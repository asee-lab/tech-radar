# Custom Domain Setup for GitHub Pages

This repository is deployed to GitHub Pages at the root custom domain `radar.asee.dev`.

## Current Architecture

```
radar.asee.dev/                  -> Tech Radar from this repository
radar.asee.dev/files/...         -> Manifest and radar CSV files
```

The site is not currently configured as a path-based deployment under `engineering.asee.io/tech-radar/`.

## DNS Configuration

`radar.asee.dev` is a subdomain, so DNS should point it at the GitHub Pages host for the owning GitHub organization or user.

```
Type    Name     Value
CNAME   radar    <github-pages-host>
```

For example, if GitHub Pages is served from the `asee-lab` organization, the target is typically:

```
radar.asee.dev -> asee-lab.github.io
```

## Repository Setup

GitHub Pages should be configured for this repository:

1. Go to repository **Settings** -> **Pages**.
2. Set the source to the `gh-pages` branch.
3. Set the custom domain to `radar.asee.dev`.
4. Enable **Enforce HTTPS** after GitHub verifies the domain.

The repository root contains a `CNAME` file with:

```
radar.asee.dev
```

The deployment script copies this file into `dist/` before publishing, so the `gh-pages` branch keeps the custom domain configuration.

## Deployment

Deploy with:

```bash
npm run deploy
```

This runs `deploy-gh-pages.sh`, which:

1. Sets `ASSET_PATH="/"` for root-level asset URLs.
2. Sets the custom quadrant names through the `QUADRANTS` build environment variable.
3. Builds the production webpack bundle into `dist/`.
4. Copies `files/manifest.json`, all `files/radar-*.csv` files, and optionally `files/README.md` into `dist/files/`.
5. Copies `CNAME` into `dist/`.
6. Creates `dist/.nojekyll`.
7. Publishes `dist/` to the `gh-pages` branch with `npx gh-pages -d dist`.

After GitHub Pages processes the new commit, the radar is available at:

```
https://radar.asee.dev/
```

## Troubleshooting

### Assets Not Loading

If CSS, JavaScript, or image files return 404s, verify that `deploy-gh-pages.sh` sets:

```bash
export ASSET_PATH="/"
```

This matches the current root-domain deployment at `radar.asee.dev`.

### Custom Domain Not Working

If `radar.asee.dev` does not load:

1. Verify the DNS CNAME points to the correct GitHub Pages host.
2. Confirm the repository's GitHub Pages settings use the `gh-pages` branch.
3. Confirm the custom domain is set to `radar.asee.dev`.
4. Confirm the deployed `gh-pages` branch contains a `CNAME` file with `radar.asee.dev`.
5. Wait for DNS and GitHub Pages certificate provisioning to complete.

## Security Notes

- Always enable **Enforce HTTPS** in GitHub Pages settings.
- HTTPS certificate provisioning can take several minutes after DNS changes.

