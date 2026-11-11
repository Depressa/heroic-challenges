import { test } from "node:test";
import assert from "node:assert/strict";
import { TABLE } from "../scripts/deck.mjs";
import {
  canClaim, canDecideReward, canDiscard, canDraw, canSeeHand, canSwap, dealRecipients, ownsHand, whisperTargets
} from "../scripts/permissions.mjs";

const gm = { id: "gm", isGM: true };
const anna = { id: "anna", isGM: false };
const boris = { id: "boris", isGM: false };

test("рука: свою держит игрок, общий вызов доступен любому игроку, но не Мастеру как владельцу", () => {
  assert.ok(ownsHand(anna, "anna"));
  assert.ok(!ownsHand(anna, "boris"));
  assert.ok(ownsHand(anna, TABLE));
  assert.ok(!ownsHand(gm, TABLE));
});

test("взять вызов: Мастер всегда, игрок только себе и по настройке; общий вызов тянет Мастер", () => {
  assert.ok(canDraw(gm, "anna", { playerParticipates: false }));
  assert.ok(!canDraw(anna, "anna", { playerParticipates: false }));
  assert.ok(canDraw(anna, "anna", { playerParticipates: true }));
  assert.ok(!canDraw(anna, "boris", { playerParticipates: true }));
  assert.ok(!canDraw(anna, TABLE, { playerParticipates: true }));
  assert.ok(canDraw(gm, TABLE, { playerParticipates: false }));
});

test("замена вызова зависит от настройки", () => {
  assert.ok(!canSwap(gm, "anna", { swapPolicy: "none" }));
  assert.ok(canSwap(gm, "anna", { swapPolicy: "gm" }));
  assert.ok(!canSwap(anna, "anna", { swapPolicy: "gm" }));
  assert.ok(canSwap(anna, "anna", { swapPolicy: "owner" }));
  assert.ok(!canSwap(anna, "boris", { swapPolicy: "owner" }));
});

test("отказ от вызова и заявка выполнения", () => {
  assert.ok(canDiscard(gm, "anna", { playerParticipates: false }));
  assert.ok(!canDiscard(anna, "anna", { playerParticipates: false }));
  assert.ok(canDiscard(anna, "anna", { playerParticipates: true }));
  assert.ok(canClaim(anna, "anna", { playerClaims: true }));
  assert.ok(!canClaim(anna, "anna", { playerClaims: false }));
  assert.ok(canClaim(gm, "anna", { playerClaims: false }));
  assert.ok(!canClaim(boris, "anna", { playerClaims: true }));
  assert.ok(canClaim(boris, TABLE, { playerClaims: true }));
});

test("выбор результата награды: Мастер всегда, получатель по настройке", () => {
  assert.ok(canDecideReward(gm, "anna", { playerParticipates: false }));
  assert.ok(!canDecideReward(anna, "anna", { playerParticipates: false }));
  assert.ok(canDecideReward(anna, "anna", { playerParticipates: true }));
  assert.ok(!canDecideReward(boris, "anna", { playerParticipates: true }));
});

test("видимость руки: все, владелец и Мастер, только владелец; общий вызов виден всем", () => {
  assert.ok(canSeeHand(boris, "anna", "all"));
  assert.ok(canSeeHand(gm, "anna", "owner"));
  assert.ok(!canSeeHand(boris, "anna", "owner"));
  assert.ok(canSeeHand(anna, "anna", "secret"));
  assert.ok(!canSeeHand(gm, "anna", "secret"));
  assert.ok(canSeeHand(boris, TABLE, "secret"));
});

test("адресаты карточки раздачи", () => {
  assert.equal(whisperTargets("all", "anna", ["gm"]), null);
  assert.deepEqual(whisperTargets("owner", "anna", ["gm", "gm2"]), ["anna", "gm", "gm2"]);
  assert.deepEqual(whisperTargets("secret", "anna", ["gm"]), ["anna"]);
  assert.equal(whisperTargets("secret", TABLE, ["gm"]), null);
});

test("кому раздавать: только игроки, по настройке только в сети", () => {
  const users = [
    { id: "gm", isGM: true, active: true },
    { id: "anna", isGM: false, active: true },
    { id: "boris", isGM: false, active: false }
  ];
  assert.deepEqual(dealRecipients(users, "active"), ["anna"]);
  assert.deepEqual(dealRecipients(users, "all"), ["anna", "boris"]);
});

test("общий вызов меняет и сбрасывает только Мастер, даже если игрокам это разрешено для своих карт", () => {
  assert.ok(!canSwap(anna, TABLE, { swapPolicy: "owner" }));
  assert.ok(canSwap(gm, TABLE, { swapPolicy: "owner" }));
  assert.ok(!canDiscard(anna, TABLE, { playerParticipates: true }));
  assert.ok(canDiscard(gm, TABLE, { playerParticipates: false }));
  assert.ok(canClaim(anna, TABLE, { playerClaims: true }));
});
