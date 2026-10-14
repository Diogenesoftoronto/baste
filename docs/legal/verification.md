# Baste legal draft verification

Final local verification 2 October 2026, on legal-review-draft based on da12cec735054e73f8e9676f482532cd8cb01b75. No legal routes were deployed, no remote branch was pushed, and no acceptance/account/payment flow was changed.

## Passed checks

- `npm run build:production`: PandaCSS code generation, Vite client production build and Qwik static generation passed. Eight static pages generated, including `/terms/` and `/privacy/` plus the existing six routes.
- `npm run build.types`: TypeScript no-emit check passed.
- `npm run lint`: site source ESLint passed.
- `npm run test`: Node/tsx ran the three existing app test files (`api.test.ts`, `materials.test.ts`, `notorganic.test.ts`); all passed, no failures/skips reported.
- `npm run test:i18n`: existing locale runtime test file passed, no failures/skips reported.
- `npm run i18n:check`: 732 EN/FR messages, ICU argument parity, raster assets, migrated surfaces and 25 guide chapters/bilingual screenshots passed. No catalog edits were needed for the legal route text.
- A loopback-only Chromium check passed 16 route/language/viewport/JavaScript combinations: two routes × EN/FR query/anchor × 390px/1440px width × JavaScript enabled/disabled. Each contained both complete language articles, expected sections, one H1, valid internal anchors and draft robots metadata. No horizontal overflow or page errors were observed.
- French homepage footer links were checked after Qwik hydration: both labels identify drafts, preserve `lang=fr`, and target `#legal-fr`. The initial 350ms footer check ran before hydration completed; waiting for the footer resolved the check without a product-code change.
- The standalone HTML pack has six readable articles (four policy drafts, owner review, factual inventory), no horizontal overflow at the checked desktop size, no scripts or external font dependency. Representative route and pack screenshots were visually reviewed.
- Draft JSON, four Markdown review copies and standalone pack were checked for content synchronization. The styling refinement did not change any policy text.
- A second Chromium pass checked eight styled views: two routes × EN/FR × desktop 1440px/mobile 390px. Baste’s Bodoni Moda and Instrument Sans fonts loaded in every view. Selected-language order, both complete translations, internal anchors, 44px language controls and zero overflow/page errors passed. All eight viewport screenshots and representative body views were visually inspected. Eight full-page PNG previews are included in the kit and saved separately to Library.
- Both routes were also checked without JavaScript. Six tested text/background token pairs exceeded a 4.5:1 contrast ratio (lowest 5.08:1). These checks do not establish complete WCAG conformance.
- Production build, TypeScript and lint passed again after the styling refinement.
- The patch’s changed-file list is limited to new legal sources/docs and the existing shared footer. Header/nav, Studio shell, docs/media, i18n catalogs and auth/payment/generation/project source remain byte-identical to the public baseline.

## Bounded coverage

Public root, Studio, docs and health were fetched read-only over HTTPS and returned 200; `/health` reported static mode; `/api/health` returned 404. No Set-Cookie header appeared in those GET responses. This does not mean page JavaScript cannot set the language preference cookie.

Source review included the separate uncommitted local Baste working tree. It established conditional mechanisms and payload categories, not successful runtime service behavior. No actual credentials/configuration values, private user rows, account enrollment, provider authorization, purchase, paid inference, live deletion or infrastructure retention settings were examined or changed. No comprehensive security audit, legal-compliance certification, lawyer review or French-contract acceptance process is claimed.

The initial 16-combination Chromium pass blocked font requests for deterministic fallback-layout checks; the additional eight styled previews allowed and confirmed the actual fonts. The source and public markup establish Google Fonts requests; provider processing, regions, retention and contracts remain unverified. Local browser checks are not a full accessibility audit or a live deployment test.

Initial direct statute retrieval returned gateway errors. The age follow-up successfully read the current official Québec private-sector privacy Act and the Civil Code PDF through web browsing; direct archival downloads still returned 403. Current CAI, Canadian OPC, Québec consumer office and OQLF guidance is linked in owner-review.md and age-review.md. Adoption review should confirm the applicable rules for the actual offering.

## Shared-baseline content revision

After the owner’s direction to align with Not Organic/Twyne, their five current public legal/support pages were fetched read-only on 2 October 2026 (all HTTP 200). Public URLs and SHA256 hashes are in shared-baseline-evidence/public-baseline-check.json. Relevant reference-source hashes are in shared-baseline-source-hashes.json. CAI default privacy-responsibility guidance was reopened. Not Organic source graph was queried; its index reported stale working-tree content, so current relevant source lines were checked directly and no index or reference repository was changed.

The revision changes policy JSON and synchronized EN/FR Markdown, source inventory and owner checklist. Styled LegalPage, Nav, Footer, routes, Studio, docs/video and i18n catalogs remain unchanged from 9f37f0fa403444db75be7b829b15ee359556814d. No account, paid request, email message or publication was performed. Mailbox publication is verified; delivery/monitoring and a public mailing address remain unresolved.

Policy synchronization and EN/FR section IDs/paragraph-count parity passed (legal-baseline-content-report.json). Production build, TypeScript, lint, locale runtime tests and i18n checks passed for this revision. Browser verification again covers 16 route/language/viewport/JavaScript combinations, French footer links and all six standalone review-pack articles. Eight full-font EN/FR desktop/mobile previews are regenerated and replace the same Library screenshot identities. Coverage remains layout/content checks, not legal certification, live hosted-feature validation or a complete accessibility audit.

## Minimum-age revision

The owner’s conditional direction to use the lowest supported independent-consent age is reflected as 14+ in both language drafts. The current Québec Act (sections 4.1 and 14), current CAI consent guidance, Canadian OPC guidance and Civil Code articles 153 and 155–158/165 were read. Privacy consent is distinguished from adulthood and minors’ contract capacity. No worldwide threshold or automatic capacity at 14 is claimed. Existing source shows no age/parental-consent flow; an implementation checkpoint, purpose-specific explanations, accidental-information process and assessment of initial host/font requests remain adoption gates. No flow or public deployment was changed.

The age revision passed production build, TypeScript, lint, the existing locale runtime test file and the 732-message i18n check. JSON/Markdown/pack synchronization and bilingual section/paragraph parity were checked again. The 16 route/language/viewport/JavaScript checks and eight styled full-font desktop/mobile views were rerun on this build; their exact output is included in the kit. Coverage is bounded as above.
