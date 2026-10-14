# Local development

Use Nix and Devenv from the repository root. Native tasks run npm scripts with Node and install frozen dependencies using the root and site `package-lock.json` files.

```sh
devenv shell
devenv tasks run baste:install
devenv up
```

`devenv up` starts the Baste API on port 3456 and the Qwik site on port 5173. Open `http://localhost:5173/gui/` for the Studio or `http://localhost:5173/docs/` for documentation. The site proxies `/api` to the local API, keeping session cookies on one origin.

The bundled GUI served by `baste gui` is also available on the API port. It is a local legacy interface; the Qwik Studio owns the account, wallet and live hosted-model UI.

If the running site reports a missing import for a source file that now exists, restart just the site with `devenv processes restart site`. Vite can retain an SSR import failure when the importing file is updated before the new module is created. Check the rendered Studio and browser console after recovery: a development error page can return HTTP 200, so a successful health request alone does not verify the page.

## Saved projects

Open **Projects** in the Studio to give an application a brief and choose an audience persona. Projects retain their own audience snapshot, so editing a source persona does not silently alter an existing project. Each saved change creates a revision; restoring an earlier revision creates a new history entry.

Local projects are stored in `.baste/projects`. Hosted projects use the signed-in Not Organic account's directory under `.baste/accounts`. These private runtime files are ignored by Git. Concurrent changes return a conflict so the Studio can retain the draft and offer the latest saved version. Repeated requests with the same command ID do not create duplicate changes.

This is the first milestone of the [design partner plan](plans/design-partner.md). Generated characters, conversational refinement, GPT-Live and stop-motion performance are subsequent milestones.

An interrupted writer can leave a project lock behind. If a saved project keeps reporting that it is busy after a server crash, stop every Baste process using that storage before repairing the specific lock. From the same working directory as the server, after building:

```sh
devenv processes down
node dist/src/projects/repair-lock.js --project <project-id> --server-stopped
# For a hosted project, also supply its owner's DID:
node dist/src/projects/repair-lock.js --project <project-id> --account <owner-did> --server-stopped
devenv up
```

The repair preserves project history and command receipts. It refuses a live lock owner, a changed file or a symlink. The stopped-server precondition also covers other workers or replicas sharing this directory; run the appropriate local or hosted command once, then restart. This operation is deliberately unavailable to browser and agent callers.

## Tasks

| Task | Behavior |
| --- | --- |
| `baste:install` | Install root and site dependencies from their lockfiles |
| `baste:api` | Start the Baste API |
| `baste:site` | Start the Qwik site and Studio |
| `baste:docs` | Start the site for its `/docs/` route |
| `baste:storybook` | Start Storybook |
| `baste:dev` | Start the configured development processes with `devenv up` |
| `baste:build` | Build the CLI/package and site |
| `baste:typecheck` | Check root and site TypeScript |
| `baste:lint` | Check frontend lint rules |
| `baste:test` | Run existing root tests |
| `baste:check` | Run the configured validation tasks |
| `baste:storybook:build` | Build the component explorer |

```sh
devenv tasks list
devenv tasks run baste:typecheck
devenv tasks run baste:check
```

Storybook does not start by default. Enable its process when needed:

```sh
BASTE_WITH_STORYBOOK=1 devenv up
```

## Configuration

Copy `.env.example` to `.env` and configure the providers you use. Do not commit `.env` or a config file containing private keys.

- `BASTE_API_PORT`: API process port, default `3456`.
- `BASTE_SITE_PORT`: Qwik development port, default `5173`.
- `BASTE_STORYBOOK_PORT`: Storybook port, default `6006`.
- `BASTE_WITH_STORYBOOK=1`: opt-in Storybook process.
- `BASTE_PUBLIC_ORIGIN`: exact browser origin for account callbacks and CSRF checks. Devenv sets `http://localhost:5173`; the standalone API defaults to `http://localhost:3456`. Set it explicitly when running the Qwik Studio outside Devenv, changing its port or serving a deployed Studio.

The Studio uses `/api` by default. Its Settings connection field supports an explicit API URL for local development. Account mode requires the configured Studio origin and a same-origin proxy. A public static site needs its hosting layer to route `/api` to Baste; a static build alone does not provide the account API.

For local generation, configure `OPENAI_API_KEY`, `QUIVER_API_KEY`, `GOOGLE_API_KEY`, and any other selected provider's settings. Run `baste config --init` for a local `baste.config.json`. Preview prompts with `baste generate cyberbotanist --dry-run` before spending provider credit.

