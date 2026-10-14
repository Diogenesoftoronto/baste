import { spawn, execFileSync } from "node:child_process";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
try {
  loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

function port(name, fallback) {
  const value = process.env[name] ?? String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(`${name} must be a port between 1 and 65535`);
  }
  return value;
}

const apiPort = port("BASTE_API_PORT", 3456);
const sitePort = port("BASTE_SITE_PORT", 5173);
const storybookPort = port("BASTE_STORYBOOK_PORT", 6006);
const mode = process.argv[2];
let args;
let cwd = root;
let command = process.execPath;

switch (mode) {
  case "api":
    if (process.argv.includes('--voice-from-skate') && !process.env.FAL_KEY) {
      process.env.FAL_KEY = execFileSync('rtk', ['proxy', 'skate', 'get', 'fal_api_key@secrets'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    }
    process.env.BASTE_PUBLIC_ORIGIN ??= `http://localhost:${sitePort}`;
    args = ["--import", "tsx", "src/cli.ts", "gui", "--port", apiPort];
    break;
  case "site":
  case "docs":
    cwd = fileURLToPath(new URL("../site/", import.meta.url));
    command = process.platform === "win32" ? "npm.cmd" : "npm";
    args = ["run", "dev", "--", "--host", "127.0.0.1", "--port", sitePort, "--strictPort"];
    console.log(`Baste ${mode}: http://localhost:${sitePort}${mode === "docs" ? "/docs/" : "/"}`);
    break;
  case "storybook":
    cwd = fileURLToPath(new URL("../site/", import.meta.url));
    command = process.platform === "win32" ? "npm.cmd" : "npm";
    args = ["run", "storybook", "--", "--host", "127.0.0.1", "--port", storybookPort, "--exact-port"];
    break;
  default:
    throw new Error("Usage: node scripts/runtime.mjs <api|site|docs|storybook>");
}

const child = spawn(command, args, { cwd, env: process.env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
