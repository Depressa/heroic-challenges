import { CLAIM_STATUS, REWARD_STATUS } from "./flow.mjs";
import { canClaim, canDecideReward } from "./permissions.mjs";

/**
 * Что пользователь может делать с карточкой в чате: какие кнопки ему не показывать и нажимаются ли варианты.
 * Решается на клиенте при показе (а не зашивается в текст сообщения), поэтому действует и для старых карточек.
 * Не зависит от Foundry, проверяется тестами.
 * @param {object} flags  Флаги карточки (`kind`, `owner`, `recipient`, `state`).
 * @param {{id: string, isGM: boolean}} user
 * @param {object} settings  `playerClaims`, `playerParticipates`, `epic`.
 * @returns {{hidden: string[], clickKind: ("claim"|"choose"|null), titleKey: (string|null), optionValue: function(number): (number|string)}}
 *          `hidden`: действия кнопок, которые убрать; `titleKey`: подсказка к варианту (полный ключ локализации).
 */
export function cardControls(flags, user, settings) {
  const hidden = new Set();
  let clickKind = null;

  if ( flags.kind === "claim" ) {
    if ( !user.isGM ) hidden.add("accept").add("decline");
  } else if ( flags.kind === "reward" ) {
    const decides = canDecideReward(user, flags.recipient, settings);
    if ( !decides ) hidden.add("choose").add("decline");
    if ( !user.isGM ) hidden.add("reroll").add("revise");
    if ( decides && (flags.state?.status === REWARD_STATUS.PENDING) ) clickKind = "choose";
  } else if ( flags.kind === "challenge" ) {
    if ( canClaim(user, flags.owner, settings) ) clickKind = "claim";
  }

  const epicClaim = (clickKind === "claim") && !!settings.epic;
  const titleKey = (clickKind === "choose") ? "HEROIC.Click.Choose"
    : (clickKind === "claim") ? (epicClaim ? "HEROIC.Click.ClaimAll" : "HEROIC.Click.Claim") : null;
  return {
    hidden: Array.from(hidden),
    clickKind,
    titleKey,
    optionValue: index => (epicClaim ? "all" : index)
  };
}

/**
 * Ждёт ли заявка решения (по флагам карточки заявки).
 * @param {object} flags
 * @returns {boolean}
 */
export function isPendingClaim(flags) {
  return (flags?.kind === "claim") && (flags.state?.status === CLAIM_STATUS.PENDING);
}

/**
 * Ждёт ли награда решения (по флагам карточки награды).
 * @param {object} flags
 * @returns {boolean}
 */
export function isPendingReward(flags) {
  return (flags?.kind === "reward") && (flags.state?.status === REWARD_STATUS.PENDING);
}
