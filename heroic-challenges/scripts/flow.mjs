/**
 * Ход заявки и награды: какие варианты можно заявить и как меняется состояние карточек в чате.
 * Не зависит от Foundry, поэтому проверяется обычными тестами.
 */

export const CLAIM_STATUS = Object.freeze({ PENDING: "pending", ACCEPTED: "accepted", DECLINED: "declined" });
export const REWARD_STATUS = Object.freeze({ PENDING: "pending", CHOSEN: "chosen", DECLINED: "declined" });

/**
 * Проверяет заявленные варианты вызова.
 * Обычная игра: ровно один вариант. Эпическая сложность: выполнены должны быть все варианты карты.
 * @param {object} options
 * @param {boolean} options.epic
 * @param {number} options.optionCount  Сколько вариантов на карте.
 * @param {number[]} options.done       Номера заявленных вариантов (с нуля).
 * @returns {number[]|null}  Отсортированные номера или `null`, если заявка недопустима.
 */
export function validateDone({ epic, optionCount, done }) {
  if ( !Array.isArray(done) ) return null;
  const unique = Array.from(new Set(done));
  if ( !unique.every(index => Number.isInteger(index) && (index >= 0) && (index < optionCount)) ) return null;
  unique.sort((a, b) => a - b);
  if ( epic ) return (unique.length === optionCount) ? unique : null;
  return (unique.length === 1) ? unique : null;
}

/**
 * Сколько наград даёт заявка: по одной за каждый выполненный вариант.
 * @param {number[]} done
 * @returns {number}
 */
export function rewardsFor(done) {
  return done.length;
}

/**
 * Решение по заявке: принять или отклонить. Меняется только ожидающая заявка.
 * @param {{status: string}} state
 * @param {"accept"|"decline"} action
 * @returns {{status: string}|null}  Новое состояние или `null`, если действие недопустимо.
 */
export function nextClaimState(state, action) {
  if ( state.status !== CLAIM_STATUS.PENDING ) return null;
  if ( action === "accept" ) return { status: CLAIM_STATUS.ACCEPTED };
  if ( action === "decline" ) return { status: CLAIM_STATUS.DECLINED };
  return null;
}

/** @returns {object} Начальное состояние награды. */
export function initialRewardState() {
  return { status: REWARD_STATUS.PENDING, choice: null, rerolls: 0 };
}

/**
 * Переход состояния награды.
 * - `choose`: выбран результат `value` (номер варианта);
 * - `decline`: отказ;
 * - `reroll`: другая награда, пока решения нет.
 * Уже принятое решение может менять только Мастер (`revise`), и перебросить после решения нельзя.
 * @param {object} state
 * @param {"choose"|"decline"|"reroll"} action
 * @param {object} context
 * @param {number|string} [context.value]
 * @param {number} context.count       Сколько вариантов на карте.
 * @param {boolean} [context.revise]   Решение меняется уже после принятия.
 * @returns {object|null}
 */
export function nextRewardState(state, action, { value, count, revise=false }) {
  const pending = state.status === REWARD_STATUS.PENDING;
  if ( !pending && !revise ) return null;
  switch ( action ) {
    case "choose": {
      const index = Number(value);
      if ( !Number.isInteger(index) || (index < 0) || (index >= count) ) return null;
      return { ...state, status: REWARD_STATUS.CHOSEN, choice: index };
    }
    case "decline":
      return { ...state, status: REWARD_STATUS.DECLINED, choice: null };
    case "reroll":
      return pending ? { ...initialRewardState(), rerolls: state.rerolls + 1 } : null;
    default:
      return null;
  }
}

/**
 * Кнопки карточки награды по состоянию.
 * @param {object} state
 * @param {number} count
 * @returns {{action: string, value?: number}[]}
 */
export function rewardButtons(state, count) {
  if ( state.status !== REWARD_STATUS.PENDING ) return [{ action: "revise" }];
  const buttons = Array.from({ length: count }, (_, value) => ({ action: "choose", value }));
  buttons.push({ action: "reroll" }, { action: "decline" });
  return buttons;
}

/**
 * Заявленные варианты из запроса: `"all"` значит все варианты карты (эпическая сложность), иначе список номеров.
 * @param {"all"|number[]} done
 * @param {number} optionCount
 * @returns {number[]|*}  Список номеров (или исходное значение, если это не `"all"`, для последующей проверки).
 */
export function expandDone(done, optionCount) {
  return (done === "all") ? Array.from({ length: optionCount }, (_, i) => i) : done;
}
