# Baste Privacy Policy

This proposed notice explains the Baste public website and browser demo, including information stored in your browser and requests to external services. It separately explains what changes when you run or connect a server. Prepared for owner review on 2 October 2026; unpublished and not effective. Bracketed items must be resolved before adoption.

## Who is responsible

Baste is operated by Keith Abiola Noel, a sole proprietor in Québec, Canada. The proprietor is responsible for protecting personal information unless that responsibility is delegated in writing as permitted by law. For this draft, the responsible person is Keith Abiola Noel, proprietor; the shared published business contact for Baste privacy and support requests is support@notorganic.info. [Before adoption: add the public business mailing address, confirm reliable private request handling through this mailbox, and record any written delegation that changes the responsible person.] The operator of an independently chosen server is responsible for that server’s practices. Do not send private information to a public issue tracker.

## Public visits and technical requests

Your browser sends the website host information needed to deliver pages and files, including your IP address, requested URL, time and browser/request headers. URLs may contain persona, tab, project or language parameters; avoid personal information in names or URLs. This information can also appear in browser history and in links you share.

The public-site deployment configuration uses Railway hosting and nginx to serve static files. The hosting service receives delivery requests; it is separate from the optional Not Organic gateway. [Before adoption: confirm the access and error logs actually retained, any additional delivery provider, purposes, staff/provider access, storage countries, retention periods and backup handling.] We cannot presently state that visits are unlogged or that all data stays in Québec. HTTPS protects transport to the public site; it does not prevent hosting providers from receiving requests.

## What you enter in the browser demo

Studio can handle persona names and summaries, cultural references and preferences, moodboard URLs, notes and tags, rankings and feedback, prompt previews, editor documents and demo job details. In the current demo these are kept in that client’s memory, rather than saved to a Baste account or sent to an AI generation API. They can disappear when the page reloads or closes.

Design personas may reveal sensitive interests or beliefs if they describe an identifiable person. Use fictional examples and omit unnecessary personal information. The demo’s aesthetic scoring is not intended as a decision about a real person. Entering content is optional; you can browse the supplied examples instead.

This does not mean the page is offline: it loads site resources and fonts, and user-added external reference images can create separate requests.

We use information for the features you request, support, service security and applicable legal obligations. We do not sell your Baste working content or use it to train general-purpose AI models. The current demo gives the operator no stored account copy of that working content. Saved preferences or feedback used in an evaluation are different from model-weight training. Any future optional training service must separately identify the selected data, purpose, recipients, audience and controls before it is enabled. This commitment does not determine an independent server operator’s practices or override an AI provider’s own terms.

## Cookies and browser storage

The language selector sets baste.language to en or fr for up to 365 days, with Path=/ and SameSite=Lax, plus Secure on HTTPS. This preference cookie is available to page scripts and accompanies matching site requests; it is not an account credential. You can delete or block it, or choose a language through ?lang=en or ?lang=fr. Browser language preferences are also used when no explicit choice is available.

The website uses localStorage for baste_api_url (the API destination), baste_sound (sound preference), baste:material:v1 (material recipe) and baste:backdrop:v1 (backdrop choice). These entries have no automatic expiry in the inspected code and remain until you or your browser remove them. They are available to scripts on this origin but are not automatically sent as cookies. The stored API destination is used to make server requests.

Clear this site’s cookies and storage in your browser settings to reset these preferences. This does not delete files you exported, local-server files or another service’s records. No advertising or audience-analytics integration was identified in the inspected website source; host logging remains to be confirmed. Sound and language controls are not analytics consent controls.

## Fonts images and documentation media

Pages request Google Fonts stylesheets and font files from fonts.googleapis.com and fonts.gstatic.com. Google receives network information such as your IP address and request headers. Its handling is described in Google’s privacy information at https://policies.google.com/privacy.

In demo mode, moodboard image URLs load directly from the destination you supply. That destination can receive your IP address, headers and any cookies your browser permits for it. The public site’s referrer policy is strict-origin-when-cross-origin; cross-origin requests can reveal the site origin. A reference URL itself can contain identifiers. Do not use private or signed URLs unless you understand their disclosure.

