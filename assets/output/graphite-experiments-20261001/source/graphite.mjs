import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const install = join(homedir(), '.local/share/graphite-editor-mcp');
const { Client } = await import(pathToFileURL(join(install, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));
const { StdioClientTransport } = await import(pathToFileURL(join(install, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')));
export const V = await import(pathToFileURL(join(install, 'dist/src/values.js')));
export const { TEMPLATES } = await import(pathToFileURL(join(install, 'dist/src/templates.js')));
export const client = new Client({ name: 'baste-graphite-investigation', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [join(install, 'dist/src/index.js')], stderr: 'pipe' });
await client.connect(transport);
export async function call(name, args) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 180000 });
  const data = JSON.parse(result.content.find(c => c.type === 'text').text);
  if (result.isError) throw new Error(`${name}: ${JSON.stringify(data)}`);
  return data;
}
if (process.argv[2] === 'inspect') {
  try {
    const findings = [];
    for (const query of ['gradient', 'warp', 'repeat', 'hue', 'math', 'animation', 'spline']) {
      const found = await call('graphite_search_nodes', { query });
      findings.push({ query, ...found });
      console.log(query, found.results.map(n => `${n.displayName}: ${n.identifier}`).join('\n'));
    }
    const identifiers = ['math_nodes::MathNode', 'repeat_nodes::repeat_nodes::RepeatRadialNode', 'repeat_nodes::repeat_nodes::RepeatArrayNode', 'graphene_core::animation::AnimationTimeNode', 'raster_nodes::adjustments::HueSaturationNode', 'vector_nodes::generator_nodes::SplineNode'];
    for (const identifier of identifiers) {
      try { const details = await call('graphite_describe_node', { identifier }); findings.push(details); console.log(JSON.stringify(details)); }
      catch (error) { console.log(error.message); }
    }
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'node-investigation.json'), JSON.stringify(findings, null, 2));
  } finally { await client.close(); }
}
