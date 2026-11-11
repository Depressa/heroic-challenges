import { test } from "node:test";
import assert from "node:assert/strict";
import { cardControls, isPendingClaim, isPendingReward } from "../scripts/controls.mjs";

const gm = { id: "gm", isGM: true };
const anna = { id: "anna", isGM: false };
const boris = { id: "boris", isGM: false };
const base = { playerClaims: true, playerParticipates: false, epic: false };

test("заявка: кнопки «Принять» и «Отклонить» только у Мастера, варианты не нажимаются", () => {
  const flags = { kind: "claim", state: { status: "pending" } };
  assert.deepEqual(cardControls(flags, gm, base).hidden, []);
  assert.deepEqual(cardControls(flags, anna, base).hidden, ["accept", "decline"]);
  assert.equal(cardControls(flags, gm, base).clickKind, null);
});

test("награда: выбор у Мастера и у получателя по настройке; «другая награда» и «изменить» только у Мастера", () => {
  const pending = { kind: "reward", recipient: "anna", state: { status: "pending" } };
  assert.deepEqual(cardControls(pending, gm, base).hidden, []);
  assert.equal(cardControls(pending, gm, base).clickKind, "choose");
  assert.equal(cardControls(pending, gm, base).titleKey, "HEROIC.Click.Choose");

  const annaOff = cardControls(pending, anna, base);
  assert.deepEqual(annaOff.hidden, ["choose", "decline", "reroll", "revise"]);
  assert.equal(annaOff.clickKind, null);

  const annaOn = cardControls(pending, anna, { ...base, playerParticipates: true });
  assert.deepEqual(annaOn.hidden, ["reroll", "revise"]);
  assert.equal(annaOn.clickKind, "choose");

  assert.equal(cardControls(pending, boris, { ...base, playerParticipates: true }).clickKind, null);

  const chosen = { ...pending, state: { status: "chosen", choice: 0 } };
  assert.equal(cardControls(chosen, gm, base).clickKind, null);
});

test("вызов: варианты нажимаются у владельца и Мастера; при эпической сложности значение «all»", () => {
  const flags = { kind: "challenge", owner: "anna" };
  const own = cardControls(flags, anna, base);
  assert.equal(own.clickKind, "claim");
  assert.equal(own.titleKey, "HEROIC.Click.Claim");
  assert.equal(own.optionValue(1), 1);
  assert.equal(cardControls(flags, boris, base).clickKind, null);
  assert.equal(cardControls(flags, anna, { ...base, playerClaims: false }).clickKind, null);
  assert.equal(cardControls(flags, gm, { ...base, playerClaims: false }).clickKind, "claim");

  const epic = cardControls(flags, anna, { ...base, epic: true });
  assert.equal(epic.titleKey, "HEROIC.Click.ClaimAll");
  assert.equal(epic.optionValue(1), "all");
  // Эпическая сложность не меняет значение у наград.
  assert.equal(cardControls({ kind: "reward", recipient: "gm", state: { status: "pending" } }, gm, { ...base, epic: true }).optionValue(1), 1);
});

test("ожидающие заявки и награды распознаются по флагам", () => {
  assert.ok(isPendingClaim({ kind: "claim", state: { status: "pending" } }));
  assert.ok(!isPendingClaim({ kind: "claim", state: { status: "accepted" } }));
  assert.ok(!isPendingClaim({ kind: "reward", state: { status: "pending" } }));
  assert.ok(!isPendingClaim(undefined));
  assert.ok(isPendingReward({ kind: "reward", state: { status: "pending" } }));
  assert.ok(!isPendingReward({ kind: "reward", state: { status: "chosen" } }));
});
