# Baste design partners

Draft implementation plan, October 1, 2026. This develops the confirmed choices in [the recovered side conversation](design-partner-recovery.json) and the subsequent Clef, Popmelt and OpenUI discussion. It proposes new product behavior; it does not describe an implemented feature.

Baste should introduce a character with a generated face, stop-motion presence, live voice and particular taste, then let the designer work with that character inside a live design. The partner can explore references, point out what appeals to it, make changes through tools, compare the result and remember decisions. Its persona develops automatically through interviews and collaboration, becoming increasingly specific to the application. Conversation, visual evidence and editing share one work surface.

## First experience

1. **Describe the project.** Accept a conversational brief, an existing persona, a connected local project or a reference URL. Begin generating immediately from the available context; ask a focused follow-up only when it materially changes the direction.
2. **Meet three possible partners.** Each gets a generated portrait, name, short introduction, cultural influences, a few specific likes and dislikes, and a sample reaction to the same design. The three should differ in meaningful taste and working style. Portrait jobs stream in independently with honest loading and retry states.
3. **Choose one.** Persist the chosen character and voice identity, then generate its stop-motion performance set from the same visual reference. Show the portrait immediately while motions become available. Remove the other two from active project state and cancel unfinished candidate work. Retain the selection event and candidate trait snapshots for the requested decision analysis. This selection is separate from the diverse archive of generated design assets.
4. **Look together.** Open the connected design. The partner can navigate, scroll, inspect interaction states, capture a viewport or element, and collect references. Both parties can point to the same element. A reference site is browsable; editing a site requires its connected project or editing integration.
5. **Discuss and change.** A comment such as “this feels too polished for me” is attached to the relevant design state. The partner can show alternatives, bring up a control, or apply a project change using the active collaboration permissions. Each actual edit creates a revision with an undo path.
6. **Develop the partner together.** Interview answers, reactions, design choices and application changes automatically refine the persona in the background. Those refinements affect subsequent conversation, critiques, recommendations and tool use. The partner, its evolving profile, project, conversation, evidence and decisions survive reloads. Opt into GPT-Live to speak naturally while the character listens, responds and collaborates through tools. Generated stop-motion expressions accompany listening, speech and reactions. Text and individual spoken replies remain available alongside live conversation.

Example: the user asks, “Why does this page feel wrong for you?” The partner highlights the glossy hero and explains that its finish conflicts with the tactile references they chose. An inline surface shows the current design and two alternatives, plus a texture control. Adjustments update the preview immediately. A committed edit updates the connected project, captures the result and leaves a readable revision in history.

## Character and taste

Keep an audience persona and a conversational partner as related, distinguishable records. The audience describes whom the design serves. The partner has an authored personality, cultural world, critical approach, speaking style and preferences. A partner may embody that audience while also helping with design craft.

Critique therefore retains two perspectives in its data: “this suits my taste” and “this helps the intended user.” Their tradeoffs can be expressed naturally in conversation. A character's preference is an interpretation, not evidence from a real user study.

Store explicit user decisions separately from inferred preferences and the character's initial traits. The partner can have consistent opinions and explain disagreement while developing a more nuanced understanding of the application. It must also recognize that the user can deliberately choose a different direction. Generate the portrait from the authored character; do not derive personality from facial appearance. Preserve recognizable identity across revisions. Portrait direction and voice delivery can evolve when a meaningful character change warrants it, without regenerating media after every exchange or losing project memory.

## Automatic persona refinement

The initial character is a starting point. Refinement is part of the default interaction loop from the first interview onward, and does not require a separate profile-editing step or approval for every update.

After a meaningful interaction, the runtime considers the new evidence against the current persona and application brief. It proposes typed changes to relevant fields, uses focused judgments where interpretation is needed, validates them, and applies a new project-scoped persona revision. Coalesce related events while work is active so background refinement does not interrupt typing, playback or direct manipulation.

The evolving profile includes the character's understanding of the application's purpose and audience, task priorities, cultural references, likes and dislikes, contextual exceptions, vocabulary, collaboration style and unresolved questions. Interviewing the character can develop its imagined world as well as clarify the design brief. Record generated character details as authored fiction, inferred preferences as inferences, and explicit user choices as decisions; the character's own prior statements do not become independent confirmation of a preference.

