import { MODULE_ID } from "./settings-defs.mjs";
import { escapeHtml, markupToHtml, plainText } from "./cards.mjs";

/**
 * Сборка данных предмета-награды. Не зависит от Foundry, поэтому проверяется обычными тестами.
 * Предмет расходуемый (dnd5e): одно использование, при расходе исчезает.
 */

/** Идентификатор активности (16 латинских букв и цифр, как требует Foundry). */
const ACTIVITY_ID = "hcRewardUse00001";

const ICON = "icons/sundries/scrolls/scroll-bound-gold-tan.webp";

/** Предельная длина текста награды в названии предмета. */
const NAME_LENGTH = 60;

/**
 * Короткая выдержка из текста для названия предмета.
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
export function excerpt(text, max=NAME_LENGTH) {
  const clean = plainText(text).replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
  if ( clean.length <= max ) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).trimEnd()}…`;
}

/**
 * Выдавать ли предмет за выбранный результат.
 * @param {"play"|"all"|"none"} policy  Настройка «Предметы за награды».
 * @param {"play"|"story"} tag          Тег варианта награды.
 * @returns {boolean}
 */
export function wantsItem(policy, tag) {
  if ( policy === "all" ) return true;
  return (policy === "play") && (tag === "play");
}

/**
 * Данные предмета для `Item.create`.
 * @param {object} data
 * @param {string} data.cardId        Идентификатор карты награды.
 * @param {number} data.optionIndex   Номер выбранного результата.
 * @param {string} [data.messageId]  Карточка награды, выдавшая предмет (чтобы найти его без ссылки).
 * @param {string} data.text          Текст результата с разметкой `{слов}`.
 * @param {object} data.labels
 * @param {string} data.labels.prefix  «Награда».
 * @param {string} data.labels.use     «Использовать».
 * @param {string} data.labels.source  Подпись происхождения, например «Награда · Основной набор № 3».
 * @returns {object}
 */
export function buildRewardItemData({ cardId, optionIndex, messageId=null, text, labels }) {
  const description = `<p>${markupToHtml(text)}</p><p><em>${escapeHtml(labels.source)}</em></p>`;
  return {
    name: `${labels.prefix}: ${excerpt(text)}`,
    type: "consumable",
    img: ICON,
    system: {
      // Поле для чата нужно: без него dnd5e скрывает описание в карточке использования у Мастера.
      description: { value: description, chat: description },
      quantity: 1,
      weight: { value: 0, units: "lb" },
      type: { value: "trinket" },
      uses: { max: "1", spent: 0, recovery: [], autoDestroy: true },
      activities: {
        [ACTIVITY_ID]: {
          _id: ACTIVITY_ID,
          type: "utility",
          name: labels.use,
          img: ICON,
          sort: 0,
          activation: { type: "special" },
          consumption: { targets: [{ type: "itemUses", target: "", value: "1" }] },
          description: { chatFlavor: escapeHtml(plainText(text)) }
        }
      }
    },
    flags: { [MODULE_ID]: { kind: "reward", cardId, optionIndex, messageId } }
  };
}
