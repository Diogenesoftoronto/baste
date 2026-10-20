// Run from any directory: node site/scripts/encode-avif.mjs
// Keeps the existing WebP sources; rerun after refreshing site imagery.
// Requires ffmpeg with libaom-av1, plus ImageMagick with AVIF support for alpha.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, stat, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const exec = promisify(execFile);
async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? collect(path) : path.endsWith('.webp') ? [path] : [];
  }));
  return nested.flat();
}

const sources = await collect(root);
let converted = 0;
let sourceBytes = 0;
let outputBytes = 0;
async function encode(source) {
  const output = source.replace(/\.webp$/, '.avif');
  const sourceInfo = await stat(source);
  const outputInfo = await stat(output).catch(() => undefined);
  if (!outputInfo || outputInfo.mtimeMs < sourceInfo.mtimeMs) {
    const temporary = output + '.tmp.avif';
    try {
      const { stdout } = await exec('magick', ['identify', '-format', '%[opaque]', source]);
      if (stdout.trim() === 'False') {
        await exec('magick', [source, '-sampling-factor', '4:4:4', '-quality', '85', temporary]);
      } else {
        await new Promise((resolve, reject) => {
          const child = spawn('ffmpeg', [
            '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', source,
            '-frames:v', '1', '-c:v', 'libaom-av1', '-still-picture', '1',
            '-crf', '20', '-b:v', '0', '-cpu-used', '6', '-threads', '2',
            '-pix_fmt', 'yuv444p10le', temporary,
          ], { stdio: ['ignore', 'ignore', 'pipe'] });
          let error = '';
          child.stderr.on('data', (chunk) => { error += chunk; });
          child.on('error', reject);
          child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${source}: ${error}`)));
        });
      }
      await rename(temporary, output);
      converted++;
    } finally {
      await rm(temporary, { force: true });
    }
  }
  sourceBytes += sourceInfo.size;
  const finalInfo = await stat(output);
  outputBytes += finalInfo.size;
}

const queue = [...sources];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) await encode(queue.shift());
}));
console.log(`${sources.length} AVIF images ready (${converted} encoded). WebP: ${sourceBytes} bytes; AVIF: ${outputBytes} bytes.`);
