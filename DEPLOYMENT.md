# GitHub Pages Deployment Guide

This guide explains how to deploy your Tech Radar to GitHub Pages with custom quadrant names and default CSV auto-loading.

## Prerequisites

1. Git repository hosted on GitHub (e.g., `asee-lab/tech-radar`)
2. Node.js and npm installed
3. All dependencies installed (`npm install`)

## Deployment Steps

### Method 1: Using the Deployment Script (Recommended)

Simply run:

```bash
npm run deploy
```

This will:
1. Build the production bundle with custom quadrant names baked in
2. Copy your CSV file to the dist directory
3. Deploy to the `gh-pages` branch
4. Your radar will be live at `https://asee-lab.github.io/tech-radar/`

### Method 2: Manual Deployment

If you prefer manual control:

```bash
# 1. Build with custom quadrants
npm run build:gh-pages

# 2. Copy CSV file
mkdir -p dist/files
cp files/radar-2025.10.csv dist/files/

# 3. Create .nojekyll (prevents GitHub from ignoring _files)
touch dist/.nojekyll

# 4. Deploy
npx gh-pages -d dist
```

## Configuration Details

### Custom Quadrant Names

The quadrant names are set in `package.json` under the `build:gh-pages` script:

```json
"build:gh-pages": "QUADRANTS='[\"Patterns and Practices\",\"Runtime Infrastructure\",\"Tools\",\"Frameworks and libraries\"]' npm run build:prod"
```

These are **baked into the JavaScript bundle** at build time via webpack's DefinePlugin.

### Auto-Loading CSV

To auto-load your CSV file on GitHub Pages, you need to update the default URL in your application or use query parameters.

**Option A: Update index.html to auto-redirect**

Add this to your `src/index.html` inside the `<head>` section:

```html
<script>
  // Auto-load radar on GitHub Pages
  if (window.location.hostname.includes('github.io') && !window.location.search) {
    const baseUrl = window.location.origin + window.location.pathname;
    const csvUrl = baseUrl + 'files/radar-2025.10.csv';
    window.location.href = '?sheetId=' + encodeURIComponent(csvUrl);
  }
</script>
```

**Option B: Share the full URL**

Share the complete URL with query parameters:
```
https://asee-lab.github.io/tech-radar/?sheetId=https://asee-lab.github.io/tech-radar/files/radar-2025.10.csv
```

## GitHub Pages Setup

1. Go to your GitHub repository settings
2. Navigate to **Pages** section
3. Set source to `gh-pages` branch
4. Click Save

The site will be available at: `https://<username>.github.io/<repo-name>/`

For this repo: `https://asee-lab.github.io/tech-radar/`

## Updating the Radar

Whenever you update your CSV or make code changes:

```bash
# Update your CSV file
vi files/radar-2025.10.csv

# Deploy the changes
npm run deploy
```

Changes will be live in a few minutes.

## Troubleshooting

### Assets not loading (404 errors)

If images or CSS files return 404, check:
1. `.nojekyll` file exists in the `dist` folder
2. `publicPath` in `webpack.common.js` is set to `/` (default)

### Quadrant names not updating

The quadrant names are compiled into the JavaScript bundle. After changing them in `package.json`, you must:
1. Run a fresh build: `npm run build:gh-pages`
2. Deploy: `npm run deploy`

### CSV file not found

Make sure:
1. The CSV file is copied to `dist/files/` during deployment
2. The URL in the query parameter matches the actual file location
3. File permissions allow public access

## Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to your `dist` folder with your domain
2. Update the `deploy-gh-pages.sh` script to include:
   ```bash
   echo "radar.yourdomain.com" > dist/CNAME
   ```
3. Configure DNS records at your domain provider
4. Update GitHub Pages settings to use the custom domain
