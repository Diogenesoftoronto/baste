# Baste owner review checklist

Prepared 2 October 2026. These are unpublished drafts for the current free public browser demo, with separately identified local and optional server paths. They are not an adopted contract, legal opinion or compliance certification. No acceptance, real account mutation, purchase or publication was performed.

## Facts requiring confirmation before publication

1. Confirm Baste’s legal operator, its relationship to Not Organic and the applicable operating jurisdiction. The shared provider’s review copy is context, not proof of Baste’s operator. Confirm any registration separately. No domicile from private context is included.
2. Supply a public business contact address and verified private support channel. Confirm the privacy responsible person’s title and working contact. Use an appropriate business contact address; do not default to a home address. Whether an address must be disclosed depends on the actual activity and contracting obligations.
3. Confirm actual hosting/delivery providers, access/error logs, fields, purposes, staff/provider access, storage countries, retention periods, cleanup and backup handling. The public website receives network requests even though demo working data remains in browser memory. No server/private user rows were examined.
4. Confirm operational safeguards, confidentiality-incident assessment and notification process, request handling, identity verification and any relevant cross-border assessments and written arrangements. An HTTPS response and a source access-control mechanism do not establish these operations.
5. Confirm the feature boundary on the intended release: static public demo only, or a separately enabled server. A locally present product identifier does not prove provider registration. Earlier captured Not Organic origin-registry evidence did not locate Baste; this is bounded evidence, not a live exhaustive registry certification.

## Owner choices before adoption

- Choose intended audience ages and whether any child use is permitted. Define parental authorization and incident handling if relevant. The draft has deliberately not selected an unsupported 13, 14, 16 or 18 minimum age.
- Choose the adoption/effective date and contracting method, with legal review of scope and governing-law wording if desired. A footer link does not create informed acceptance. This patch adds no acceptance tracking.
- Confirm that the modest input-processing permission and no additional output-ownership claim reflect intent. No blanket training permission, perpetual content licence, indemnity, liability cap, forced arbitration or consumer-rights waiver has been added.
- Decide whether to keep Google Fonts requests or commission self-hosting, and whether external moodboard URLs need a notice before loading. The present patch discloses current behavior; it does not change it.
- Confirm how browser preferences and future optional tracking will be categorized and controlled. No blanket claim that every cookie needs consent, or that no tracking could exist at the host, is made.
- Have both language texts reviewed together. French contract delivery and any express choice of another language belong in a real contracting flow; a language selector is insufficient on its own.

## Separate gate for a future hosted or paid launch

Do not adopt the demo policy as a complete hosted-service policy. First verify the provider-approved Baste origin/callback, scopes and product audience, functioning account authorization, actual backend proxy, ownership/storage controls and account closure/export process. Live funded generation and completed checkout were not tested.

Confirm seller, current offers, total prices, currency, taxes, billing interval, credits/usage, renewal, notice, cancellation, refund and failed/unauthorized payment handling. Identify the payment processor and which records each party holds. No actual expiry, refund exclusion or shared credit entitlement has been invented.

Identify actual AI recipients and routing, data categories, provider account controls, training policy, location, retention and deletion. The local working tree includes QuiverAI, OpenAI, Google, configured Seedance and TypeSafe paths and an optional Not Organic gateway; that list is not a confirmed production subprocessor register. Feedback inserted into judging prompts is personalization of inference, not evidence of model-weight training. Hashing a DID is not anonymization.

Extend retention and deletion beyond custom persona JSON to project snapshots/receipts, moodboards, ranks, feedback JSONL, editor files, brand kits, generation assets, metadata, sessions, logs, backups and provider copies. Sign-out, account closure, subscription cancellation and record deletion are separate actions. No comprehensive deletion endpoint is verified.

Assess whether processing real-person interests, beliefs or preference histories engages Québec profiling rules. Fictional design personas reduce risk; they are not a legal exemption for real-person profiling. If any exclusively automated decision about a person is introduced, evaluate the applicable notice, explanation, correction and human-review requirements before offering it.

## Current authoritative guidance and drafting implications