Studio documentation screenshots, narrated videos and captions are served as site files, without a third-party video embed in the inspected guide. Loading or playing them still sends requests to the website host. Following an external link takes you to that service’s own practices.

## Connecting or running a server

Studio first probes the configured API’s health endpoint and falls back to the demo when that fails. Changing the API destination can send subsequent personas, feedback, documents or other requested operations to that server. Requests include credentials where the browser permits them; optional account operations use a CSRF header. Verify that you trust the server.

A local CLI/server can save custom persona JSON, configuration, moodboards, rankings, feedback history, generated assets and metadata, brand kits, editor documents, project snapshots and command receipts, OpenPencil exports and design-version records in files or SQLite. Storage depends on the command and installed build. Feedback can be summarized and included in later evaluation requests to personalize scoring; this is not the same as training model weights. The public site operator does not receive these files merely because you run the software.

Depending on the installed version, local software supports QuiverAI for SVGs, OpenAI or Google for images, Google or configured Seedance endpoints for video, and OpenAI, TypeSafe or Not Organic for evaluation. These paths can transmit prompts, persona context, candidate descriptions, metadata, feedback-derived preferences and, where supplied for evaluation, SVG source. Check your installed version and the actual account’s settings and terms for model availability, training use, retention, processing countries and deletion. No provider-wide zero-retention or no-training promise is made.

On a supported server, decompose fetches the URL you request and related stylesheets and can use a browser to render it; optional mirroring stores assets. An image proxy fetches requested images through that server. Those destinations receive the server’s requests, and deep rendering can load third-party page resources. Use only URLs you are authorized to access. Remix combines persona information into a saved new persona when the server supports it. These are server features, not operations performed by the public browser demo.

## Accounts payment and future hosted processing

The current public deployment does not provide account login, checkout or paid generation endpoints. Interface code for a Not Organic bridge is not proof that the connection is registered, authorized or operational. This policy does not describe an active Baste payment-card collection or hosted account-deletion service.

A supported local account bridge, if enabled and externally authorized, keeps an opaque baste_session cookie for up to eight hours, with HttpOnly, SameSite=Lax and Secure on HTTPS. Sessions, authorization state, CSRF values, upstream tokens and signing keys are held in server memory; restart ends those sessions. The browser sees a public DID/handle and account/model/wallet information. Owned files can be separated in server directories by a hash of the DID; hashing does not make personal information anonymous. Sign-out is not deletion of those files. These are source-level mechanisms, not verified public-service behavior.

Before enabling a hosted service, we must disclose the actual operator and recipient roles, account identifiers, sessions, project and prompt storage, usage and billing records, payment provider, purposes, retention, cross-border processing and relevant choices. Connecting an account must not be treated as consent to unrelated training, marketing or publication of private personas.

If you separately use an authorized Not Organic connection, its shared layer processes the account and authorization information, requested AI content, usage and billing records needed for that feature. Its current published notice identifies Railway for hosting and Convex for application records, configured routing/model providers for AI, Paddle for purchases and PostHog for gateway operational analytics when configured. The inspected gateway telemetry uses a pseudonymous identifier and usage, cost and outcome metadata rather than prompt bodies or direct DIDs. Those are shared-layer practices, not evidence that the current Baste demo sends content to Convex, collects card details or runs PostHog. Review https://notorganic.info/privacy and https://notorganic.info/terms for that layer’s current review notices; they remain marked not effective.

The isolated, unpublished account-gate implementation asks for a 14+ age attestation, agreement to the specific Baste Terms and consent to the described necessary account processing after identity authentication. Its account-linked record contains the product and policy version, policy-content digest, server-recorded date, interface and contract language, confirmation that the French Terms were supplied, and the three confirmations. The record does not contain a birth date, identity document, IP address, user-agent or duplicate DID. One current receipt is stored in the account’s hashed directory; sign-out and server restart do not remove it. There is no automatic receipt expiry or completed account deletion/export process in this implementation. Local test receipts are stored separately and never count as acceptance of effective policies. [Before adoption: set justified receipt retention, access, portability and deletion arrangements, finalize the actual hosted-service notice and adopt the policies.] This source implementation is not a live public account service or independent age verification.

