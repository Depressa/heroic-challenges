import { TABLE } from "./deck.mjs";

/**
 * Права: кто что может делать. Не зависит от Foundry (пользователь описывается простым объектом).
 * `user`: `{ id, isGM }`; `owner`: идентификатор владельца руки или {@link TABLE}.
 */

/**
 * Относится ли рука к пользователю. Общий вызов (стол) доступен любому игроку.
 * @param {{id: string, isGM: boolean}} user
 * @param {string} owner
 * @returns {boolean}
 */
export function ownsHand(user, owner) {
  return (owner === TABLE) ? !user.isGM : (user.id === owner);
}

/**
 * Может ли пользователь вытянуть вызов для владельца: Мастер всегда, игрок только себе и по настройке.
 * Общий вызов тянет только Мастер.
 */
export function canDraw(user, owner, { playerParticipates }) {
  return user.isGM || ((owner !== TABLE) && (user.id === owner) && playerParticipates);
}

/**
 * Может ли пользователь заменить вызов: Мастер всегда (кроме запрета), игрок свой вызов только по настройке.
 * Общий вызов (стол) меняет только Мастер: он один на всех.
 */
export function canSwap(user, owner, { swapPolicy }) {
  if ( swapPolicy === "none" ) return false;
  return user.isGM || ((owner !== TABLE) && (swapPolicy === "owner") && ownsHand(user, owner));
}

/**
 * Может ли пользователь отказаться от вызова (сбросить его без награды): Мастер, а игрок свой вызов по настройке
 * участия. Общий вызов сбрасывает только Мастер.
 */
export function canDiscard(user, owner, { playerParticipates }) {
  return user.isGM || ((owner !== TABLE) && ownsHand(user, owner) && playerParticipates);
}

/** Может ли пользователь заявить выполнение вызова: Мастер всегда, игрок по настройке. */
export function canClaim(user, owner, { playerClaims }) {
  return user.isGM || (ownsHand(user, owner) && playerClaims);
}

/**
 * Может ли пользователь выбрать результат награды: Мастер всегда, владелец награды по настройке участия.
 * @param {{id: string, isGM: boolean}} user
 * @param {string|null} recipientUserId  Игрок, получающий награду.
 * @param {{playerParticipates: boolean}} settings
 */
export function canDecideReward(user, recipientUserId, { playerParticipates }) {
  return user.isGM || ((user.id === recipientUserId) && playerParticipates);
}

/**
 * Видна ли пользователю карта в руке.
 * - `all`: всем;
 * - `owner`: владельцу и Мастеру;
 * - `secret`: только владельцу (общий вызов при этом виден всем).
 * @param {{id: string, isGM: boolean}} user
 * @param {string} owner
 * @param {"all"|"owner"|"secret"} visibility
 * @returns {boolean}
 */
export function canSeeHand(user, owner, visibility) {
  if ( (owner === TABLE) || (visibility === "all") ) return true;
  if ( visibility === "owner" ) return user.isGM || (user.id === owner);
  return user.id === owner;
}

/**
 * Кому адресована карточка раздачи: `null` значит всем, иначе список пользователей.
 * @param {"all"|"owner"|"secret"} visibility
 * @param {string} owner
 * @param {string[]} gmIds
 * @returns {string[]|null}
 */
export function whisperTargets(visibility, owner, gmIds) {
  if ( (owner === TABLE) || (visibility === "all") ) return null;
  if ( visibility === "owner" ) return Array.from(new Set([owner, ...gmIds]));
  return [owner];
}

/**
 * Кому раздавать вызовы: игрокам (не Мастерам), по настройке только тем, кто в сети.
 * @param {{id: string, isGM: boolean, active: boolean}[]} users
 * @param {"active"|"all"} dealTo
 * @returns {string[]}
 */
export function dealRecipients(users, dealTo) {
  return users.filter(user => !user.isGM && ((dealTo === "all") || user.active)).map(user => user.id);
}
