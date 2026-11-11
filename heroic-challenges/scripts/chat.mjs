import { MODULE_ID } from "./settings-defs.mjs";
import { escapeHtml } from "./cards.mjs";
import { CLAIM_STATUS, REWARD_STATUS, rewardButtons } from "./flow.mjs";
import { cardControls, isPendingClaim } from "./controls.mjs";
import { whisperTargets } from "./permissions.mjs";
import { faceView } from "./view.mjs";
import { getLibrary } from "./store.mjs";
import { currentSettings } from "./settings.mjs";
import { t } from "./i18n.mjs";

const TEMPLATE = `modules/${MODULE_ID}/templates/chat.hbs`;

/** Шаблон лица карты подключается как часть: `{{> hcFace}}`. */
export const FACE_PARTIALS = Object.freeze({ hcFace: `modules/${MODULE_ID}/templates/face.hbs` });

/** Через сколько кнопки карточки снова включаются, если ответа Мастера не последовало. */
const BUTTON_TIMEOUT = 4000;

/**
 * Лицо карты для шаблона.
 * @param {object} card
 * @param {number[]} [chosen]
 * @param {object[]} [clicks]  Что делает щелчок по вариантам (см. {@link faceView}).
 * @returns {object}
 */
export function buildFace(card, chosen=null, clicks=null) {
  return faceView(card, { kind: t(`Kind.${card.kind}`), lang: game.i18n.lang }, chosen, clicks);
}

/**
 * Подпись кнопки карточки. Отказ на карточке награды подписан иначе, чем на заявке: там отклоняют заявку,
 * здесь отказываются от награды.
 * @param {{action: string, value?: number}} button
 * @param {string} kind  Вид карточки (`claim` или `reward`).
 * @returns {string}
 */
function buttonLabel({ action, value }, kind) {
  if ( action === "choose" ) return t("Button.choose", { n: value + 1 });
  if ( (action === "decline") && (kind === "reward") ) return t("Button.declineReward");
  return t(`Button.${action}`);
}

/** Кнопка с подписью; кнопки выбора результата занимают по половине строки. */
function withLabel(kind) {
  return button => ({ ...button, label: buttonLabel(button, kind), choose: button.action === "choose" });
}

/** Имя пользователя по идентификатору. */
function userName(id) {
  return game.users.get(id)?.name ?? "";
}

/**
 * Данные для шаблона карточки по сохранённому состоянию.
 * @param {object} flags  Флаги модуля у сообщения.
 * @returns {object}
 */
function prepareContext(flags) {
  const card = getLibrary().get(flags.cardId);
  const context = {
    kind: flags.kind, title: "", lines: [], face: null, status: "", itemLine: "", note: "",
    buttons: [], reviseButtons: [], missing: !card
  };
  if ( !card ) return context;

  switch ( flags.kind ) {
    case "challenge":
      context.title = t(`Chat.Challenge.${flags.mode}`, { name: userName(flags.owner) });
      context.face = buildFace(card);
      break;

    case "claim": {
      context.title = t("Chat.Claim.Title");
      context.lines.push(t("Chat.Claim.Text", { name: userName(flags.by) }));
      context.face = buildFace(card, flags.done);
      const status = flags.state.status;
      if ( status === CLAIM_STATUS.PENDING ) {
        context.buttons = [{ action: "accept" }, { action: "decline" }].map(withLabel("claim"));
      } else {
        context.status = t(`Chat.Claim.${status}`);
      }
      break;
    }

    case "reward": {
      const { state } = flags;
      context.title = t("Chat.Reward.Title", { name: userName(flags.recipient) });
      context.face = buildFace(card, (state.status === REWARD_STATUS.CHOSEN) ? [state.choice] : null);
      if ( state.rerolls ) context.lines.push(t("Chat.Reward.Rerolls", { n: state.rerolls }));
      context.buttons = rewardButtons(state, card.options.length).map(withLabel("reward"));
      if ( state.status !== REWARD_STATUS.PENDING ) {
        context.reviseButtons = rewardButtons({ ...state, status: REWARD_STATUS.PENDING }, card.options.length)
          .filter(b => b.action !== "reroll").map(withLabel("reward"));
        context.status = (state.status === REWARD_STATUS.CHOSEN)
          ? t("Chat.Reward.chosen", { n: state.choice + 1 }) : t("Chat.Reward.declined");
      }
      context.itemLine = flags.itemUuid ? `${t("Chat.Item.Given")}: @UUID[${flags.itemUuid}]{${escapeHtml(flags.itemName ?? "")}}` : "";
      if ( flags.itemNote ) context.note = t(`Chat.Item.${flags.itemNote}`);
      break;
    }

    case "idea":
      context.title = t("Chat.Idea.Title");
      context.face = buildFace(card);
      break;
  }
  return context;
}

