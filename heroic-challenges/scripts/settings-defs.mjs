export const MODULE_ID = "heroic-challenges";

/**
 * Описание всех настроек модуля одним списком (без Foundry, проверяется тестами).
 * От него зависят регистрация настроек, заголовки групп и проверка полноты подписей.
 *
 * Поля:
 * - `key`: ключ настройки (под ним значение хранится в мире);
 * - `kind`: `boolean` (флажок) или `choice` (список);
 * - `numeric`: значения списка числовые;
 * - `default`: значение по умолчанию;
 * - `group`: группа (заголовок в списке настроек);
 * - `choices`: `[{ value, label }]`, где `label` — ключ локализации.
 */

/**
 * Группы настроек в порядке показа: в списке настроек модуля их отделяют заголовки.
 * Подписи: `HEROIC.Settings.Group.<id>.Title` и `.Hint`.
 */
export const SETTING_GROUPS = Object.freeze(["sets", "dealing", "rules", "decisions", "rewards"]);

export const SETTING_DEFS = Object.freeze([
  // Какие наборы подключены (основной набор есть всегда).
  { key: "setPP", kind: "boolean", default: false, group: "sets" },
  { key: "setVV", kind: "boolean", default: false, group: "sets" },
  { key: "setBonus", kind: "boolean", default: false, group: "sets" },

  // Как раздаются вызовы.
  {
    key: "drawMode", kind: "choice", default: "player", group: "dealing",
    choices: [
      { value: "player", label: "HEROIC.Settings.drawMode.Player" },
      { value: "group", label: "HEROIC.Settings.drawMode.Group" },
      { value: "theme", label: "HEROIC.Settings.drawMode.Theme" }
    ]
  },
  {
    key: "handSize", kind: "choice", numeric: true, default: 1, group: "dealing",
    choices: [
      { value: 1, label: "HEROIC.Settings.handSize.One" },
      { value: 2, label: "HEROIC.Settings.handSize.Two" },
      { value: 3, label: "HEROIC.Settings.handSize.Three" }
    ]
  },
  {
    key: "dealTo", kind: "choice", default: "active", group: "dealing",
    choices: [
      { value: "active", label: "HEROIC.Settings.dealTo.Active" },
      { value: "all", label: "HEROIC.Settings.dealTo.All" }
    ]
  },
  {
    key: "handVisibility", kind: "choice", default: "all", group: "dealing",
    choices: [
      { value: "all", label: "HEROIC.Settings.handVisibility.All" },
      { value: "owner", label: "HEROIC.Settings.handVisibility.Owner" },
      { value: "secret", label: "HEROIC.Settings.handVisibility.Secret" }
    ]
  },

  // Правила.
  { key: "epic", kind: "boolean", default: false, group: "rules" },
  {
    key: "swapPolicy", kind: "choice", default: "gm", group: "rules",
    choices: [
      { value: "none", label: "HEROIC.Settings.swapPolicy.None" },
      { value: "gm", label: "HEROIC.Settings.swapPolicy.GM" },
      { value: "owner", label: "HEROIC.Settings.swapPolicy.Owner" }
    ]
  },

  // Кто решает.
  { key: "playerParticipates", kind: "boolean", default: false, group: "decisions" },
  { key: "playerClaims", kind: "boolean", default: true, group: "decisions" },
  {
    key: "claimMode", kind: "choice", default: "confirm", group: "decisions",
    choices: [
      { value: "confirm", label: "HEROIC.Settings.claimMode.Confirm" },
      { value: "auto", label: "HEROIC.Settings.claimMode.Auto" }
    ]
  },

  // Награды.
  {
    key: "rewardItems", kind: "choice", default: "play", group: "rewards",
    choices: [
      { value: "play", label: "HEROIC.Settings.rewardItems.Play" },
      { value: "all", label: "HEROIC.Settings.rewardItems.All" },
      { value: "none", label: "HEROIC.Settings.rewardItems.None" }
    ]
  }
]);

/**
 * Путь к подписи настройки в файле локализации (без префикса `HEROIC.`).
 * @param {string} key
 * @returns {string}
 */
export function labelPath(key) {
  return `Settings.${key}`;
}
