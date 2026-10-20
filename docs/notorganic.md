# Not Organic account integration

Baste consumes Not Organic identity, model access and billing through a server-side bridge. The Qwik Studio is the account interface; it does not handle provider keys, token persistence or payment credentials.

The integration reuses the other projects' boundaries: Keating's verified available wallet balance and advertised offer gating, and server-held PKCE/DPoP sessions rather than browser-held upstream secrets.

## Studio flow

1. Start Baste and open Studio Settings.
2. Select **Sign in / create profile**. The Not Organic authorization portal owns profile creation and authentication.
3. After the callback, inspect the public DID/handle, live model catalog and wallet balance in Settings. Manage the account profile through the portal link; design personas remain separate Baste objects.
4. In Generate, choose Not Organic and an available image model. The hosted suite contains hero/background images; the provider also judges candidates. Optional editing, segmentation and image animation use the provider’s fal roles and the same wallet. Full UI kits still require local SVG providers.
5. Choose an advertised wallet offer to open checkout and review price there. After returning, refresh the wallet to confirm available credit. Returning from checkout alone does not establish payment success.

No price is inferred from an offer ID. Checkout stays unavailable when the provider does not advertise it. Paid generation stays unavailable when balance cannot be verified, credit is empty, or the wallet is blocked. Dry runs remain prompt drafts with no paid generation requests.

## Server configuration

```dotenv
NOTORGANIC_ENABLED=true
BASTE_PUBLIC_ORIGIN=http://localhost:5173
NOTORGANIC_ISSUER=https://api.notorganic.info
NOTORGANIC_AUTHORIZATION_URL=https://id.notorganic.info/authorize
NOTORGANIC_MAX_COST_MICROUSD=10000000
```

`BASTE_PUBLIC_ORIGIN` must match the browser's exact origin. The callback is `{BASTE_PUBLIC_ORIGIN}/api/notorganic/callback`. The issuer is an origin without `/v1`; the authorization URL is the portal's authorization endpoint. HTTPS is required outside loopback development, and checkout requires an HTTPS return origin. The maximum-cost setting is a request ceiling in micro-USD, not a quoted model rate.

The Studio asks for an explicit per-run maximum, initially $1. Its budget plan reports the conservative image/judging request counts, minimum cap and operator limit before any generation charges. Iterations, batch size and final outputs per purpose are visible controls; changing them updates the plan. The server's default limit is $10. The default two-image suite with 5 iterations, batch size 3 and 3 outputs per purpose needs a $12.90 conservative cap, so it cannot start under that limit. Reduce the candidate settings, or have the operator explicitly increase the limit and then explicitly choose a sufficient per-run maximum. Do not interpret the conservative cap as a price quote.

Production must proxy `/api` on the Studio origin to the Baste API. Vite supplies that proxy during development and preview. Public deployment needs an equivalent reverse proxy and provider-approved origin.

Not Organic must register Baste's client origin, callback, `baste` product audience, and requested scopes:

```text
wallet:read usage:read billing:checkout infer:image judgement:evaluate videos:generate videos:read
```

Registration, provider configuration and offered billing products are external requirements. Enabling a local environment flag does not grant provider authorization or make an offer payable.

## Session and storage

The server generates PKCE state/verifier and a DPoP signing key. It exchanges the authorization code, verifies the upstream account and product-scoped token, then rotates the Baste session. Browser state contains only public profile information and an anti-CSRF token. The Baste cookie is HttpOnly, SameSite=Lax, and Secure on HTTPS.

Sessions expire after eight hours and currently live in process memory. Restarting the server requires signing in again. A multi-replica production deployment needs shared session storage or session affinity before it can reliably serve account sessions across replicas.

Authenticated persona records, associated design data and generation outputs are separated by DID. Base personas remain shared read-only templates; tailoring creates an owned copy. Local CLI stores remain independent from account-owned work. Hosted config writes and filesystem watcher/native-file operations are unavailable; the operator manages server configuration.

Completed hosted image results include protected URLs under `/api/assets/images/`. The Studio previews and downloads those files with the account session cookie. An account cannot fetch another DID's files, and private responses must not be cached by the proxy.

## Bridge API

All paths below start with `/api/notorganic/` and return JSON unless the callback redirects. Responses must not be cached.

