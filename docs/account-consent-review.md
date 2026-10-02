# Baste account age and acceptance checkpoint

Prepared for owner/code review on 2 October 2026. Isolated, unpublished implementation. No effective policy adoption, remote push, credentials change, real account enrollment, payment, age-verification submission or deployment occurred.

## Result and current deployment

The public `https://baste.love` deployment remains the static bilingual Studio demo. Fresh read-only GETs returned 200 for Studio/docs/health; health identified static mode. `/api/health`, `/api/notorganic/status`, `/terms/` and `/privacy/` returned 404. The local legal pages are still review drafts, not public or effective contracts.

The actual optional Baste bridge has opaque eight-hour HttpOnly sessions, CSRF checks, PKCE/one-time OAuth state, issuer-confirmed account DID and account-scoped files. It had no age or policy receipt. The implementation uses that Baste bridge; it changes neither the identity provider nor another product’s account rules.

Source baseline: public UI/legal commit `73d08a9136407b95012ace00d23acd6852c3e09a`, plus an exact source-only snapshot of the existing local backend at `39dfc4451092e6e33699bd6f4fd563ecdadb6d69`. The backend snapshot is provenance, not newly authored feature work. Its hashes are in `backend-snapshot-hashes.json`. Only the subsequent consent patch is the implementation patch. Existing private runtime files, credentials and user rows were not copied or inspected.

## User flow

1. Sign-in explains the 14+ account minimum before the identity-provider redirect. No birth date or identity document is requested.
2. The provider confirms identity. Baste reads the receipt for that account. A current valid receipt opens the account workspace without another confirmation prompt.
3. A new or existing account without a current receipt enters onboarding. The account is authenticated but cannot read account data/config/projects/assets, load models/wallet, use checkout, or dispatch hosted generation/evaluation.
4. The server supplies the complete French Terms first, with a keyboard-accessible reading region. The user may expressly choose English after French delivery. Changing the agreement language clears the Terms confirmation. Full Terms and Privacy pages remain linked.
5. Three unchecked required confirmations cover age 14+, the precise Terms, and the specifically explained necessary account/design processing. Optional analytics, advertising and future purposes are excluded. Being 14 does not establish adult contract capacity or authorize a purchase.
6. A successful server write stores the current versioned receipt, then opens the workspace. Missing/false/non-boolean confirmations, unknown extra fields, stale versions/content digests, absent current French delivery, unauthenticated requests, CSRF failures and cross-origin writes fail closed.
7. Decline/under-14 actions sign out and record no negative age or acceptance. Refresh clears unsent form choices. OAuth cancellation/errors preserve EN/FR and consume one-time state. Logout/new login invalidates an in-flight callback; a newly issued orphan device refresh grant is revoked best-effort, without restoring the cancelled session.

Policy links and a checkbox are not proof of age, comprehension, lawful contract capacity or complete privacy compliance. The server records supplying French text and the person’s language choice; it does not pretend to prove they read it.

## Minimal record and persistence

`src/notorganic/consent.ts` writes one current receipt to `.baste/accounts/<SHA256(DID)>/consent.json`, using a random temporary filename and atomic rename. New receipt files are mode 0600; newly created directories use 0700. The directory key is linkable to the account; hashing is not anonymization. An unchanged-version retry preserves the original server timestamp.

Fields are exactly product, policy version, policy-content SHA256, mode, server-recorded ISO date, interface locale, contract language, French-delivery confirmation and three required confirmations. There is no duplicate DID, birth date, identity document, IP, user-agent, optional-analytics permission or provider credential in the receipt. Server delivery markers are transient session state. Signing out/restarting does not delete a file receipt; a restart still ends the original in-memory auth session. A new policy version or digest requires reconfirmation, including for an already signed-in account’s future API/provider requests.

The store has no automatic receipt expiry or completed account export/delete endpoint. Current-version replacement does not retain an acceptance history. Choose a justified retention/audit policy and integrate access, applicable portability and deletion before offering real hosted accounts. Mount and protect the writable account directory persistently; deployment storage/backups and multi-instance/session arrangements must be verified. Read/write/corruption failures grant no account access.

## Adoption and preview boundary

`site/src/lib/account-policy.json` is the shared version/digest/adoption manifest. It remains `status: review`, with `effectiveAt: null`. By default, the UI disables real sign-in/acceptance and the backend refuses them. Editing a browser checkbox or POST does not adopt the policies. The valid adopted path requires the Baste product/minimum, exact policy digest/URLs, non-review version, adopted status and an effective date reached on the server.

