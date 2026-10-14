import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ImageGenerator } from "../dist/src/assets/generators.js";
import { toBasteConfig } from "../dist/src/config/baste-config.js";
import { evaluateBatch } from "../dist/src/evaluation/judge.js";
import { scoreQuestions } from "../dist/src/evaluation/typesafe-judge.js";
import { basePersonas } from "../dist/src/persona/base-personas.js";

const persona = basePersonas.cyberbotanist;
const image = { kind: "image" as const, purpose: "hero", description: "Forest" };
const prompt = { prompt: "Bioluminescent organic forest", systemContext: "Art", parameters: {} };

test("hosted images use account transport and never direct provider credentials", async t => {
  const outputDir = mkdtempSync(join(tmpdir(), "baste-hosted-"));
  t.after(() => rmSync(outputDir, { recursive: true, force: true }));
  const config = toBasteConfig({ outputDir }, { imageProvider: "notorganic" });
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const generator = new ImageGenerator({ ...config.generation,
    openaiApiKey: "must-not-be-used", notOrganicFetch: async (path, init) => {
      calls.push({ path, init });
      return Response.json({ data: [{ b64_json: Buffer.from("image artifact").toString("base64") }] });
    },
  });
  const artifact = await generator.generate(persona, image, prompt);
  assert.equal(calls[0].path, "/v1/images/generations");
  assert.equal(JSON.parse(String(calls[0].init?.body)).model, "image");
  assert.equal(new Headers(calls[0].init?.headers).has("Authorization"), false);
  assert.equal(artifact.metadata.service, "notorganic");
  assert.equal(readFileSync(artifact.content, "utf8"), "image artifact");
});

test("hosted image authentication and payment failures cannot fall back to BYOK", async t => {
  const outputDir = mkdtempSync(join(tmpdir(), "baste-hosted-"));
  t.after(() => rmSync(outputDir, { recursive: true, force: true }));
  const config = { outputDir, imageProvider: "notorganic" as const, openaiApiKey: "must-not-be-used" };
  await assert.rejects(new ImageGenerator(config).generate(persona, image, prompt), /Sign in/);
  for (const status of [401, 402, 403, 503]) {
    await assert.rejects(new ImageGenerator({ ...config, notOrganicFetch: async () =>
      Response.json({ error: "sensitive upstream payload" }, { status }),
    }).generate(persona, image, prompt), error => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes("sensitive"));
      return true;
    });
  }
  await assert.rejects(new ImageGenerator({ ...config, imageModel: "unapproved-model",
    notOrganicFetch: async () => { throw new Error("must not call"); },
  }).generate(persona, image, prompt), /available Not Organic image model/);
});

test("hosted Jev uses the judgement alias, preserves rubric and propagates payment errors", async () => {
  const answers: Record<string, unknown> = {};
  for (const [id, question] of Object.entries(scoreQuestions)) {
    answers[id] = { type: "score", score: 3, confidence: 0.8,
      probabilities: Object.fromEntries(question.criteria.map((_, i) => [String(i), i === 3 ? 1 : 0])),
      legend: Object.fromEntries(question.criteria.map((text, i) => [String(i), text])),
    };
  }
  answers.violatesPetPeeve = { type: "noul", noul: 0.1 };
  const assets = [{ type: "image" as const, prompt: prompt.prompt, purpose: "hero" }];
  const localJudge = async () => { throw new Error("Local judge must not run"); };
  const config = toBasteConfig({ evaluator: { provider: "notorganic", model: "judgement" } }).evaluator;
  const [result] = await evaluateBatch(persona, assets, localJudge, { ...config,
    notOrganicFetch: async (path, init) => {
      assert.equal(path, "/v1/judgement");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "judgement");
      assert.equal(typeof body.state, "string");
      const state = JSON.parse(body.state);
      assert.equal(state.persona.id, persona.id);
      assert.equal(state.candidate.prompt, prompt.prompt);
      assert.equal(state.candidate.purpose, "hero");
      assert.equal(Object.keys(body.questions).length, 6);
      assert.equal(new Headers(init?.headers).has("Authorization"), false);
      return Response.json({ model: "jev-resolved", answers });
    },
  });
  assert.equal(result.overall, 0.75);
  assert.equal(result.typesafe?.model, "jev-resolved");
  assert.ok(result.tags.includes("notorganic"));
  await assert.rejects(evaluateBatch(persona, assets, localJudge, { ...config,
    notOrganicFetch: async () => Response.json({ error: "private" }, { status: 402 }),
  }), /more credit/);
});
