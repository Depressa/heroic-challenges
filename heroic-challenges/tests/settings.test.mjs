import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { SETTING_DEFS, SETTING_GROUPS, labelPath } from "../scripts/settings-defs.mjs";

const lang = JSON.parse(readFileSync(new URL("../lang/ru.json", import.meta.url), "utf8"));

/** Значение по пути вида `HEROIC.Settings.drawMode.Player` в файле локализации. */
const resolve = path => path.split(".").reduce((node, part) => node?.[part], lang);

test("настройки: ключи уникальны, группы существуют, значения по умолчанию допустимы", () => {
  const keys = SETTING_DEFS.map(def => def.key);
  assert.equal(new Set(keys).size, keys.length);

  for ( const def of SETTING_DEFS ) {
    assert.ok(SETTING_GROUPS.includes(def.group), `${def.key}: группа ${def.group}`);
    if ( def.kind === "boolean" ) {
      assert.equal(typeof def.default, "boolean", def.key);
    } else {
      assert.equal(def.kind, "choice", def.key);
      assert.ok(def.choices?.length >= 2, def.key);
      assert.ok(def.choices.some(choice => String(choice.value) === String(def.default)), `${def.key}: значение по умолчанию`);
      if ( def.numeric ) assert.ok(def.choices.every(choice => typeof choice.value === "number"), def.key);
    }
  }
  for ( const group of SETTING_GROUPS ) assert.ok(SETTING_DEFS.some(def => def.group === group), group);
});

test("настройки: у каждой есть название, пояснение и подписи значений; у групп заголовки", () => {
  for ( const def of SETTING_DEFS ) {
    assert.ok(resolve(`HEROIC.${labelPath(def.key)}.Name`), `${def.key}: название`);
    assert.equal(typeof resolve(`HEROIC.${labelPath(def.key)}.Hint`), "string", `${def.key}: пояснение`);
    for ( const choice of def.choices ?? [] ) assert.ok(resolve(choice.label), `${def.key}: ${choice.label}`);
  }
  for ( const group of SETTING_GROUPS ) {
    assert.ok(resolve(`HEROIC.Settings.Group.${group}.Title`), `группа ${group}`);
    assert.equal(typeof resolve(`HEROIC.Settings.Group.${group}.Hint`), "string", `группа ${group}`);
  }
});

test("локализация: все ключи HEROIC.*, упомянутые в скриптах и шаблонах, существуют", () => {
  const files = [
    ...readdirSync(new URL("../scripts/", import.meta.url)).map(name => `../scripts/${name}`),
    ...readdirSync(new URL("../templates/", import.meta.url)).map(name => `../templates/${name}`)
  ];
  const missing = [];
  for ( const file of files ) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    // Полные ключи в виде "HEROIC.Что.То" в строках и шаблонах.
    for ( const [, key] of source.matchAll(/HEROIC\.([A-Za-z0-9_.]+[A-Za-z0-9])/g) ) {
      if ( resolve(`HEROIC.${key}`) === undefined ) missing.push(`${file}: HEROIC.${key}`);
    }
    // Короткие ключи в вызовах t("Ключ") и t(`Ключ`) (без подстановок) и в предупреждениях notice("Ключ").
    for ( const [, key] of source.matchAll(/\b(?:t|notice)\(["`]([A-Za-z0-9_.]+)["`]/g) ) {
      if ( resolve(`HEROIC.${key}`) === undefined ) missing.push(`${file}: "${key}"`);
    }
  }
  assert.deepEqual(missing, []);
});

test("локализация: ключи, собираемые из значений на лету, существуют", () => {
  const need = [
    ...["player", "group", "theme", "transfer"].map(mode => `Chat.Challenge.${mode}`),
    ...["accepted", "declined"].map(status => `Chat.Claim.${status}`),
    ...["chosen", "declined"].map(status => `Chat.Reward.${status}`),
    ...["challenge", "reward"].map(kind => `Kind.${kind}`),
    ...["Story", "NoActor", "Failed", "Used"].map(note => `Chat.Item.${note}`),
    ...["accept", "decline", "declineReward", "choose", "reroll", "revise"].map(action => `Button.${action}`),
    ...["group", "theme"].map(mode => `Window.Table.${mode}`),
    ...["Claim", "ClaimAll", "Choose"].map(click => `Click.${click}`)
  ];
  for ( const key of need ) assert.ok(resolve(`HEROIC.${key}`), key);
});

test("модуль: module.json согласован с системой и версией Foundry", () => {
  const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
  assert.equal(manifest.id, "heroic-challenges");
  assert.equal(manifest.compatibility.minimum, "14");
  assert.deepEqual(manifest.relationships.systems.map(system => [system.id, system.compatibility.minimum]), [["dnd5e", "5.3.0"]]);
  assert.ok(!JSON.stringify(manifest).includes("critical-rolls"));
  for ( const path of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(language => language.path)] ) {
    assert.doesNotThrow(() => readFileSync(new URL(`../${path}`, import.meta.url)), path);
  }
});
