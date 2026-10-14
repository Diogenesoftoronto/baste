import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
export const accountScope = new AsyncLocalStorage<string>();
export function accountKey(): string | undefined {
  const did = accountScope.getStore();
  return did ? createHash("sha256").update(did).digest("hex") : undefined;
}
export function accountPath(path: string, localPath: string): string {
  const key = accountKey();
  return key ? resolve(".baste/accounts", key, path) : resolve(localPath);
}
