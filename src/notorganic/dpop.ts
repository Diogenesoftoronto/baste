import { createHash, generateKeyPairSync, randomUUID, sign, type KeyObject } from "node:crypto";

export interface DpopKey { privateKey: KeyObject; publicJwk: JsonWebKey }
export function createDpopKey(): DpopKey {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return { privateKey, publicJwk: publicKey.export({ format: "jwk" }) };
}
export function hash(value: string): string { return createHash("sha256").update(value).digest("base64url"); }
export function dpopProof(key: DpopKey, url: string, method: string, token?: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const input = `${encode({ alg: "ES256", typ: "dpop+jwt", jwk: key.publicJwk })}.${encode({ htu: url, htm: method.toUpperCase(), iat, exp: iat + 60, jti: randomUUID(), ...(token ? { ath: hash(token) } : {}) })}`;
  return `${input}.${sign("sha256", Buffer.from(input), { key: key.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