| Method and path | Result |
| --- | --- |
| `GET status` | `configured`, `authenticated`, `csrfToken`, public `profile`, `manageAccountUrl`, capabilities and optional reason |
| `POST login` | Authorization `{ url }`; account profile creation happens in the portal |
| `GET callback` | Verifies one-time state and authorization code, then redirects to Studio Settings |
| `GET models` | `{ data: [{ id, kind }] }` from the authorized provider catalog |
| `GET wallet` | Verified `availableMicros`, block/debt state and `checkout: { available, packIds, planIds }` |
| `GET packs` | Wallet/offer availability alias |
| `POST checkout` | Accepts exactly one advertised `packId` or `planId`, returns secure `{ url }` |
| `POST logout` | Removes local session authority and attempts refresh-token revocation |

POSTs and authenticated Baste mutations require `X-Baste-CSRF` from `status`, with the session cookie and correct Studio origin. Requests never accept a browser-supplied DID as authority. Invalid or unavailable provider data produces an error instead of a guessed model list, balance or offer.

`POST /api/generate/:id/plan` accepts the generation request and returns `imageCalls`, `judgementCalls`, `minimumBudgetMicrousd`, `operatorMaxCostMicrousd`, `requestedMaxCostMicrousd`, `withinOperatorLimit`, `withinRequestedBudget`, and per-request ceilings. Generation accepts `maxCostMicrousd`, `qd: { iterations, batchSize }` and `outputCount`. Hosted limits are 0–10 iterations, batch size 1–10, outputs 1–10, and 1–8 image purposes. The budget includes the initial population, evolved candidates and final outputs. The first image purpose ships judged candidates rather than drawing new ones, so its outputs add judging requests only. The server rejects an insufficient cap before contacting paid generation or judging services. Actual debits belong to Not Organic; reserved ceilings may be higher than eventual cost.

## Live validation

Automated tests cover isolated contracts and rejection paths. They do not prove the external OAuth portal or paid services. Before declaring production integration complete, verify a real profile/signup, authorization callback, refreshed session, owned persona creation, authorized image catalog, funded generation and judging, checkout completion, signed webhook credit delivery, and resulting wallet balance. Keep the test origin, product registration and payment-mode evidence with deployment records. No live purchase is required merely to build or review this code.

## Hosted fal roles

The provider exposes `POST /v1/fal/jobs` and `GET /v1/fal/jobs/:jobId` for `image-edit`, `image-segment` and `image-animate`. Baste sends images inline (up to 8 MiB each) or uses existing fal media URLs. It never uses a Baste operator’s fal key for an account run. Polling reads the existing reservation; it does not create another charge. Jobs belong to the authenticated DID and product, are persisted before returning, and the provider reconciles them after disconnection.

Enable these roles in **Not Organic’s gateway**, with its `FAL_KEY` and an asynchronous job store. Set positive integer prices in micro-USD: `FAL_EDIT_PRICE_MICROUSD` per balanced edit, `FAL_SEGMENT_PRICE_MICROUSD` per segmentation, and `FAL_ANIMATE_PRICE_MICROUSD` per second at 720p. These are operator-configured billed rates, not guessed prices. Optional `FAL_EDIT_UPSTREAM_MODEL`, `FAL_SEGMENT_UPSTREAM_MODEL`, and `FAL_ANIMATE_UPSTREAM_MODEL` select compatible Ideogram, SAM 3 and Seedance endpoints. Unpriced or storage-unavailable roles stay out of the catalog. Native stores without async-job methods must implement them before enabling this path.

The spending plan includes up to three subject-segmentation attempts per cut, QD edits, final background repaints, optional end-frame edits, animation jobs and their quality checks. Each submission consumes its conservative ceiling before dispatch, including failed requests. The gateway rejects configured rates above the submitted ceiling. Existing sessions may need a new sign-in to grant video permissions.

## CLI account credits

```sh
baste login
baste credits
baste credits --buy <advertised-pack-id>
baste credits --plan <advertised-plan-id>
baste generate cyberbotanist --provider notorganic --iterations 0 --batch-size 1 --output-count 1 --max-cost 5 --edit --animate parallax
baste logout
```

`login` uses PKCE and device-bound DPoP on `http://localhost:3458/callback`; register the exact `http://localhost:3458` client origin, callback and Baste product with the scopes above. `--no-open` prints authorization or checkout URLs for manual use. Checkout opens a provider-advertised offer for the user to review and pay; it does not purchase automatically. Run `baste credits` afterward to verify the balance.

Credentials and the device signing key live in `$XDG_CONFIG_HOME/baste/account.json` (default `~/.config/baste/account.json`), atomically replaced with mode 0600. Refresh is bound to the original DID, issuer and Baste product; logout attempts device revocation and always removes local credentials. Keep this file private. Hosted CLI generation defaults to hero/background images, preflights models and balance, and uses the same per-suite budget guard as Studio. Custom `assetTypes` must contain only images. `--max-cost` is a positive USD spending limit, not a price quote; local operator limits still apply.
