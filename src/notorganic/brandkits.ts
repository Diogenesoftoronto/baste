import { loadBrandKit as load, saveBrandKit as save } from "../decompose/store.js";
import type { BrandKit } from "../decompose/index.js";
import { accountScope, accountPath } from "./scope.js";
export function loadBrandKit(id: string): BrandKit | null {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid persona id.");
  return accountScope.getStore() ? load(id, [accountPath("personas", "personas")]) : load(id);
}
export function saveBrandKit(id: string, kit: BrandKit): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid persona id.");
  return accountScope.getStore() ? save(id, kit, accountPath("personas", "personas")) : save(id, kit);
}
