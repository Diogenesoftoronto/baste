import { $, component$, useContext, useSignal } from '@builder.io/qwik';
import { css } from 'styled-system/css';
import { StudioCtx, refreshAccount, toast } from '../context';
import { btn, hint, panel, panelTitle } from '../ui';
import { accountRequest, availableBalance, formatBalance, walletBlocked } from '~/lib/notorganic';

import { useLocale } from '~/i18n/provider';
import { localeHref } from '~/i18n/runtime';
import { accountCopy } from '~/lib/account-copy';
import { AccountConsent } from './account-consent';

export const AccountSection = component$(() => {
  const s = useContext(StudioCtx);
  const locale = useLocale();
  const t = accountCopy[locale.value];
  const busy = useSignal(false);
  const account = s.account;
  const status = account.status;
  const balance = availableBalance(account.wallet);
  const checkout = account.wallet?.checkout;

  const act = $(async (path: 'login' | 'logout' | 'checkout', selection?: { packId: string } | { planId: string }) => {
    busy.value = true;
    try {
      const result = await accountRequest<{ url?: string }>(s.apiBase, path, s.account.status?.csrfToken,
        path === 'login' ? { locale: locale.value } : selection ?? {});
      if (path === 'logout') {
        await refreshAccount(s);
        toast(s, accountCopy[locale.value].signedout);
      } else {
        if (!result.url) throw new Error('The account server did not provide a destination.');
        const destination = new URL(result.url, window.location.href);
        if (destination.protocol !== 'https:' && !(destination.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(destination.hostname))) {
          throw new Error('The account destination is unavailable.');
        }
        window.location.assign(destination.href);
      }
    } catch {
      toast(s, accountCopy[locale.value].unavailable, 'error');
    } finally {
      busy.value = false;
    }
  });

  return (
    <section class={panel} aria-labelledby="st-account" aria-busy={account.loading || busy.value}>
      <div class={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3, flexWrap: 'wrap' })}>
        <h2 id="st-account" class={panelTitle}>{t.title}</h2>
        <button class={btn('ghost')} disabled={s.status !== 'live' || account.loading || busy.value}
          onClick$={() => refreshAccount(s)}>{t.refresh}</button>
      </div>
      {s.status !== 'live' ? <><p class={hint}>{t.demo}</p><p class={hint}>{t.minimum}</p></>
        : account.loading ? <p class={hint} role="status">{t.checking}</p>
        : account.error ? <p class={hint} role="alert">{t.unavailable}</p>
        : !status?.configured ? <p class={hint}>{t.notConfigured} <a href={localeHref('/docs/#notorganic', locale.value)}>{t.setup}</a>.</p>
        : !status.authenticated ? <>
          <p class={hint}>{t.signDescription}</p><p class={hint}>{t.minimum}</p>
          {status.consent?.mode === 'preview' ? <p class={hint} role="note">{t.prototype}</p> : !status.consent?.canAccept && <p class={hint} role="note">{t.draft}</p>}
          <p class={hint}><a href={localeHref('/terms/', locale.value)}>{t.termsLink}</a> · <a href={localeHref('/privacy/', locale.value)}>{t.privacyLink}</a></p>
          <button class={btn('primary', css({ mt: 4, minH: '44px', h: 'auto', py: 3, whiteSpace: 'normal' }))} disabled={busy.value || !status.consent?.canAccept} onClick$={() => act('login')}>{status.consent?.mode === 'preview' ? t.testSignin : t.signin}</button>
        </> : status.accessGranted !== true ? <AccountConsent /> : <>
          {status.consent?.receipt && <p class={hint} role="status">{status.consent.mode === 'preview' ? t.prototype : t.receipt} · {t.version}: <code>{status.consent.receipt.version}</code> · <time dateTime={status.consent.receipt.acceptedAt}>{status.consent.receipt.acceptedAt}</time></p>}
          <div class={css({ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap', mt: 4 })}>
            <div class={css({ minW: 0 })}>
              <p class={css({ fontWeight: 600 })}>{status.profile?.handle || t.connected}</p>
              {status.profile?.did && <p class={css({ fontFamily: 'mono', fontSize: '12px', color: 'ink-muted', overflowWrap: 'anywhere' })}>{status.profile.did}</p>}
              {status.manageAccountUrl && <a class={css({ display: 'inline-block', mt: 2, fontSize: '13px', color: 'chalk' })} href={status.manageAccountUrl} target="_blank" rel="noopener noreferrer">{t.manage}</a>}
            </div>
            <button class={btn('secondary')} disabled={busy.value} onClick$={() => act('logout')}>{t.signout}</button>
          </div>

          <div class={css({ borderTop: '1px solid token(colors.rule)', mt: 5, pt: 4 })}>
            <h3 class={css({ fontSize: '16px', fontWeight: 600 })}>{t.wallet}</h3>
            {account.walletError ? <p class={hint} role="alert">{t.walletError}</p>
              : balance === null ? <p class={hint}>{t.noBalance}</p>
              : <p class={css({ mt: 2, fontSize: '18px' })}>{formatBalance(balance)} <span class={hint}>{t.available}</span></p>}
            {walletBlocked(account.wallet) && <p class={hint}>{t.blocked}</p>}
            {balance === 0 && <p class={hint}>{t.empty}</p>}
            {!checkout?.available ? <p class={hint}>{t.checkoutUnavailable}</p> : <>
              <p class={hint}>{t.purchase}</p>
              <div class={css({ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 3 })}>
                {(checkout.packIds ?? []).map((id) => <button key={id} class={btn('secondary', css({ maxW: '100%', h: 'auto', minH: '38px', py: 2, whiteSpace: 'normal', overflowWrap: 'anywhere' }))} disabled={busy.value} onClick$={() => act('checkout', { packId: id })}>{t.buy} · {id}</button>)}
                {(checkout.planIds ?? []).map((id) => <button key={id} class={btn('secondary', css({ maxW: '100%', h: 'auto', minH: '38px', py: 2, whiteSpace: 'normal', overflowWrap: 'anywhere' }))} disabled={busy.value} onClick$={() => act('checkout', { planId: id })}>{t.plan} · {id}</button>)}
              </div>
              {!(checkout.packIds?.length || checkout.planIds?.length) && <p class={hint}>{t.noOffers}</p>}
            </>}
          </div>

          <div class={css({ borderTop: '1px solid token(colors.rule)', mt: 5, pt: 4 })}>
            <h3 class={css({ fontSize: '16px', fontWeight: 600 })}>{t.models}</h3>
            {account.modelError ? <p class={hint} role="alert">{t.modelError}</p>
              : !account.models.length ? <p class={hint}>{t.noModels}</p>
              : <ul class={css({ listStyle: 'none', mt: 2 })}>{account.models.map((model) => <li key={model.id} class={css({ py: 2, borderBottom: '1px solid token(colors.rule)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: 3 })}>
                <code class={css({ overflowWrap: 'anywhere', minW: 0 })}>{model.id}</code><span class={css({ color: 'ink-muted' })}>{model.kind}</span>
              </li>)}</ul>}
            <p class={hint}>{t.providers}</p>
          </div>
        </>}
    </section>
  );
});
