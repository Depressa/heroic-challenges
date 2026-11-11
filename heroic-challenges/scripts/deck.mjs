import { KINDS } from "./cards.mjs";

/**
 * Состояние колод и рук. Все функции чистые: возвращают новое состояние и не меняют переданное.
 *
 * Состояние: `{ v, decks: {challenge, reward}, discards: {challenge, reward}, pending, hands, table }`.
 * - `decks`: стопки добора, верх — начало списка;
 * - `discards`: сброс;
 * - `pending`: награды, вытянутые из колоды, но ещё не решённые (лежат в карточке чата);
 * - `hands`: руки игроков, `{ [userId]: [{ uid, id }] }`;
 * - `table`: общий вызов группы или тема сессии, `[{ uid, id }]`.
 */

/** Владелец общего вызова (групповой вызов или тема сессии). */
export const TABLE = "table";

/** Случайная строка для идентификатора записи в руке. */
function defaultUid() {
  return Math.random().toString(36).slice(2, 10);
}

/** @returns {object} Пустое состояние. */
export function emptyState() {
  return {
    v: 1,
    decks: { [KINDS.CHALLENGE]: [], [KINDS.REWARD]: [] },
    discards: { [KINDS.CHALLENGE]: [], [KINDS.REWARD]: [] },
    pending: [],
    hands: {},
    table: []
  };
}

/**
 * Перемешивание (Фишер — Йетс).
 * @param {string[]} list
 * @param {function(): number} [rng=Math.random]
 * @returns {string[]}
 */