For example, a partner may begin with a taste for dense, expressive interfaces. After discussing this application's discovery and checkout flows, it can learn that richness supports browsing while checkout needs calm, predictable hierarchy. Future critiques and suggestions should express that distinction automatically.

Each refinement records the changed fields, prior values, supporting interaction or observation, reason, scope and remaining uncertainty. Explicit corrections take precedence. Repeated patterns can strengthen an inference; contradictions can narrow its context, weaken it or make the next useful interview question clear. A single accepted change need not rewrite the whole personality.

Apply learned refinements to the selected partner in this project. Shared base personas and other projects retain their own state. Keep refinement history quietly accessible through a short explanation such as “I learned that you want more restraint in checkout,” with inspect, edit, pin and undo controls. Pinned fields remain fixed until the user changes them; all other supported fields remain eligible for automatic refinement.

Downstream tools consume a specific persona revision. Updating the profile invalidates affected judgment caches and refreshes relevant recommendations without replaying completed mutations or resetting active controls. A critique finishing against an older persona is marked stale and reconciled before it drives another change. Personalization is persisted application state and prompt context; it does not require model fine-tuning.

## Models and tools

Use a common typed decision interface with capability-aware providers. Route work by the evidence required, then evaluate providers on Baste examples before fixing permanent defaults.

| Responsibility | Proposed owner | Result |
| --- | --- | --- |
| Character creation, conversation and tool planning | Conversational model | Character records, replies and validated tool requests |
| Live spoken conversation | Not Organic's existing GPT-Live endpoint (`gpt-live-1`, client delegation) | Full-duplex speech connected to Baste's shared partner and tool runtime |
| Visual comparison and style coherence | Clef adapter | Typed judgments over actual screenshots and references |
| Preference interpretation, persona refinement and next useful action | Existing Jev adapter | Typed judgments over proposed profile changes, brief, decisions and grounded observations |
| Portrait, character frames and design asset creation | Image generation and motion tools | Persisted, identity-consistent media with generation provenance |
| Character performance | Application animation runtime | Generated frame sequences selected by conversation, playback and tool state |
| Individual spoken replies | Speech tool | Cancellable audio tied to a specific reply and compatible voice |
| Navigation, editing, validation and persistence | Application tools | Observations, mutations, revisions and receipts |

Clef's official hosted API supports embedded images alongside typed questions; it currently allows up to four images per request and does not accept remote image URLs. Baste therefore needs a capture and image-preparation stage, rather than passing a website URL as visual evidence. The released model returns decisions rather than free-form explanations. A conversational model explains the result using the same evidence. [Cloudflare API](https://developers.cloudflare.com/workers-ai/models/clef/), [model card](https://huggingface.co/Cloudflare/clef).

Do not route every interaction through both judges. Use Jev for text decisions, Clef when pixels matter, and deterministic code for exact constraints. Independent questions about the same evidence can be batched. A second call is useful when its input depends on an earlier answer. Cache by evidence, persona revision, question version and model identity.

## GPT-Live conversation

Integrate the specifically requested GPT-Live model, `gpt-live-1`, through Not Organic's existing `GET /v1/live/sessions` WebSocket upgrade. It supports simultaneous listening and speaking, with reasoning and tool work delegated to a separate backend. Baste supplies a same-origin authenticated browser relay and client delegation into the same runtime as text conversation. The current Not Organic endpoint uses WebSocket audio; browser WebRTC would require a separate gateway capability and is outside this baseline. [Not Organic integration contract](../../../notorganic-provider/docs/integrations/gpt-live.md), [GPT-Live overview](https://developers.openai.com/api/docs/guides/live).

Reuse the gateway's DPoP authentication, `realtime:connect` capability, existing realtime-consent requirement, wallet reservation, spending ceiling and final-usage reconciliation. The Baste backend connects with a fresh proof bound to the public HTTPS GET URL, an idempotency key and `x-notorganic-max-cost-microusd`. Keep all gateway credentials server-held. Native browser WebSockets cannot supply these headers, so the browser connects to Baste's relay rather than receiving a gateway token.

