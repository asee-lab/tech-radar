# Custom Domain Setup for GitHub Pages

## Scenario: Multiple Radars Under engineering.asee.io

This guide shows how to host multiple tech radars under the same custom domain using path-based routing.

## Architecture

```
engineering.asee.io/              → Landing page (main repository)
engineering.asee.io/tech-radar/   → Tech Radar (this repository)
engineering.asee.io/platform/     → Platform Radar (separate repository)
```

## DNS Configuration

### For the Main Domain

Add these DNS records at your DNS provider:

```
Type    Name              Value
CNAME   engineering       asee-lab.github.io.
```

Or if using an apex domain:

```
Type    Name    Value
A       @       185.199.108.153
A       @       185.199.109.153
A       @       185.199.110.153
A       @       185.199.111.153
```

## Repository Setup

### Main Landing Page Repository (e.g., `engineering-landing`)

1. **Create CNAME file** in the repository root:
   ```
   engineering.asee.io
   ```

2. **GitHub Pages Settings:**
   - Go to Settings → Pages
   - Source: `main` branch (or `gh-pages`)
   - Custom domain: `engineering.asee.io`
   - Enable "Enforce HTTPS"

3. **Deploy:** This becomes your landing page at `engineering.asee.io/`

### Tech Radar Repository (this one: `tech-radar`)

1. **No CNAME file needed** - it will be served at the path `/tech-radar/`

2. **GitHub Pages Settings:**
   - Go to Settings → Pages
   - Source: `gh-pages` branch
   - **No custom domain** (leave blank)

3. **Deploy:**
   ```bash
   npm run deploy
   ```

4. **Access:** `engineering.asee.io/tech-radar/`

### Additional Radars (e.g., `platform-radar`)

Same as tech-radar:
- No CNAME file
- Deploy to `gh-pages` branch
- Access at `engineering.asee.io/platform-radar/`

## How It Works

1. **DNS Resolution:**
   - `engineering.asee.io` → GitHub Pages servers

2. **GitHub Pages Routing:**
   - `/` → served from the repository with the CNAME file
   - `/tech-radar/` → served from `tech-radar` repository
   - `/platform-radar/` → served from `platform-radar` repository

3. **Path Preservation:**
   - The `ASSET_PATH="/tech-radar/"` in `deploy-gh-pages.sh` ensures all assets (JS, CSS, images) load from the correct path

## Testing

### Before Custom Domain is Set Up

Your radar would be available at the GitHub Pages default URL.

### After Custom Domain is Set Up

Your radar is available at:
```
https://engineering.asee.io/tech-radar/
```

**Both URLs will work!** GitHub Pages maintains the `.github.io` URL even with a custom domain.

## Deployment Checklist

- [ ] Configure DNS (CNAME or A records)
- [ ] Set up main landing page repository with CNAME file
- [ ] Deploy tech-radar: `npm run deploy`
- [ ] Wait 5-10 minutes for DNS propagation
- [ ] Enable HTTPS on main repository
- [ ] Test: `https://engineering.asee.io/tech-radar/`

## Troubleshooting

### Assets Not Loading (404s)

**Problem:** CSS/JS/images return 404 errors

**Solution:** Verify `ASSET_PATH="/tech-radar/"` is set in `deploy-gh-pages.sh`

### Redirect Loop

**Problem:** Page keeps redirecting

**Solution:** Check the auto-redirect script matches your actual hostname

### Custom Domain Not Working

**Problem:** Site doesn't load at custom domain

**Solution:**
1. Verify DNS records are correct
2. Check CNAME file exists in the main landing repository
3. Wait 24 hours for DNS propagation
4. Check GitHub Pages settings show "DNS check successful"

No additional configuration needed - just deploy!

## Note on Deployment Configuration

This repository is configured to use the custom domain `radar.asee.dev` exclusively. The deployment script has been configured with:
- `ASSET_PATH="/"` for root-level deployment
- CNAME file automatically copied to enable custom domain
- All asset paths configured for custom domain usage

## Security Notes

- **Always enable HTTPS** in GitHub Pages settings
- **HTTPS is automatic** for `.github.io` domains
- **HTTPS requires DNS setup** for custom domains (usually takes 5-10 minutes)
