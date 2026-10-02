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
- Draft JSON, four Markdown review copies and standalone pack were checked for content synchronization.
- The patch’s changed-file list is limited to new legal sources/docs and the existing shared footer. Header/nav, Studio shell, docs/media, i18n catalogs and auth/payment/generation/project source remain byte-identical to the public baseline.

## Bounded coverage

Public root, Studio, docs and health were fetched read-only over HTTPS and returned 200; `/health` reported static mode; `/api/health` returned 404. No Set-Cookie header appeared in those GET responses. This does not mean page JavaScript cannot set the language preference cookie.

Source review included the separate uncommitted local Baste working tree. It established conditional mechanisms and payload categories, not successful runtime service behavior. No actual credentials/configuration values, private user rows, account enrollment, provider authorization, purchase, paid inference, live deletion or infrastructure retention settings were examined or changed. No comprehensive security audit, legal-compliance certification, lawyer review or French-contract acceptance process is claimed.

Chromium font requests were blocked for deterministic local layout checks. The source and public markup establish Google Fonts requests; provider processing, regions, retention and contracts remain unverified. Local browser checks are not a full accessibility audit or a live deployment test.

Direct official consolidated statute retrieval returned gateway errors; current authoritative CAI, Canadian OPC, Québec consumer office and OQLF guidance was read and linked in owner-review.md. Adopting legal review should confirm the applicable statutes and amendments.
