import { MODULE_ID, addGroupHeadings, registerSettings } from "./settings.mjs";
import { FACE_PARTIALS, bindButtons } from "./chat.mjs";
import { ensureDecks, getLibrary, loadLibrary, markReady } from "./store.mjs";
import { onMessageDeleted, registerSocket, requestAction, sync } from "./actions.mjs";
import { onFaceClick } from "./click.mjs";
import { openWindow, refreshWindow } from "./window.mjs";
import { WINDOW_COMMAND } from "./commands.mjs";

/** Перерисовка окна с задержкой: несколько изменений подряд дают одну перерисовку. */
let refreshDebounced;
function refreshSoon() {
  refreshDebounced ??= foundry.utils.debounce(refreshWindow, 50);
  refreshDebounced();
}

/** Колоды приводит в порядок активный Мастер (состав наборов, удалённые игроки, потерянные награды). */
function syncIfGM() {
  if ( game.users.activeGM?.isSelf ) sync();
}

Hooks.once("init", () => {
  registerSettings({ onSetsChanged: syncIfGM, onStateChanged: refreshSoon });
  // Сокет слушается с самого начала: запросы игроков, пришедшие до загрузки данных, дождутся её.
  registerSocket();
  // Команда `/hc` (или `/вызовы`) в чате открывает окно; `false` не даёт отправить её текст в чат.
  foundry.applications.sidebar.tabs.ChatLog.CHAT_COMMANDS.hc = {
    rgx: WINDOW_COMMAND,
    fn: () => {
      openWindow();
      return false;
    }
  };
});
Hooks.on("renderSettingsConfig", addGroupHeadings);

Hooks.once("ready", async () => {
  await loadLibrary();
  await foundry.applications.handlebars.loadTemplates(FACE_PARTIALS);
  if ( game.users.activeGM?.isSelf ) {
    await ensureDecks();
    await sync();
  }
  markReady();
  game.modules.get(MODULE_ID).api = { open: openWindow, request: requestAction, library: getLibrary };
});

/** Кнопка «Героические вызовы» в инструментах токенов (для всех). */
Hooks.on("getSceneControlButtons", controls => {
  const tools = controls.tokens?.tools;
  if ( !tools ) return;
  tools.heroicChallenges = {
    name: "heroicChallenges",
    title: "HEROIC.Title",
    toolclip: { heading: "HEROIC.Title", items: [{ paragraph: "HEROIC.ToolHint" }] },
    icon: "fa-solid fa-dragon",
    order: Object.keys(tools).length,
    button: true,
    onChange: () => openWindow()
  };
});

Hooks.on("renderChatMessageHTML", (message, html) => bindButtons(message, html, requestAction, onFaceClick));

// Окно показывает игроков и их персонажей: перерисовываем, когда они появляются, уходят или меняются.
Hooks.on("userConnected", refreshSoon);
Hooks.on("updateUser", (user, changes) => {
  if ( ("name" in changes) || ("character" in changes) || ("role" in changes) ) refreshSoon();
});
Hooks.on("deleteUser", () => {
  refreshSoon();
  syncIfGM();
});

// Заявки и награды живут в чате: окно показывает, какие вызовы уже заявлены, а удалённая карточка награды
// возвращает карту в игру.
Hooks.on("createChatMessage", message => {
  if ( message.flags?.[MODULE_ID]?.kind === "claim" ) refreshSoon();
});
Hooks.on("updateChatMessage", (message, changes) => {
  if ( changes.flags?.[MODULE_ID] ) refreshSoon();
});
Hooks.on("deleteChatMessage", message => {
  if ( !message.flags?.[MODULE_ID] ) return;
  refreshSoon();
  if ( game.users.activeGM?.isSelf ) onMessageDeleted(message);
});
