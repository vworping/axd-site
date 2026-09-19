# Deployment and rollback

## Production

- Website: https://mindofaxd.com/
- GitHub repository: `vworping/axd-site`
- Production branch: `main`
- Existing Cloudflare Worker: `axd-site`
- Automatic deployment: Cloudflare Workers Builds (confirmed from the repository's successful deployment check).
- Wrangler custom build: `node site/build.mjs`
- Public assets: `site/dist/`

The domain remains attached to the existing Worker. No DNS migration is needed for this replacement.

## Publishing edits

1. Edit files under `site/` and preview locally.
2. Run `node site/build.mjs` and relevant syntax checks.
3. Review `git diff`; stage the intended files explicitly. `site/dist/` and `.local-archive/` must remain ignored.
4. Commit and push to `main`.
5. Wait for **Workers Builds: axd-site** to report success in the GitHub commit checks.
6. Verify the live site, project copy, image loading, and shared-link metadata.

Wrangler runs the custom build before deployment. The build defaults to `https://mindofaxd.com/`; `SITE_URL` can override the canonical/social URLs for another deployment target. Do not put account tokens into the repository.

## What is archived

`pre-redesign-2026-09-19` tags the old production source at commit `37bceed28858d9217397c259911d0be009690074`.

The original machine also has an ignored `.local-archive/` containing:

- `pre-redesign-2026-09-19/`: old site, original input assets, and old image-processing tools.
- `redesign-before-launch/`: a snapshot of the new source before reorganization.
- `asset-sources.json`: local source-photo paths.
- `sites-preview-config/`: the separate former Sites preview manifest.

These local archives are not uploaded or served. The Git tag preserves tracked old files; the local archive additionally preserves untracked raw inputs.

## Rollback

Use Cloudflare's deployment rollback to restore the previous known-good version immediately if needed. Reconcile `main` afterward so the next build does not overwrite that rollback.

To reverse the launch in Git, identify the commit titled **Launch redesigned Mind of AXD portfolio**, review its inverse, and revert that commit on `main`. Push the revert and wait for the Cloudflare check. This restores the former root files and the previous Wrangler assets configuration without rewriting Git history. Later edits may require resolving conflicts deliberately.

Do not force-push the old tag over `main`.
