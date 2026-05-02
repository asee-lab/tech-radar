#!/bin/bash
set -e

echo "🚀 Deploying Tech Radar to GitHub Pages..."

# Set the base path for custom domain (root path)
export ASSET_PATH="/"

# Set environment variables for the build
export QUADRANTS='["Patterns and Practices","Runtime Infrastructure","Tools","Frameworks and libraries"]'

# Build the production bundle
echo "📦 Building production bundle..."
npm run build:prod

# Copy manifest + all version CSVs to dist directory
echo "📄 Copying manifest and CSVs to dist..."
mkdir -p dist/files
cp files/manifest.json dist/files/
cp files/radar-*.csv dist/files/
cp files/README.md dist/files/ 2>/dev/null || true

# Copy CNAME file for custom domain
echo "📝 Copying CNAME file for custom domain..."
cp CNAME dist/

# Create .nojekyll file to prevent GitHub Pages from ignoring files starting with underscore
echo "📝 Creating .nojekyll file..."
touch dist/.nojekyll

# Deploy to gh-pages branch
echo "🌐 Deploying to gh-pages branch..."
if command -v gh-pages &> /dev/null; then
    npx gh-pages -d dist
else
    echo "Installing gh-pages..."
    npm install --save-dev gh-pages
    npx gh-pages -d dist
fi

echo "✅ Deployment complete!"
echo "Your radar will be available at: https://radar.asee.dev"
