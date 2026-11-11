import { MODULE_ID } from "./settings-defs.mjs";
import { KINDS, randomId } from "./cards.mjs";
import {
  TABLE, awardClaim, clearOwner, dealMany, discardEntry, drawReward, entriesOf, reconcilePending, resetState,
  resolveReward, swapEntry, syncDecks, transferEntry
} from "./deck.mjs";
import {
  CLAIM_STATUS, REWARD_STATUS, expandDone, initialRewardState, nextClaimState, nextRewardState, rewardsFor,
  validateDone
} from "./flow.mjs";
import { isPendingClaim, isPendingReward } from "./controls.mjs";
import { canClaim, canDecideReward, canDiscard, canDraw, canSwap, dealRecipients } from "./permissions.mjs";
import { challengeWhisper, postCard, updateCard } from "./chat.mjs";
import { t } from "./i18n.mjs";
import { syncRewardItem } from "./items.mjs";
import { currentSettings } from "./settings.mjs";
import { getLibrary, getState, mutate, rng, wantedDecks, whenReady } from "./store.mjs";

const SOCKET = `module.${MODULE_ID}`;

/** Очередь решений по карточке: два почти одновременных решения выполняются по одному, а не оба сразу. */
const locks = new Map();

/**
 * Выполняет действие над карточкой после всех предыдущих действий над ней.
 * @param {string} messageId
 * @param {function(): Promise<*>} fn
 * @returns {Promise<*>}
 */
function withLock(messageId, fn) {
  const previous = locks.get(messageId) ?? Promise.resolve();
  const run = previous.then(fn);
  const chained = run.catch(err => console.error(`${MODULE_ID} |`, err));
  locks.set(messageId, chained);
  chained.then(() => {
    if ( locks.get(messageId) === chained ) locks.delete(messageId);
  });
  return run;
}

/** Вызовы, карточка заявки по которым ещё создаётся (защита от двойного нажатия). */
const claimsInFlight = new Set();

/**
 * Показывает уведомления тому, кто запрашивал действие.
 * @param {string[]} notices  Ключи локализации без префикса.
 */
function showNotices(notices) {
  for ( const key of notices ?? [] ) ui.notifications.warn(t(key));
}

/**
 * Передаёт действие активному Мастеру (или выполняет сразу, если Мастер — мы).
 * @param {string} action
 * @param {object} [payload]
 */
export function requestAction(action, payload={}) {
  const gm = game.users.activeGM;
  if ( !gm ) return void ui.notifications.warn(t("Notice.NoGM"));
  if ( gm.isSelf ) return void perform(action, payload, game.user.id).then(showNotices);
  game.socket.emit(SOCKET, { action, payload });
}

/**
 * Слушает запросы игроков и ответы Мастера. Отправителя запроса берём только из сокета: без него запрос отклоняется.
 * Результат (предупреждения) Мастер возвращает запросившему тем же сокетом.
 */
export function registerSocket() {
  game.socket.on(SOCKET, async (data, senderId) => {
    if ( data?.type === "notice" ) {
      if ( data.userId === game.user.id ) showNotices(data.notices);
      return;
    }
    if ( !game.users.activeGM?.isSelf ) return;
    if ( !senderId ) return void console.warn(`${MODULE_ID} | сокет не сообщил отправителя, запрос отклонён`);
    const notices = await perform(data?.action, data?.payload ?? {}, senderId);
    if ( notices.length ) game.socket.emit(SOCKET, { type: "notice", userId: senderId, notices });
  });
}

/**
 * Выполняет действие. Вызывается только на клиенте активного Мастера; права проверяются по `userId`.
 * Запросы, пришедшие до загрузки данных (Мастер только что открыл мир), ждут её.
 * @param {string} action
 * @param {object} payload
 * @param {string} userId  Кто запросил действие.
 * @returns {Promise<string[]>}  Предупреждения для запросившего (ключи локализации).
 */
