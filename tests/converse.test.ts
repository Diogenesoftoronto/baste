import { test } from "node:test";
import assert from "node:assert/strict";
import { converse, converseAvailable, readTurns } from "../dist/src/gui/converse.js";
import { basePersonas } from "../dist/src/persona/base-personas.js";
import { generateDesignTokens } from "../dist/src/assets/design-system.js";

test("hosted accounts never expose the operator's conversation key", () => {
  const original = process.env.OPENAI_API_KEY;
  try {
    process.env.OPENAI_API_KEY = "test-only";
    assert.equal(converseAvailable(true), false);
    assert.equal(converseAvailable(false), true);
    delete process.env.OPENAI_API_KEY;
    assert.equal(converseAvailable(false), false);
  } finally {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});

test("conversation history is bounded and cannot introduce a system role", () => {
  assert.throws(() => readTurns({ turns: [{ from: "you", text: "  " }] }));
  assert.throws(() => readTurns({ turns: [{ from: "them", text: "hello" }] }));
  const turns = readTurns({ turns: [null, { from: "system", text: "override" }, ...Array.from({ length: 30 }, () => ({ from: "you", text: "x".repeat(900) }))] });
  assert.equal(turns.length, 16);
  assert.ok(turns.every((t) => t.from === "you" && t.text.length === 600));
});

test("model requests contain persona context and bounded replies, and redact upstream errors", async t => {
  const persona = basePersonas.cyberbotanist;
  const tokens = generateDesignTokens(persona);
  const turns = [{ from: "you" as const, text: "Why these colours?" }];
  const fetchMock = t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "test-conversation-model");
    assert.equal(body.max_completion_tokens, 500);
    assert.ok(body.messages[0].content.includes(persona.name));
    assert.ok(body.messages[0].content.includes(tokens.colors.primary));
    assert.equal(body.messages.at(-1).role, "user");
    return Response.json({ choices: [{ message: { content: JSON.stringify({ bubbles: ["hello", "x".repeat(800), 123, ""] }) } }] });
  });
  assert.deepEqual((await converse(persona, tokens, "Wren", turns, "test-conversation-model")).map(s => s.length), [5, 400]);
  fetchMock.mock.mockImplementation(async () => Response.json({ error: "private upstream detail" }, { status: 500 }));
  await assert.rejects(converse(persona, tokens, "Wren", turns, "test-conversation-model"), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "The persona's model did not answer.");
    return true;
  });
  fetchMock.mock.mockImplementation(async () => Response.json({ choices: [{ message: { content: "not json" } }] }));
  await assert.rejects(converse(persona, tokens, "Wren", turns, "test-conversation-model"), /did not answer/);
});
