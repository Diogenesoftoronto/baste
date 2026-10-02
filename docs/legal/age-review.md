# Baste minimum-age review

Prepared 2 October 2026. Unpublished owner-review evidence; no age, parental-consent, account or purchase flow was changed.

## Recommendation and owner instruction

Use 14+ as Baste’s product minimum. The owner first suggested 13+, then instructed an increase to the lowest supported independent-consent age if necessary. For the Québec-based operator, 14 is the supported statutory threshold for a minor’s own privacy consent. It is not a worldwide consent age, a statement of adulthood, or proof of comprehension. Higher local/provider limits and valid consent requirements still apply. Both language drafts now state 14+; the audience-age placeholder is removed.

## Official rules and their limits

- [Québec private-sector privacy Act, sections 4.1 and 14](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1?langCont=en): consent for an under-14 minor comes from the person having parental authority or the tutor; a minor 14 or older may give it themselves. Collection from an under-14 child has a narrow clearly-for-the-child’s-benefit exception. That collection exception is not general independent consent for subsequent uses/disclosures. Baste does not rely on it for all requests. Consent must remain clear, free, informed, specific and distinct where requested in writing; sensitive information requires express consent where the Act applies. Necessary collection and valid consent are separate requirements.
- [CAI current consent guidance](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/consentement-personnes-entreprises): confirms the under-14/14+ distinction and says consent exceptions must be read narrowly. The product’s ease of use or a teenager’s reading fluency does not establish understanding of data flows.
- [Canadian OPC meaningful-consent guidance](https://www.priv.gc.ca/en/privacy-topics/collecting-personal-information/consent/gl_omc_201805/): generally expects parent/guardian consent below 13 and maturity-appropriate explanations for youth able to consent. It is not a guarantee of capacity at 13 or 14. The page’s older description of Québec as having no specified threshold is not used here; the current Québec statute controls. PIPEDA applicability depends on activities/flows, as recorded in owner-review.md.
- [Civil Code of Québec, articles 153 and 155–158, official PDF pages 61–62](https://www.legisquebec.gouv.qc.ca/en/pdf/cs/CCQ-1991.pdf#page=61): majority is 18. A minor can act only within lawful capacity, including ordinary/usual needs within age/discernment limits; article 156 has an employment/profession rule for 14+. Otherwise the tutor represents the minor. These are not blanket authority to buy subscriptions. Article 165 preserves protections despite a declaration of adulthood. Assess the actual agreement before an account/paid launch; use required tutor representation where the minor cannot act alone.

The official Civil Code PDF served during browsing was updated 12 August 2026. Statute HTML/Civil Code PDF were successfully read through web browsing; direct archival downloads returned 403. CAI and OPC public guidance captures/hashes are in age-review-evidence/age-source-check.json. No applicable future amendment, specific paid contract or worldwide rules survey is certified.

## Current Baste paths and minimum recommended work

| Path | Current source evidence | Age-related consequence |
| --- | --- | --- |
| Initial delivery/fonts | deployment/nginx.conf; site/src/root.tsx:10 | Host/network requests and Google Fonts precede any age check. Static delivery is not zero collection. Confirm/minimize logs, recipients and retention; consider self-hosting fonts. |
| Demo inputs | site/src/lib/demo-client.ts:12 | Personas, notes, feedback and editor documents remain in client memory. Use fictional examples; memory alone does not establish exemption from every privacy obligation. |
| Reference images | site/src/components/studio/tabs/moodboard.tsx:87 | User URLs load externally and disclose network data. Put notice/choice and the product-age boundary before optional remote loading. |
| Preferences | site/src/i18n/provider.tsx:34; settings/materials/juice sources in fact inventory | Cookie/localStorage preferences are not parental authorization or an age check. Avoid collecting full birthdates or IDs without demonstrated necessity. |
| Optional server/account | site/src/lib/api.ts:138; site/src/lib/notorganic.ts:40 | Chosen server receives subsequent operations; optional source accounts are not verified public login. Apply the age boundary and relevant informed choices before enabling transmission; assess minors’ contracts separately. |

Recommended minimum implementation: an appropriate, privacy-preserving age-band checkpoint before optional personal-content/remote-reference/server features; understandable EN/FR notices and any required purpose-specific choices; an under-14 accidental-information response process. This is an implementation recommendation, not a claim that a checkbox is legally sufficient or that the law prescribes this exact UI. No full birthdate or identity-document collection is proposed by default.

Initial network delivery cannot be undone by a later age gate. Its necessity, minimization, service-provider arrangements and any lawful consent/exception analysis must be assessed separately. For a feature that requires authorization the minor cannot give, withhold that feature until the proper arrangement exists. Raising the number in a policy alone does not complete these operations. Publication remains blocked by those age-related arrangements plus the existing address, mailbox, host retention and safeguards facts.

## Account sign-in follow-up

The later isolated `baste-account-consent` branch implements a Baste-only post-authentication 14+ attestation and versioned Terms/necessary-processing checkpoint. Current-version account receipts persist across sign-outs/restarts; pending accounts cannot access account data, models, wallets or provider calls. French Terms are supplied before an express English choice. The manifest remains review-only; real login/acceptance is disabled until final adoption. Only loopback mock-provider previews work during review. See ../account-consent-review.md. This does not enforce an age boundary on the anonymous demo, initial website/font requests, CLI or independent local mode, or implement parental representation, full age verification, receipt deletion/expiry or the remaining hosted-service/privacy operations. The public deployment is unchanged.
