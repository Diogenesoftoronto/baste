import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ElementNode } from "@openuidev/lang-core";
import { catalogContract, library, READ_TOOLS, WRITE_TOOLS } from "./catalog";
import { SurfaceRuntime, isBinding, type RuntimeSnapshot, type ToolMap } from "./runtime";
import { starterProgram, type DesignReading } from "./starter";
import { draftProgram, readEvents, splitReply } from "./partner";

const design: DesignReading = {
  revision: 3,
  colors: { background: "#101010", surface: "#1a1a1a", primary: "#ff3366", secondary: "#33ccff", accent: "#ffcc00", text: "#f5f5f5", textMuted: "#999999", border: "#333333" },
  headingFont: "Dela Gothic One", bodyFont: "Inter", edges: "soft", adjusted: [],
};

function setup(tools: ToolMap = {}, initialState?: Record<string, unknown>) {
  const snapshots: RuntimeSnapshot[] = [];
  const actions: unknown[] = [];
  const runtime = new SurfaceRuntime({
    library, tools, readTools: READ_TOOLS, writeTools: WRITE_TOOLS, initialState,
    onAction: (event) => actions.push(event),
    onChange: (snapshot) => snapshots.push(structuredClone(snapshot)),
  });
  return { runtime, actions, last: () => snapshots.at(-1)! };
}

function find(node: unknown, type: string, out: ElementNode[] = []): ElementNode[] {
  if (Array.isArray(node)) node.forEach((item) => find(item, type, out));
  else if (node && typeof node === "object") {
    const element = node as ElementNode;
    if (element.type === "element" && element.typeName === type) out.push(element);
    Object.values(element.props ?? {}).forEach((value) => find(value, type, out));
  }
  return out;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("the checked-in catalog matches the component definitions", () => {
  const checked = JSON.parse(readFileSync(new URL("./catalog.json", import.meta.url), "utf8"));
  assert.deepEqual(checked, JSON.parse(JSON.stringify(catalogContract())), "Run `npm run openui:catalog` in site/.");
});

test("only field values are bindings in the prompt", () => {
  const prompt = library.prompt();
  const bindings = prompt.split("\n").filter((line) => /^[A-Z]\w*\(.*\$binding/.test(line)).map((line) => line.split("(")[0]);
  assert.deepEqual(bindings.sort(), ["Choice", "ColorField", "EdgeField", "FontField"]);
});

test("Baste's starter surface is a valid program whose bindings follow the controls", () => {
  const { runtime, last } = setup();
  runtime.setProgram(starterProgram(design));
  assert.deepEqual(last().errors, []);
  const [preview] = find(last().root, "Preview");
  assert.equal((preview.props.colors as Record<string, string>).primary, "#ff3366");
  const field = find(last().root, "ColorField").find((node) => node.props.label === "Main")!;
  assert.ok(isBinding(field.props.value));
  runtime.assign(field.props.value, "#00ff88");
  assert.equal((find(last().root, "Preview")[0].props.colors as Record<string, string>).primary, "#00ff88");
  assert.equal(last().state.$primary, "#00ff88");
  const [contrast] = find(last().root, "Contrast");
  assert.deepEqual([contrast.props.foreground, contrast.props.background], [design.colors.text, design.colors.background], "read-only props receive plain values");
  runtime.dispose();
});

test("a save runs only from the button, with the values the person set, and Reset restores the saved design", async () => {
  const calls: unknown[] = [];
  const { runtime, last } = setup({ update_design: async (args) => { calls.push(args); return { revision: 4, summary: "Adjusted" }; } });
  runtime.setProgram(starterProgram(design));
  await tick();
  assert.equal(calls.length, 0, "rendering never saves");
  runtime.assign(find(last().root, "FontField")[0].props.value as never, "Fraunces");
  const [save] = find(last().root, "Button").filter((node) => node.props.label === "Save as a new version");
  await runtime.run(save.props.action as never);
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as { changes: { headingFont: string } }).changes.headingFont, "Fraunces");
  assert.deepEqual(find(last().root, "SaveStatus")[0].props.result, { status: "success", data: { revision: 4, summary: "Adjusted" } });
  const [undo] = find(last().root, "Button").filter((node) => node.props.label === "Undo unsaved changes");
  await runtime.run(undo.props.action as never);
  assert.equal(last().state.$heading, "Dela Gothic One");
  runtime.dispose();
});

test("after a save, the controls follow the saved design, including an undo", () => {
  const { runtime, last } = setup();
  runtime.setProgram(starterProgram(design));
  runtime.assign(find(last().root, "ColorField").find((node) => node.props.label === "Main")!.props.value as never, "#2ec4b6");
  runtime.assign(find(last().root, "ColorField").find((node) => node.props.label === "Accent")!.props.value as never, "#123456");
  const saved = { ...design, revision: 4, colors: { ...design.colors, primary: "#2ec4b6" } };
  runtime.setProgram(starterProgram(saved));
  assert.equal(last().state.$accent, "#123456", "an unsaved edit survives a save of other values");
  runtime.setProgram(starterProgram({ ...design, revision: 5 }));
  assert.equal(last().state.$primary, design.colors.primary, "undoing the save returns the control to the restored value");
  runtime.dispose();
});

