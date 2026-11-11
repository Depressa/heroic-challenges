import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TABLE, awardClaim, clearOwner, counts, dealChallenge, dealMany, discardEntry, draw, drawReward, emptyState, entriesOf,
  reconcilePending, resetState, resolveReward, shuffle, swapEntry, syncDecks, transferEntry
} from "../scripts/deck.mjs";

/** Детерминированный генератор. */
function seeded(seed=1) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

/** Счётчик для идентификаторов записей. */
function uids() {
  let n = 0;
  return () => `u${++n}`;
}

const ids = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const wanted = (c=6, r=4) => ({ challenge: ids("c", c), reward: ids("r", r) });

/** Все карты вызовов в состоянии (колода, сброс, руки, стол): без потерь и повторов. */
function allChallenges(state) {
  return [...state.decks.challenge, ...state.discards.challenge, ...state.table.map(e => e.id), ...Object.values(state.hands).flat().map(e => e.id)];
}

test("тасование: не теряет и не повторяет карты, исходный список не меняется", () => {
  const source = ids("c", 20);
  const copy = [...source];
  const result = shuffle(source, seeded(7));
  assert.deepEqual(source, copy);
  assert.deepEqual([...result].sort(), [...source].sort());
  assert.notDeepEqual(result, source);
});

test("сборка колод: карты перемешаны, руки и сброс пусты", () => {
  const state = resetState(wanted(), seeded());
  assert.equal(state.decks.challenge.length, 6);
  assert.equal(state.decks.reward.length, 4);
  assert.deepEqual(state.hands, {});
  assert.deepEqual(state.table, []);
});

test("добор: верхняя карта уходит, пустая колода перемешивает сброс, совсем пустая даёт null", () => {
  let state = { ...emptyState(), decks: { challenge: ["a", "b"], reward: [] }, discards: { challenge: ["x", "y"], reward: [] } };
  let result = draw(state, "challenge", seeded());
  assert.equal(result.id, "a");
  assert.deepEqual(result.state.decks.challenge, ["b"]);
  state = result.state;
  result = draw(state, "challenge", seeded());
  assert.equal(result.id, "b");
  result = draw(result.state, "challenge", seeded());
  assert.ok(result.reshuffled);
  assert.ok(["x", "y"].includes(result.id));
  assert.equal(result.state.discards.challenge.length, 0);
  assert.equal(result.state.decks.challenge.length, 1);
  assert.equal(draw(emptyState(), "reward").id, null);
});

test("раздача: рука добирается до нужного размера и не больше", () => {
  const state = resetState(wanted(), seeded());
  const dealt = dealChallenge(state, "u1", { limit: 2, rng: seeded(), uid: uids() });
  assert.equal(dealt.added.length, 2);
  assert.equal(entriesOf(dealt.state, "u1").length, 2);
  const again = dealChallenge(dealt.state, "u1", { limit: 2, rng: seeded(), uid: uids() });
  assert.equal(again.added.length, 0);
  assert.equal(allChallenges(dealt.state).length, 6);
});

test("раздача: когда карт не хватает, раздаётся сколько есть", () => {
  const state = resetState(wanted(2, 1), seeded());
  const first = dealChallenge(state, "u1", { limit: 2, rng: seeded(), uid: uids() });
  const second = dealChallenge(first.state, "u2", { limit: 1, rng: seeded(), uid: uids() });
  assert.equal(first.added.length, 2);
  assert.equal(second.added.length, 0);
});

test("раздача: общий вызов лежит на столе", () => {
  const state = resetState(wanted(), seeded());
  const dealt = dealChallenge(state, TABLE, { limit: 1, rng: seeded(), uid: uids() });
  assert.equal(dealt.state.table.length, 1);
  assert.deepEqual(dealt.state.hands, {});
});

test("сброс вызова: карта уходит наверх сброса, запись исчезает, пустая рука убирается", () => {
  const state = dealChallenge(resetState(wanted(), seeded()), "u1", { limit: 1, rng: seeded(), uid: () => "e1" }).state;
  const { state: next, entry } = discardEntry(state, "u1", "e1");
  assert.equal(next.discards.challenge[0], entry.id);
  assert.equal("u1" in next.hands, false);
  assert.equal(discardEntry(next, "u1", "e1").entry, null);
});

