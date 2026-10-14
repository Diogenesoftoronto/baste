import { $, component$, useContext, useSignal, useStore, useVisibleTask$ } from '@builder.io/qwik';
import { css } from 'styled-system/css';
import { StudioCtx, refreshAccount, refreshPersonas, toast } from '../context';
import { btn, hint, panelTitle } from '../ui';
import { useLocale } from '~/i18n/provider';
import { localeHref } from '~/i18n/runtime';
import { accountCopy } from '~/lib/account-copy';
import { accountRequest } from '~/lib/notorganic';
import type { AccountPolicyCopies, LegalCopy } from '~/lib/account-consent';

const PolicyText = component$<{ copy: LegalCopy; language: 'en' | 'fr'; label: string }>(({ copy, language, label }) => (
  <section lang={language} aria-label={label} tabIndex={0} class={css({ border: '1px solid token(colors.rule-strong)', rounded: 'base', maxH: '320px', overflowY: 'auto', p: 4, mt: 3, bg: 'paper', fontSize: '14px', lineHeight: 1.65, _focusVisible: { outline: '3px solid token(colors.chalk)', outlineOffset: '2px' } })}>
    <h3 class={css({ fontFamily: 'display', fontSize: '22px', mb: 3 })}>{copy.title}</h3>
    <p class={css({ mb: 4 })}>{copy.intro}</p>
    {copy.sections.map(section => <div key={section.id}>
      <h4 class={css({ fontWeight: 600, mt: 4, mb: 2 })}>{section.title}</h4>
      {section.paragraphs.map((paragraph, index) => <p key={index} class={css({ mb: 3, overflowWrap: 'anywhere' })}>{paragraph}</p>)}
    </div>)}
  </section>
));