export async function perform(action, payload, userId) {
  await whenReady;
  const user = game.users.get(userId);
  if ( !user ) return [];
  const settings = currentSettings();
  const notices = [];
  const notice = key => notices.push(key);
  try {
    switch ( action ) {
      case "deal": await deal(user, payload.owner, settings, notice); break;
      case "swap": await swap(user, payload, settings, notice); break;
      case "discard": await discard(user, payload, settings); break;
      case "transfer": await transfer(user, payload, settings, notice); break;
      case "claim": await claim(user, payload, settings, notice); break;
      case "claimDecide": await claimDecide(user, payload, notice); break;
      case "rewardAction": await rewardAction(user, payload, settings, notice); break;
      case "giveReward": await giveReward(user, payload, notice); break;
      case "idea": await idea(user, payload); break;
      case "reset": await reset(user); break;
      case "sync": if ( user.isGM ) await sync(); break;
    }
  } catch(err) {
    console.error(`${MODULE_ID} |`, err);
  }
  return notices;
}

/**
 * Публикует карточки выданных вызовов. Скрытый вызов публикуется от имени владельца: автор видит свои шёпоты,
 * поэтому иначе карту видел бы и Мастер.
 * @param {{uid: string, id: string}[]} entries
 * @param {string} owner
 * @param {object} settings
 * @param {string} [mode]  Подпись карточки (`Chat.Challenge.*`); по умолчанию зависит от владельца.
 */
async function announce(entries, owner, settings, mode=null) {
  mode ??= (owner === TABLE) ? settings.drawMode : "player";
  const secret = (owner !== TABLE) && (settings.handVisibility === "secret");
  for ( const entry of entries ) {
    await postCard({ kind: "challenge", owner, uid: entry.uid, cardId: entry.id, mode }, challengeWhisper(owner),
      secret ? { author: owner } : {});
  }
}

/**
 * Раздача вызовов: всем (без `owner`, только Мастер) или одному владельцу. Одно изменение состояния на всю раздачу.
 * @param {User} user
 * @param {string} [owner]
 * @param {object} settings
 * @param {function(string): void} notice
 */
async function deal(user, owner, settings, notice) {
  let owners;
  if ( owner ) {
    if ( !canDraw(user, owner, settings) ) return;
    owners = [owner];
  } else {
    if ( !user.isGM ) return;
    owners = (settings.drawMode === "player") ? dealRecipients(game.users, settings.dealTo) : [TABLE];
  }
  // Режим раздачи должен совпадать с владельцем: в «групповом» режиме у игроков нет своих рук.
  owners = owners.filter(item => (item === TABLE) === (settings.drawMode !== "player"));
  if ( !owners.length ) return notice((settings.dealTo === "all") ? "Notice.NoPlayersAtAll" : "Notice.NoPlayers");

  const result = await mutate(state => {
    const dealt = dealMany(state, owners, item => (item === TABLE) ? 1 : settings.handSize, { rng });
    return { state: dealt.state, perOwner: dealt.perOwner, reshuffled: dealt.reshuffled, exhausted: dealt.exhausted };
  });
  if ( result.reshuffled ) notice("Notice.Reshuffled");
  if ( result.exhausted ) notice("Notice.DeckEmpty");
  else if ( !result.perOwner.length ) notice("Notice.NothingDealt");
  for ( const { owner: item, added } of result.perOwner ) await announce(added, item, settings);
}

/** Замена вызова: новая карта, старая в сброс. */
async function swap(user, { owner, uid }, settings, notice) {
  if ( !canSwap(user, owner, settings) ) return;
  const result = await mutate(state => {
    const swapped = swapEntry(state, owner, uid, { rng });
    return { state: swapped.state, entry: swapped.entry, reshuffled: swapped.reshuffled };
  });
  if ( !result.entry ) return notice("Notice.DeckEmpty");
  if ( result.reshuffled ) notice("Notice.Reshuffled");
  // Карточка вызова обновляется на месте, как перебросанная награда: новое сообщение не появляется.
  const message = challengeMessage(owner, uid);
  if ( message ) await updateCard(message, { ...message.flags[MODULE_ID], uid: result.entry.uid, cardId: result.entry.id });
  else await announce([result.entry], owner, settings);
}

/**
 * Карточка вызова игрока (или стола) в чате по идентификатору записи в руке.
 * @param {string} owner
 * @param {string} uid
 * @returns {ChatMessage|null}
 */
function challengeMessage(owner, uid) {
  return game.messages.contents.findLast(message => {
    const flags = message.flags?.[MODULE_ID];
    return (flags?.kind === "challenge") && (flags.owner === owner) && (flags.uid === uid);
  }) ?? null;
}

/** Отказ от вызова: карта в сброс без награды. */
async function discard(user, { owner, uid }, settings) {
  if ( !canDiscard(user, owner, settings) ) return;
  await mutate(state => ({ state: discardEntry(state, owner, uid).state }));
}

