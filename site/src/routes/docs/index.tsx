import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { css } from 'styled-system/css';
import { Nav, GITHUB_URL } from '~/components/layout/nav';
import { Footer } from '~/components/layout/footer';
import { CodeView } from '~/components/ui/code-view';
import { CopyCommand } from '~/components/ui/copy-command';
import { btn } from '~/components/studio/ui';

const SECTIONS = [
  ['start', 'Start a fitting'], ['development', 'Run locally'], ['notorganic', 'Account & payment'],
  ['providers', 'Local providers'], ['cli', 'CLI reference'], ['api', 'API reference'], ['outputs', 'Outputs'],
] as const;

const COMMANDS = [
  ['baste list', 'List base and custom personas'],
  ['baste show cyberbotanist', 'Read a persona and its cultural influences'],
  ['baste create my-persona --base cyberbotanist', 'Make a custom persona from a base'],
  ['baste generate cyberbotanist --dry-run', 'Inspect the brief without paid provider calls'],
  ['baste generate cyberbotanist', 'Generate an asset suite with configured providers'],
  ['baste ui-kit cyberbotanist', 'Generate a full kit, including local SVG and video providers'],
  ['baste tokens cyberbotanist --format css', 'Export tokens as CSS, JSON, Panda or Tailwind'],
  ['baste gui --port 3456', 'Run the API and bundled GUI'],
  ['baste config --init', 'Write a starting configuration'],
  ['baste mcp --stdio', 'Expose Baste tools through MCP'],
] as const;

const API = [
  ['GET /api/health', 'Server health'],
  ['GET /api/personas', 'Available personas'],
  ['POST /api/personas', 'Create a design persona'],
  ['GET /api/personas/:id', 'Read a persona'],
  ['PUT /api/personas/:id', 'Update a custom persona'],
  ['POST /api/tokens/:id', 'Export tokens; JSON body: { format }'],
  ['POST /api/prompts/:id', 'Preview the image, SVG and video briefs'],
  ['POST /api/generate/:id', 'Start a job; JSON body: { dryRun, imageProvider, imageModel }'],
  ['POST /api/generate/:id/plan', 'Check image/judging call ceilings and the required per-run budget'],
  ['GET /api/jobs/:id', 'Read progress, result or failure'],
  ['GET /api/assets/images/:filename', 'Preview or download an image owned by the signed-in account'],
  ['GET /api/notorganic/status', 'Read account configuration and CSRF token'],
  ['POST /api/notorganic/login', 'Start profile creation or sign-in'],
  ['GET /api/notorganic/models', 'Authorized live hosted model catalog'],
  ['GET /api/notorganic/wallet', 'Verified balance and available checkout offers'],
  ['POST /api/notorganic/checkout', 'Get payment URL for an advertised packId or planId'],
  ['POST /api/notorganic/logout', 'End the Baste account session'],
] as const;

const prose = css({ maxW: '70ch', fontSize: '15px', lineHeight: 1.7, color: 'ink-soft' });
const section = css({ display: 'flex', flexDirection: 'column', gap: 5, py: 9, borderBottom: '1px solid token(colors.rule)', scrollMarginTop: '90px', minW: 0 });
const title = css({ fontFamily: 'display', fontSize: '32px', fontWeight: 500, lineHeight: 1.15 });
const table = css({ w: '100%', borderCollapse: 'collapse', fontSize: '13px', '& td, & th': { textAlign: 'left', py: 3, px: 3, borderBottom: '1px solid token(colors.rule)', verticalAlign: 'top' }, '& th': { color: 'ink', fontWeight: 600 }, '& td:first-child': { fontFamily: 'mono', color: 'ink', minW: '210px' } });