Preview requires `BASTE_CONSENT_PREVIEW=true` **and** HTTP loopback public, issuer and authorization origins. It is unavailable with a real third-party provider or public origin. Preview receipts use a separate `consent-preview.json` and `mode: preview`; they never satisfy adopted policies. The test harness supplies synthetic identities only and must not be deployed. No preview flag or adopted state was added to an actual deployment/configuration.

Before deployment: finalize the policy copy for the actual hosted offering, resolve the existing owner checklist (address, mailbox handling, host/provider retention and safeguards), adopt/publish the complete EN/FR policies, update notices/version/digest/effective date, define receipt retention and rights operations, and verify Baste’s provider registration/callback. The existing public Docker/nginx recipe has no backend; deploying this UI alone cannot create sign-in. Higher provider/local age limits and minors’ purchase/representation arrangements require their own actual offering review. Paid login/generation/checkout were not verified live.

Identity authentication necessarily supplies the Baste bridge with the minimum profile identity before the post-authentication checkpoint. This gate is not a promise that no under-14 identity data can ever arrive. Before a real hosted launch, assess and explain the lawful basis/necessity of that initial authentication processing and the under-14 accidental-information response, alongside initial host/font requests.

This implementation covers Baste account onboarding. It does not gate initial website/Google Fonts requests, the anonymous demo, direct external reference images, the CLI or independent local mode; it does not create parental-consent, verified-age, optional-analytics, complete account-deletion or new payment flows. Those boundaries remain explicit in the draft Privacy Policy.

## Verification and supporting evidence

The final evidence report identifies the exact commit, commands and results. The backend regression suite covers consent, DPoP/CSRF/issuer checks, account isolation, provider budgets and existing project behavior. Site type/lint/build, existing app/locale tests and 732-message bilingual checks are also run. A real Chromium test uses the production site build and actual modified API against a loopback mock identity provider, with temporary account directories and all external browser requests blocked. It covers EN/FR at 1440px and 390px, required-field defaults, language choice, refresh, keyboard submit, direct API bypass attempts, returning sign-in, decline, underage, callback cancellation and default draft lockout. Eight primary screenshots show the gate and saved-preview state in both languages/sizes.

No full accessibility audit, security audit, lawyer review, live provider verification or compliance certification is claimed. External fonts are blocked in these deterministic preview tests; the earlier legal-page styled verification confirmed the actual fonts separately. An initial full test run under the sandbox lost subprocess stdout; the supported escalated local runner resolved that environment issue. Existing project auth fixtures were updated to complete the new gate. Browser harness waits were corrected for Qwik’s lazy handlers and multiple transient toasts; final evidence contains the passing run.

## Source and legal context

- `src/notorganic/server.ts`: sign-in/callback/session/CSRF and account/provider guards.
- `src/notorganic/consent.ts`: adoption boundary, validation, account receipt store.
- `site/src/lib/account-policy.json`: review status/version/content digest; no effective adoption.
- `site/src/components/studio/flows/account-consent.tsx`: French delivery, explicit language choice, required confirmations and decline.
- `site/src/components/studio/flows/account.tsx`, `context.ts`, `routes/gui/index.tsx`, `lib/notorganic.ts`: pending-account UI and request suppression.
- `tests/consent.test.ts`, `tests/notorganic.test.ts`, `tests/projects-api.test.ts`, `site/src/lib/notorganic.test.ts`: gate/adapted auth regressions.
- [Québec private-sector privacy Act, sections 4.1 and 14](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1?langCont=en): the 14+ independent privacy-consent threshold, with valid-purpose/meaningful-consent requirements and narrower under-14 rules.
- [CAI consent guidance](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/consentement-personnes-entreprises): capacity and purpose-specific consent, not a general permission for future uses.
- [Civil Code of Québec, articles 153 and 155–158/165](https://www.legisquebec.gouv.qc.ca/en/pdf/cs/CCQ-1991.pdf#page=61): adulthood and minors’ contractual authority remain separate.
- [OQLF contract-language guidance](https://www.oqlf.gouv.qc.ca/charte/changementslegislatifs/): French delivery before an express choice of another contract language where applicable. The implementation is reviewable assistance, not a legal determination for every agreement.