/**
 * HTML карточки по сохранённому состоянию.
 * @param {object} flags
 * @returns {Promise<string>}
 */
export async function renderContent(flags) {
  return foundry.applications.handlebars.renderTemplate(TEMPLATE, prepareContext(flags));
}

/**
 * Публикует карточку в чат.
 * @param {object} flags             Флаги модуля (`kind`, `cardId` и данные вида).
 * @param {string[]|null} [whisper]  Кому адресована карточка (`null` — всем).
 * @param {object} [extra]           Дополнительные поля сообщения (например, `author`).
 * @returns {Promise<ChatMessage>}
 */
export async function postCard(flags, whisper=null, extra={}) {
  const data = {
    content: await renderContent(flags),
    speaker: { alias: t("Title") },
    flags: { [MODULE_ID]: flags },
    ...extra
  };
  if ( whisper ) data.whisper = whisper;
  return ChatMessage.create(data);
}

/**
 * Обновляет карточку после изменения состояния.
 * @param {ChatMessage} message
 * @param {object} flags
 * @returns {Promise<ChatMessage>}
 */
export async function updateCard(message, flags) {
  return message.update({ content: await renderContent(flags), flags: { [MODULE_ID]: flags } });
}

/**
 * Кому адресовать карточку раздачи по настройке видимости руки.
 * @param {string} owner
 * @returns {string[]|null}
 */
export function challengeWhisper(owner) {
  const gmIds = game.users.filter(user => user.isGM).map(user => user.id);
  return whisperTargets(game.settings.get(MODULE_ID, "handVisibility"), owner, gmIds);
}

/**
 * Вызовы, по которым в чате уже есть заявка, ждущая решения.
 * @returns {string[]}
 */
export function pendingClaimUids() {
  return game.messages.contents.filter(message => isPendingClaim(message.flags?.[MODULE_ID]))
    .map(message => message.flags[MODULE_ID].uid);
}

/**
 * Подключает кнопки и варианты карточки. Что доступно пользователю, решает {@link cardControls} при показе,
 * поэтому это работает и для карточек, созданных раньше.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @param {function(string, object): void} request   Отправляет действие Мастеру: `(action, payload)`.
 * @param {function(HTMLElement): void} onOption     Щелчок по варианту вызова.
 */
export function bindButtons(message, html, request, onOption) {
  const root = html.querySelector(".heroic-card");
  const flags = message.flags?.[MODULE_ID];
  if ( !root || !flags ) return;

  const controls = cardControls(flags, { id: game.user.id, isGM: game.user.isGM }, currentSettings());
  for ( const action of controls.hidden ) {
    root.querySelectorAll(`button[data-hc-action="${action}"]`).forEach(button => button.remove());
  }
  root.querySelectorAll(".hc-actions, .hc-revise").forEach(node => {
    if ( !node.querySelector("button") ) node.remove();
  });
  if ( controls.clickKind ) {
    root.querySelectorAll(".hc-options li").forEach((item, index) => {
      item.classList.add("hc-clickable");
      item.title = game.i18n.localize(controls.titleKey);
      Object.assign(item.dataset, {
        hcClick: controls.clickKind, hcOwner: flags.owner ?? "", hcUid: flags.uid ?? "", hcOption: controls.optionValue(index)
      });
    });
  }

  // Кнопки выключаются до ответа Мастера; если карточка не обновилась (запрос отклонён, Мастер не ответил),
  // они включаются обратно.
  const disable = () => {
    const buttons = Array.from(root.querySelectorAll("button[data-hc-action]"));
    buttons.forEach(button => button.disabled = true);
    setTimeout(() => buttons.forEach(button => button.disabled = false), BUTTON_TIMEOUT);
  };

  root.addEventListener("click", event => {
    const option = event.target.closest("li.hc-clickable");
    if ( option ) {
      if ( flags.kind === "reward" ) {
        disable();
        request("rewardAction", { messageId: message.id, action: "choose", value: option.dataset.hcOption });
      } else {
        onOption(option);
      }
      return;
    }
    const button = event.target.closest("button[data-hc-action]");
    if ( !button ) return;
    const { hcAction, hcValue } = button.dataset;
    if ( hcAction === "revise" ) {
      root.querySelector(".hc-revise")?.removeAttribute("hidden");
      button.remove();
      return;
    }
    disable();
    if ( flags.kind === "claim" ) request("claimDecide", { messageId: message.id, action: hcAction });
    else request("rewardAction", { messageId: message.id, action: hcAction, value: hcValue });
  });
}
