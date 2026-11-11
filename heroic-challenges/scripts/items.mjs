import { MODULE_ID } from "./settings-defs.mjs";
import { REWARD_STATUS } from "./flow.mjs";
import { buildRewardItemData, wantsItem } from "./reward-item.mjs";
import { getLibrary } from "./store.mjs";
import { localCardText, t } from "./i18n.mjs";

/**
 * Приводит предмет-награду у персонажа в соответствие с решением на карточке награды.
 * - Выбран результат: выдаётся предмет (если настройка и тег результата это допускают; прежний предмет этой карточки
 *   заменяется);
 * - отказ или смена решения: предмет, выданный этой карточкой, удаляется;
 * - если прежний предмет уже потрачен, новый при смене решения не выдаётся.
 * Выполняется только на клиенте Мастера.
 * @param {object} flags      Флаги карточки награды (`cardId`, `recipient`, `state`, `itemUuid`).
 * @param {string} messageId  Идентификатор карточки: им помечается предмет, чтобы найти его и без ссылки.
 * @returns {Promise<{itemUuid: string|null, itemName: string|null, itemNote: string|null}>}
 *          `itemNote`: `Story` (сюжетная награда, Мастер вводит сам), `NoActor`, `Used` или `Failed`.
 */
export async function syncRewardItem(flags, messageId) {
  const none = { itemUuid: null, itemName: null, itemNote: null };
  const actor = game.users.get(flags.recipient)?.character ?? null;

  // Предметы этой карточки: по ссылке и по метке сообщения (если ссылка потерялась, например при двойном решении).
  const previous = [];
  const byUuid = flags.itemUuid ? await fromUuid(flags.itemUuid) : null;
  if ( byUuid ) previous.push(byUuid);
  for ( const item of actor?.items ?? [] ) {
    if ( (item.flags?.[MODULE_ID]?.messageId === messageId) && !previous.includes(item) ) previous.push(item);
  }
  for ( const item of previous ) await item.delete();

  const { state } = flags;
  if ( state.status !== REWARD_STATUS.CHOSEN ) return none;
  if ( flags.itemUuid && !previous.length ) return { ...none, itemNote: "Used" };

  const card = getLibrary().get(flags.cardId);
  const option = card?.options[state.choice];
  if ( !option ) return none;

  const tag = option.tag ?? "story";
  if ( !wantsItem(game.settings.get(MODULE_ID, "rewardItems"), tag) ) return { ...none, itemNote: (tag === "story") ? "Story" : null };
  if ( !actor ) return { ...none, itemNote: "NoActor" };

  try {
    const [item] = await actor.createEmbeddedDocuments("Item", [buildRewardItemData({
      cardId: card.id,
      optionIndex: state.choice,
      messageId,
      text: localCardText(option),
      labels: {
        prefix: t("Item.Prefix"),
        use: t("Item.Use"),
        source: t("Item.Source", { set: card.setTitle, n: card.number })
      }
    })]);
    return { itemUuid: item.uuid, itemName: item.name, itemNote: null };
  } catch(err) {
    console.error(`${MODULE_ID} | не удалось выдать предмет`, err);
    ui.notifications.error(t("Chat.Item.FailedNotice"));
    return { ...none, itemNote: "Failed" };
  }
}