/**
 * Передача вызова другому игроку (только Мастер, только игроку). Новый владелец получает карточку вызова в чат:
 * иначе о карте он узнал бы только из окна.
 */
async function transfer(user, { owner, uid, to }, settings, notice) {
  const recipient = game.users.get(to);
  if ( !user.isGM || (owner === TABLE) || !recipient || recipient.isGM ) return;
  const result = await mutate(state => {
    const next = transferEntry(state, owner, uid, to, settings.handSize);
    return { state: next ?? state, entry: next ? entriesOf(next, to).find(item => item.uid === uid) : null };
  });
  if ( !result.entry ) return notice("Notice.TransferFailed");
  await announce([result.entry], to, settings, "transfer");
}

/**
 * Есть ли уже заявка по этой карте, ожидающая решения.
 * Смотрит по всему чату (заявки живут только в сообщениях): после очистки чата защита от повторной заявки
 * пропадает, и это допустимо: вместе с карточкой пропала и сама заявка, решать по ней уже нечего.
 */
function hasPendingClaim(uid) {
  return claimsInFlight.has(uid) || game.messages.some(message => {
    const flags = message.flags?.[MODULE_ID];
    return isPendingClaim(flags) && (flags.uid === uid);
  });
}

/**
 * Заявка на награду: игрок говорит, что выполнил вызов. Мастер подтверждает карточкой в чате
 * (или заявка принимается сразу, если её подаёт Мастер или включено автоматическое принятие).
 */
async function claim(user, { owner, uid, done }, settings, notice) {
  if ( !canClaim(user, owner, settings) ) return;
  const entry = entriesOf(getState(), owner).find(item => item.uid === uid);
  const card = entry && getLibrary().get(entry.id);
  if ( !card ) return notice("Notice.ClickGone");
  const valid = validateDone({ epic: settings.epic, optionCount: card.options.length, done: expandDone(done, card.options.length) });
  if ( !valid ) return;
  if ( hasPendingClaim(uid) ) return notice("Notice.ClaimPending");

  claimsInFlight.add(uid);
  try {
    const message = await postCard({
      kind: "claim", owner, uid, cardId: card.id, by: user.id, done: valid, state: { status: CLAIM_STATUS.PENDING }
    });
    if ( user.isGM || (settings.claimMode === "auto") ) await decideClaim(message.id, "accept", notice);
  } finally {
    claimsInFlight.delete(uid);
  }
}

/** Решение Мастера по заявке (кнопки карточки). */
async function claimDecide(user, { messageId, action }, notice) {
  if ( !user.isGM ) return;
  await decideClaim(messageId, action, notice);
}

/**
 * Принимает или отклоняет заявку. Принятая: вызов уходит в сброс, каждому получателю добирается награда
 * (по одной за каждый выполненный вариант) и публикуется карточкой. Получатели общего вызова определяются
 * в момент принятия: игроки, которые сейчас в сети.
 * @param {string} messageId
 * @param {"accept"|"decline"} action
 * @param {function(string): void} notice
 */
async function decideClaim(messageId, action, notice) {
  await withLock(messageId, async () => {
    const message = game.messages.get(messageId);
    const flags = message?.flags?.[MODULE_ID];
    if ( !isPendingClaim(flags) ) return;
    const next = nextClaimState(flags.state, action);
    if ( !next ) return;
    if ( next.status === CLAIM_STATUS.DECLINED ) return updateCard(message, { ...flags, state: next });

    const recipients = (flags.owner === TABLE) ? dealRecipients(game.users, "active") : [flags.owner];
    if ( !recipients.length ) return notice("Notice.NoRecipients");

    const result = await mutate(state => {
      const awarded = awardClaim(state, { owner: flags.owner, uid: flags.uid, recipients, count: rewardsFor(flags.done) }, rng);
      return { state: awarded.state, ok: awarded.ok, rewards: awarded.rewards, short: awarded.short };
    });
    if ( !result.ok ) {
      notice("Notice.CardGone");
      return updateCard(message, { ...flags, state: { status: CLAIM_STATUS.DECLINED } });
    }
    if ( result.short ) notice("Notice.RewardsEmpty");
    await updateCard(message, { ...flags, state: next, recipients });
    for ( const reward of result.rewards ) await postReward(reward.cardId, reward.recipient);
  });
}

