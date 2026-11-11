import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SETS, buildLibrary, cardText, markupToHtml } from "../scripts/cards.mjs";
import { faceView } from "../scripts/view.mjs";

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const ru = read("../lang/ru.json");
const en = read("../lang/en.json");
const moduleJson = read("../module.json");
const files = SETS.map(set => read(`../data/${set}.ru.json`));
const library = buildLibrary(files);
const cards = Array.from(library.values());

/** Плоский список `ключ → значение` для словаря локализации. */
const flat = (obj, prefix="") => Object.entries(obj).flatMap(([key, value]) => (value && (typeof value === "object"))
  ? flat(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]]);
const ruStrings = new Map(flat(ru));
const enStrings = new Map(flat(en));

const CYRILLIC = /[Ѐ-ӿ]/;
const REPLACEMENT = /�/;
const count = (text, char) => (text.match(new RegExp(`\\${char}`, "g")) ?? []).length;

test("локализация: en.json и ru.json содержат одинаковый набор ключей", () => {
  assert.deepEqual([...enStrings.keys()].sort(), [...ruStrings.keys()].sort());
});

test("локализация: плейсхолдеры ({n}, {name} и т.д.) в каждом ключе совпадают в обоих языках", () => {
  const placeholders = text => (text.match(/\{[A-Za-z]+\}/g) ?? []).sort();
  for ( const [key, value] of ruStrings ) {
    assert.deepEqual(placeholders(enStrings.get(key)), placeholders(value), key);
  }
});

test("локализация: пустые подписи (без подсказки) одинаковы в обоих языках", () => {
  for ( const [key, value] of ruStrings ) {
    assert.equal(enStrings.get(key) === "", value === "", key);
  }
});

test("локализация: в английском файле нет кириллицы, непустые подписи там же, где в русском", () => {
  for ( const [key, value] of enStrings ) {
    assert.ok(!CYRILLIC.test(value), key);
    if ( ruStrings.get(key) !== "" ) assert.ok(value.trim().length > 0, key);
  }
});

test("локализация: названия наборов (Set.*) есть в обоих языках", () => {
  for ( const set of SETS ) {
    assert.ok(ru.HEROIC.Set[set], `ru: Set.${set}`);
    assert.ok(en.HEROIC.Set[set], `en: Set.${set}`);
  }
  assert.equal(en.HEROIC.Set.core, "Core Set");
  assert.equal(ru.HEROIC.Set.core, "Основной набор");
});

test("модуль: английский язык объявлен в module.json и его файл существует", () => {
  const langs = moduleJson.languages.map(item => item.lang);
  assert.deepEqual(langs, ["ru", "en"]);
  const english = moduleJson.languages.find(item => item.lang === "en");
  assert.equal(english.path, "lang/en.json");
  assert.equal(english.name, "English");
});

test("cardText: английский текст при языке en, русский иначе; без английского — русский", () => {
  const entry = { ru: "Русский", en: "English" };
  assert.equal(cardText(entry, "en"), "English");
  assert.equal(cardText(entry, "ru"), "Русский");
  assert.equal(cardText(entry), "Русский");
  assert.equal(cardText({ ru: "Только русский" }, "en"), "Только русский");
});

test("лицо карты: на английском варианты и цитата берутся из поля en, разметка сохраняется", () => {
  const card = library.get("pp-c-01");
  const view = faceView(card, { kind: "Challenge", lang: "en" });
  assert.equal(view.options[0].html, markupToHtml(card.options[0].en));
  assert.match(view.options[0].html, /<em class="hc-pick">melee<\/em>/);
  assert.equal(view.quote, card.quote.en);
  assert.equal(faceView(card, { kind: "Вызов", lang: "ru" }).quote, card.quote.ru);
  assert.equal(faceView(card, { kind: "Вызов" }).quote, card.quote.ru);
});

test("библиотека: название набора задаётся переводом, по умолчанию берётся поле title", () => {
  const translated = buildLibrary(files, file => `EN ${file.set}`);
  assert.equal(translated.get("pp-c-01").setTitle, "EN pp");
  assert.equal(library.get("pp-c-01").setTitle, "Мощь и доблесть");
});

test("данные: у каждой карты английский текст вариантов непустой, без кириллицы и без U+FFFD", () => {
  for ( const card of cards ) {
    for ( const option of card.options ) {
      assert.ok(option.en?.trim(), `${card.id}: пустой en`);
      assert.ok(!CYRILLIC.test(option.en), `${card.id}: кириллица в en «${option.en}»`);
      assert.ok(!REPLACEMENT.test(option.en), `${card.id}: U+FFFD в en «${option.en}»`);
    }
    if ( card.quote ) {
      assert.ok(card.quote.en?.trim(), `${card.id}: пустая цитата en`);
      assert.ok(!CYRILLIC.test(card.quote.en), `${card.id}: кириллица в цитате en`);
      assert.ok(!REPLACEMENT.test(card.quote.en), `${card.id}: U+FFFD в цитате en`);
    }
  }
});

/**
 * Варианты, где число подсвеченных слов в английском оригинале и в русском переводе различается уже в данных
 * (подсветка стоит на других словах). Тексты карт в модуле не переписываются, поэтому расхождения перечислены здесь.
 * Список проверяется в обе стороны: исчезнувшее расхождение тоже нужно убрать из списка.
 */
const KNOWN_HIGHLIGHT_DIFFS = new Set([
  "core-c-35:0", "core-r-01:1", "pp-c-17:0", "bonus-c-05:1", "bonus-c-09:1"
]);

test("данные: разметка {слов} в английском тексте есть там же, где в русском (число пар совпадает)", () => {
  const differs = [];
  for ( const card of cards ) {
    card.options.forEach((option, index) => {
      const context = `${card.id} вариант ${index + 1}`;
      assert.equal(count(option.en, "{"), count(option.en, "}"), `${context}: скобки сбалансированы`);
      if ( count(option.en, "{") !== count(option.ru, "{") ) differs.push(`${card.id}:${index}`);
      if ( card.kind === "challenge" ) {
        assert.ok(/\{[^{}]+\}/.test(option.en), `${context}: нет подсветки в en`);
        assert.ok(markupToHtml(option.en).includes("<em class=\"hc-pick\">"), `${context}: не подсвечивается`);
      }
    });
  }
  assert.deepEqual(differs.filter(key => !KNOWN_HIGHLIGHT_DIFFS.has(key)), [], "новые расхождения подсветки");
  assert.deepEqual([...KNOWN_HIGHLIGHT_DIFFS].filter(key => !differs.includes(key)), [],
    "расхождение устранено: убрать его из KNOWN_HIGHLIGHT_DIFFS");
});