test("замена вызова: новая карта вместо старой, старая в сброс; без карт ничего не меняется", () => {
  const dealt = dealChallenge(resetState(wanted(), seeded()), "u1", { limit: 1, rng: seeded(), uid: () => "e1" });
  const old = dealt.added[0].id;
  const swapped = swapEntry(dealt.state, "u1", "e1", { rng: seeded(), uid: () => "e2" });
  assert.equal(swapped.entry.uid, "e2");
  assert.notEqual(swapped.entry.id, old);
  assert.equal(swapped.state.discards.challenge[0], old);
  assert.equal(entriesOf(swapped.state, "u1").length, 1);

  const small = dealChallenge(resetState(wanted(1, 1), seeded()), "u1", { limit: 1, rng: seeded(), uid: () => "e1" });
  const none = swapEntry(small.state, "u1", "e1", { rng: seeded() });
  assert.equal(none.entry, null);
  assert.equal(none.state, small.state);
});

test("передача вызова: уходит от одного к другому, у полной руки отказ", () => {
  let state = resetState(wanted(), seeded());
  state = dealChallenge(state, "u1", { limit: 1, rng: seeded(), uid: () => "e1" }).state;
  state = dealChallenge(state, "u2", { limit: 1, rng: seeded(), uid: () => "e2" }).state;
  assert.equal(transferEntry(state, "u1", "e1", "u2", 1), null);
  const moved = transferEntry(state, "u1", "e1", "u2", 2);
  assert.equal(entriesOf(moved, "u1").length, 0);
  assert.equal(entriesOf(moved, "u2").length, 2);
  assert.equal(transferEntry(state, "u1", "e1", "u1", 5), null);
  assert.equal(transferEntry(state, "u1", "нет", "u2", 5), null);
});

test("награда: добранная карта ждёт решения и после решения уходит в сброс", () => {
  let state = resetState(wanted(), seeded());
  const drawn = drawReward(state, seeded());
  assert.equal(drawn.state.pending.length, 1);
  assert.equal(counts(drawn.state).reward.deck, 3);
  state = resolveReward(drawn.state, drawn.id);
  assert.deepEqual(state.pending, []);
  assert.deepEqual(state.discards.reward, [drawn.id]);
  assert.equal(resolveReward(state, "нет"), state);
});

test("пересборка по наборам: лишние карты уходят, новые замешиваются, то, что в руках и в ожидании, не дублируется", () => {
  let state = resetState(wanted(4, 2), seeded());
  state = dealChallenge(state, "u1", { limit: 1, rng: seeded(), uid: () => "e1" }).state;
  const held = entriesOf(state, "u1")[0].id;
  const reward = drawReward(state, seeded());
  state = reward.state;

  const bigger = syncDecks(state, wanted(6, 4), seeded());
  assert.equal(new Set(allChallenges(bigger)).size, 6);
  assert.equal(allChallenges(bigger).length, 6);
  const rewardsEverywhere = [...bigger.decks.reward, ...bigger.discards.reward, ...bigger.pending];
  assert.equal(new Set(rewardsEverywhere).size, 4);

  // набор отключён: его карты уходят из колоды, но уже розданная остаётся у игрока
  const smaller = syncDecks(bigger, { challenge: ["c1", "c2"], reward: ["r1"] }, seeded());
  assert.ok(smaller.decks.challenge.every(id => ["c1", "c2"].includes(id)));
  assert.equal(entriesOf(smaller, "u1")[0].id, held);
});

test("игрок удалён: его карты уходят в сброс", () => {
  let state = dealChallenge(resetState(wanted(), seeded()), "u1", { limit: 2, rng: seeded(), uid: uids() }).state;
  state = clearOwner(state, "u1");
  assert.equal(entriesOf(state, "u1").length, 0);
  assert.equal(state.discards.challenge.length, 2);
  assert.equal(allChallenges(state).length, 6);
});

