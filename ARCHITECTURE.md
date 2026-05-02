# Repository Architecture and Technology Stack

## 1) What this repository is
This repository is a browser-based interactive “Technology Radar” application that renders radar visualizations from an input source (Google Sheet, CSV, or JSON). It is a static single-page app with a Node/webpack build step and optional containerized runtime.

- Root bootstrap: [src/site.js](src/site.js)
- UI skeleton: [src/index.html](src/index.html)
- Static build entry: [webpack.common.js](webpack.common.js)
- Runtime bundle entry: [webpack.dev.js](webpack.dev.js), [webpack.prod.js](webpack.prod.js)

## 2) Technology Stack

| Layer | Technologies |
| --- | --- |
| Language/runtime | JavaScript (Node.js >= 18 for tooling), browser JavaScript (ES2015+ via Babel) |
| Rendering/graphics | D3 (`d3`), D3 tip (`d3-tip`) |
| UI helpers | jQuery, jQuery UI autocomplete |
| CSS | SCSS + PostCSS + cssnano |
| Bundler | webpack 5 + Babel loader |
| Tests | Jest (unit), Cypress (E2E), jsdom helper |
| Auth | Google API JS client + Google Identity Services |
| Input sanitization | sanitize-html |
| Infrastructure | Nginx static serving inside Docker |
| CLI/scripts | npm scripts, bash scripts, Docker, gh-pages |
| Data parsing | d3.csv, d3.json |

## 3) High-level architecture

The app follows a layered front-end architecture:

1. **Static entry and build layer**
   - HTML shell provides mount points and shell UI for both input form and radar view.
   - Webpack compiles JS/SCSS and emits a static bundle for web hosting.

2. **Bootstrap and boot policy**
   - `src/site.js` loads global assets via `src/common.js`, optional analytics via `src/analytics.js`, and starts app orchestration using `Factory().build()`.
   - Build-time constants (`CLIENT_ID`, `API_KEY`, `ASSET_PATH`, `QUADRANTS`, `RINGS`, etc.) are injected via webpack DefinePlugin.

3. **Application factory/orchestration layer**
   - `src/util/factory.js` decides input mode by URL query params, creates one of:
     - Google Sheet loader
     - CSV loader
     - JSON loader
   - It handles validation, normalization, error flow, and passes parsed domain objects into the rendering pipeline.

4. **Data source adapters**
   - Google Sheet path: `src/util/sheet.js` + `src/util/googleAuth.js`
   - CSV path: `d3.csv` in `src/util/factory.js`
   - JSON path: `d3.json` in `src/util/factory.js`

5. **Domain model layer**
   - `src/models/blip.js`
   - `src/models/ring.js`
   - `src/models/quadrant.js`
   - `src/models/radar.js`

6. **Visualization/presentation layer**
   - Core renderer: [src/graphing/radar.js](src/graphing/radar.js)
   - Components:
     - [src/graphing/components/quadrants.js](src/graphing/components/quadrants.js)
     - [src/graphing/components/quadrantTables.js](src/graphing/components/quadrantTables.js)
     - [src/graphing/components/search.js](src/graphing/components/search.js)
     - [src/graphing/components/banner.js](src/graphing/components/banner.js)
     - [src/graphing/components/alternativeRadars.js](src/graphing/components/alternativeRadars.js)
     - [src/graphing/components/buttons.js](src/graphing/components/buttons.js)
   - Core blip placement algorithms: [src/graphing/blips.js](src/graphing/blips.js)
   - Geometry helpers: [src/util/ringCalculator.js](src/util/ringCalculator.js), [src/util/mathUtils.js](src/util/mathUtils.js)

7. **Utility & cross-cutting layer**
   - Input parsing: [src/util/queryParamProcessor.js](src/util/queryParamProcessor.js)
   - URL handling: [src/util/urlUtils.js](src/util/urlUtils.js)
   - HTML helpers/sanitization: [src/util/htmlUtil.js](src/util/htmlUtil.js), [src/util/inputSanitizer.js](src/util/inputSanitizer.js)
   - Validation and exceptions: [src/util/contentValidator.js](src/util/contentValidator.js), [src/exceptions](src/exceptions)

## 4) Runtime sequence

```mermaid
flowchart TD
    A[User opens app URL] --> B[src/site.js calls Factory.build()]
    B --> C{URL has sheetId/documentId?
    param?}
    C -->|google sheet| D[GoogleSheet loader in factory]
    C -->|.csv| E[CSV loader in factory]
    C -->|.json| F[JSON loader in factory]
    C -->|none| G[Render home/input screen]
    D --> H[validate + auth flow]
    H --> I[Sheets API request]
    I --> J[sanitize + validate headers]
    E --> J
    F --> J
    J --> K[Build Blip/Ring/Quadrant domain objects]
    K --> L[Graphing Radar build]
    L --> M[D3 renders SVG quadrants and blips]
    M --> N[UI components mount: search, subnav, legends, table, alternatives]
```

## 5) Feature toggle and compatibility mode

There is a runtime feature switch in config:
- [src/config.js](src/config.js) (currently `UIRefresh2022: true` in both dev/prod)
- Many rendering branches still keep legacy behavior behind this toggle, notably in:
  - `src/util/factory.js`
  - [src/graphing/radar.js](src/graphing/radar.js)
  - [src/graphing/config.js](src/graphing/config.js)
  - [src/graphing/components](src/graphing/components)

This indicates a phased migration path where the old and refreshed UI paths are maintained in the same repo.

## 6) Build and runtime pipeline

- Development: `npm run dev`, webpack-dev-server on port 8080, optional auto-load local CSV via `AUTO_LOAD_CSV` ([scripts] in [package.json](package.json)).
- Production bundle: `npm run build:prod` or `npm run build:gh-pages`.
- Testing:
  - Unit: `npm run test`
  - Coverage: `npm run test:coverage`
  - E2E: Cypress (`npm run test:e2e-headless`)
- Docker deployment:
  - Container build via [Dockerfile](Dockerfile)
  - Entrypoint script [build_and_start_nginx.sh](build_and_start_nginx.sh)
  - Nginx config template [default.template](default.template)
- Static hosting/deployment helper:
  - GitHub Pages script [deploy-gh-pages.sh](deploy-gh-pages.sh)

## 7) Observations for maintainers

- The project is split clearly between:
  - Source ingestion/validation (`src/util/factory.js`, `src/util/sheet.js`, `src/util/googleAuth.js`)
  - Domain models (`src/models/*`)
  - Renderers/components (`src/graphing/*`)
- Security hardening exists via explicit HTML sanitization before rendering `description` and text fields.
- The D3-centric renderer is the dominant architecture pattern, with D3 managing both geometry calculations and interactive DOM/SVG rendering.
- Deployment is container-friendly and can also run as plain static hosting due to fully prebuilt assets.

