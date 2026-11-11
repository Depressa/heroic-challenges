import { MODULE_ID, SETTING_DEFS, SETTING_GROUPS, labelPath } from "./settings-defs.mjs";

export { MODULE_ID };

/**
 * Кнопка в списке настроек, которая не открывает окно, а сразу выполняет действие.
 * Foundry требует, чтобы класс кнопки был приложением (ApplicationV2), создаёт его и вызывает `render`;
 * вместо окна запускаем действие.
 * (Модули подключаются при вызове: они сами читают настройки, поэтому статический импорт был бы циклическим.)
 */
class ActionMenu extends foundry.applications.api.ApplicationV2 {
  /** @returns {Promise<void>} */
  async run() {}

  /** @returns {Promise<this>} */
  async render() {
    await this.run();
    return this;
  }
}

class DealMenu extends ActionMenu {
  async run() {
    const { requestAction } = await import("./actions.mjs");
    requestAction("deal", {});
  }
}

class OpenWindowMenu extends ActionMenu {
  async run() {
    const { openWindow } = await import("./window.mjs");
    openWindow();
  }
}

/**
 * Регистрирует настройки мира. Все они лежат прямо в списке настроек модуля (Settings → Configure Settings →
 * Module Settings). Сверху две кнопки действий, ниже настройки по группам (заголовки добавляет
 * {@link addGroupHeadings}).
 * @param {object} callbacks
 * @param {function(): void} callbacks.onSetsChanged   Изменился состав подключённых наборов.
 * @param {function(): void} callbacks.onStateChanged   Изменилось состояние колод.
 */
export function registerSettings({ onSetsChanged, onStateChanged }) {
  game.settings.registerMenu(MODULE_ID, "deal", {
    name: "HEROIC.Settings.Tools.DealName",
    label: "HEROIC.Settings.Tools.Deal",
    hint: "HEROIC.Settings.Tools.DealHint",
    icon: "fa-solid fa-hand-holding-hand",
    type: DealMenu,
    restricted: true
  });
  game.settings.registerMenu(MODULE_ID, "window", {
    name: "HEROIC.Settings.Tools.WindowName",
    label: "HEROIC.Settings.Tools.Window",
    hint: "HEROIC.Settings.Tools.WindowHint",
    icon: "fa-solid fa-dragon",
    type: OpenWindowMenu,
    restricted: true
  });

  // Состояние колод и рук: служебное, в списке настроек не показывается.
  game.settings.register(MODULE_ID, "state", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: onStateChanged
  });

  for ( const def of SETTING_DEFS ) {
    const config = {
      name: `HEROIC.${labelPath(def.key)}.Name`,
      hint: `HEROIC.${labelPath(def.key)}.Hint`,
      scope: "world",
      config: true,
      default: def.default
    };
    if ( def.kind === "boolean" ) {
      config.type = Boolean;
    } else {
      config.type = def.numeric ? Number : String;
      // Подписи вариантов — ключи локализации: Foundry переводит их сам при показе (в `init` переводы ещё не загружены).
      config.choices = Object.fromEntries(def.choices.map(choice => [choice.value, choice.label]));
    }
    if ( def.group === "sets" ) config.onChange = onSetsChanged;
    game.settings.register(MODULE_ID, def.key, config);
  }
}

/**
 * Добавляет в список настроек модуля заголовки групп (Foundry такого сам не умеет).
 * @param {Application} app
 * @param {HTMLElement} html
 */
export function addGroupHeadings(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if ( !root ) return;
  for ( const group of SETTING_GROUPS ) {
    const first = SETTING_DEFS.find(def => def.group === group);
    const field = first && root.querySelector(`[name="${MODULE_ID}.${first.key}"]`);
    const row = field?.closest(".form-group");
    if ( !row || row.previousElementSibling?.classList.contains("hc-settings-heading") ) continue;
    const heading = document.createElement("div");
    heading.className = "hc-settings-heading";
    const hint = game.i18n.localize(`HEROIC.Settings.Group.${group}.Hint`);
    heading.innerHTML = `<h3></h3>${hint ? "<p class=\"hint\"></p>" : ""}`;
    heading.querySelector("h3").textContent = game.i18n.localize(`HEROIC.Settings.Group.${group}.Title`);
    if ( hint ) heading.querySelector(".hint").textContent = hint;
    row.before(heading);
  }
}

/**
 * Значения настроек, от которых зависят права и показ (одним объектом).
 * @returns {object}
 */
export function currentSettings() {
  const get = key => game.settings.get(MODULE_ID, key);
  return {
    drawMode: get("drawMode"),
    handSize: get("handSize"),
    dealTo: get("dealTo"),
    handVisibility: get("handVisibility"),
    epic: get("epic"),
    swapPolicy: get("swapPolicy"),
    playerParticipates: get("playerParticipates"),
    playerClaims: get("playerClaims"),
    claimMode: get("claimMode"),
    rewardItems: get("rewardItems")
  };
}
