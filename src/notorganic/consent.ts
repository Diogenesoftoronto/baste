import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import manifest from "../../site/src/lib/account-policy.json" with { type: "json" };
import policies from "../../site/src/components/legal/policies.json" with { type: "json" };

export class ConsentValidationError extends Error {}
export type ConsentMode = "adopted" | "preview";
export interface ConsentPolicy {
  product: string; minimumAge: number; status: string; version: string;
  effectiveAt: string | null; contentSha256: string; termsUrl: string; privacyUrl: string;
}
export interface ConsentReceipt {
  product: "baste"; version: string; contentSha256: string; mode: ConsentMode;
  acceptedAt: string; locale: "en" | "fr"; contractLanguage: "en" | "fr";
  age14OrOlder: true; termsAccepted: true; necessaryProcessingAccepted: true; frenchProvided: true;
}
export interface ReceiptStore {
  read(did: string, mode: ConsentMode): ConsentReceipt | undefined;
  write(did: string, receipt: ConsentReceipt): void;
}

/** One current receipt per account; no DOB, ID, IP, user-agent or duplicate DID. */
export class FileReceiptStore implements ReceiptStore {
  constructor(private root?: string) {}
  private path(did: string, mode: ConsentMode) {
    const key = createHash("sha256").update(did).digest("hex");
    return resolve(this.root ?? ".baste/accounts", key, mode === "preview" ? "consent-preview.json" : "consent.json");
  }
  read(did: string, mode: ConsentMode): ConsentReceipt | undefined {
    try { return JSON.parse(readFileSync(this.path(did, mode), "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      // Unreadable or corrupt records never grant access.
      throw new Error("The Baste acceptance record could not be read.");
    }
  }
  write(did: string, receipt: ConsentReceipt): void {
    const path = this.path(did, receipt.mode);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const temp = `${path}.${randomBytes(12).toString("hex")}.tmp`;
    try {
      writeFileSync(temp, JSON.stringify(receipt) + "\n", { mode: 0o600, flag: "wx" });
      renameSync(temp, path);
    } finally {
      try { unlinkSync(temp); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
  }
}

export const policyCopies = policies;
export const policyContentHash = createHash("sha256").update(JSON.stringify(policies)).digest("hex");
const loopback = (value: string) => {
  try { const u = new URL(value); return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname); }
  catch { return false; }
};
export class ConsentService {
  constructor(
    private store: ReceiptStore = new FileReceiptStore(),
    private policy: () => ConsentPolicy = () => manifest,
    private preview: () => boolean = () => process.env.BASTE_CONSENT_PREVIEW === "true" &&
      [process.env.BASTE_PUBLIC_ORIGIN ?? "", process.env.NOTORGANIC_ISSUER ?? "", process.env.NOTORGANIC_AUTHORIZATION_URL ?? ""].every(loopback),
  ) {}
  current() {
    const p = this.policy();
    const valid = p.product === "baste" && p.minimumAge === 14 && /^[A-Za-z0-9._-]{1,100}$/.test(p.version) &&
      p.contentSha256 === policyContentHash && p.termsUrl === "/terms/" && p.privacyUrl === "/privacy/";
    const effective = p.effectiveAt !== null && Number.isFinite(Date.parse(p.effectiveAt)) && Date.parse(p.effectiveAt) <= Date.now();
    const mode: ConsentMode | undefined = valid && p.status === "adopted" && effective && !p.version.startsWith("review-") ? "adopted"
      : valid && p.status === "review" && this.preview() ? "preview" : undefined;
    return { ...p, canAccept: !!mode, mode: mode ?? null };
  }
  status(did?: string) {
    const policy = this.current();
    const stored = did && policy.mode ? this.store.read(did, policy.mode) : undefined;
    const receipt = this.matches(stored, policy) ? stored : undefined;
    return { ...policy, required: !!did && !receipt, receipt: receipt ?? null };
  }
  private matches(r: ConsentReceipt | undefined, p = this.current()): r is ConsentReceipt {
    return !!r && !!p.mode && r.product === "baste" && r.mode === p.mode && r.version === p.version && r.contentSha256 === p.contentSha256 &&
      r.age14OrOlder === true && r.termsAccepted === true && r.necessaryProcessingAccepted === true && r.frenchProvided === true &&
      ["en", "fr"].includes(r.locale) && ["en", "fr"].includes(r.contractLanguage) && Number.isFinite(Date.parse(r.acceptedAt)) && Date.parse(r.acceptedAt) <= Date.now();
  }
  allowed(did: string): boolean { const s = this.status(did); return s.canAccept && !s.required; }
  accept(did: string, body: Record<string, unknown>): ConsentReceipt {
    const p = this.current();
    if (!p.mode) throw new ConsentValidationError("Baste policies are not adopted for account acceptance.");
    const keys = ["version", "contentSha256", "locale", "contractLanguage", "age14OrOlder", "termsAccepted", "necessaryProcessingAccepted", "frenchProvided"];
    if (Object.keys(body).some(k => !keys.includes(k)) || body.version !== p.version || body.contentSha256 !== p.contentSha256 ||
      body.age14OrOlder !== true || body.termsAccepted !== true || body.necessaryProcessingAccepted !== true || body.frenchProvided !== true ||
      typeof body.locale !== "string" || !["en", "fr"].includes(body.locale) || typeof body.contractLanguage !== "string" || !["en", "fr"].includes(body.contractLanguage)) throw new ConsentValidationError("Review the current Baste policies and complete each required confirmation.");
    const existing = this.status(did).receipt;
    if (existing) return existing; // Retries preserve the original server timestamp.
    const receipt: ConsentReceipt = { product: "baste", version: p.version, contentSha256: p.contentSha256, mode: p.mode,
      acceptedAt: new Date().toISOString(), locale: body.locale as "en" | "fr", contractLanguage: body.contractLanguage as "en" | "fr",
      age14OrOlder: true, termsAccepted: true, necessaryProcessingAccepted: true, frenchProvided: true };
    this.store.write(did, receipt);
    return receipt;
  }
}