Honor the implemented gateway contract: startup accepts only authored `instructions` (up to 16,000 characters); the gateway fixes `gpt-live-1`, Marin, 24 kHz mono PCM16 audio, `store: false` and client delegation. Resample and pace microphone audio at the Baste boundary. Context appends are limited to 500 characters by the gateway. Current `apps/gateway/src/live.ts` accepts either session-wide `delegation_id: null` or a client-delegation ID previously observed from upstream; the integration document's null-only statement predates that source behavior. Use the implemented policy and verify the deployed contract during integration. Baste executes delegated tools through its shared commands and returns concise results; it does not need automatic paid Responses delegation.

Seed each session with a bounded, application-authored description of the selected partner and its persona revision, then supply relevant history and design facts through supported context appends. Keep user and site material as reference data. Send concise updates when the selected element, project or persona changes. Keep screenshots and detailed visual evidence in the vision-capable backend: the Live audio frontend accepts audio and text, with visual findings returned by delegated work. [Delegation and visual context](https://developers.openai.com/api/docs/guides/live-delegation#add-images-and-visual-context).

Live interviews feed the same refinement pipeline as typed exchanges. Coalesce transcript fragments into meaningful evidence so an unfinished phrase does not immediately rewrite the persona. After persisting a refinement, update the voice context and backend revision together; enforce current revisions in application code because context delivery is asynchronous. Start with the gateway's Marin voice and express character differences through conversational style and generated performance. Per-partner Live voice selection would be a specific extension to the existing gateway policy; it is not currently configurable, even at session startup. [Session context and configuration](https://developers.openai.com/api/docs/guides/live-conversations).

Keep listening, audio playback and delegated work as independent state. The user can interrupt a spoken explanation while a capture or edit is in progress. Interrupting playback does not imply cancellation of that work: an explicit stop or changed request updates the corresponding operation, rejects stale results and reports whether a change already completed. Captions, visible action status and the animated character reflect what actually happened. Share operation IDs and revisions across typed and spoken requests to prevent duplicate edits.

Provide a clear start/end control, microphone mute, captions and a text continuation path on disconnect. Restore durable project and persona state when reconnecting, and reconcile running operations before retrying. Track voice duration separately from delegated models and media jobs. End a call by stopping microphone input and sending `session.close`, then allow the relay to receive `session.closed` and finalize usage before teardown. Not Organic already owns this accounting, including incomplete-usage reconciliation. Muting alone leaves a billed session active. Baste must request the existing capability and pass an allowed spending ceiling, rather than introduce a second voice billing system. [Live lifecycle](https://developers.openai.com/api/docs/guides/live-conversations#usage-and-graceful-close).

## Generated stop-motion character

Generate the character's performance assets from its selected portrait and a consistent reference sheet. Preserve face, silhouette, clothing, materials, framing and palette across the set. The stop-motion treatment should feel deliberately posed, with held frames, small handmade variations and expressive transitions. Material and movement style can differ between characters while retaining Baste's overall visual direction.

Start with generated sequences for idle, attentive listening, speaking, considering a design, pointing, delight and doubt. Use a compact set of mouth shapes and head/hand poses for speech. Generate the chosen partner's core listening and speaking sequences first, then fill out reactions in the background. These are generated poses and frame sequences; the player assembles them into an ongoing performance. A motion-generation adapter is an optional production path to evaluate, not an assumed existing provider capability.

Package output as a versioned frame or sprite atlas with a manifest: character/reference revision, semantic state, dimensions, frame durations, loop and transition points, background treatment, generation provenance and asset hashes. Begin with a tunable cadence around 8–12 distinct poses per second and evaluate it visually. Check continuity, stable framing, usable loop seams and expressions that remain legible at the compact on-screen size. Retry an individual sequence without replacing the whole character.

Drive speaking poses from actual audible playback and its local audio clock, with a lightweight audio envelope choosing among held mouth shapes. This gives responsive stylized speech without promising exact phoneme alignment. Transcript arrival is not a playback clock. Stop speaking animation when output is muted, interrupted or disconnected; return to the appropriate listening or idle pose. Full duplex means listening can remain active during speech, so attention, mouth movement, reaction and tool activity cannot be one mutually exclusive state.

Select reactions from grounded dialogue and tool outcomes through a bounded expression command. A completed revision can trigger a pleased gesture; a pending judgment can trigger consideration. The animation should never announce success before the tool result. Playback is local and immediate using cached generated assets, with no generation call required for each conversational turn. Preserve the portrait while assets load or fail, and provide a still or restrained-motion mode that respects reduced-motion preferences.

Persona refinements can change gesture choice, pace and expressive habits immediately. Generate an additional expression or revised performance set in the background when a meaningful evolution warrants it, then switch versions at a safe playback boundary. Preserve visual identity and retain earlier versions for undo. Conversation continues while generation runs; no portrait or animation regeneration is required after every interview answer.

## Seeing and judging a design

The review loop is: **observe → ask focused questions → explain with evidence → change through tools → observe again**.

Capture the URL, viewport, interaction state, image hash, time, project revision, relevant DOM elements and the actions that reached the state. A desktop hero, mobile menu and hover state are different observations. Results against old revisions become stale instead of attaching silently to the newest design.

Useful visual questions include:

- Which of these variants better matches the selected references, including an “equally suitable” or “insufficient evidence” outcome?
- How consistent are the typography, spacing, imagery and materials with the chosen direction? Judge these dimensions separately.
- Does this element violate a specific, recorded dislike?
- Does the primary action remain visually prominent in this captured state?
- Did this revision improve the intended quality while preserving the qualities already accepted?

Use element candidates and screenshot crops to ground findings. Clef can choose among known elements or assess a proposed observation; it does not automatically return a reliable free-form critique or locate every issue. The conversational model can draft observations, but explanations must remain tied to captured evidence and actual judgment results.

Keep cultural fit, coherence, novelty and usability visible as separate dimensions. Baste's existing weighted rubric remains configurable. Exact contrast, overflow, keyboard and functional checks stay deterministic. A visual model's confidence describes its answer distribution; Baste must measure agreement with user preferences before treating it as a reliable predictor. [TypeSafe confidence](https://docs.typesafe.ai/confidence), [composite scoring](https://docs.typesafe.ai/patterns/composite-scoring).

Evaluate pairwise choices on held-out screenshots and user decisions. Check order reversal, repeated judgments, mobile and desktop states, unusual styles and incomplete evidence. Generic decision benchmarks do not establish skill at aesthetic judgment. Preserve useful disagreements and diverse design candidates rather than optimizing everything toward one average appearance.

## Fluid interface

Keep the live design central. The partner has a compact, persistent animated presence with text entry, GPT-Live controls and optional captions. Its generated portrait is the loading and reduced-motion fallback. Discussion and tool results can attach to selected elements or expand inline. On narrow screens, use an anchored sheet with a clear return to the design. Preserve focus and in-progress edits when the interface changes.

Start with a small component catalog:

| Surface | Purpose |
| --- | --- |
| Partner choices | Compare the three initial characters |
| Evidence annotation | Point at a captured element and explain a reaction |
| Variant comparison | Compare current and proposed treatments |
| Palette and type controls | Adjust actual design values with a live preview |
| Reference board | Collect and relate visual references |
| Revision comparison | Inspect changes and undo them |
| Preference prompt | Resolve a meaningful taste question |

OpenUI composes these application-owned components and connects them to tools. Reactive state keeps ordinary controls responsive without a new model call for every click. Incremental changes preserve the controls and values that still apply. Actual design edits pass through the project's mutation tools, so a newly generated control never masquerades as a completed code change. [OpenUI architecture](https://www.openui.com/docs/openui-lang/architecture), [reactive state](https://www.openui.com/docs/openui-lang/reactive-state), [incremental editing](https://www.openui.com/docs/openui-lang/incremental-editing).

Keep Baste's Qwik/Panda stack and existing atelier identity. Evaluate a Qwik adapter around the framework-independent OpenUI core, including state subscriptions, query lifecycle, cancellation, action dispatch and component validation. Qwik support is adapter work, not a verified drop-in integration. Use one versioned component/tool contract rather than inventing a second generative UI grammar. Keep a normal static interface available if an emitted surface is invalid.

Popmelt's documented pattern is valuable here: element-level conversation, direct manipulation, local project context and a remembered history of design choices. Explore an optional in-page companion for connected projects, backed by the same Baste commands, so work can happen both in Studio and on the running site. This plan uses those interaction ideas; it does not claim Popmelt itself is integrated or that its advertised behavior was tested. [Popmelt](https://popmelt.com/).

## Tool and project contract

Introduce durable, account-scoped `Project`, `DesignPartner`, `Conversation`, `Evidence`, `DecisionEvent` and `Revision` records, with versioned character media manifests and live-session operation records. A project references its brief, selected audience persona, partner, connected sites, canonical design state, artifacts and active runs. Large evidence, media and conversation records are stored separately and referenced by ID.

All surfaces call the same validated service commands: agent, Studio, generated UI, CLI and MCP. Proposed tool families are partner creation/selection, profile inspection/refinement/pinning/revert, character media generation and bounded expression selection, live-session lifecycle, browser observation/navigation, reference collection, visual judgment, token/component edits, project patches, comparison/revert and speech. Tool schemas describe actual capabilities; the model cannot invent tools or obtain authority from page content.

Mutations include a base revision and idempotency key, and return the resulting revision, changed entities and a human-readable result. Apply changes atomically where possible. For connected repositories, stage a bounded patch, verify it, apply it and capture the updated preview; retain enough history to undo the patch without overwriting later user edits. A failed or interrupted action retains an accurate status. Newer edits take precedence over stale tool results.

The user's selected collaboration scope covers the connected project. The runtime still distinguishes project edits from external publication, payment and unrelated sites. Implement the browser as an isolated service with project-specific sessions, destination checks on navigation and subresources, and explicit capture/action history. Existing static decomposition is not this browser runtime.

Not Organic remains the hosted identity, wallet and provider boundary. GPT-Live already has a gateway endpoint and accounting: consume them through Baste's relay and add the existing `realtime:connect` capability to Baste's account flow. Inventory the provider's other existing routes before adding Baste adapters for chat, visual judgment, character media and speech; extend provider contracts only for demonstrated gaps. Credentials remain server-held. Budget a run across conversation, live-session duration, captures, judgments, media and speech, and stop further dispatch when cancelled or out of budget. Baste's current image/Jev client does not yet connect these additional workflows.

## Learning from decisions

Record candidate exposure and order, selection, interview answers, preference answers, automatic persona refinements, accepted edits, reversions and explicit reasons as typed events. Include relevant trait snapshots, evidence/revision IDs and model/rubric versions so a decision can be understood later. Automatic project personalization consumes these events during normal work; product analytics remains a separate projection.

Project history retains the detailed work context. The product analytics projection contains decision events and traits, following the recovered choice; raw conversation, voice recordings, screenshots and provider credentials are excluded from that projection. A candidate selection is not a negative label for every trait of the alternatives. Distinguish explicit preference, inferred preference, no response and technical failure.

Use these events first to improve ranking and measure usefulness: whether judgments match later choices, whether changes survive, and where users reverse the partner. Fine-tuning is a later experiment once there is enough representative, appropriately scoped evidence. Do not silently turn every logged event into a training example.

## Existing foundations and gaps

The source review found reusable foundations, but no complete conversational partner workflow:

- `src/persona/types.ts`, `builder.ts` and `store.ts`: cultural persona records; add partner identity and project context around them.
- `src/assets/generators.ts`: hosted image generation suitable for portrait jobs; add portrait-specific output and identity handling.
- `src/evaluation/typesafe-judge.ts`: explicit text-only Jev evidence; add a multimodal decision adapter and reusable rubrics without claiming existing pixel inspection.
- `src/notorganic/scope.ts` and account stores: reuse DID ownership for all new records and assets.
- `.flue/agents/baste.ts`: currently action dispatch with an unused session, not a persisted conversational tool loop.
- `src/decompose/index.ts`: static extraction and a short-lived optional browser path; add persistent observation/action sessions and browser network enforcement.
- `src/versioning/`: semantic changes and diffs; extend this into complete project revisions. The current OpenPencil import does not preserve the complete edited design as a reversible project mutation.
- `src/mcp/server.ts` and `src/gui/api.ts`: extract shared commands before allowing hosted partners to use them; current local MCP handlers are not account-scoped.
- `site/src/components/studio/`: preserve the existing components, but introduce a project work surface and shared generated contracts instead of extending duplicated API types indefinitely.

Twyne references to reuse as patterns are `src/components/onboarding/conversational-interview.tsx` for progressive briefing, `src/utils/personas.ts` for character voice and critical method, `src/components/in-flow/catalog.ts` and `src/utils/in-flow-tools.ts` for bounded tool surfaces, and its flow/review and brief-history utilities for visible state and durable decisions. Twyne's existing cast does not already implement generated partner identities. These are current source references, including work in progress, rather than proof of deployed behavior.

For GPT-Live, Twyne's `src/utils/live-voice.ts`, `src/utils/live-voice-workspace.ts`, `src/components/ui/live-voice-desk.tsx` and `convex/liveVoice.ts` provide local references for persona context, client delegation, revision-aware actions and Not Organic session authorization. Verify interruption against actual playback when adapting them; the inspected helper does not expose a separate output-queue clear operation. Keating's `web/src/components/KeatingBot.tsx` and `keating-bot.css` provide a discrete-pose atlas player with loading fallback, visibility pausing and reduced motion. Reuse those playback patterns in Qwik; generate new partner-specific art. Keating's separate Realtime interruption protocol must not be copied into GPT-Live as if they were the same API. These references were inspected in source, without a live provider or playback test.

The concrete Baste Live integration gaps are in `src/notorganic/server.ts` (request `realtime:connect`, bridge existing GET/POST `/v1/realtime/consent`, and represent Live availability), `src/gui/server.ts` (authenticated same-origin WebSocket upgrade/relay), `site/vite.config.ts` (WebSocket forwarding), and the new browser audio/delegation adapter. Existing grants may need reconnection for the additional scope. Reuse origin/CSRF protection for consent changes and check origin, account ownership and spending ceilings on the socket upgrade. Session budgeting must consume Not Organic's existing Live reservation contract; image/Jev request estimates do not cover an ongoing voice session.

## Build sequence and acceptance

| Stage | Deliverable | Acceptance evidence |
| --- | --- | --- |
| 1. Shared foundation | Project/partner schemas, ownership, commands, revisions, event contract and mappings to existing hosted capabilities | Account isolation; reload persistence; stale-write rejection; exact edit/undo round trip |
| 2. Meet and talk | Three persisted candidates, generated portraits, selection, core stop-motion assets, streamed conversation and automatic persona refinement | Interview the chosen partner; observe a supported profile revision and changed subsequent recommendation; reload and retain the same identity and learned context; undo or pin a trait; generated motions retain identity and individual failures recover |
| 3. Look together | Connected browser, captures, element references, Clef adapter and Jev decisions | Navigate a real site, capture desktop/mobile states, receive grounded judgments and reject stale evidence |
| 4. Collaborate | Initial OpenUI catalog, live controls, token/component tools and connected source patches | Discuss an element, adjust it through a generated surface, see the actual preview update, undo and reload without loss |
| 5. Live character | GPT-Live with shared tool delegation, generated stop-motion performance, individual spoken replies, project decision history and analytics projection | Real microphone/speaker session; speak over a reply; complete and cancel tool work with accurate state; refine the persona by voice; motion follows audible playback; reconnect without duplicate edits; close and reconcile usage; reduced-motion fallback; analytics contains only its allowed event fields |

After Stage 1, character/conversation and motion assets, browser/visual judgment, the Qwik OpenUI adapter, and Baste's relay/client for the existing Not Organic GPT-Live endpoint can proceed in parallel against shared contracts. Stage 4 integrates design tools; Stage 5 connects the live performance to that workflow. The first complete release includes GPT-Live and generated stop-motion characters. Broader project integrations follow later.

The first acceptance journey is deliberately end to end: describe a project, meet three characters, choose one, see its generated stop-motion presence, start GPT-Live, interview it and observe automatic refinement, open a connected site, discuss a specific element aloud, interrupt and clarify, compare an alternative informed by the refined persona, make and undo a real edit through the shared tools, end the call, then reload and continue with the learned profile intact. Verify actual audible output, animation and completed mutations separately. Passing that journey is the release goal, rather than merely completing the individual adapters.