/** Публикует карточку награды (два результата на выбор). */
function postReward(cardId, recipient) {
  return postCard({ kind: "reward", cardId, recipient, state: initialRewardState() });
}

/**
 * Решение по награде: выбор результата, отказ, другая награда или изменение уже принятого решения.
 * Выбирает Мастер, а владелец награды только при включённой настройке участия.
 */
async function rewardAction(user, { messageId, action, value }, settings, notice) {
  await withLock(messageId, async () => {
    const message = game.messages.get(messageId);
    const flags = message?.flags?.[MODULE_ID];
    if ( flags?.kind !== "reward" ) return;
    const pending = flags.state.status === REWARD_STATUS.PENDING;
    if ( (action === "reroll") || !pending ) {
      if ( !user.isGM ) return;
    } else if ( !canDecideReward(user, flags.recipient, settings) ) {
      return;
    }

    const card = getLibrary().get(flags.cardId);
    const next = nextRewardState(flags.state, action, { value, count: card?.options.length ?? 0, revise: !pending });
    if ( !next ) return;
    const updated = { ...flags, state: next };

    if ( action === "reroll" ) {
      const result = await mutate(state => {
        const drawn = drawReward(state, rng);
        if ( !drawn.id ) return { state, id: null };
        return { state: resolveReward(drawn.state, flags.cardId), id: drawn.id };
      });
      if ( !result.id ) return notice("Notice.RewardsEmpty");
      updated.cardId = result.id;
    } else if ( pending ) {
      await mutate(state => ({ state: resolveReward(state, flags.cardId) }));
    }

    Object.assign(updated, await syncRewardItem(updated, messageId));
    await updateCard(message, updated);
  });
}

/** Награда без вызова (только Мастер, только игроку): добирается случайная награда. */
async function giveReward(user, { userId }, notice) {
  const recipient = game.users.get(userId);
  if ( !user.isGM || !recipient || recipient.isGM ) return;
  const result = await mutate(state => {
    const drawn = drawReward(state, rng);
    return { state: drawn.state, id: drawn.id };
  });
  if ( !result.id ) return notice("Notice.RewardsEmpty");
  await postReward(result.id, userId);
}

/** «Идея для Мастера»: случайная карта (вызов или награда) без раздачи, шёпотом тому, кто попросил. */
async function idea(user, { kind }) {
  if ( !user.isGM || !Object.values(KINDS).includes(kind) ) return;
  const cardId = randomId(wantedDecks()[kind], rng);
  if ( !cardId ) return;
  await postCard({ kind: "idea", cardId }, [user.id]);
}

/** Колоды заново: все карты подключённых наборов, руки и сброс очищены (только Мастер). */
async function reset(user) {
  if ( !user.isGM ) return;
  await mutate(() => ({ state: resetState(wantedDecks(), rng) }));
  ui.notifications.info(t("Notice.DecksReset"));
}

/** Награды, карточки которых ещё ждут решения. */
function liveRewardIds() {
  return game.messages.contents.filter(message => isPendingReward(message.flags?.[MODULE_ID]))
    .map(message => message.flags[MODULE_ID].cardId);
}

/**
 * Приводит колоды в порядок: к подключённым наборам, без рук удалённых игроков и без «ожидающих» наград,
 * карточки которых уже нет в чате (такие уходят в сброс). Выполняется на клиенте активного Мастера.
 * @returns {Promise<void>}
 */
export async function sync() {
  const live = liveRewardIds();
  const result = await mutate(state => {
    let current = syncDecks(state, wantedDecks(), rng);
    for ( const owner of Object.keys(current.hands) ) {
      if ( !game.users.get(owner) ) current = clearOwner(current, owner);
    }
    const reconciled = reconcilePending(current, live);
    return { state: reconciled.state, lost: reconciled.lost };
  });
  if ( result.lost.length ) ui.notifications.info(t("Notice.PendingLost", { n: result.lost.length }));
}

/**
 * Карточку модуля удалили из чата: награда, ждавшая решения, уходит в сброс. Выполняется на клиенте активного Мастера.
 * @param {ChatMessage} message
 * @returns {Promise<void>}
 */
export async function onMessageDeleted(message) {
  const flags = message.flags?.[MODULE_ID];
  if ( !isPendingReward(flags) ) return;
  await mutate(state => ({ state: resolveReward(state, flags.cardId) }));
}
