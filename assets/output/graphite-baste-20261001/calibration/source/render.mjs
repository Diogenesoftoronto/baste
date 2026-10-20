import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Real MCP calls over stdio. The renderer is installed outside the Baste tree.
const install = process.env.GRAPHITE_MCP_INSTALL ?? join(homedir(), '.local/share/graphite-editor-mcp');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { Client } = await import(pathToFileURL(join(install, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));
const { StdioClientTransport } = await import(pathToFileURL(join(install, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')));
const { TEMPLATES } = await import(pathToFileURL(join(install, 'dist/src/templates.js')));
const V = await import(pathToFileURL(join(install, 'dist/src/values.js')));
const { protoNodeEntry: proto, nodeInput: node, f64Value: f64, boolValue: bool, colorValue, nonePrimaryValue: none, dAffine2Value: affine, dVec2Value: vec2, u32Value: u32 } = V;
const transport = new StdioClientTransport({ command: process.execPath, args: [join(install, 'dist/src/index.js')], stderr: 'pipe' });
transport.stderr?.on('data', chunk => process.stderr.write(chunk));
const client = new Client({ name: 'baste-background-study', version: '1.0.0' });
await client.connect(transport);

async function call(name, args) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 180000 });
  const data = JSON.parse(result.content.find(c => c.type === 'text').text);
  if (result.isError) throw new Error(`${name}: ${JSON.stringify(data)}`);
  return data;
}
const color = (hex, alpha = 1) => ({ red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255, alpha, linear: true });
const families = [
  { id: 'flax-linen', name: 'Flax linen', dark: '#DDD5C6', light: '#F6F1E8', accent: '#D2402A', ink: '#817661', temperature: 0.72, density: 0.2, abstractness: 0.8, purpose: 'A quiet textile ground for the main interface.' },
  { id: 'cutting-room', name: 'Cutting room', dark: '#E7DDCE', light: '#F8F1E7', accent: '#C3422D', ink: '#9B8F7E', temperature: 0.9, density: 0.42, abstractness: 0.35, purpose: 'Pattern-paper contours for a hero or section background.' },
  { id: 'chalk-draft', name: 'Chalk draft', dark: '#DFE5E4', light: '#F1F3ED', accent: '#2F55A4', ink: '#8EAAA9', temperature: 0.3, density: 0.4, abstractness: 0.45, purpose: 'A cool drafting-paper alternative for the Studio.' },
  { id: 'ink-selvedge', name: 'Ink selvedge', dark: '#22211F', light: '#34332F', accent: '#D2402A', ink: '#B5AA94', temperature: 0.57, density: 0.3, abstractness: 0.72, purpose: 'A dark textile ground for showcases with light text.' },
];

function documentFor(family, round, width, height) {
  const s = width / 1920;
  const p = { width, height, seed: 3700 + families.indexOf(family) * 100 + round * 17, scale: (round === 0 ? 4 : 2.5 + round * 0.35) * s, dark: color(family.dark), light: color(family.light) };
  const document = TEMPLATES['duotone-image'].build(p);
  const noise = document.network_interface.network.nodes.find(([id]) => id === 101)[1];
  noise.inputs[6] = f64(0); // Paper grain, without a large domain warp.
  noise.inputs[7] = { Value: { tagged_value: { FractalType: 'FBm' }, exposed: false } };
  noise.inputs[8] = u32(3);
  const entries = document.network_interface.network.nodes.filter(([id]) => id !== 104);
  let next = 200;
  let accumulated = 103;
  function add(entry) { const id = next++; entries.push([id, entry]); return id; }
  function stack(id) { accumulated = add(proto('graphic_nodes::graphic::ExtendNode', [node(accumulated), node(id)])); }
  function rect(x, y, w, h, hex, alpha, rotation = 0, repeat) {
    let id = add(proto('vector_nodes::generator_nodes::RectangleNode', [none(), f64(w * s), f64(h * s), { Value: { tagged_value: { BoxCorners: [0] }, exposed: false } }, bool(true), bool(false)]));
    id = add(V.monitorTransformWrapperNode(id, { translation: [x * s, y * s], rotation }));
    const c = color(hex, alpha);
    id = add(proto('graphene_core::vector::FillNode', [node(id), colorValue(c), colorValue(c), V.gradientRampValue([c, c]), { Value: { tagged_value: { GradientForm: 'Linear' }, exposed: false } }, bool(false), affine([1, 0, 0, 1, 0, 0])]));
    id = add(V.genericWrapperNode(id));
    if (repeat) id = add(proto('repeat_nodes::repeat_nodes::RepeatArrayNode', [node(id), vec2(repeat.x * s, repeat.y * s), f64(0), u32(repeat.count)]));
    stack(id);
  }
  function segment(x1, y1, x2, y2, hex, alpha, thickness = 1) {
    rect((x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1) + 0.5, thickness, hex, alpha, Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI);
  }
  function contour(cx, cy, rx, ry, start, end, hex, alpha, dashed = false, thickness = 1.2) {
    const steps = 32;
    for (let i = 0; i < steps; i++) {
      if (dashed && i % 2) continue;
      const a = start + (end - start) * i / steps, b = start + (end - start) * (i + 1) / steps;
      segment(cx + rx * Math.cos(a), cy + ry * Math.sin(a), cx + rx * Math.cos(b), cy + ry * Math.sin(b), hex, alpha, thickness);
    }
  }
  const intensity = [0.8, 0.65, 0.5, 0.4, 0.32][round];
  const shift = [0, -40, 35, 0, 20][round];
  if (family.id === 'flax-linen' || family.id === 'ink-selvedge') {
    // Repeated orthogonal threads form an actual woven structure.
    const threadColor = family.id === 'flax-linen' ? '#B8AA91' : '#90846E';
    rect(960, 0, 1920, 0.65, threadColor, 0.09 * intensity, 0, { x: 0, y: 1200, count: 241 });
    rect(0, 600, 0.65, 1200, threadColor, 0.065 * intensity, 0, { x: 1920, y: 0, count: 385 });
    // Selvedge lives on the edge, keeping the reading area quiet.
    rect(1790 + shift, 600, 0.8, 1200, family.ink, 0.2 * intensity);
    rect(1814 + shift, 38, 1.5, 13, family.accent, 0.52 * intensity, -3, { x: 0, y: 1120, count: 47 });
    if (family.id === 'ink-selvedge') {
      contour(1670, 1100, 220, 96, -2.4, 0.7, family.accent, 0.85 * intensity, true, 2);
      rect(960, 1155, 1920, 0.8, family.ink, 0.2 * intensity);
    }
  } else {
    // Drafting grid, all subordinate to the background rather than a foreground motif.
    rect(960, 0, 1920, 0.6, family.ink, 0.09 * intensity, 0, { x: 0, y: 1200, count: 26 });
    rect(0, 600, 0.6, 1200, family.ink, 0.09 * intensity, 0, { x: 1920, y: 0, count: 41 });
    const blue = family.id === 'chalk-draft';
    // Armhole, sleeve-cap, seam allowances: an abstract garment pattern on the right.
    contour(1900 + shift, 300, 520, 480, 1.5, 4.25, family.accent, 0.27 * intensity, false, 1.4);
    contour(1900 + shift, 300, 554, 514, 1.5, 4.25, family.accent, 0.17 * intensity, true, 1);
    contour(1560 + shift, 1150, 390, 320, 3.3, 6.0, family.ink, 0.38 * intensity, false, 1.2);
    contour(1560 + shift, 1150, 421, 351, 3.3, 6.0, family.ink, 0.23 * intensity, true, 1);
    segment(1390 + shift, 200, 1700 + shift, 1020, family.ink, 0.19 * intensity, 0.8);
    rect(1570 + shift, 410, 11, 1, family.accent, 0.48 * intensity, -8, { x: 210, y: 575, count: 27 });
    if (blue) {
      segment(1300, 1020, 1900, 1020, family.accent, 0.28 * intensity, 1);
      rect(1310, 1010, 1, 20, family.accent, 0.3 * intensity, 0, { x: 576, y: 0, count: 25 });
    }
  }
  const artboard = add(V.artboardWrapperNode(accumulated, { x: 0, y: 0, width, height, background: color(family.light) }));
  const result = V.assembleDocument(entries, artboard);
  return { document: result, params: { ...p, round, intensity, shift }, nodeCount: entries.length };
}

async function render(family, round, width, height, folder) {
  const built = documentFor(family, round, width, height);
  const name = `baste-${family.id}-r${round + 1}-${width}x${height}-20261001`;
  const docPath = join(root, 'source', `${name}.graphite`);
  await writeFile(docPath, JSON.stringify(built.document));
  const validation = await call('graphite_validate_doc', { documentPath: docPath });
  if (!validation.valid) throw new Error(JSON.stringify(validation));
  const rendered = await call('graphite_render', { document: built.document, output: { format: 'png', width, height, outputName: name } });
  const artifactPath = join(root, folder, `${name}.png`);
  await copyFile(rendered.artifactPath, artifactPath);
  console.log(`${family.name} / round ${round + 1}: ${width}×${height}, ${rendered.byteSize} bytes, validated=${rendered.validation.valid}, exit=${rendered.exitCode}, signal=${rendered.signal}`);
  return { id: name, family: family.id, title: family.name, round: round + 1, artifactPath, documentPath: docPath, params: built.params, nodeCount: built.nodeCount, featureSpace: { temperature: family.temperature, density: family.density * built.params.intensity, abstractness: family.abstractness }, purpose: family.purpose, render: rendered };
}

try {
  await mkdir(join(root, 'candidates'), { recursive: true });
  await mkdir(resolve(root, '../images'), { recursive: true });
  const tools = await client.listTools();
  console.log(`MCP connected: ${tools.tools.map(t => t.name).join(', ')}`);
  await writeFile(join(root, 'connection.json'), JSON.stringify({ transport: 'stdio', server: client.getServerVersion(), tools: tools.tools.map(t => t.name), install }, null, 2));
  const mode = process.argv[2] ?? 'draft';
  if (mode === 'inspect') {
    for (const query of ['Repeat Array', 'Extend', 'Noise Pattern']) console.log(JSON.stringify(await call('graphite_search_nodes', { query })));
  } else if (mode === 'draft') {
    const candidates = [];
    for (let round = 0; round < 5; round++) {
      for (const family of families) {
        candidates.push(await render(family, round, 960, 600, 'candidates'));
        await writeFile(join(root, 'archive.json'), JSON.stringify({ persona: 'baste-atelier', brief: 'Warm paper, ink, thread and chalk; a quiet background for culturally specific persona fittings.', method: 'Five rounds across four distinct feature-space regions; candidates reviewed visually before production exports.', criteria: { personaAlignment: 0.3, visualQuality: 0.2, uniqueness: 0.2, coherence: 0.15, usability: 0.15 }, candidates }, null, 2));
      }
    }
  } else if (mode === 'final') {
    const selected = JSON.parse(await readFile(join(root, 'selection.json'), 'utf8'));
    const outputs = [];
    for (const selection of selected) {
      const family = families.find(f => f.id === selection.family);
      if (!family || selection.round < 1 || selection.round > 5) throw new Error('Invalid selection');
      outputs.push({ ...await render(family, selection.round - 1, 2560, 1600, '../images'), review: selection.review });
    }
    await writeFile(join(root, 'baste-atelier-suite.json'), JSON.stringify({ generatedBy: 'Graphite through graphite-editor-mcp over stdio', connector: 'https://github.com/ktheunlikedoll/graphite-editor-mcp', enginePin: 'd7ae6029e0c1818d81a13b0389ef1808496a715b', palette: { paper: '#F1ECE2', ink: '#1C1B19', thread: '#D2402A', chalk: '#2F55A4' }, outputs }, null, 2));
  } else throw new Error(`Unknown mode: ${mode}`);
} finally {
  await client.close();
}
