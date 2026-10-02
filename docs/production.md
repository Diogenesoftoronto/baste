# Public Baste deployment

This release serves the committed public Qwik site at https://baste.love. The public `/gui/` page explains local Studio installation. No Baste API, provider credentials, project files, account sessions, checkout, or generation runs in the container. The newer uncommitted local Studio and atelier redesign are separate from this release.

## Pipeline and checks

Reuse Railway project `996bc181-df20-435a-b5f4-685e2c0fee0b`, service `d32a4c18-d6d6-4c14-9b27-926204fa9db5`, environment `production`. Set the non-secret service variable `PORT=80` to match nginx and Railway health checks. Keep nginx at two workers to avoid sizing memory use to the host CPU count. Connect its existing GitHub integration to `Diogenesoftoronto/baste`, branch `main`. Pushes build the locked site dependencies, Panda styles, client assets, and static pages using the root Dockerfile. GitHub CI checks CLI types, site types, lint and the same static build, retaining a public-site artifact. No CI deployment credential is needed.

Run `npm ci`, `npm run typecheck`, `npm run build`; then `npm ci --prefix site`, `npm --prefix site run build:production`, `npm --prefix site run build.types`, and `npm --prefix site run lint`. Build the container with `docker build -t baste-public .`; run it with `docker run --rm -p 127.0.0.1:18080:80 baste-public`.

Expected: `/health`, `/`, `/gui/` return 200; `/api/config`, `/.env`, and missing paths return 404. The final image contains nginx and generated public files. No API proxy or fallback to the home page is installed. Verify the exact remote commit in Railway deployment metadata.

## Domain

Custom domain `baste.love` targets port 80. Its Railway DNS target is `0gkhexca.up.railway.app`. At Porkbun replace only conflicting apex parking A/AAAA/ALIAS/CNAME records with `ALIAS @ 0gkhexca.up.railway.app` (TTL 600). Preserve MX/TXT and all unrelated subdomain records. Add the ownership TXT record shown by `railway domain status baste.love --project 996bc181-df20-435a-b5f4-685e2c0fee0b -e production -s baste-site --json` if certificate validation requires it. The `www` parking record is outside this apex release.

The service can be checked at https://baste-site-production.up.railway.app while DNS is pending. Do not claim baste.love complete until DNS points to Railway, HTTPS certificate validation succeeds, public pages/health pass and API/private paths remain blocked.

## Cost

Existing service and subscription, one replica, no volume, idle sleeping enabled. Railway lists RAM at $10/GB/month, CPU at $20/vCPU/month and egress at $0.05/GB: https://docs.railway.com/pricing/plans. A 20–100 MB nginx process suggests roughly $0.20–$1/month in memory while continuously running, plus measured CPU/egress; sleeping reduces idle use. This estimate is not a spending cap or new subscription. No paid generation is needed.

## Rollback

Record the verified deployment ID and commit with `railway deployment list --project 996bc181-df20-435a-b5f4-685e2c0fee0b -e production -s baste-site --json`. Failed builds should not displace a healthy deployment. To return to an earlier verified image use `railway api 'mutation { deploymentRollback(id: "VERIFIED_DEPLOYMENT_ID") }'`, then verify deployment status and HTTPS again. The latest good image can be redeployed with `railway deployment redeploy --project 996bc181-df20-435a-b5f4-685e2c0fee0b -e production -s baste-site --yes --json`. Before the first successful release there is no healthy prior Baste deployment to restore.

Hosted Studio requires a separate release: provider-approved origin, same-origin API proxy, protected assets, suitable session storage and real-account verification. Do not enable hosted signup, payment, or generation without that review and authorized credential configuration. Preserve local development work when integrating these production files.
