---
name: preview-netlify
description: Put a rig page preview on Netlify and take the lane marker off it later (ADR 0003). Use for a plan's "Preview for review" and "Clean up" issues when the host is Netlify.
---

# preview-netlify

A preview is one HTML file on a public link that we can upload over (ADR 0003). Ask the human
before every create, upload, setting change and delete: what, why, where, who sees it, how to undo.

## Save the page (a command, not a browser save)

```sh
pnpm start &                                   # marker on, from .env
curl -s localhost:8787/<path> -o <outside-the-repo>/preview/index.html
LANE_MARKER= PORT=8788 pnpm start &            # marker off: banner reads "no marker set"
curl -s localhost:8788/<path> -o <outside-the-repo>/preview-clean/index.html
```

Never inside the repo, an issue or chat (ADR 0003).

## Publish

1. `netlify status` must show the human signed in.
2. The team slug is not the team name: `netlify api listAccountsForUser` and use `slug`.
3. `netlify sites:create --name <name> --account-slug <slug> --disable-linking`
4. `netlify deploy --prod --dir <preview dir> --site <site id> --no-build`
5. Check from outside: `curl -s -o /dev/null -w "%{http_code}" https://<name>.netlify.app/`.
   401 with a "Login Redirect" page means the team's visitor protection is on. With the human's
   yes, for this site only:
   `netlify api updateSite --data '{"site_id":"<id>","body":{"sso_login":false}}'`
6. Send the link only once it answers 200 with the banner.

## Clean up (after the review is in, not before)

1. Deploy `preview-clean/` over the same site (step 4).
2. Every deploy keeps its own link (`<deploy id>--<name>.netlify.app`). List them:
   `netlify api listSiteDeploys --data '{"site_id":"<id>"}'`, and with the human's yes delete each
   one that still shows the marker: `netlify api deleteDeploy --data '{"deploy_id":"<id>"}'`.
3. Check the main link and every remaining deploy link: none may contain the marker.