test("an incremental patch keeps the values the person already changed", () => {
  const { runtime, last } = setup();
  const program = starterProgram(design);
  runtime.setProgram(program);
  runtime.assign(find(last().root, "ColorField")[0].props.value as never, "#222244");
  const patched = draftProgram(program, "Here is a calmer lead.\n```openui-lang\nroot = Workbench(\"Calmer\", [preview, colour, note])\nnote = Note(\"Try the ground first.\", \"aside\")\n```")!;
  runtime.setProgram(patched);
  assert.deepEqual(last().errors, []);
  assert.equal(last().state.$background, "#222244");
  assert.equal(find(last().root, "Note")[0].props.text, "Try the ground first.");
  assert.equal(find(last().root, "Section").length, 1, "unreferenced sections are dropped");
  runtime.dispose();
});

test("queries may only read and mutations may only write", async () => {
  const calls: string[] = [];
  const { runtime, last } = setup({
    read_design: async () => { calls.push("read"); return design; },
    update_design: async () => { calls.push("write"); return {}; },
  });
  runtime.setProgram(`root = Workbench("x", [Note(current.headingFont), Buttons([Button("Go", @Run(bad))])])
current = Query("read_design", {}, {headingFont: "…"})
sneaky = Query("update_design", {changes: {edges: "sharp"}, summary: "x"}, {})
bad = Mutation("read_design", {})`);
  await tick(); await tick();
  assert.deepEqual(calls, ["read"]);
  assert.equal(find(last().root, "Note")[0].props.text, "Dela Gothic One");
  assert.ok(last().errors.some((error) => error.statementId === "sneaky"));
  assert.ok(last().errors.some((error) => error.statementId === "bad"));
  await runtime.run(find(last().root, "Button")[0].props.action as never);
  assert.deepEqual(calls, ["read"]);
  runtime.dispose();
});

test("assistant and link steps are reported to the host, never run by the surface", async () => {
  const { runtime, actions, last } = setup();
  runtime.setProgram(`root = Workbench("x", [Question("Warmer or cooler?", [Button("Warmer", @ToAssistant("Warmer, please", {direction: "warm"})), Button("Plain")])])`);
  const [warmer, plain] = find(last().root, "Button");
  await runtime.run(warmer.props.action as never, "Warmer");
  await runtime.run(plain.props.action as never, "Plain");
  assert.deepEqual(actions.map((event: any) => [event.type, event.humanFriendlyMessage, event.params.context?.direction]), [
    ["continue_conversation", "Warmer, please", "warm"],
    ["continue_conversation", "Plain", undefined],
  ]);
  runtime.dispose();
});

test("streaming shows the shell without errors, and invalid programs report what failed", () => {
  const { runtime, last } = setup();
  runtime.setProgram(`root = Workbench("Drafting", [preview, more])\npreview = Preview({primary: "#ff`, true);
  assert.equal(last().streaming, true);
  assert.deepEqual(last().errors, []);
  assert.equal(last().root?.typeName, "Workbench");
  runtime.setProgram(`root = Workbench("Bad", [Nope("x")])`);
  assert.ok(last().errors.some((error) => error.code === "unknown-component"));
  runtime.setProgram("this is not a program");
  assert.equal(last().root, null);
  assert.ok(last().errors.length > 0);
  runtime.dispose();
});

test("replies split into prose and patch while a fence is still open", async () => {
  assert.deepEqual(splitReply("Warmer ground.\n```openui-lang\nroot = Workbench(\"a\", [])\n```\nTry it."), { prose: "Warmer ground.\n\nTry it.", patch: "root = Workbench(\"a\", [])" });
  assert.deepEqual(splitReply("Thinking about it.\n```openui-l"), { prose: "Thinking about it.", patch: "" });
  assert.equal(splitReply("One.\n\n```openui-lang\nroot = Workbench(\"a\", [])\n```\n \n\nTwo.").prose, "One.\n\nTwo.");
  assert.equal(splitReply("Hi\n```openui-lang\nroot = Work").patch, "root = Work");
  const encoder = new TextEncoder();
  const chunks = ['{"type":"delta","text":"Hel', 'lo"}\n{"type":"done","reply":"Hello","program":null,"issues":[]}\n'];
  const stream = new ReadableStream<Uint8Array>({ start(controller) { chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk))); controller.close(); } });
  const events = [];
  for await (const event of readEvents(stream)) events.push(event);
  assert.deepEqual(events.map((event) => event.type), ["delta", "done"]);
  const cut = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode('{"type":"delta","text":"Hel"}\n')); controller.close(); } });
  const partial = [];
  for await (const event of readEvents(cut)) partial.push(event);
  assert.equal(partial.at(-1)?.type, "error");
});
