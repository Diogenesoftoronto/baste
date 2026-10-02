export const COMMANDS = [
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

export const API = [
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

export const REFERENCE_NOTES = [
  [
    "The CLI operates on your local persona store. It does not inherit a Studio account session. Use baste --help for versioning, remix, site decomposition, cultural references and OpenPencil commands."
  ],
  [
    "The development site proxies these same-origin routes to the local API. Account routes require a connected session. In account mode, personas and generation results are scoped to the authenticated DID. Mutations require X-Baste-CSRF from the status response.",
    "Errors distinguish authentication (401), denied access (403), insufficient credit (402), busy provider (429), and unavailable services. Config writes and native file/watch operations are unavailable in account mode."
  ]
] as const;
