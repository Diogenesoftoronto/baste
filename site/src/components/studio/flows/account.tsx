import { $, component$, useContext, useSignal } from '@builder.io/qwik';
import { css } from 'styled-system/css';
import { StudioCtx, errMsg, refreshAccount, toast } from '../context';
import { btn, hint, panel, panelTitle } from '../ui';
import { accountRequest, availableBalance, formatBalance, walletBlocked } from '~/lib/notorganic';

export const AccountSection = component$(() => {
  const s = useContext(StudioCtx);
  const busy = useSignal(false);
  const account = s.account;
  const status = account.status;
  const balance = availableBalance(account.wallet);
  const checkout = account.wallet?.checkout;

  const act = $(async (path: 'login' | 'logout' | 'checkout', selection?: { packId: string } | { planId: string }) => {
    busy.value = true;
    try {
      const result = await accountRequest<{ url?: string }>(s.apiBase, path, s.account.status?.csrfToken,
        path === 'login' ? { returnTo: '/gui/?flow=settings' } : selection ?? {});
      if (path === 'logout') {
        await refreshAccount(s);
        toast(s, 'Signed out of Not Organic');
      } else {
        if (!result.url) throw new Error('The account server did not provide a destination.');
        const destination = new URL(result.url, window.location.href);
        if (destination.protocol !== 'https:' && !(destination.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(destination.hostname))) {
          throw new Error('The account destination is unavailable.');
        }
        window.location.assign(destination.href);
      }
    } catch (error) {
      toast(s, errMsg(error), 'error');
    } finally {
      busy.value = false;
    }
  });

  return (
    <section class={panel} aria-labelledby="st-account" aria-busy={account.loading || busy.value}>
      <div class={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3, flexWrap: 'wrap' })}>
        <h2 id="st-account" class={panelTitle}>Not Organic account</h2>
        <button class={btn('ghost')} disabled={s.status !== 'live' || account.loading || busy.value}
          onClick$={() => refreshAccount(s)}>Refresh account</button>
      </div>
      {s.status !== 'live' ? <p class={hint}>Start the Baste server to connect an account. You can keep fitting local personas in demo mode.</p>
        : account.loading ? <p class={hint} role="status">Checking account, models and balance…</p>
        : account.error ? <p class={hint} role="alert">Account unavailable: {account.error}</p>
        : !status?.configured ? <p class={hint}>{status?.reason || 'Not Organic is not configured on this Baste server.'} <a href="/docs/#notorganic">Read account setup</a>.</p>
        : !status.authenticated ? <>
          {status.reason && <p class={hint} role="alert">{status.reason}</p>}
          <p class={hint}>Create a profile or sign in at Not Organic to use hosted image models and your wallet. Your design personas stay in Baste.</p>
          <button class={btn('primary', css({ mt: 4 }))} disabled={busy.value} onClick$={() => act('login')}>Sign in / create profile</button>
        </> : <>
          <div class={css({ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap', mt: 4 })}>
            <div class={css({ minW: 0 })}>
              <p class={css({ fontWeight: 600 })}>{status.profile?.handle || 'Connected profile'}</p>
              {status.profile?.did && <p class={css({ fontFamily: 'mono', fontSize: '12px', color: 'ink-muted', overflowWrap: 'anywhere' })}>{status.profile.did}</p>}
              {status.manageAccountUrl && <a class={css({ display: 'inline-block', mt: 2, fontSize: '13px', color: 'chalk' })} href={status.manageAccountUrl} target="_blank" rel="noopener noreferrer">Manage profile at Not Organic ↗</a>}
            </div>
            <button class={btn('secondary')} disabled={busy.value} onClick$={() => act('logout')}>Sign out</button>
          </div>

          <div class={css({ borderTop: '1px solid token(colors.rule)', mt: 5, pt: 4 })}>
            <h3 class={css({ fontSize: '16px', fontWeight: 600 })}>Wallet</h3>
            {account.walletError ? <p class={hint} role="alert">Balance unavailable: {account.walletError}</p>
              : balance === null ? <p class={hint}>The available balance could not be verified.</p>
              : <p class={css({ mt: 2, fontSize: '18px' })}>{formatBalance(balance)} <span class={hint}>available for hosted generation</span></p>}
            {walletBlocked(account.wallet) && <p class={hint}>Hosted inference is blocked by your wallet. Review billing at Not Organic before generating.</p>}
            {balance === 0 && <p class={hint}>Add credit before requesting paid generation. Prompt drafts remain available.</p>}
            {!checkout?.available ? <p class={hint}>Checkout is unavailable. Refresh after billing becomes available, or manage your account at Not Organic.</p> : <>
              <p class={hint}>Choose an available offer. The payment page shows the current price before you pay. Returning here does not confirm payment; refresh your wallet.</p>
              <div class={css({ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 3 })}>
                {(checkout.packIds ?? []).map((id) => <button key={id} class={btn('secondary', css({ maxW: '100%', h: 'auto', minH: '38px', py: 2, whiteSpace: 'normal', overflowWrap: 'anywhere' }))} disabled={busy.value} onClick$={() => act('checkout', { packId: id })}>Buy credit · {id}</button>)}
                {(checkout.planIds ?? []).map((id) => <button key={id} class={btn('secondary', css({ maxW: '100%', h: 'auto', minH: '38px', py: 2, whiteSpace: 'normal', overflowWrap: 'anywhere' }))} disabled={busy.value} onClick$={() => act('checkout', { planId: id })}>View plan · {id}</button>)}
              </div>
              {!(checkout.packIds?.length || checkout.planIds?.length) && <p class={hint}>No offers are currently available for this account.</p>}
            </>}
          </div>

          <div class={css({ borderTop: '1px solid token(colors.rule)', mt: 5, pt: 4 })}>
            <h3 class={css({ fontSize: '16px', fontWeight: 600 })}>Hosted models</h3>
            {account.modelError ? <p class={hint} role="alert">Catalog unavailable: {account.modelError}</p>
              : !account.models.length ? <p class={hint}>No hosted models are available to this account.</p>
              : <ul class={css({ listStyle: 'none', mt: 2 })}>{account.models.map((model) => <li key={model.id} class={css({ py: 2, borderBottom: '1px solid token(colors.rule)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: 3 })}>
                <code class={css({ overflowWrap: 'anywhere', minW: 0 })}>{model.id}</code><span class={css({ color: 'ink-muted' })}>{model.kind}</span>
              </li>)}</ul>}
            <p class={hint}>Images use the live catalog. SVGs and videos use your configured local providers. Provider credentials stay on the Baste server.</p>
          </div>
        </>}
    </section>
  );
});
