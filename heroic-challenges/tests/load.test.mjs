import { test } from "node:test";
import assert from "node:assert/strict";

// Заглушка: класс кнопок в настройках и класс окна наследуются от приложения Foundry.
globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: Base => class extends Base {} } } };

test("модули с кодом Foundry подключаются без ошибок (все импорты на месте)", async () => {
  const hooks = [];
  globalThis.Hooks = { once: (name, fn) => hooks.push(["once", name, fn]), on: (name, fn) => hooks.push(["on", name, fn]) };
  try {
    await import("../scripts/main.mjs");
    const names = hooks.map(([, name]) => name);
    for ( const name of ["init", "ready", "renderSettingsConfig", "getSceneControlButtons", "renderChatMessageHTML"] ) {
      assert.ok(names.includes(name), name);
    }
  } finally {
    delete globalThis.Hooks;
  }
});

test("кнопка в панели инструментов добавляется в группу токенов", async () => {
  const hooks = [];
  globalThis.Hooks = { once: () => {}, on: (name, fn) => hooks.push([name, fn]) };
  try {
    await import(`../scripts/main.mjs?again`);
    const [, handler] = hooks.find(([name]) => name === "getSceneControlButtons");
    const controls = { tokens: { tools: { select: {} } } };
    handler(controls);
    assert.equal(controls.tokens.tools.heroicChallenges.title, "HEROIC.Title");
    assert.ok(controls.tokens.tools.heroicChallenges.button);
    handler({});
  } finally {
    delete globalThis.Hooks;
  }
});