The public persona conversation at `/#meet` uses authored replies when no conversation model is available. In local mode, `OPENAI_API_KEY` enables open-ended replies through `POST /api/converse/:id`; `BASTE_CONVERSATION_MODEL` selects the model (default `gpt-4o`). Restart the API after changing these values. `/api/health` reports `conversation.mode` as `ai` or `demo`. Account mode always disables this local-key path. Hosted AI conversation still needs a metered account transport; the public page labels its authored demo explicitly. Failed AI replies remain visible with a retry action, and never silently become demo replies.

Technical explanations, scoring, exports and local setup are at `/method/`. The public landing page introduces the personas. Lenis and Tempus run only on the landing and Method pages; inner chat and Studio scrollers remain native. The Method page's decorative Strands composition from shaders.com loads on visibility, with a static fallback for unavailable WebGPU and reduced motion. The heading reveal adapts React Bits' BlurText treatment to Qwik without adding a React runtime.

The public conversation reuses the Moss, Ren and Ada portraits from the October 8 companion workroom studies, recovered from worktree `73bc` through the local Entire session history. Their source prompts and asset provenance are in [companion-portraits.json](companion-portraits.json). They are illustrated example characters; the page does not claim that runtime portrait generation or the full Studio partner workflow is implemented. The conversation keeps the atelier typography and writing surface stable, while palette and type samples show each persona's design choices inline.

For the hosted account path, see [Not Organic integration](notorganic.md). Local CLI calls do not receive a browser's hosted account session.

## Tour video

The 74-second tour on the home page and in the Studio guide is a HyperFrames composition in `videos/baste-tour/`. Each step writes files the next one reads, so any step can be redone alone:

```sh
# Screens, recorded from the running site with the system Chrome on the GPU
env -u LD_LIBRARY_PATH node scripts/record-tour.mjs        # footage/*.webm, clips.json, cfr/*.mp4
# Narration on Cartesia Sonic (voice Theo), word timings from fal Whisper; music bed on fal Stable Audio 2.5
node scripts/narrate-tour.mjs --skate --keep-timing         # narration/; --keep-timing fits new lines to the current cut
node scripts/score-tour.mjs --skate                         # music/bed.mp3
cd videos/baste-tour
node build.mjs                                              # index.html, captions.vtt, captions.fr.vtt, assets/voice/
env -u LD_LIBRARY_PATH npx --yes hyperframes@0.8.145 check
env -u LD_LIBRARY_PATH npx --yes hyperframes@0.8.145 snapshot --at 20,43,60
env -u LD_LIBRARY_PATH npx --yes hyperframes@0.8.145 render --quality high --fps 30 --output renders/baste-tour.mp4
node publish.mjs                                            # site/public/media/tour/, site/src/lib/tour.json
```

`build.mjs` holds the edit: the seconds of each recording that play, their speed, the wipes and the camera moves. It refuses a cut that starts before 3.6 s, while the development overlay is still on screen, or that runs past the end of a take. French subtitles live in `narration/captions.fr.json`, one line per English cue; the build stops if the counts differ. `--skate` reads `cartesia_api_key@secrets` and `fal_api_key@secrets`; otherwise set `CARTESIA_API_KEY` and `FAL_KEY`. The Studio guide narrations use the same voice: `node scripts/narrate-studio-guide.mjs --skate` for the short recording and `node scripts/revoice-walkthrough.mjs --skate` for the long English walkthrough, which keeps its picture and caption timings. The key is only held in the process.

The render's preflight runs `ldd` on its Chrome. On a Nix or Guix host, unset `LD_LIBRARY_PATH` and put the system `ldd` first on `PATH` (for example a directory holding a link to `/usr/bin/ldd`). A render is cancelled when the shell that launched it exits; set `HYPERFRAMES_RENDER_DETACHED=1` to run one in the background. Footage, renders, snapshots and `.work/` are build products and stay out of Git; the published files under `site/public/media/tour/` are what the site serves.

## Verification boundaries

The fabric regression check exercises window resizing, a lost WebGL context, and touch viewport changes while scrolling. It checks that no resized canvas reaches paint before being redrawn, inspects the rendered background, and saves screenshots plus a report under `/tmp/baste-fabric-qa`:

```sh
rtk proxy node site/scripts/verify-fabric.mjs
```

Set `PLAYWRIGHT_MODULE` to an installed Playwright module if it is not on the project path. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `FABRIC_QA_URL` (default `http://localhost:5173`), and `FABRIC_QA_OUTPUT` are optional overrides. This is browser emulation; an actual mobile device remains a separate check.

Typechecks and builds verify code and compilation. They do not prove live sign-in, provider registration, funded inference, checkout, wallet delivery or webhook reconciliation. Record those separately after exercising a registered account and configured deployment. A prompt dry run proves prompt drafting only.