## Retention exports and deletion

Demo content lasts in memory for that page/client instance. Preference storage lasts as described above. Website logging and backup retention are unresolved and must be stated before adoption; no fixed period is invented here.

Token and editor exports create copies you control. Removing a custom persona removes that demo persona and its saved demo editor document, but does not establish that all moodboards, feedback or exports have been erased. Reloading resets demo memory. In the local source, persona deletion removes its custom JSON file, not all related records, output files, databases, backups or upstream provider records. Local operators must manage those separately. There is no verified hosted “delete everything” action.

The shared Not Organic implementation encrypts stored gateway response records and assigns a 30-day expiry, including a stored judgement result when that path completes with usage. A supported Responses API request with store: false avoids that response record; Baste’s inspected account bridge does not expose that endpoint as a general user control. The 30-day expiry does not apply to Baste local files, feedback, project history, billing/security records, backups or independent provider copies. It is not a verified deadline for deleting every record after a Baste request.

## Your requests and choices

Depending on applicable law, you may request access, correction, withdrawal of consent and deletion or portability where provided by law. Direct a Baste request to Keith Abiola Noel, proprietor responsible for privacy, through support@notorganic.info; identify Baste and the relevant data or account. [Before adoption: confirm this mailbox reliably receives private requests and implement the identity-verification, response and escalation process.] We will respond within applicable legal time limits, verify identity proportionately and explain any lawful refusal or retention. Do not send passwords, API keys or full payment-card numbers.

For local files, direct requests to the server operator; for external recipients, their own request processes may also be needed. Withdrawal may affect a feature requiring the information. You may raise a concern with the Commission d’accès à l’information du Québec at https://www.cai.gouv.qc.ca or, where applicable, the Office of the Privacy Commissioner of Canada at https://www.priv.gc.ca.

## Protection transfers and children

The public demo avoids account storage of your working content, but your browser, exported files and chosen server still require protection. [Before adoption: confirm actual host access controls, incident response and notification procedures and any safeguards for information processed outside Québec.] External requests can involve processing outside Québec or Canada; this draft does not claim that a privacy impact assessment or provider agreement is complete.

Baste’s intended audience is people aged 14 and over. This product minimum reflects Québec’s rule that a minor aged 14 or over may give the consent required under its private-sector privacy law; it is not a worldwide consent age. Consent must still be clear, free, informed, specific and understandable for the person and purpose. Being able to read or use the software does not itself establish valid consent. Contract capacity and any parent or tutor authorization needed for an account or purchase are separate questions.

In Québec, consent required under that privacy law for a child under 14 is given by the person having parental authority or the tutor. Collection from the child without that consent has a narrow exception when clearly for the child’s benefit; this draft does not treat all Baste requests as covered by that exception. Baste is not intended for under-14 use. Do not submit personal information about a child under 14. A parent or tutor concerned about information already supplied may contact support@notorganic.info; we will assess the request and applicable obligations without asking for unnecessary identity documents.

[Before adoption: implement an appropriate way to apply the 14+ boundary and age-appropriate privacy choices before optional personal-data collection or transmission, and a process for information supplied by an under-14 child.] The current release has no age-assurance or parental-consent flow. Website delivery requests and Google Fonts load before any such check, while external reference images and a chosen API can create additional disclosures. A minimum-age sentence or a footer link does not stop those requests or replace required consent. Other jurisdictions and providers may impose different or higher requirements.

## Changes and consent

The adopted policy must have an effective date and remain accessible in English and French. Material changes will be communicated appropriately. Where a new purpose or disclosure requires consent, we must obtain it before that processing begins; simply changing this policy or your continuing to browse does not provide blanket consent.
