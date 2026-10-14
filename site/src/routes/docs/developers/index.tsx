import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { css } from 'styled-system/css';
import { Nav, GITHUB_URL } from '~/components/layout/nav';
import { Footer } from '~/components/layout/footer';
import { CodeView } from '~/components/ui/code-view';
import { CopyCommand } from '~/components/ui/copy-command';
import { DocsNavigation } from '~/components/docs/navigation';
import { COMMANDS, API } from '~/components/docs/reference';

const SECTIONS = [
  ['development', 'Run locally'], ['notorganic', 'Account server'],
  ['providers', 'Local providers'], ['fal', 'One key: fal'], ['voice', 'Companion voice'], ['cli', 'CLI reference'], ['api', 'API reference'], ['outputs', 'Outputs'],
  ['tour', 'Tour video'],
] as const;

const prose = css({ maxW: '70ch', fontSize: '15px', lineHeight: 1.7, color: 'ink-soft' });
const section = css({ display: 'flex', flexDirection: 'column', gap: 5, py: 9, borderBottom: '1px solid token(colors.rule)', scrollMarginTop: '90px', minW: 0 });
const title = css({ fontFamily: 'display', fontSize: '32px', fontWeight: 500, lineHeight: 1.15 });
const table = css({ w: '100%', borderCollapse: 'collapse', fontSize: '13px', '& td, & th': { textAlign: 'left', py: 3, px: 3, borderBottom: '1px solid token(colors.rule)', verticalAlign: 'top' }, '& th': { color: 'ink', fontWeight: 600 }, '& td:first-child': { fontFamily: 'mono', color: 'ink', minW: '210px' } });

