import { cardText, markupToHtml } from "./cards.mjs";
import { TABLE, entriesOf } from "./deck.mjs";
import { cardControls } from "./controls.mjs";
import { canDiscard, canDraw, canSeeHand, canSwap } from "./permissions.mjs";

/**
 * Данные для шаблонов: лицо карты и руки игроков в окне.
 * Не зависит от Foundry (подписи передаются готовыми), поэтому проверяется обычными тестами.
 */

/**
 * Лицо карты: заголовок, два окошка с подсвеченными словами и цитата.
 * @param {object} card
 * @param {object} labels
 * @param {string} labels.kind    «Вызов» или «Награда».
 * @param {string} [labels.lang="ru"]  Язык текста карты (`ru` или `en`), как `game.i18n.lang`.
 * @param {number[]} [chosen]     Номера выбранных вариантов (остальные помечаются как невыбранные).
 * @param {object[]} [clicks]    Что делает щелчок по каждому варианту (`null`, если варианты не нажимаются):
 *                               `{ kind, owner, uid, option, titleKey }`.
 * @returns {object}
 */
export function faceView(card, labels, chosen=null, clicks=null) {
  const lang = labels.lang ?? "ru";
  return {
    kind: card.kind,
    set: card.set,
    kindLabel: labels.kind,
    setTitle: card.setTitle,
    options: card.options.map((option, index) => ({
      n: index + 1,
      html: markupToHtml(cardText(option, lang)),
      chosen: !!chosen?.includes(index),
      dimmed: !!chosen && !chosen.includes(index),
      click: clicks?.[index] ?? null
    })),
    quote: card.quote ? cardText(card.quote, lang) : ""
  };
}

/**
 * Щелчки по вариантам вызова в окне: заявка выполнения. Что именно делает щелчок (значение варианта, подсказка),
 * решает {@link cardControls}, тот же источник, что и у карточек в чате.
 * @param {string} owner
 * @param {string} uid
 * @param {object} card
 * @param {object} controls  Результат {@link cardControls} для этого вызова.
 * @param {boolean} allowed  Можно ли сейчас заявлять этот вызов (карта видна, заявка ещё не ждёт решения).
 * @returns {object[]|null}  На каждый вариант `{ kind, owner, uid, option, titleKey }` или `null`.
 */
export function claimClicks(owner, uid, card, controls, allowed) {
  if ( !allowed || (controls.clickKind !== "claim") ) return null;
  return card.options.map((_, index) => ({
    kind: controls.clickKind,
    owner,
    uid,
    option: controls.optionValue(index),
    titleKey: controls.titleKey
  }));
}

/**
 * Руки для окна: для каждого владельца список его карт с доступными действиями.
 * Мастер видит руки всех игроков и общий вызов; игрок видит свою руку и общий вызов.
 * @param {object} args
 * @param {object} args.state                  Состояние колод.
 * @param {Map<string, object>} args.library
 * @param {{id: string, isGM: boolean}} args.user
 * @param {{id: string, name: string, isGM: boolean}[]} args.users
 * @param {object} args.settings               `drawMode`, `handSize`, `handVisibility`, `epic`, `swapPolicy`,
 *                                             `playerParticipates`, `playerClaims`.
 * @param {function(object, object[]|null): object} args.face  Строит лицо карты: `(card, clicks) => view`.
 * @param {string[]} [args.pendingUids]  Вызовы, по которым заявка уже ждёт решения: заявить их снова нельзя.
 * @returns {object[]}
 */
export function handsView({ state, library, user, users, settings, face, pendingUids=[] }) {
  const pending = new Set(pendingUids);
  const groupMode = settings.drawMode !== "player";
  const owners = [];
  if ( groupMode ) owners.push({ owner: TABLE, name: null });
  if ( !groupMode || user.isGM ) {
    for ( const other of users.filter(item => !item.isGM) ) {
      if ( user.isGM || (other.id === user.id) ) owners.push({ owner: other.id, name: other.name });
    }
  }

  return owners.map(({ owner, name }) => {
    const visible = canSeeHand(user, owner, settings.handVisibility);
    const controls = cardControls({ kind: "challenge", owner }, user, settings);
    const canSwapHere = canSwap(user, owner, settings);
    const canDiscardHere = canDiscard(user, owner, settings);
    const canTransfer = user.isGM && !groupMode;
    const cards = [];
    for ( const entry of entriesOf(state, owner) ) {
      const card = library.get(entry.id);
      if ( !card ) continue;
      // Заявить можно только видимую карту, по которой заявка ещё не ждёт решения.
      const claimPending = pending.has(entry.uid);
      const claimable = visible && !claimPending && (controls.clickKind === "claim");
      cards.push({
        owner,
        uid: entry.uid,
        hidden: !visible,
        face: visible ? face(card, claimClicks(owner, entry.uid, card, controls, claimable)) : null,
        canClaim: claimable,
        claimPending,
        // Кнопки заявки: по одной на вариант, а при эпической сложности одна «выполнено всё».
        claimOptions: settings.epic
          ? [{ owner, uid: entry.uid, option: "all", all: true }]
          : card.options.map((_, index) => ({ owner, uid: entry.uid, option: index, n: index + 1, all: false })),
        canSwap: canSwapHere,
        canDiscard: canDiscardHere,
        canTransfer,
        canManage: canSwapHere || canTransfer || canDiscardHere
      });
    }
    // Общий вызов раздаётся кнопкой «Раздать вызовы»: отдельная кнопка у стола делала бы то же самое.
    const limit = (owner === TABLE) ? 1 : settings.handSize;
    return {
      owner,
      isTable: owner === TABLE,
      name,
      mine: owner === user.id,
      cards,
      empty: !cards.length,
      canDraw: (owner !== TABLE) && (cards.length < limit) && canDraw(user, owner, settings)
    };
  });
}
