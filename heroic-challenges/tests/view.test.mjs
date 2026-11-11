import { test } from "node:test";
import assert from "node:assert/strict";
import { TABLE, dealChallenge, emptyState } from "../scripts/deck.mjs";
import { faceView, handsView } from "../scripts/view.mjs";

const card = {
  id: "c1", kind: "challenge", number: 4, set: "core", setTitle: "Основной набор",
  options: [{ ru: "{Убить} или {напугать} врага" }, { ru: "Спасти <друга>" }],
  quote: { ru: "Цитата" }
};
const reward = { ...card, id: "r1", kind: "reward", quote: undefined };
const library = new Map([["c1", card], ["r1", reward]]);
const labels = { kind: "Вызов" };

const users = [
  { id: "gm", name: "Мастер", isGM: true },
  { id: "anna", name: "Анна", isGM: false },
  { id: "boris", name: "Борис", isGM: false }
];
const baseSettings = {
  drawMode: "player", handSize: 1, handVisibility: "all", epic: false, swapPolicy: "gm", playerParticipates: false, playerClaims: true
};
// Как в окне: лицо карты со щелчками по вариантам.
const face = (c, clicks) => faceView(c, labels, null, clicks);

/** Состояние, где у Анны есть карта c1. */
function stateWithAnna() {
  const ids = ["c1"];
  const base = { ...emptyState(), decks: { challenge: ids, reward: [] } };
  return dealChallenge(base, "anna", { limit: 1, uid: () => "e1" }).state;
}

test("лицо карты: подсветка слов, экранирование, выбранные и невыбранные варианты", () => {
  const view = faceView(card, labels, [1]);
  assert.equal(view.options[0].html, "<em class=\"hc-pick\">Убить</em> или <em class=\"hc-pick\">напугать</em> врага");
  assert.equal(view.options[1].html, "Спасти &lt;друга&gt;");
  assert.deepEqual(view.options.map(o => [o.chosen, o.dimmed]), [[false, true], [true, false]]);
  assert.equal(view.quote, "Цитата");
  assert.equal(view.kind, "challenge");
  assert.equal(view.set, "core");
  assert.equal(view.setTitle, "Основной набор");
  assert.equal(view.kindLabel, "Вызов");
  assert.deepEqual(view.options.map(o => o.click), [null, null]);
  assert.equal(faceView(reward, labels).quote, "");
  assert.deepEqual(faceView(card, labels).options.map(o => [o.chosen, o.dimmed]), [[false, false], [false, false]]);
});

test("окно игрока: только его рука, кнопки по настройкам", () => {
  const hands = handsView({ state: stateWithAnna(), library, user: users[1], users, settings: baseSettings, face });
  assert.equal(hands.length, 1);
  const [hand] = hands;
  assert.equal(hand.owner, "anna");
  assert.ok(hand.mine);
  assert.equal(hand.cards.length, 1);
  const [entry] = hand.cards;
  assert.ok(entry.canClaim);
  assert.ok(!entry.canSwap);
  assert.ok(!entry.canDiscard);
  assert.ok(!entry.canTransfer);
  assert.deepEqual(entry.claimOptions.map(o => o.option), [0, 1]);
  assert.equal(entry.canManage, false);
  assert.ok(!hand.canDraw);
});

test("окно Мастера: руки всех игроков, Мастер может замещать, передавать и раздавать пустым рукам", () => {
  const hands = handsView({ state: stateWithAnna(), library, user: users[0], users, settings: baseSettings, face });
  assert.deepEqual(hands.map(h => h.owner), ["anna", "boris"]);
  assert.ok(hands[0].cards[0].canSwap && hands[0].cards[0].canTransfer && hands[0].cards[0].canDiscard);
  assert.equal(hands[0].cards[0].canManage, true);
  assert.ok(hands[1].empty && hands[1].canDraw);
});

test("скрытая рука: Мастер видит рубашку, владелец карту", () => {
  const settings = { ...baseSettings, handVisibility: "secret" };
  const seenByGM = handsView({ state: stateWithAnna(), library, user: users[0], users, settings, face });
  assert.ok(seenByGM[0].cards[0].hidden);
  assert.equal(seenByGM[0].cards[0].face, null);
  const seenByAnna = handsView({ state: stateWithAnna(), library, user: users[1], users, settings, face });
  assert.ok(!seenByAnna[0].cards[0].hidden);
});

