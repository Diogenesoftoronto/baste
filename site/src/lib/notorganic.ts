import type { AccountConsentStatus } from "./account-consent";
/** Same-origin account bridge. Provider tokens and keys never enter browser state. */
export interface NotOrganicStatus {
  configured: boolean;
  authenticated: boolean;
  accessGranted?: boolean;
  consent?: AccountConsentStatus;
  csrfToken?: string;
  profile?: { did: string; handle?: string };
  manageAccountUrl?: string;
  capabilities?: { profileEdit: boolean; imageGeneration: boolean; videoGeneration: boolean };
  reason?: string;
}

export interface HostedModel { id: string; kind: 'image' | 'judgement' | 'text' | 'other' }
export interface HostedWallet {
  availableMicros?: number;
  balanceMicros?: number;
  balance_microusd?: number;
  reservedMicros?: number;
  debtMicros?: number;
  hostedInferenceBlocked?: boolean;
  blocked?: boolean;
  checkout?: { available: boolean; packIds: string[]; planIds?: string[] };
}

export interface HostedAccount {
  status: NotOrganicStatus | null;
  models: HostedModel[];
  wallet: HostedWallet | null;
  loading: boolean;
  error: string;
  modelError: string;
  walletError: string;
}

export function emptyHostedAccount(): HostedAccount {
  return { status: null, models: [], wallet: null, loading: false, error: '', modelError: '', walletError: '' };
}

const refreshVersions = new WeakMap<HostedAccount, number>();

export async function accountRequest<T>(base: string, path: string, csrfToken?: string, body?: unknown): Promise<T> {
  const response = await fetch(`${base.replace(/\/+$/, '')}/notorganic/${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...(body === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Baste-CSRF': csrfToken ?? '' },
      body: JSON.stringify(body),
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = typeof data?.error === 'string' ? data.error : data?.error?.message;
    throw new Error(error || `Account request failed (${response.status})`);
  }
  if (!data || typeof data !== 'object') throw new Error('The account server returned an invalid response.');
  return data as T;
}

export async function refreshHostedAccount(base: string, account: HostedAccount): Promise<void> {
  const version = (refreshVersions.get(account) ?? 0) + 1;
  refreshVersions.set(account, version);
  const current = () => refreshVersions.get(account) === version;
  account.loading = true;
  account.error = '';
  account.models = [];
  account.wallet = null;
  account.modelError = '';
  account.walletError = '';
  try {
    const status = await accountRequest<NotOrganicStatus>(base, 'status');
    if (!current()) return;
    account.status = status;
    if (!account.status.authenticated || account.status.accessGranted !== true) return;
    await Promise.all([
      accountRequest<{ data: HostedModel[] }>(base, 'models').then((data) => {
        if (!current()) return;
        if (!Array.isArray(data.data)) throw new Error('The model catalog could not be verified.');
        account.models = data.data.filter((model) => typeof model.id === 'string');
      }).catch((error: Error) => { if (current()) account.modelError = error.message; }),
      accountRequest<HostedWallet>(base, 'wallet').then((wallet) => { if (current()) account.wallet = wallet; })
        .catch((error: Error) => { if (current()) account.walletError = error.message; }),
    ]);
  } catch (error) {
    if (!current()) return;
    account.status = null;
    account.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (current()) account.loading = false;
  }
}

/** Match Keating: prefer product-scoped available balance and subtract reservations. */
export function availableBalance(wallet: HostedWallet | null): number | null {
  if (!wallet) return null;
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  if (wallet.availableMicros !== undefined) return valid(wallet.availableMicros) ? wallet.availableMicros : null;
  const cash = wallet.balanceMicros ?? wallet.balance_microusd;
  const held = wallet.reservedMicros ?? 0;
  return valid(cash) && valid(held) ? Math.max(0, cash - held) : null;
}

export function walletBlocked(wallet: HostedWallet | null): boolean {
  return wallet?.hostedInferenceBlocked === true || wallet?.blocked === true || (wallet?.debtMicros ?? 0) > 0;
}

export function formatBalance(micros: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(micros / 1_000_000);
}

/** Identity authentication alone never grants account workspace access. */
export function needsAccountOnboarding(status: NotOrganicStatus | null): boolean {
  return status?.configured === true && status.authenticated && status.accessGranted !== true;
}
