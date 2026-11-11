import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRewardItemData, excerpt, wantsItem } from "../scripts/reward-item.mjs";

const labels = { prefix: "Награда", use: "Использовать", source: "Награда · Основной набор, № 3" };

test("выдержка: разметка убирается, длинный текст обрезается по слову", () => {
  assert.equal(excerpt("Перебросьте проваленную проверку {Ловкости} или {слуха}."), "Перебросьте проваленную проверку Ловкости или слуха");
  const long = excerpt("Автоматически преуспейте в проверке {Харизмы} или {проворства} и ещё что-нибудь очень длинное", 30);
  assert.ok(long.endsWith("…"));
  assert.ok(long.length <= 31);
});

test("предметы за награды: игровые, все, не выдавать", () => {
  assert.ok(wantsItem("play", "play"));
  assert.ok(!wantsItem("play", "story"));
  assert.ok(wantsItem("all", "story"));
  assert.ok(!wantsItem("none", "play"));
});

test("предмет-награда: расходуемый, одно использование, исчезает после расхода", () => {
  const data = buildRewardItemData({ cardId: "core-r-03", optionIndex: 1, text: "Перебросьте проваленную проверку {Ловкости} или {слуха}", labels });
  assert.equal(data.type, "consumable");
  assert.equal(data.name, "Награда: Перебросьте проваленную проверку Ловкости или слуха");
  assert.deepEqual(data.system.uses, { max: "1", spent: 0, recovery: [], autoDestroy: true });
  const [activity] = Object.values(data.system.activities);
  assert.equal(activity.type, "utility");
  assert.equal(activity._id.length, 16);
  assert.match(activity._id, /^[A-Za-z0-9]{16}$/);
  assert.deepEqual(activity.consumption.targets, [{ type: "itemUses", target: "", value: "1" }]);
  assert.equal(data.flags["heroic-challenges"].cardId, "core-r-03");
  assert.equal(data.flags["heroic-challenges"].optionIndex, 1);
});

test("предмет-награда: описание безопасно и содержит подсказку об источнике и текст для чата", () => {
  const data = buildRewardItemData({ cardId: "x", optionIndex: 0, text: "<b>Вы</b> получаете {зелье}", labels });
  assert.ok(!data.system.description.value.includes("<b>"));
  assert.ok(data.system.description.value.includes("<em class=\"hc-pick\">зелье</em>"));
  assert.ok(data.system.description.value.includes(labels.source));
  assert.equal(data.system.description.chat, data.system.description.value);
  assert.ok(Object.values(data.system.activities)[0].description.chatFlavor.includes("&lt;b&gt;"));
});
