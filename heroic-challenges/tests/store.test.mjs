import { test } from "node:test";
import assert from "node:assert/strict";

// Заглушки Foundry: настройка `state` хранится в памяти, запись занимает «один тик», как сетевой запрос.
const stored = new Map();
globalThis.foundry = { ...globalThis.foundry, utils: { deepClone: value => structuredClone(value) } };
globalThis.game = {
  settings: {
    get: (module, key) => stored.get(`${module}.${key}`),
    set: async (module, key, value) => {
      await new Promise(resolve => setTimeout(resolve, 1));
      stored.set(`${module}.${key}`, value);
      return value;
    }
  }
};

const { emptyState } = await import("../scripts/deck.mjs");
const { getState, mutate } = await import("../scripts/store.mjs");

/** Состояние с заданным списком карт в колоде вызовов. */
function stateWith(ids) {
  return { ...emptyState(), decks: { challenge: ids, reward: [] } };
}

test("getState: пустое состояние, пока ничего не сохранено; сохранённое отдаётся копией", async () => {
  stored.clear();
  assert.deepEqual(getState(), emptyState());
  await mutate(() => ({ state: stateWith(["a"]) }));
  const first = getState();
  first.decks.challenge.push("мусор");
  assert.deepEqual(getState().decks.challenge, ["a"]);
});

test("mutate: изменения выполняются по очереди, каждое видит результат предыдущего", async () => {
  stored.clear();
  const order = [];
  const results = await Promise.all([1, 2, 3].map(n => mutate(state => {
    order.push(n);
    return { state: stateWith([...state.decks.challenge, `c${n}`]), n };
  })));
  assert.deepEqual(order, [1, 2, 3]);
  assert.deepEqual(results.map(result => result.n), [1, 2, 3]);
  assert.deepEqual(getState().decks.challenge, ["c1", "c2", "c3"]);
  // Поле `state` вызывающему не возвращается.
  assert.ok(results.every(result => !("state" in result)));
});

test("mutate: ошибка одного изменения не ломает очередь и не портит состояние", async () => {
  stored.clear();
  await mutate(() => ({ state: stateWith(["a"]) }));
  const quiet = console.error;
  console.error = () => {};
  try {
    const failing = mutate(() => {
      throw new Error("сломалось");
    });
    const next = mutate(state => ({ state: stateWith([...state.decks.challenge, "b"]), ok: true }));
    await assert.rejects(failing, /сломалось/);
    assert.deepEqual(await next, { ok: true });
    assert.deepEqual(getState().decks.challenge, ["a", "b"]);
  } finally {
    console.error = quiet;
  }
});