test("устойчивость: случайные действия не теряют и не повторяют карты", () => {
  const rng = seeded(42);
  const next = uids();
  let state = resetState(wanted(12, 8), rng);
  const players = ["u1", "u2", "u3"];
  for ( let i = 0; i < 400; i++ ) {
    const owner = players[Math.floor(rng() * players.length)];
    const roll = rng();
    if ( roll < 0.35 ) state = dealChallenge(state, owner, { limit: 2, rng, uid: next }).state;
    else if ( roll < 0.55 ) {
      const entry = entriesOf(state, owner)[0];
      if ( entry ) state = discardEntry(state, owner, entry.uid).state;
    } else if ( roll < 0.7 ) {
      const entry = entriesOf(state, owner)[0];
      if ( entry ) state = swapEntry(state, owner, entry.uid, { rng, uid: next }).state;
    } else if ( roll < 0.8 ) {
      const entry = entriesOf(state, owner)[0];
      const to = players[(players.indexOf(owner) + 1) % players.length];
      if ( entry ) state = transferEntry(state, owner, entry.uid, to, 2) ?? state;
    } else if ( roll < 0.9 ) {
      const drawn = drawReward(state, rng);
      state = drawn.state;
      if ( drawn.id && (rng() < 0.7) ) state = resolveReward(state, drawn.id);
    }
    assert.equal(allChallenges(state).length, 12, `шаг ${i}`);
    assert.equal(new Set(allChallenges(state)).size, 12, `шаг ${i}`);
    const rewards = [...state.decks.reward, ...state.discards.reward, ...state.pending];
    assert.equal(new Set(rewards).size, 8, `шаг ${i}`);
    assert.equal(rewards.length, 8, `шаг ${i}`);
  }
});

test("счётчики: сколько карт в колодах и сбросе", () => {
  const state = resetState(wanted(), seeded());
  assert.deepEqual(counts(state), { challenge: { deck: 6, discard: 0 }, reward: { deck: 4, discard: 0, pending: 0 } });
});

test("dealMany: несколько владельцев одним изменением; нехватка карт отмечается", () => {
  const state = resetState(wanted(3, 1), seeded());
  const dealt = dealMany(state, ["u1", "u2"], () => 2, { rng: seeded(), uid: uids() });
  assert.deepEqual(dealt.perOwner.map(item => [item.owner, item.added.length]), [["u1", 2], ["u2", 1]]);
  assert.ok(dealt.exhausted);
  assert.equal(allChallenges(dealt.state).length, 3);
  const again = dealMany(dealt.state, ["u1"], () => 2, { rng: seeded(), uid: uids() });
  assert.deepEqual(again.perOwner, []);
});

test("awardClaim: вызов в сброс, награды получателям; без вызова отказ; при нехватке наград short", () => {
  let state = dealChallenge(resetState(wanted(4, 3), seeded()), "u1", { limit: 1, rng: seeded(), uid: () => "e1" }).state;
  const awarded = awardClaim(state, { owner: "u1", uid: "e1", recipients: ["u1", "u2"], count: 1 }, seeded());
  assert.ok(awarded.ok && !awarded.short);
  assert.deepEqual(awarded.rewards.map(r => r.recipient), ["u1", "u2"]);
  assert.equal(awarded.state.pending.length, 2);
  assert.equal(entriesOf(awarded.state, "u1").length, 0);
  assert.equal(awarded.state.discards.challenge.length, 1);

  const gone = awardClaim(awarded.state, { owner: "u1", uid: "e1", recipients: ["u1"], count: 1 }, seeded());
  assert.ok(!gone.ok);
  assert.equal(gone.state, awarded.state);

  state = dealChallenge(awarded.state, "u2", { limit: 1, rng: seeded(), uid: () => "e2" }).state;
  const short = awardClaim(state, { owner: "u2", uid: "e2", recipients: ["u2"], count: 2 }, seeded());
  assert.ok(short.ok && short.short);
  assert.equal(short.rewards.length, 1);
});

test("reconcilePending: награды без карточки уходят в сброс, остальные ждут", () => {
  let state = resetState(wanted(2, 3), seeded());
  const a = drawReward(state, seeded());
  const b = drawReward(a.state, seeded());
  state = b.state;
  const { state: next, lost } = reconcilePending(state, [b.id]);
  assert.deepEqual(lost, [a.id]);
  assert.deepEqual(next.pending, [b.id]);
  assert.deepEqual(next.discards.reward, [a.id]);
  assert.deepEqual(reconcilePending(next, [b.id]).lost, []);
});

test("entriesOf: чужие свойства объекта рукой не считаются", () => {
  const state = resetState(wanted(), seeded());
  assert.deepEqual(entriesOf(state, "__proto__"), []);
  assert.deepEqual(entriesOf(state, "constructor"), []);
});
