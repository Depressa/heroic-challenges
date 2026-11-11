import { entriesOf } from "./deck.mjs";
import { requestAction } from "./actions.mjs";
import { t } from "./i18n.mjs";
import { currentSettings } from "./settings.mjs";
import { getState } from "./store.mjs";

/**
 * Щелчок по варианту вызова (в окне или на карточке в чате): заявка выполнения после подтверждения.
 * При эпической сложности любой вариант заявляет все.
 * @param {HTMLElement} target  Элемент варианта с данными `data-hc-*`.
 * @returns {Promise<void>}
 */
export async function onFaceClick(target) {
  const { hcClick, hcOwner, hcUid, hcOption } = target.dataset;
  if ( hcClick !== "claim" ) return;
  if ( !entriesOf(getState(), hcOwner).some(entry => entry.uid === hcUid) ) {
    return void ui.notifications.warn(t("Notice.ClickGone"));
  }
  const epic = currentSettings().epic;
  const yes = await foundry.applications.api.DialogV2.confirm({
    window: { title: t("Click.ClaimTitle") },
    content: `<p>${t(epic ? "Click.ClaimAllConfirm" : "Click.ClaimConfirm")}</p>`,
    rejectClose: false
  });
  if ( yes ) requestAction("claim", { owner: hcOwner, uid: hcUid, done: epic ? "all" : [Number(hcOption)] });
}