export default component$(() => (
  <>
    <Nav />
    <main id="main" class={css({ maxW: '1180px', mx: 'auto', px: { base: 4, md: 8 }, pt: { base: 8, md: 14 } })}>
      <DocsNavigation active="developers" />
      <header class={css({ maxW: '780px', pb: 10 })}>
        <h1 class="display" style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 1.05 }}>Developer docs.</h1>
        <p class={css({ mt: 5, fontSize: '19px', lineHeight: 1.55, maxW: '58ch', color: 'ink-soft' })}>Run your own Baste installation, configure generation services, or build with the CLI and API.</p>
      <p class={prose}>Looking for help with personas, materials, moodboards or exports? <a href="/docs/">Read the Studio guide</a>.</p>
      </header>
      <div class={css({ display: 'grid', gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: '200px minmax(0, 1fr)' }, gap: { base: 3, lg: 12 }, alignItems: 'start' })}>
        <nav aria-label="Developer documentation sections" class={css({ position: { lg: 'sticky' }, top: '90px', display: 'flex', flexDirection: { base: 'row', lg: 'column' }, flexWrap: 'wrap', gap: 3, fontSize: '14px', py: 4, borderTop: '1px solid token(colors.rule)' })}>
          {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} class={css({ color: 'ink-soft', textDecoration: 'none', _hover: { color: 'thread-ink', textDecoration: 'underline' } })}>{label}</a>)}
        </nav>
        <div class={css({ minW: 0 })}>
          <section id="development" class={section}>
            <h2 class={title}>Run locally</h2>
            <p class={prose}>From a checkout with Nix and Devenv installed, enter the development shell, install the locked dependencies, then start the API and site together.</p>
            <CodeView label="Start local development" code={'devenv shell\ndevenv tasks run baste:install\ndevenv up'} />
            <p class={prose}>The Studio runs at <a href="http://localhost:5173/gui/">localhost:5173/gui/</a>. Its same-origin <code>/api</code> proxy reaches the Baste server on port 3456. Set <code>BASTE_SITE_PORT</code> and <code>BASTE_API_PORT</code> to change the ports. Storybook is an optional process on port 6006.</p>
            <p class={prose}>Use the native tasks for individual commands and checks. The full task list and environment setup live in the <a href={`${GITHUB_URL}/blob/main/docs/development.md`}>development guide</a>.</p>
            <CopyCommand command="devenv tasks list" />
          </section>

          <section id="notorganic" class={section}>
            <h2 class={title}>Configure an account server</h2>
            <p class={prose}>In Studio Settings, select <strong>Sign in / create profile</strong>. Not Organic creates or authenticates your account profile; a Baste design persona is a separate object. Manage your handle and account in the linked Not Organic portal.</p>
            <p class={prose}>The Baste server holds the provider session and DPoP key. The browser receives an HttpOnly Baste session cookie, a CSRF token and the profile's public DID and handle. The model picker loads the authorized catalog from your connected account.</p>
            <p class={prose}>Your wallet shows verified available credit and only the offers advertised by the provider. Select an offer to open checkout and review its current price before paying. On return, refresh the wallet: a redirect alone does not prove payment or credit delivery.</p>
            <p class={prose}>Hosted generation currently covers image suites and asset judging. Full UI kits still need your local SVG and video providers. An unverified, blocked or empty wallet prevents paid hosted generation; prompt drafts remain available.</p>
            <p class={prose}>Set a maximum spend for each hosted run, initially $1. The live budget plan counts image and judging requests, including QD candidates and final outputs. Reduce iterations, batch size or outputs per purpose until the plan fits your maximum and the server limit, or explicitly raise your maximum. These conservative ceilings are spending limits, not quoted prices.</p>
            <p class={prose}>For server operators: enable <code>NOTORGANIC_ENABLED</code>, set <code>BASTE_PUBLIC_ORIGIN</code>, and configure the issuer and authorization URL. Baste must be registered with Not Organic for its origin, callback, product audience, scopes and billing offers. Public checkout needs an HTTPS return origin.</p>
            <CodeView label="Account server configuration" code={'NOTORGANIC_ENABLED=true\nBASTE_PUBLIC_ORIGIN=http://localhost:5173\nNOTORGANIC_ISSUER=https://api.notorganic.info\nNOTORGANIC_AUTHORIZATION_URL=https://id.notorganic.info/authorize'} />
            <p class={prose}>The callback is <code>/api/notorganic/callback</code> on the Studio origin. Production hosting must proxy <code>/api</code> to the Baste server. Sessions live in server memory and expire after eight hours; restarting the server requires signing in again. Read the <a href={`${GITHUB_URL}/blob/main/docs/notorganic.md`}>account integration guide</a> for the deployment boundary.</p>
          </section>

          <section id="providers" class={section}>
            <h2 class={title}>Use your own provider keys</h2>
            <p class={prose}>Local mode keeps provider keys in the server environment or local config. Image generation uses OpenAI or Google; SVG generation uses QuiverAI; video uses its configured provider. The Studio never needs an upstream key pasted into a form.</p>
            <CodeView label="Local provider key configuration" code={'OPENAI_API_KEY=…\nQUIVER_API_KEY=…\nGOOGLE_API_KEY=…'} />
            <p class={prose}>Copy <code>.env.example</code> to <code>.env</code> and configure only the services you use. Run <code>baste config --init</code> to create <code>baste.config.json</code>. Model IDs must be supported by your chosen provider. Local generation and CLI use this configuration; hosted Studio requests use the connected account session.</p>
          </section>

          <section id="fal" class={section}>
            <h2 class={title}>Run everything on one fal key</h2>
            <p class={prose}>With <code>FAL_KEY</code> set, one fal account can cover a whole run: Seedream v4 images, Recraft v3 vector icons, Seedance 1 Pro ambient loops, and a judge that looks at the rendered images through fal’s vision model. The archive in the <a href="/#tour">tour</a> came from a run like this.</p>
            <CodeView label="Generate on fal" code={'FAL_KEY=… baste generate cyberbotanist --provider fal\n\n# Mix providers: fal images, your QuiverAI SVGs, OpenAI judging\nbaste generate cyberbotanist --image-provider fal --svg-provider quiver --judge openai'} />
            <p class={prose}><code>--provider fal</code> routes every stage through fal; <code>--image-provider</code>, <code>--svg-provider</code>, <code>--video-provider</code> and <code>--judge</code> override one stage each. The vision judge defaults to <code>google/gemini-2.5-flash</code>; SVG markup and video prompts go to the text endpoint because the vision endpoint needs an image. In the Studio, choose <strong>fal (images, icons and judge)</strong> as the image provider. A run fails at the start when <code>FAL_KEY</code> is missing, before anything is spent.</p>
            <p class={prose}>Draft with <code>--dry-run</code> first. Each stage bills your fal account, and judging adds a request for every candidate, so iterations and batch size multiply the cost.</p>
          </section>

          <section id="voice" class={section}>
            <h2 class={title}>Companion voice</h2>
            <p class={prose}>Set <code>FAL_KEY</code> on the Baste API server for ElevenLabs Turbo v2.5 speech and Wizper transcription. The browser sends recorded audio to Baste and receives audio bytes or editable text; it never receives the provider key. Recording starts only after a user gesture and stops after 45 seconds.</p>
            <CodeView label="Start local voice with Skate" code={'node scripts/runtime.mjs api --voice-from-skate'} />
            <p class={prose}>The Skate option reads <code>fal_api_key@secrets</code> into the API process environment. Alternatively set <code>FAL_KEY</code> in your server environment. The fal account needs available credit. Set <code>BASTE_VOICE_ENABLED=false</code> to disable voice.</p>
            <p class={prose}>Hosted account mode additionally requires <code>BASTE_VOICE_ENABLED=true</code>. Existing account authentication, origin and CSRF checks apply. Voice uses the operator’s fal balance, separately from Not Organic wallet billing. Each server process allows ten requests per caller per minute, 120 total per hour, and four concurrent requests; replicated deployments need a shared limit before increasing capacity.</p>
            <p class={prose}>Speech and transcription use bounded, cancellable requests. Audio is not saved by Baste. fal receives the audio and text, with provider request storage disabled. Spoken replies require an explicit opt-in. Pause, resume, stop, persona changes and tab visibility control playback and microphone cleanup.</p>
            <p class={prose}>This is turn-based voice with editable transcripts. The planned GPT-Live design partner remains a separate integration. Voice does not turn the authored guided demo into a model conversation.</p>
          </section>

          <section id="cli" class={section}>
            <h2 class={title}>CLI reference</h2>
            <p class={prose}>The CLI operates on your local persona store. It does not inherit a Studio account session. Use <code>baste --help</code> for versioning, remix, site decomposition, cultural references and OpenPencil commands.</p>
            <div class={css({ overflowX: 'auto' })} tabIndex={0} role="region" aria-label="CLI commands"><table class={table}><thead><tr><th>Command</th><th>Purpose</th></tr></thead><tbody>{COMMANDS.map(([command, description]) => <tr key={command}><td>{command}</td><td>{description}</td></tr>)}</tbody></table></div>
          </section>

          <section id="api" class={section}>
            <h2 class={title}>API reference</h2>
            <p class={prose}>The development site proxies these same-origin routes to the local API. Account routes require a connected session. In account mode, personas and generation results are scoped to the authenticated DID. Mutations require <code>X-Baste-CSRF</code> from the status response.</p>
            <div class={css({ overflowX: 'auto' })} tabIndex={0} role="region" aria-label="API endpoints"><table class={table}><thead><tr><th>Route</th><th>Purpose</th></tr></thead><tbody>{API.map(([route, description]) => <tr key={route}><td>{route}</td><td>{description}</td></tr>)}</tbody></table></div>
            <p class={prose}>Errors distinguish authentication (401), denied access (403), insufficient credit (402), busy provider (429), and unavailable services. Config writes and native file/watch operations are unavailable in account mode. The <a href={`${GITHUB_URL}#readme`}>README</a> contains the wider local API and TypeScript package usage.</p>
          </section>

          <section id="outputs" class={section}>
            <h2 class={title}>Keep the fitting</h2>
            <p class={prose}>Local output lives under <code>assets/output/</code>: SVGs, images, videos, plus a persona suite manifest with metadata and relationships. In account mode, persona records and assets belong to the authenticated DID's separate directory.</p>
            <CodeView label="Local asset output structure" code={'assets/output/\n  svg/\n  images/\n  videos/\n  {persona}-suite.json'} />
            <p class={prose}>The quality-diversity archive explores color temperature, visual density and abstractness. Judging weights persona alignment at 30%, visual quality and uniqueness at 20% each, coherence and usability at 15% each. These scores guide selection; review assets in the interface they will serve.</p>
          </section>

          <section id="tour" class={section}>
            <h2 class={title}>Rebuild the tour video</h2>
            <p class={prose}>The 74-second tour on the home page and in the Studio guide is a <a href="https://hyperframes.heygen.com/">HyperFrames</a> composition in <code>videos/baste-tour/</code>. Every screen in it is recorded from this site, and the archive replays a real fal run. Each stage writes files the next one reads, so you can redo one step without the others.</p>
            <CodeView label="Tour pipeline" code={'# 1 · Record the screens (site on :5173, system Chrome on the GPU)\nnode scripts/record-tour.mjs\n\n# 2 · Narration on Cartesia, word timings and music on fal\nnode scripts/narrate-tour.mjs --skate --keep-timing\nnode scripts/score-tour.mjs --skate\n\n# 3 · Compose, check, render, publish\ncd videos/baste-tour\nnode build.mjs\nnpx hyperframes@0.8.145 check\nnpx hyperframes@0.8.145 render --quality high --fps 30 --output renders/baste-tour.mp4\nnode publish.mjs'} />
            <p class={prose}><code>build.mjs</code> holds the edit: which seconds of each recording play, at what speed, and where the camera moves. It writes the composition, levels the voice lines, and makes English and French captions; the French lines are in <code>narration/captions.fr.json</code>. <code>publish.mjs</code> encodes the web video, poster and the Studio guide’s chapter clips into <code>site/public/media/tour/</code>, and writes <code>site/src/lib/tour.json</code> for the chapter list and transcript.</p>
            <p class={prose}>Narration is Cartesia Sonic in the Theo voice (<code>scripts/cartesia.mjs</code>); word timings and music come from fal. The scripts read <code>CARTESIA_API_KEY</code> and <code>FAL_KEY</code>, or take both from Skate with <code>--skate</code>; keys are never written to a file. On a Nix or Guix host, run the recorder and the HyperFrames commands with <code>env -u LD_LIBRARY_PATH</code> so Chrome loads the system libraries, and put the system <code>ldd</code> first on <code>PATH</code> for the render preflight. A render is cancelled when its launching shell exits; set <code>HYPERFRAMES_RENDER_DETACHED=1</code> to run it detached.</p>
          </section>
        </div>
      </div>
    </main>
    <Footer />
  </>
));

export const head: DocumentHead = {
  title: 'Developer docs · Baste',
  meta: [{ name: 'description', content: 'Install and operate Baste with Devenv, configure local and hosted providers, and use the CLI and API.' }],
};
