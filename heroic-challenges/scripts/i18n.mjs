import { cardText } from "./cards.mjs";

/**
 * Локализованная строка модуля.
 * @param {string} key   Ключ без префикса `HEROIC.`.
 * @param {object} [data]
 * @returns {string}
 */
export function t(key, data) {
  return data ? game.i18n.format(`HEROIC.${key}`, data) : game.i18n.localize(`HEROIC.${key}`);
}

/**
 * Текст карты (вариант или цитата) на языке интерфейса Foundry.
 * @param {{ru?: string, en?: string}} entry
 * @returns {string}
 */
export function localCardText(entry) {
  return cardText(entry, game.i18n.lang);
}