Sources were opened on 2 October 2026. The observations below are limited guidance for owner/legal review and do not determine every jurisdiction that applies.

- [Québec CAI collection and technology guidance](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/collecte-renseignements-personnels_entreprises): minimize necessary collection and provide a clear notice explaining purposes, recipients, rights, storage and technological functions. It distinguishes voluntary activation of identifying/location/profiling functions from ordinary cookie privacy settings. This supports explicit disclosure of fonts, reference URLs, browser storage and server destinations.
- [Québec CAI privacy policy guide](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_GU_POL_Confidentialite.pdf): tailor clear language to actual practices, rather than reuse another product’s policy. This supports separate demo and server sections and visible unresolved facts.
- [Québec CAI privacy accountability](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/responsable-protection-renseignements-personnels-entreprise): publish the responsible person’s title/contact and operationalize access, correction, applicable portability and project privacy assessments. A placeholder remains a publication blocker.
- [Québec CAI use and disclosure](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/utilisation-communication-renseignements-personnels): processing outside Québec requires evaluation and written safeguards as applicable. No completed assessment is represented.
- [Canadian OPC meaningful consent](https://www.priv.gc.ca/en/privacy-topics/collecting-personal-information/consent/gl_omc_201805/): make data, purposes, recipients and material consequences understandable; optional uses and new purposes require appropriate choice/consent. The draft avoids treating browsing or policy edits as blanket consent.
- [Canadian OPC privacy-law scope](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/02_05_d_15/): Québec private-sector law and PIPEDA applicability depend on activities and cross-border information flows. No unsupported one-law-only claim is made.
- [Québec consumer office pre-purchase information](https://www.opc.gouv.qc.ca/consommateur/sujet/achat/internet/conseils), [written contract](https://www.opc.gouv.qc.ca/consommateur/sujet/achat/internet/contrat), and [online cancellation](https://www.opc.gouv.qc.ca/consommateur/sujet/achat/internet/annulation): a future paid offer needs identifiable seller, price and delivery/payment terms, an opportunity to correct/refuse, a retainable contract and applicable cancellation/refund remedies. Current free-demo terms do not substitute for checkout implementation.
- [OQLF language-of-contract guidance](https://www.oqlf.gouv.qc.ca/charte/changementslegislatifs/): since 1 June 2023, applicable adhesion contracts require delivery of the French version before an express choice to be bound in another language, subject to the relevant exceptions. The patch includes complete French static text; no English-precedence or blanket language waiver is included.

Direct official consolidated statute fetches returned gateway errors during this run. Current regulator pages were read instead; a final adopting reviewer should verify applicable statutory provisions and any recent amendments. No assertion of legal compliance or lawyer review is made.

## Patch integration

The isolated local branch is legal-review-draft, based on da12cec735054e73f8e9676f482532cd8cb01b75. It preserves the bilingual Studio guide, narrated local media and current 732-message catalogs. New files: site/src/components/legal/legal-page.tsx, policies.json, routes/terms/index.tsx, routes/privacy/index.tsx and docs/legal review sources. The sole existing UI source changed is components/layout/footer.tsx. Nav/header, Studio topbar, docs, account, payment, generation and project source are unchanged.

Both complete texts are included in static HTML. After hydration the selected language appears first; the other complete text follows, with language anchors and section links. The page uses Baste’s existing Nav, Footer, typography and color tokens, a numbered contents rail and a responsive reading sheet. The footer labels explicitly identify drafts and preserve the chosen locale. Metadata uses noindex/nofollow; this is indexing guidance, not access control. Do not deploy the patch merely because it builds. Owner adoption and resolution of bracketed items must precede any publication decision; publication was not authorized in this task.

The Studio itself has no shared Footer in the current layout, so this patch adds links wherever the existing public-site Footer is used (including Documentation), without changing the Studio shell. The legal routes can also be reached directly. Adding a Studio-shell legal link can be a separate reviewed integration change.

The JSON is the website text source; the four Markdown files are readable review copies. Keep them synchronized when revising. Markdown and a printable standalone HTML pack are supplied as editable/readable artifacts; no unrendered Word document is represented as verified.
