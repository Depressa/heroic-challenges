import { test } from "node:test";
import assert from "node:assert/strict";
import { WINDOW_COMMAND } from "../scripts/commands.mjs";

test("команда окна: /hc и /вызовы распознаются с регистром и лишними словами", () => {
  assert.equal(WINDOW_COMMAND.test("/hc"), true);
  assert.equal(WINDOW_COMMAND.test("/HC"), true);
  assert.equal(WINDOW_COMMAND.test("/вызовы"), true);
  assert.equal(WINDOW_COMMAND.test("/Вызовы что-то"), true);
});

test("команда окна: другие сообщения и команды не затрагиваются", () => {
  assert.equal(WINDOW_COMMAND.test("/hcx"), false);
  assert.equal(WINDOW_COMMAND.test("/вызов"), false);
  assert.equal(WINDOW_COMMAND.test("/r 1d20"), false);
  assert.equal(WINDOW_COMMAND.test("hc"), false);
  assert.equal(WINDOW_COMMAND.test("привет /hc"), false);
  assert.equal(WINDOW_COMMAND.test(""), false);
});