export function shuffle(list, rng=Math.random) {
  const result = [...list];
  for ( let i = result.length - 1; i > 0; i-- ) {
    const j = Math.min(Math.floor(rng() * (i + 1)), i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Записи владельца (руки игрока или общего вызова).
 * @param {object} state
 * @param {string} owner  Идентификатор пользователя или {@link TABLE}.
 * @returns {{uid: string, id: string}[]}
 */
export function entriesOf(state, owner) {
  if ( owner === TABLE ) return state.table;
  // Владелец приходит из запроса: чужие свойства объекта (например, `__proto__`) рукой не считаются.
  return Object.hasOwn(state.hands, owner) ? state.hands[owner] : [];
}

/** Состояние с заменёнными записями владельца. */
function withEntries(state, owner, entries) {
  if ( owner === TABLE ) return { ...state, table: entries };
  const hands = { ...state.hands, [owner]: entries };
  if ( !entries.length ) delete hands[owner];
  return { ...state, hands };
}

/** Все идентификаторы вызовов, лежащие в руках и на столе. */
function heldIds(state) {
  return [...state.table, ...Object.values(state.hands).flat()].map(entry => entry.id);
}

/** Состояние с картой, добавленной наверх сброса вызовов. */
function withDiscarded(state, id) {
  return { ...state, discards: { ...state.discards, [KINDS.CHALLENGE]: [id, ...state.discards[KINDS.CHALLENGE]] } };
}

/**
 * Колоды заново: все карты нужных наборов, перемешаны; руки и сброс очищены.
 * @param {{challenge: string[], reward: string[]}} wanted  Карты подключённых наборов.
 * @param {function(): number} [rng]
 * @returns {object}
 */
export function resetState(wanted, rng=Math.random) {
  const state = emptyState();
  state.decks = {
    [KINDS.CHALLENGE]: shuffle(wanted[KINDS.CHALLENGE], rng),
    [KINDS.REWARD]: shuffle(wanted[KINDS.REWARD], rng)
  };
  return state;
}

/**
 * Приводит колоды в соответствие с подключёнными наборами: карты отключённых наборов уходят из колоды и сброса
 * (то, что уже в руках, остаётся), новые карты замешиваются в колоду.
 * @param {object} state
 * @param {{challenge: string[], reward: string[]}} wanted
 * @param {function(): number} [rng]
 * @returns {object}
 */
export function syncDecks(state, wanted, rng=Math.random) {
  const held = new Set(heldIds(state));
  const decks = {};
  const discards = {};
  for ( const kind of Object.values(KINDS) ) {
    const allowed = new Set(wanted[kind]);
    const deck = state.decks[kind].filter(id => allowed.has(id));
    const discard = state.discards[kind].filter(id => allowed.has(id));
    const present = new Set([...deck, ...discard, ...held, ...state.pending]);
    const missing = wanted[kind].filter(id => !present.has(id));
    decks[kind] = missing.length ? shuffle([...deck, ...missing], rng) : deck;
    discards[kind] = discard;
  }
  return { ...state, decks, discards };
}

/**
 * Берёт верхнюю карту колоды. Если колода пуста, сброс перемешивается в новую колоду.
 * @param {object} state
 * @param {string} kind
 * @param {function(): number} [rng]
 * @returns {{state: object, id: (string|null), reshuffled: boolean}}  `id` равен `null`, если карт нет совсем.
 */
export function draw(state, kind, rng=Math.random) {
  let deck = state.decks[kind];
  let discard = state.discards[kind];
  let reshuffled = false;
  if ( !deck.length && discard.length ) {
    deck = shuffle(discard, rng);
    discard = [];
    reshuffled = true;
  }
  if ( !deck.length ) return { state, id: null, reshuffled };
  const [id, ...rest] = deck;
  return {
    state: {
      ...state,
      decks: { ...state.decks, [kind]: rest },
      discards: { ...state.discards, [kind]: discard }
    },
    id,
    reshuffled
  };
}

/**
 * Добирает вызовы владельцу до нужного размера руки (или пока не кончатся карты).
 * @param {object} state
 * @param {string} owner
 * @param {object} options
 * @param {number} options.limit            Сколько вызовов должно быть на руках.
 * @param {function(): number} [options.rng]
 * @param {function(): string} [options.uid]
 * @returns {{state: object, added: {uid: string, id: string}[], reshuffled: boolean}}
 */
export function dealChallenge(state, owner, { limit, rng=Math.random, uid=defaultUid }) {
  let current = state;
  const added = [];
  let reshuffled = false;
  while ( entriesOf(current, owner).length < limit ) {
    const result = draw(current, KINDS.CHALLENGE, rng);
    if ( !result.id ) break;
    reshuffled ||= result.reshuffled;
    const entry = { uid: uid(), id: result.id };
    current = withEntries(result.state, owner, [...entriesOf(result.state, owner), entry]);
    added.push(entry);
  }
  return { state: current, added, reshuffled };
}

/**
 * Убирает вызов из руки в сброс (выполнен или от него отказались).
 * @param {object} state
 * @param {string} owner
 * @param {string} entryUid
 * @returns {{state: object, entry: (object|null)}}
 */
export function discardEntry(state, owner, entryUid) {
  const entries = entriesOf(state, owner);
  const entry = entries.find(item => item.uid === entryUid);
  if ( !entry ) return { state, entry: null };
  return { state: withDiscarded(withEntries(state, owner, entries.filter(item => item !== entry)), entry.id), entry };
}

/**
 * Заменяет вызов: берёт новую карту, старая уходит в сброс. Если новой карты нет, ничего не меняется.
 * @param {object} state
 * @param {string} owner
 * @param {string} entryUid
 * @param {{rng?: function(): number, uid?: function(): string}} [options]
 * @returns {{state: object, entry: (object|null), reshuffled: boolean}}  `entry`: новая запись.
 */
export function swapEntry(state, owner, entryUid, { rng=Math.random, uid=defaultUid }={}) {
  const entries = entriesOf(state, owner);
  const old = entries.find(item => item.uid === entryUid);
  if ( !old ) return { state, entry: null, reshuffled: false };
  const drawn = draw(state, KINDS.CHALLENGE, rng);
  if ( !drawn.id ) return { state, entry: null, reshuffled: false };
  const entry = { uid: uid(), id: drawn.id };
  const next = withEntries(drawn.state, owner, entries.map(item => (item === old) ? entry : item));
  return { state: withDiscarded(next, old.id), entry, reshuffled: drawn.reshuffled };
}

/**
 * Передаёт вызов другому владельцу. Если у получателя рука полна, ничего не происходит.
 * @param {object} state
 * @param {string} from
 * @param {string} entryUid
 * @param {string} to
 * @param {number} limit  Размер руки получателя.
 * @returns {object|null}  Новое состояние или `null`, если передать нельзя.
 */
export function transferEntry(state, from, entryUid, to, limit) {
  if ( from === to ) return null;
  const entry = entriesOf(state, from).find(item => item.uid === entryUid);
  if ( !entry || (entriesOf(state, to).length >= limit) ) return null;
  const next = withEntries(state, from, entriesOf(state, from).filter(item => item !== entry));
  return withEntries(next, to, [...entriesOf(next, to), entry]);
}

/**
 * Добирает награду: карта уходит в «ожидающие» (до решения по карточке).
 * @param {object} state
 * @param {function(): number} [rng]
 * @returns {{state: object, id: (string|null), reshuffled: boolean}}
 */
export function drawReward(state, rng=Math.random) {
  const result = draw(state, KINDS.REWARD, rng);
  if ( !result.id ) return result;
  return { ...result, state: { ...result.state, pending: [...result.state.pending, result.id] } };
}

/**
 * Решённая награда уходит из «ожидающих» в сброс.
 * @param {object} state
 * @param {string} id
 * @returns {object}
 */
export function resolveReward(state, id) {
  const index = state.pending.indexOf(id);
  if ( index < 0 ) return state;
  return {
    ...state,
    pending: state.pending.filter((_, i) => i !== index),
    discards: { ...state.discards, [KINDS.REWARD]: [id, ...state.discards[KINDS.REWARD]] }
  };
}

/**
 * Убирает все записи владельца в сброс (например, игрока удалили из мира).
 * @param {object} state
 * @param {string} owner
 * @returns {object}
 */
export function clearOwner(state, owner) {
  let current = state;
  for ( const { uid } of entriesOf(state, owner) ) current = discardEntry(current, owner, uid).state;
  return current;
}

/**
 * Сколько карт в колодах, сбросе и (у наград) в ожидании решения.
 * @param {object} state
 * @returns {{challenge: {deck: number, discard: number}, reward: {deck: number, discard: number, pending: number}}}
 */
export function counts(state) {
  const of = kind => ({ deck: state.decks[kind].length, discard: state.discards[kind].length });
  return { [KINDS.CHALLENGE]: of(KINDS.CHALLENGE), [KINDS.REWARD]: { ...of(KINDS.REWARD), pending: state.pending.length } };
}

/**
 * Раздаёт вызовы нескольким владельцам одним изменением состояния.
 * @param {object} state
 * @param {string[]} owners
 * @param {function(string): number} limitFor  Размер руки владельца.
 * @param {{rng?: function(): number, uid?: function(): string}} [options]
 * @returns {{state: object, perOwner: {owner: string, added: object[]}[], reshuffled: boolean, exhausted: boolean}}
 *          `exhausted`: кому-то не хватило карт.
 */
export function dealMany(state, owners, limitFor, { rng=Math.random, uid=defaultUid }={}) {
  let current = state;
  const perOwner = [];
  let reshuffled = false;
  let exhausted = false;
  for ( const owner of owners ) {
    const limit = limitFor(owner);
    const dealt = dealChallenge(current, owner, { limit, rng, uid });
    current = dealt.state;
    reshuffled ||= dealt.reshuffled;
    if ( entriesOf(current, owner).length < limit ) exhausted = true;
    if ( dealt.added.length ) perOwner.push({ owner, added: dealt.added });
  }
  return { state: current, perOwner, reshuffled, exhausted };
}

/**
 * Засчитанная заявка: вызов уходит в сброс, каждому получателю добирается по награде за каждый выполненный вариант.
 * @param {object} state
 * @param {object} claim
 * @param {string} claim.owner
 * @param {string} claim.uid
 * @param {string[]} claim.recipients
 * @param {number} claim.count       Наград на получателя.
 * @param {function(): number} [rng]
 * @returns {{state: object, ok: boolean, rewards: {recipient: string, cardId: string}[], short: boolean}}
 *          `ok: false` — вызова уже нет в руке; `short` — наград не хватило.
 */
export function awardClaim(state, { owner, uid, recipients, count }, rng=Math.random) {
  if ( !entriesOf(state, owner).some(item => item.uid === uid) ) return { state, ok: false, rewards: [], short: false };
  let current = discardEntry(state, owner, uid).state;
  const rewards = [];
  for ( const recipient of recipients ) {
    for ( let i = 0; i < count; i++ ) {
      const drawn = drawReward(current, rng);
      if ( !drawn.id ) return { state: current, ok: true, rewards, short: true };
      current = drawn.state;
      rewards.push({ recipient, cardId: drawn.id });
    }
  }
  return { state: current, ok: true, rewards, short: false };
}

/**
 * Сверяет «ожидающие» награды с карточками в чате: награды, у которых карточки уже нет, уходят в сброс.
 * @param {object} state
 * @param {string[]} liveIds  Идентификаторы наград из карточек, ещё ждущих решения.
 * @returns {{state: object, lost: string[]}}
 */
export function reconcilePending(state, liveIds) {
  const live = new Set(liveIds);
  const lost = state.pending.filter(id => !live.has(id));
  let current = state;
  for ( const id of lost ) current = resolveReward(current, id);
  return { state: current, lost };
}
