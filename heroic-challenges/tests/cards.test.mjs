import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KINDS, SETS, buildLibrary, deckIds, enabledSets, markupToHtml, plainText, randomId } from "../scripts/cards.mjs";

const files = SETS.map(set => JSON.parse(readFileSync(new URL(`../data/${set}.ru.json`, import.meta.url), "utf8")));
const library = buildLibrary(files);
const cards = Array.from(library.values());

test("данные: состав наборов совпадает с оригиналом (125 вызовов, 100 наград)", () => {
  const count = (set, kind) => cards.filter(card => (card.set === set) && (card.kind === kind)).length;
  assert.equal(count("core", "challenge"), 50);
  assert.equal(count("core", "reward"), 50);
  assert.equal(count("pp", "challenge"), 25);
  assert.equal(count("pp", "reward"), 25);
  assert.equal(count("vv", "challenge"), 25);
  assert.equal(count("vv", "reward"), 25);
  assert.equal(count("bonus", "challenge"), 25);
  assert.equal(count("bonus", "reward"), 0);
  assert.equal(cards.length, 225);
});

test("данные: идентификаторы и номера согласованы", () => {
  for ( const card of cards ) {
    const letter = (card.kind === "challenge") ? "c" : "r";
    assert.equal(card.id, `${card.set}-${letter}-${String(card.number).padStart(2, "0")}`);
  }
  for ( const set of SETS ) {
    for ( const kind of Object.values(KINDS) ) {
      const numbers = cards.filter(card => (card.set === set) && (card.kind === kind)).map(card => card.number);
      assert.deepEqual(numbers, numbers.map((_, i) => i + 1), `${set} ${kind}`);
    }
  }
});

test("данные: у каждой карты два варианта с русским и английским текстом, разметка сбалансирована", () => {
  for ( const card of cards ) {
    assert.equal(card.options.length, 2, card.id);
    for ( const option of card.options ) {
      for ( const field of ["ru", "en"] ) {
        const text = option[field];
        assert.ok(text?.trim(), `${card.id} ${field}`);
        assert.equal((text.match(/\{/g) ?? []).length, (text.match(/\}/g) ?? []).length, `${card.id} ${field}: скобки`);
        assert.ok(!/\{\}|\{[^{}]*\{|\}[^{}]*\}/.test(text), `${card.id} ${field}: вложенные или пустые скобки`);
      }
      assert.ok(!/[A-Za-z]/.test(option.ru), `${card.id}: латиница в русском тексте`);
    }
  }
});

test("данные: у каждого варианта вызова есть подсвеченные слова (в том числе у бонусных вызовов)", () => {
  for ( const card of cards.filter(card => card.kind === "challenge") ) {
    for ( const option of card.options ) {
      assert.ok(/\{[^{}]+\}/.test(option.ru), `${card.id}: «${option.ru}»`);
    }
  }
});

test("данные: типографика русского текста (многоточие одним знаком, без вложенных «ёлочек»)", () => {
  for ( const card of cards ) {
    const texts = [...card.options.map(option => option.ru), card.quote?.ru].filter(Boolean);
    for ( const text of texts ) {
      assert.ok(!text.includes("..."), `${card.id}: «${text}»`);
      // Цитата выводится в «ёлочках», поэтому кавычки внутри неё должны быть „лапками“.
      assert.ok(!/[«»]/.test(text), `${card.id}: «${text}»`);
    }
  }
});

test("данные: цитаты у всех карт, кроме бонусных, и тег у каждой награды", () => {
  for ( const card of cards ) {
    if ( card.set === "bonus" ) assert.ok(!card.quote, card.id);
    else {
      assert.ok(card.quote?.ru && card.quote?.en, `${card.id}: цитата`);
      assert.ok(!/[A-Za-z]/.test(card.quote.ru), `${card.id}: латиница в цитате`);
    }
    for ( const option of card.options ) {
      if ( card.kind === "reward" ) assert.ok(["play", "story"].includes(option.tag), `${card.id}: тег`);
      else assert.equal(option.tag, undefined, `${card.id}: у вызова тега нет`);
    }
  }
});

test("данные: в тексте нет остатков разметки PDF", () => {
  for ( const card of cards ) {
    const texts = [...card.options.flatMap(option => [option.ru, option.en]), card.quote?.ru, card.quote?.en].filter(Boolean);
    for ( const text of texts ) {
      assert.ok(!/­|�|\s{2,}|”/.test(text), `${card.id}: «${text}»`);
      // Английские “кавычки” остались бы от PDF; русские „лапки“ закрываются тем же знаком “, они допустимы парой.
      assert.ok(!/“/.test(text.replace(/„[^„“]*“/g, "")), `${card.id}: «${text}»`);
    }
  }
});

test("наборы: основной подключён всегда, расширения по настройкам", () => {
  assert.deepEqual(enabledSets({ setPP: false, setVV: false, setBonus: false }), ["core"]);
  assert.deepEqual(enabledSets({ setPP: true, setVV: false, setBonus: true }), ["core", "pp", "bonus"]);
});

test("колоды: состав по подключённым наборам", () => {
  assert.equal(deckIds(library, ["core"], "challenge").length, 50);
  assert.equal(deckIds(library, ["core", "pp", "vv", "bonus"], "challenge").length, 125);
  assert.equal(deckIds(library, ["core", "pp", "vv", "bonus"], "reward").length, 100);
  assert.equal(deckIds(library, ["bonus"], "reward").length, 0);
});

test("библиотека: повторяющийся идентификатор отклоняется", () => {
  const card = { id: "x", kind: "challenge", number: 1, options: [] };
  assert.throws(() => buildLibrary([{ set: "a", title: "A", cards: [card, card] }]));
});

test("разметка: выделенные слова подсвечиваются, остальное экранируется", () => {
  assert.equal(markupToHtml("{Убить} или <b>напугать</b>"), "<em class=\"hc-pick\">Убить</em> или &lt;b&gt;напугать&lt;/b&gt;");
  assert.equal(plainText("{Убить} или {напугать}"), "Убить или напугать");
});

test("случайная карта: граничные значения генератора", () => {
  assert.equal(randomId([], () => 0.5), null);
  assert.equal(randomId(["a", "b", "c"], () => 0), "a");
  assert.equal(randomId(["a", "b", "c"], () => 0.999999), "c");
  assert.equal(randomId(["a", "b", "c"], () => 1), "c");
});
