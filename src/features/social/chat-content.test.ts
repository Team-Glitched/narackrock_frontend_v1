import assert from "node:assert/strict";
import test from "node:test";
import { chatMessageContent } from "./chat-messages.ts";

test("chat accepts 2000 code points and rejects 2001", () => {
  const ascii = "x".repeat(2000);
  const emoji = "🎹".repeat(2000);
  assert.equal(chatMessageContent(ascii), ascii);
  assert.equal(chatMessageContent(emoji), emoji);
  assert.equal(chatMessageContent(`${ascii}x`), null);
  assert.equal(chatMessageContent(`${emoji}x`), null);
});

test("chat trims edges while preserving internal line breaks and rejects invisible/whitespace-only drafts", () => {
  assert.equal(chatMessageContent("  first\nsecond  "), "first\nsecond");
  assert.equal(chatMessageContent(" \n\t "), null);
  assert.equal(chatMessageContent("\u3164\u2800\u200B"), null);
  assert.equal(chatMessageContent("\u3164안\u200B녕\n하\u2800세요\uFEFF"), "안녕\n하세요");
});
