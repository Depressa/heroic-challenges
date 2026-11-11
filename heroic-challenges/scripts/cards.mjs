/**
 * Библиотека карт: чтение данных из JSON, состав колод по наборам, разметка выделенных слов.
 * Не зависит от Foundry, поэтому проверяется обычными тестами.
 */

export const KINDS = Object.freeze({ CHALLENGE: "challenge", REWARD: "reward" });

/** Наборы в порядке показа. Основной набор подключён всегда. */
export const SETS = Object.freeze(["core", "pp", "vv", "bonus"]);

/**
 * Собирает библиотеку из файлов данных.
 * @param {object[]} files  Содержимое `data/*.ru.json`: `{ set, title, source, cards }`.
 * @param {function(object): string} [setTitle]  Название набора для показа (по умолчанию поле `title` файла;
 *                                               в модуле передаётся перевод `Set.<набор>`).
 * @returns {Map<string, object>}  Карты по идентификатору; к каждой добавлены `set` и `setTitle`.
 */
export function buildLibrary(files, setTitle=file => file.title) {
  const library = new Map();
  for ( const file of files ) {
    for ( const card of file.cards ) {
      if ( library.has(card.id) ) throw new Error(`Повторяющийся идентификатор карты: ${card.id}`);
      library.set(card.id, { ...card, set: file.set, setTitle: setTitle(file) });
    }
  }
  return library;
}

/**
 * Текст карты на нужном языке: английский оригинал (`en`) или русский перевод (`ru`).
 * Если английского текста нет, берётся русский.
 * @param {{ru?: string, en?: string}} entry  Вариант или цитата карты.
 * @param {string} [lang="ru"]               Язык интерфейса Foundry (`game.i18n.lang`).
 * @returns {string}
 */
export function cardText(entry, lang="ru") {
  return ((lang === "en") && entry.en) ? entry.en : entry.ru;
}

/**
 * Подключённые наборы по настройкам.
 * @param {{setPP: boolean, setVV: boolean, setBonus: boolean}} flags
 * @returns {string[]}
 */
export function enabledSets({ setPP, setVV, setBonus }) {
  return SETS.filter(set => (set === "core") || ((set === "pp") && setPP) || ((set === "vv") && setVV)
    || ((set === "bonus") && setBonus));
}

/**
 * Идентификаторы карт колоды: все карты нужного типа из подключённых наборов.
 * @param {Map<string, object>} library
 * @param {string[]} sets
 * @param {string} kind
 * @returns {string[]}
 */
export function deckIds(library, sets, kind) {
  return Array.from(library.values()).filter(card => (card.kind === kind) && sets.includes(card.set)).map(card => card.id);
}

/**
 * Экранирование для HTML.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

/**
 * Текст варианта в безопасный HTML: слова в `{фигурных скобках}` (подсвеченные на карте) становятся `<em class="hc-pick">`.
 * @param {string} text
 * @returns {string}
 */
export function markupToHtml(text) {
  return escapeHtml(text).replace(/\{([^{}]+)\}/g, "<em class=\"hc-pick\">$1</em>");
}

/**
 * Текст варианта без разметки.
 * @param {string} text
 * @returns {string}
 */
export function plainText(text) {
  return text.replace(/[{}]/g, "");
}

/**
 * Случайная карта из списка (без изменения колоды): для режима «идея для Мастера».
 * @param {string[]} ids
 * @param {function(): number} [rng=Math.random]
 * @returns {string|null}
 */
export function randomId(ids, rng=Math.random) {
  return ids.length ? ids[Math.min(Math.floor(rng() * ids.length), ids.length - 1)] : null;
}
