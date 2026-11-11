import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expandDone, initialRewardState, nextClaimState, nextRewardState, rewardButtons, rewardsFor, validateDone
} from "../scripts/flow.mjs";

test("заявка: в обычной игре ровно один вариант", () => {
  assert.deepEqual(validateDone({ epic: false, optionCount: 2, done: [1] }), [1]);
  assert.equal(validateDone({ epic: false, optionCount: 2, done: [0, 1] }), null);
  assert.equal(validateDone({ epic: false, optionCount: 2, done: [] }), null);
  assert.equal(validateDone({ epic: false, optionCount: 2, done: [2] }), null);
  assert.equal(validateDone({ epic: false, optionCount: 2, done: [-1] }), null);
  assert.equal(validateDone({ epic: false, optionCount: 2, done: ["1"] }), null);
  assert.equal(validateDone({ epic: false, optionCount: 2, done: "1" }), null);
});

test("заявка: при эпической сложности нужны все варианты", () => {
  assert.deepEqual(validateDone({ epic: true, optionCount: 2, done: [1, 0] }), [0, 1]);
  assert.deepEqual(validateDone({ epic: true, optionCount: 2, done: [0, 1, 1] }), [0, 1]);
  assert.equal(validateDone({ epic: true, optionCount: 2, done: [0] }), null);
});

test("награды: по одной за каждый выполненный вариант", () => {
  assert.equal(rewardsFor([0]), 1);
  assert.equal(rewardsFor([0, 1]), 2);
});

test("решение по заявке: только из ожидания", () => {
  assert.deepEqual(nextClaimState({ status: "pending" }, "accept"), { status: "accepted" });
  assert.deepEqual(nextClaimState({ status: "pending" }, "decline"), { status: "declined" });
  assert.equal(nextClaimState({ status: "accepted" }, "decline"), null);
  assert.equal(nextClaimState({ status: "pending" }, "что-то"), null);
});

test("награда: выбор результата, отказ, другая награда", () => {
  const start = initialRewardState();
  assert.deepEqual(nextRewardState(start, "choose", { value: "1", count: 2 }), { status: "chosen", choice: 1, rerolls: 0 });
  assert.equal(nextRewardState(start, "choose", { value: 2, count: 2 }), null);
  assert.equal(nextRewardState(start, "choose", { value: "x", count: 2 }), null);
  assert.deepEqual(nextRewardState(start, "decline", { count: 2 }), { status: "declined", choice: null, rerolls: 0 });
  assert.deepEqual(nextRewardState(start, "reroll", { count: 2 }), { status: "pending", choice: null, rerolls: 1 });
});

test("награда: решение меняет только Мастер, и «другую награду» после решения взять нельзя", () => {
  const chosen = { status: "chosen", choice: 0, rerolls: 1 };
  assert.equal(nextRewardState(chosen, "choose", { value: 1, count: 2 }), null);
  assert.deepEqual(nextRewardState(chosen, "choose", { value: 1, count: 2, revise: true }), { status: "chosen", choice: 1, rerolls: 1 });
  assert.deepEqual(nextRewardState(chosen, "decline", { count: 2, revise: true }).status, "declined");
  assert.equal(nextRewardState(chosen, "reroll", { count: 2, revise: true }), null);
});

test("кнопки награды: до решения выбор, другая награда и отказ; после решения только «изменить»", () => {
  assert.deepEqual(rewardButtons(initialRewardState(), 2), [
    { action: "choose", value: 0 }, { action: "choose", value: 1 }, { action: "reroll" }, { action: "decline" }
  ]);
  assert.deepEqual(rewardButtons({ status: "chosen", choice: 0, rerolls: 0 }, 2), [{ action: "revise" }]);
});

test("expandDone: «all» разворачивается по числу вариантов карты, списки проходят как есть", () => {
  assert.deepEqual(expandDone("all", 2), [0, 1]);
  assert.deepEqual(expandDone("all", 3), [0, 1, 2]);
  assert.deepEqual(expandDone([1], 2), [1]);
  assert.equal(expandDone("что-то", 2), "что-то");
  assert.deepEqual(validateDone({ epic: true, optionCount: 2, done: expandDone("all", 2) }), [0, 1]);
});
