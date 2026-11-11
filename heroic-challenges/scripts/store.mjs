import { MODULE_ID } from "./settings-defs.mjs";
import { KINDS, SETS, buildLibrary, deckIds, enabledSets } from "./cards.mjs";
import { emptyState, resetState, syncDecks } from "./deck.mjs";
import { t } from "./i18n.mjs";

/** Библиотека карт; загружается один раз при запуске мира. */
let library = new Map();

let resolveReady;
/** Готовность модуля: данные загружены, колоды у Мастера в порядке. Запросы игроков ждут этого момента. */
export const whenReady = new Promise(resolve => {
  resolveReady = resolve;
});

/** Отмечает готовность (вызывается один раз после загрузки). */
export function markReady() {
  resolveReady();
}

/**
 * Загружает файлы данных и строит библиотеку.
 * @returns {Promise<Map<string, object>>}
 */
export async function loadLibrary() {
  const files = await Promise.all(SETS.map(set => foundry.utils.fetchJsonWithTimeout(
    foundry.utils.getRoute(`modules/${MODULE_ID}/data/${set}.ru.json`)
  )));
  library = buildLibrary(files, file => t(`Set.${file.set}`));
  return library;
}

/** @returns {number} Случайное число 0…1 на генераторе Foundry. */
export function rng() {
  return CONFIG.Dice.randomUniform();
}

/** @returns {Map<string, object>} Загруженная библиотека карт. */
export function getLibrary() {
  return library;
}

/** @returns {string[]} Подключённые наборы по настройкам. */
export function activeSets() {
  const get = key => game.settings.get(MODULE_ID, key);
  return enabledSets({ setPP: get("setPP"), setVV: get("setVV"), setBonus: get("setBonus") });
}

/** @returns {{challenge: string[], reward: string[]}} Карты подключённых наборов. */
export function wantedDecks() {
  const sets = activeSets();
  return {
    [KINDS.CHALLENGE]: deckIds(library, sets, KINDS.CHALLENGE),
    [KINDS.REWARD]: deckIds(library, sets, KINDS.REWARD)
  };
}

/**
 * Текущее состояние колод (копия: менять её можно свободно).
 * @returns {object}
 */
export function getState() {
  const stored = game.settings.get(MODULE_ID, "state");
  return stored?.v ? foundry.utils.deepClone(stored) : emptyState();
}

/** Очередь изменений: запросы выполняются по одному, чтобы два игрока не перезаписали друг друга. */
let queue = Promise.resolve();

/**
 * Изменяет состояние колод. Выполняется только на клиенте Мастера.
 * @template T
 * @param {function(object): {state: object, [key: string]: *}} change  Получает состояние, возвращает новое
 *                                                                       и любые данные для вызывающего.
 * @returns {Promise<T>}  То, что вернула `change` (без поля `state`).
 */
export function mutate(change) {
  const run = async () => {
    const { state, ...rest } = change(getState());
    await game.settings.set(MODULE_ID, "state", state);
    return rest;
  };
  const result = queue.then(run);
  queue = result.catch(err => console.error(`${MODULE_ID} |`, err));
  return result;
}

/**
 * Готовит колоды при запуске мира: первая сборка или приведение к подключённым наборам.
 * @returns {Promise<void>}
 */
export async function ensureDecks() {
  await mutate(state => {
    const stored = game.settings.get(MODULE_ID, "state");
    const wanted = wantedDecks();
    return { state: stored?.v ? syncDecks(state, wanted, rng) : resetState(wanted, rng) };
  });
}