export default component$(() => (
  <>
    <Nav />
    <main id="main" class={css({ maxW: '1180px', mx: 'auto', px: { base: 4, md: 8 }, pt: { base: 8, md: 14 } })}>
      <header class={css({ maxW: '780px', pb: 10 })}>
        <p class={prose}>This public release is a browser demo. Changes stay in this tab; generation is simulated. Hosted sign-in, payment and saved projects need a separately configured Baste server and are unavailable here.</p>
        <h1 class="display" style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 1.05 }}>The workroom manual.</h1>
        <p class={css({ mt: 5, fontSize: '19px', lineHeight: 1.55, maxW: '58ch', color: 'ink-soft' })}>Start with a person's films, music, spaces and obsessions. Fit a persona, draft its prompts, then choose how to generate.</p>
      </header>
      <div class={css({ display: 'grid', gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: '200px minmax(0, 1fr)' }, gap: { base: 3, lg: 12 }, alignItems: 'start' })}>
        <nav aria-label="Documentation sections" class={css({ position: { lg: 'sticky' }, top: '90px', display: 'flex', flexDirection: { base: 'row', lg: 'column' }, flexWrap: 'wrap', gap: 3, fontSize: '14px', py: 4, borderTop: '1px solid token(colors.rule)' })}>
          {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} class={css({ color: 'ink-soft', textDecoration: 'none', _hover: { color: 'thread-ink', textDecoration: 'underline' } })}>{label}</a>)}
        </nav>
        <div class={css({ minW: 0 })}>
          <section id="start" class={section}>
            <h2 class={title}>Start a fitting</h2>
            <ol class={css({ pl: 5, display: 'flex', flexDirection: 'column', gap: 3, fontSize: '15px', lineHeight: 1.7, color: 'ink-soft', maxW: '70ch' })}>
              <li>Open the Studio and choose a base persona, or write your own cultural measurements.</li>
              <li>Inspect the fitting and export tokens. Add influences that make the result specific to its person.</li>
              <li>Open Generate and draft prompts first. A dry run makes no paid generation calls.</li>
              <li>Choose local provider keys or connect Not Organic for hosted images. Review the resulting archive and keep diverse candidates.</li>
            </ol>
            <div><a href="/gui/" class={btn('primary')}>Open Studio →</a></div>
            <p class={prose}>Without a server, the Studio uses demo personas. Demo edits stay in the current tab and generation is simulated. Start the server for saved work.</p>
          </section>

          <section id="development" class={section}>
            <h2 class={title}>Run locally</h2>
            <p class={prose}>From a checkout with Nix and Devenv installed, enter the development shell, install the locked dependencies, then start the API and site together.</p>
            <CodeView label="Start local development" code={'devenv shell\ndevenv tasks run baste:install\ndevenv up'} />
            <p class={prose}>The Studio runs at <a href="http://localhost:5173/gui/">localhost:5173/gui/</a>. Its same-origin <code>/api</code> proxy reaches the Baste server on port 3456. Set <code>BASTE_SITE_PORT</code> and <code>BASTE_API_PORT</code> to change the ports. Storybook is an optional process on port 6006.</p>
            <p class={prose}>Use the native tasks for individual commands and checks. The full task list and environment setup live in the <a href={`${GITHUB_URL}/tree/main#readme`}>development guide</a>.</p>
            <CopyCommand command="devenv tasks list" />
          </section>

          <section id="notorganic" class={section}>
            <h2 class={title}>Account, models and payment</h2>
            <p class={prose}>In Studio Settings, select <strong>Sign in / create profile</strong>. Not Organic creates or authenticates your account profile; a Baste design persona is a separate object. Manage your handle and account in the linked Not Organic portal.</p>
            <p class={prose}>The Baste server holds the provider session and DPoP key. The browser receives an HttpOnly Baste session cookie, a CSRF token and the profile's public DID and handle. The model picker loads the authorized catalog from your connected account.</p>
            <p class={prose}>Your wallet shows verified available credit and only the offers advertised by the provider. Select an offer to open checkout and review its current price before paying. On return, refresh the wallet: a redirect alone does not prove payment or credit delivery.</p>
            <p class={prose}>Hosted generation currently covers image suites and asset judging. Full UI kits still need your local SVG and video providers. An unverified, blocked or empty wallet prevents paid hosted generation; prompt drafts remain available.</p>
            <p class={prose}>Set a maximum spend for each hosted run, initially $1. The live budget plan counts image and judging requests, including QD candidates and final outputs. Reduce iterations, batch size or outputs per purpose until the plan fits your maximum and the server limit, or explicitly raise your maximum. These conservative ceilings are spending limits, not quoted prices.</p>
            <p class={prose}>For server operators: enable <code>NOTORGANIC_ENABLED</code>, set <code>BASTE_PUBLIC_ORIGIN</code>, and configure the issuer and authorization URL. Baste must be registered with Not Organic for its origin, callback, product audience, scopes and billing offers. Public checkout needs an HTTPS return origin.</p>
            <CodeView label="Account server configuration" code={'NOTORGANIC_ENABLED=true\nBASTE_PUBLIC_ORIGIN=http://localhost:5173\nNOTORGANIC_ISSUER=https://api.notorganic.info\nNOTORGANIC_AUTHORIZATION_URL=https://id.notorganic.info/authorize'} />
            <p class={prose}>The callback is <code>/api/notorganic/callback</code> on the Studio origin. Production hosting must proxy <code>/api</code> to the Baste server. Sessions live in server memory and expire after eight hours; restarting the server requires signing in again. Read the <a href={`${GITHUB_URL}/tree/main#readme`}>account integration guide</a> for the deployment boundary.</p>
          </section>

          <section id="providers" class={section}>
            <h2 class={title}>Use your own provider keys</h2>
            <p class={prose}>Local mode keeps provider keys in the server environment or local config. Image generation uses OpenAI or Google; SVG generation uses QuiverAI; video uses its configured provider. The Studio never needs an upstream key pasted into a form.</p>
            <CodeView label="Local provider key configuration" code={'OPENAI_API_KEY=…\nQUIVER_API_KEY=…\nGOOGLE_API_KEY=…'} />
            <p class={prose}>Copy <code>.env.example</code> to <code>.env</code> and configure only the services you use. Run <code>baste config --init</code> to create <code>baste.config.json</code>. Model IDs must be supported by your chosen provider. Local generation and CLI use this configuration; hosted Studio requests use the connected account session.</p>
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
            <p class={prose}>Errors distinguish authentication (401), denied access (403), insufficient credit (402), busy provider (429), and unavailable services. Config writes and native file/watch operations are unavailable in account mode. The <a href={`${GITHUB_URL}/tree/main#readme`}>README</a> contains the wider local API and TypeScript package usage.</p>
          </section>

          <section id="outputs" class={section}>
            <h2 class={title}>Keep the fitting</h2>
            <p class={prose}>Local output lives under <code>assets/output/</code>: SVGs, images, videos, plus a persona suite manifest with metadata and relationships. In account mode, persona records and assets belong to the authenticated DID's separate directory.</p>
            <CodeView label="Local asset output structure" code={'assets/output/\n  svg/\n  images/\n  videos/\n  {persona}-suite.json'} />
            <p class={prose}>The quality-diversity archive explores color temperature, visual density and abstractness. Judging weights persona alignment at 30%, visual quality and uniqueness at 20% each, coherence and usability at 15% each. These scores guide selection; review assets in the interface they will serve.</p>
          </section>
        </div>
      </div>
    </main>
    <Footer />
  </>
));

export const head: DocumentHead = {
  title: 'Documentation · Baste',
  meta: [{ name: 'description', content: 'Run Baste with Devenv, fit local design personas, connect Not Organic accounts and models, and use the CLI and API.' }],
};
