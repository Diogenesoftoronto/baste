/**
 * Writes the OpenUI contract the Baste server prompts and validates with.
 * Run `npm run openui:catalog` after changing src/lib/openui/catalog.ts;
 * `npm test` fails while the checked-in JSON is stale.
 */
import { writeFileSync } from "node:fs";
import { catalogContract } from "../src/lib/openui/catalog";

export const CATALOG_JSON = new URL("../src/lib/openui/catalog.json", import.meta.url);
writeFileSync(CATALOG_JSON, `${JSON.stringify(catalogContract(), null, 2)}\n`);
console.log(`Wrote ${CATALOG_JSON.pathname}`);
