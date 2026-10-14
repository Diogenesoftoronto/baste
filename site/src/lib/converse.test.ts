import assert from "node:assert/strict";
import { test } from "node:test";
import { askFor, classify, greet, respond, suggestions, type Topic } from "./converse";
import { DEMO_PERSONAS, DEMO_TOKENS } from "./demo-data";
import { contrastRatio } from "./fitting";

test("every suggested question reaches the advertised topic", () => {
  const topics: Topic[] = ["who", "influences", "colour", "dislikes", "type", "density", "motion", "process", "judge", "make", "own", "others", "thanks"];
  for (const topic of topics) assert.equal(classify(askFor(topic)), topic, askFor(topic));
  assert.equal(classify("How does the motion work?"), "motion");
  assert.equal(classify("What music do you like while you work?"), "influences");
  assert.equal(classify("Thanks, but why these colours?"), "colour");
  assert.equal(classify("Tell me about animations"), "motion");
});

test("all persona replies are nonempty and their samples use their actual tokens", () => {
  for (const persona of DEMO_PERSONAS) {
    const tokens = DEMO_TOKENS[persona.id];
    assert.ok(greet(persona, tokens).length);
    const colour = respond(persona, tokens, "Why these colours?", []);
    const palette = colour.bubbles.find((b) => b.attach?.kind === "palette")?.attach;
    assert.ok(palette?.kind === "palette");
    assert.equal(palette.swatches.find((s) => s.role === "primary")?.hex, tokens.colors.primary);
    for (const topic of ["who", "influences", "dislikes", "type", "density", "motion", "process", "judge", "make", "own", "others"] as Topic[]) {
      const answer = respond(persona, tokens, askFor(topic), []);
      assert.equal(answer.topic, topic);
      assert.ok(answer.bubbles.every((b) => b.text.trim().length > 0 && !b.text.includes("undefined")));
    }
  }
});

test("suggestions advance, and unknown questions stay explicitly unanswered", () => {
  const covered: Topic[] = ["who", "influences", "colour", "dislikes"];
  assert.ok(suggestions(covered).every(({ topic }) => !covered.includes(topic)));
  const p = DEMO_PERSONAS[0];
  assert.equal(respond(p, DEMO_TOKENS[p.id], "How many moons orbit Saturn?", []).topic, "unknown");
});

test("conversation text and placeholders meet AA against persona surfaces", () => {
  for (const tokens of Object.values(DEMO_TOKENS)) {
    for (const ground of [tokens.colors.surface, tokens.colors.background]) {
      assert.ok(contrastRatio(tokens.colors.text, ground) >= 4.5);
      assert.ok(contrastRatio(tokens.colors.textMuted, ground) >= 4.5);
    }
  }
});