export const AccountConsent = component$(() => {
  const s = useContext(StudioCtx);
  const locale = useLocale();
  const t = accountCopy[locale.value];
  const busy = useSignal(false);
  const failure = useSignal('');
  const review = useStore<{ data: AccountPolicyCopies | null; loading: boolean; age: boolean; terms: boolean; processing: boolean; contractLanguage: 'en' | 'fr' }>({ data: null, loading: true, age: false, terms: false, processing: false, contractLanguage: 'fr' });
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track, cleanup }) => {
    const base = track(() => s.apiBase);
    track(() => s.account.status?.csrfToken);
    const version = track(() => s.account.status?.consent?.version);
    let cancelled = false; cleanup(() => { cancelled = true; });
    review.loading = true; review.data = null; review.age = false; review.terms = false; review.processing = false; review.contractLanguage = 'fr'; failure.value = '';
    document.getElementById('baste-consent-title')?.focus();
    if (!version) { review.loading = false; return; }
    try {
      const data = await accountRequest<AccountPolicyCopies>(base, 'consent/policy');
      if (cancelled) return;
      if (data.policy.product !== 'baste' || data.policy.minimumAge !== 14 || data.policy.version !== version || !data.copies?.terms?.fr?.sections?.length || !data.copies?.terms?.en?.sections?.length) throw new Error();
      review.data = data;
    } catch { if (!cancelled) failure.value = accountCopy[locale.value].policyError; }
    finally { if (!cancelled) review.loading = false; }
  });

  const accept = $(async () => {
    if (!review.data || busy.value || !review.data.policy.canAccept || !review.age || !review.terms || !review.processing) return;
    busy.value = true; failure.value = '';
    try {
      await accountRequest(s.apiBase, 'consent', s.account.status?.csrfToken, {
        version: review.data.policy.version, contentSha256: review.data.policy.contentSha256,
        locale: locale.value, contractLanguage: review.contractLanguage,
        age14OrOlder: review.age, termsAccepted: review.terms, necessaryProcessingAccepted: review.processing, frenchProvided: true,
      });
      await refreshAccount(s);
      if (s.account.status?.accessGranted !== true) throw new Error();
      await refreshPersonas(s);
      toast(s, accountCopy[locale.value].completion);
    } catch { failure.value = accountCopy[locale.value].saveError; }
    finally { busy.value = false; }
  });
  const end = $(async (underage: boolean) => {
    if (busy.value) return;
    busy.value = true; failure.value = '';
    try {
      await accountRequest(s.apiBase, 'logout', s.account.status?.csrfToken, {});
      await refreshAccount(s);
      toast(s, underage ? accountCopy[locale.value].underageResult : accountCopy[locale.value].declined, 'info');
      s.view = 'settings';
    } catch { failure.value = accountCopy[locale.value].unavailable; }
    finally { busy.value = false; }
  });
  const policy = review.data?.policy ?? s.account.status?.consent;
  const controls = css({ minH: '44px', h: 'auto', py: 3, whiteSpace: 'normal', textAlign: 'center' });
  const checkbox = css({ w: '22px', h: '22px', flexShrink: 0, mt: '2px', accentColor: 'token(colors.ink)' });
  const checkLabel = css({ display: 'flex', alignItems: 'start', gap: 3, minH: '44px', fontSize: '15px', lineHeight: 1.55, py: 2 });
  return <div data-baste-consent class={css({ mt: 5, maxW: '760px' })}>
    <h1 id="baste-consent-title" tabIndex={-1} class={panelTitle}>{t.gateTitle}</h1>
    <p class={css({ mt: 3, lineHeight: 1.6 })}>{t.gateIntro}</p>
    <p class={hint}>{t.minimum}</p>
    <p class={css({ p: 4, mt: 4, bg: 'paper-deep', borderLeft: '3px solid token(colors.thread-ink)', fontSize: '14px', lineHeight: 1.6 })} role="note">
      {policy?.mode === 'preview' ? t.prototype : !policy?.canAccept ? t.draft : t.saved}
    </p>
    {policy?.mode === 'preview' && <p class={hint}>{t.saved}</p>}
    <nav aria-label={t.setup} class={css({ display: 'flex', flexWrap: 'wrap', gap: 4, my: 4, fontSize: '14px', color: 'chalk' })}>
      <a href={localeHref('/terms/#legal-fr', 'fr')} target="_blank" rel="noopener noreferrer">{t.termsLink} · FR ↗</a>
      <a href={localeHref('/privacy/', locale.value) + `#legal-${locale.value}`} target="_blank" rel="noopener noreferrer">{t.privacyLink} ↗</a>
    </nav>
    {review.loading ? <p role="status" class={hint}>{t.loadingPolicy}</p> : !s.account.status?.consent ? <p role="alert">{t.updateServer}</p> : review.data && <>
      <p class={hint}>{t.version}: <code>{review.data.policy.version}</code></p>
      <p class={css({ mt: 4, fontSize: '14px', lineHeight: 1.6 })}>{t.frenchFirst}</p>
      <PolicyText copy={review.data.copies.terms.fr} language="fr" label={t.frenchLabel} />
      <button type="button" class={btn('secondary', css({ mt: 3, minH: '44px', h: 'auto', py: 3, whiteSpace: 'normal' }))} disabled={busy.value} onClick$={() => { review.contractLanguage = review.contractLanguage === 'fr' ? 'en' : 'fr'; review.terms = false; }}>{review.contractLanguage === 'fr' ? t.englishChoice : t.frenchChoice}</button>
      {review.contractLanguage === 'en' && <PolicyText copy={review.data.copies.terms.en} language="en" label={t.englishLabel} />}
      <form preventdefault:submit onSubmit$={accept} aria-busy={busy.value} class={css({ mt: 5 })}>
        <fieldset disabled={busy.value || !review.data.policy.canAccept} class={css({ border: 0, p: 0, m: 0 })}>
          <legend class={css({ fontWeight: 600, fontSize: '16px', mb: 3 })}>{t.gateTitle}</legend>
          <label class={checkLabel}><input class={checkbox} id="baste-age" type="checkbox" required checked={review.age} onChange$={(_, el) => { review.age = el.checked; }} /><span>{t.age}</span></label>
          <label class={checkLabel}><input class={checkbox} id="baste-terms" type="checkbox" required checked={review.terms} onChange$={(_, el) => { review.terms = el.checked; }} /><span>{review.contractLanguage === 'fr' ? t.termsFr : t.termsEn}</span></label>
          <label class={checkLabel}><input class={checkbox} id="baste-processing" type="checkbox" required aria-describedby="baste-processing-limits" checked={review.processing} onChange$={(_, el) => { review.processing = el.checked; }} /><span>{t.processing}</span></label>
        </fieldset>
        <p id="baste-processing-limits" class={hint}>{t.optional}</p><p class={hint}>{t.minors}</p>
        <div class={css({ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 5 })}>
          <button type="submit" class={btn('primary', controls)} disabled={busy.value || !review.data.policy.canAccept || !review.age || !review.terms || !review.processing}>{busy.value ? t.saving : policy?.mode === 'preview' ? t.previewAccept : t.accept}</button>
          <button type="button" class={btn('secondary', controls)} disabled={busy.value} onClick$={() => end(false)}>{t.decline}</button>
          <button type="button" class={btn('ghost', controls)} disabled={busy.value} onClick$={() => end(true)}>{t.underage}</button>
        </div>
      </form>
    </>}
    {!review.data && !review.loading && <button type="button" class={btn('secondary', controls)} disabled={busy.value} onClick$={() => end(false)}>{t.decline}</button>}
    {failure.value && <p role="alert" class={css({ mt: 4, color: 'thread-ink', fontSize: '14px' })}>{failure.value}</p>}
  </div>;
});