test("эпическая сложность: одна кнопка «выполнено всё», щелчок по любому варианту заявляет всё", () => {
  const hands = handsView({ state: stateWithAnna(), library, user: users[1], users, settings: { ...baseSettings, epic: true }, face });
  assert.deepEqual(hands[0].cards[0].claimOptions, [{ owner: "anna", uid: "e1", option: "all", all: true }]);
  assert.deepEqual(hands[0].cards[0].face.options.map(o => o.click), [
    { kind: "claim", owner: "anna", uid: "e1", option: "all", titleKey: "HEROIC.Click.ClaimAll" },
    { kind: "claim", owner: "anna", uid: "e1", option: "all", titleKey: "HEROIC.Click.ClaimAll" }
  ]);
});

test("щелчки по вариантам в окне: те же данные, что у карточки в чате (cardControls)", () => {
  const hands = handsView({ state: stateWithAnna(), library, user: users[1], users, settings: baseSettings, face });
  assert.deepEqual(hands[0].cards[0].face.options.map(o => o.click), [
    { kind: "claim", owner: "anna", uid: "e1", option: 0, titleKey: "HEROIC.Click.Claim" },
    { kind: "claim", owner: "anna", uid: "e1", option: 1, titleKey: "HEROIC.Click.Claim" }
  ]);
  // Чужая рука у Мастера нажимается, у другого игрока нет; без права заявлять нет и щелчков.
  const asGM = handsView({ state: stateWithAnna(), library, user: users[0], users, settings: baseSettings, face });
  assert.equal(asGM[0].cards[0].face.options[0].click.kind, "claim");
  const noClaims = handsView({ state: stateWithAnna(), library, user: users[1], users, settings: { ...baseSettings, playerClaims: false }, face });
  assert.deepEqual(noClaims[0].cards[0].face.options.map(o => o.click), [null, null]);
  assert.ok(!noClaims[0].cards[0].canClaim);
});

test("групповой режим: общий вызов на столе, у игрока своей руки нет", () => {
  const base = { ...emptyState(), decks: { challenge: ["c1"], reward: [] } };
  const state = dealChallenge(base, TABLE, { limit: 1, uid: () => "t1" }).state;
  const settings = { ...baseSettings, drawMode: "group" };
  const asPlayer = handsView({ state, library, user: users[1], users, settings, face });
  assert.deepEqual(asPlayer.map(h => h.owner), [TABLE]);
  assert.ok(asPlayer[0].isTable);
  assert.ok(asPlayer[0].cards[0].canClaim);
  const asGM = handsView({ state, library, user: users[0], users, settings, face });
  assert.deepEqual(asGM.map(h => h.owner), [TABLE, "anna", "boris"]);
  assert.ok(!asGM[0].cards[0].canTransfer);
  // Общий вызов раздаётся кнопкой «Раздать вызовы»: у пустого стола отдельной кнопки нет.
  const emptyTable = handsView({ state: emptyState(), library, user: users[0], users, settings, face });
  assert.ok(emptyTable[0].isTable && emptyTable[0].empty && !emptyTable[0].canDraw);
  assert.ok(emptyTable[1].canDraw);
});

test("карта, которой нет в данных, в окне не показывается", () => {
  const state = stateWithAnna();
  const hands = handsView({ state, library: new Map(), user: users[1], users, settings: baseSettings, face });
  assert.equal(hands[0].cards.length, 0);
});

test("заявленный вызов нельзя заявить снова; у скрытой карты кнопок заявки нет", () => {
  const pendingHands = handsView({ state: stateWithAnna(), library, user: users[1], users, settings: baseSettings, face, pendingUids: ["e1"] });
  assert.ok(pendingHands[0].cards[0].claimPending);
  assert.ok(!pendingHands[0].cards[0].canClaim);
  assert.equal(pendingHands[0].cards[0].face.options[0].click, null);

  const secret = { ...baseSettings, handVisibility: "secret" };
  const gmHands = handsView({ state: stateWithAnna(), library, user: users[0], users, settings: secret, face });
  assert.ok(gmHands[0].cards[0].hidden);
  assert.ok(!gmHands[0].cards[0].canClaim);
  assert.ok(gmHands[0].cards[0].canSwap);
});
