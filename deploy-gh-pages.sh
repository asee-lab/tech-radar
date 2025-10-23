#!/bin/bash
set -e

echo "🚀 Deploying Tech Radar to GitHub Pages..."

# Set the base path for GitHub Pages (repository name)
export ASSET_PATH="/tech-radar/"

# Set environment variables for the build
export QUADRANTS='["Patterns and Practices","Runtime Infrastructure","Tools","Frameworks and libraries"]'
export AUTO_LOAD_CSV="radar-2025.10.csv"

# Build the production bundle
echo "📦 Building production bundle..."
npm run build:prod

# Copy the CSV file to dist directory
echo "📄 Copying CSV file to dist..."
mkdir -p dist/files
cp files/radar-2025.10.csv dist/files/
cp files/README.md dist/files/ 2>/dev/null || true

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
echo "Your radar will be available at: https://asee-lab.github.io/tech-radar/"
