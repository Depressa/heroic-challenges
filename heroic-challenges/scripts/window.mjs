import { MODULE_ID } from "./settings-defs.mjs";
import { KINDS, escapeHtml } from "./cards.mjs";
import { counts } from "./deck.mjs";
import { handsView } from "./view.mjs";
import { requestAction } from "./actions.mjs";
import { buildFace, pendingClaimUids } from "./chat.mjs";
import { t } from "./i18n.mjs";
import { onFaceClick } from "./click.mjs";
import { currentSettings } from "./settings.mjs";
import { getLibrary, getState } from "./store.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Окно выбора игрока.
 * @param {string} title
 * @param {{id: string, name: string}[]} users
 * @returns {Promise<string|null>}  Идентификатор выбранного пользователя.
 */
async function pickUser(title, users) {
  if ( !users.length ) return null;
  const options = users.map(user => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join("");
  const { DialogV2 } = foundry.applications.api;
  const value = await DialogV2.prompt({
    window: { title },
    content: `<div class="form-group"><select name="user">${options}</select></div>`,
    ok: { label: t("Window.Choose"), callback: (event, button) => button.form.elements.user.value },
    rejectClose: false
  });
  return (typeof value === "string") ? value : null;
}

/** Игроки (не Мастера). */
function players() {
  return game.users.filter(user => !user.isGM);
}

/** Окно «Героические вызовы»: руки игроков, общий вызов, счётчики колод и кнопки Мастера. */
class HeroicChallengesWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "heroic-challenges-window",
    classes: ["heroic-challenges"],
    window: { title: "HEROIC.Title", icon: "fa-solid fa-dragon", resizable: true },
    position: { width: 560, height: "auto" },
    actions: {
      draw: HeroicChallengesWindow.onDraw,
      claim: HeroicChallengesWindow.onClaim,
      swap: HeroicChallengesWindow.onSwap,
      discard: HeroicChallengesWindow.onDiscard,
      transfer: HeroicChallengesWindow.onTransfer,
      dealAll: HeroicChallengesWindow.onDealAll,
      idea: HeroicChallengesWindow.onIdea,
      give: HeroicChallengesWindow.onGive,
      reset: HeroicChallengesWindow.onReset
    }
  };

  /** @override */
  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/window.hbs`, scrollable: [""] }
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const settings = currentSettings();
    const user = { id: game.user.id, isGM: game.user.isGM };
    const state = getState();
    const hands = handsView({
      state,
      library: getLibrary(),
      user,
      users: game.users.map(item => ({ id: item.id, name: item.name, isGM: item.isGM })),
      settings,
      face: (card, clicks) => buildFace(card, null, clicks),
      pendingUids: pendingClaimUids()
    });
    for ( const hand of hands ) {
      hand.title = hand.isTable ? t(`Window.Table.${settings.drawMode}`) : hand.name;
    }
    const stock = counts(state);
    return Object.assign(context, {
      isGM: user.isGM,
      hands,
      noPlayers: user.isGM && !hands.length,
      stock,
      groupMode: settings.drawMode !== "player"
    });
  }

  /** @inheritDoc */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    // Щелчок по варианту вызова заявляет его выполнение.
    this.element.addEventListener("click", event => {
      const option = event.target.closest("li.hc-clickable");
      if ( option ) onFaceClick(option);
    });
  }

  /** Взять вызов. */
  static onDraw(event, target) {
    requestAction("deal", { owner: target.dataset.owner });
  }

  /** Заявить выполнение: вариант `option` (или оба при эпической сложности). */
  static onClaim(event, target) {
    const { owner, uid, option } = target.dataset;
    requestAction("claim", { owner, uid, done: (option === "all") ? "all" : [Number(option)] });
  }

  /** Заменить вызов. */
  static onSwap(event, target) {
    const { owner, uid } = target.dataset;
    requestAction("swap", { owner, uid });
  }

  /** Отказаться от вызова. */
  static async onDiscard(event, target) {
    const { owner, uid } = target.dataset;
    const yes = await foundry.applications.api.DialogV2.confirm({
      window: { title: t("Window.Discard") },
      content: `<p>${t("Window.DiscardConfirm")}</p>`,
      rejectClose: false
    });
    if ( yes ) requestAction("discard", { owner, uid });
  }

  /** Передать вызов другому игроку (Мастер). */
  static async onTransfer(event, target) {
    const { owner, uid } = target.dataset;
    const to = await pickUser(t("Window.Transfer"), players().filter(user => user.id !== owner));
    if ( to ) requestAction("transfer", { owner, uid, to });
  }

  /** Раздать вызовы (Мастер). */
  static onDealAll() {
    requestAction("deal", {});
  }

  /** «Идея для Мастера»: случайная карта без раздачи. */
  static onIdea(event, target) {
    requestAction("idea", { kind: (target.dataset.kind === KINDS.REWARD) ? KINDS.REWARD : KINDS.CHALLENGE });
  }

  /** Награда без вызова (Мастер). */
  static async onGive() {
    const userId = await pickUser(t("Window.Give"), players());
    if ( userId ) requestAction("giveReward", { userId });
  }

  /** Собрать колоды заново (Мастер). */
  static async onReset() {
    const yes = await foundry.applications.api.DialogV2.confirm({
      window: { title: t("Window.Reset") },
      content: `<p>${t("Window.ResetConfirm")}</p>`,
      rejectClose: false
    });
    if ( yes ) requestAction("reset", {});
  }
}

/** Открывает окно (или выводит его вперёд, если оно уже открыто). */
export function openWindow() {
  const existing = foundry.applications.instances.get("heroic-challenges-window");
  if ( existing ) return existing.render({ force: true });
  return new HeroicChallengesWindow().render({ force: true });
}

/** Перерисовывает открытое окно (состояние или настройки изменились). */
export function refreshWindow() {
  foundry.applications.instances.get("heroic-challenges-window")?.render();
}
