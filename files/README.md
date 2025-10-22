# Local Radar Files

Place your CSV or JSON radar files in this directory to serve them locally during development.

## Auto-load on Startup

To automatically load a specific CSV file when running `npm run dev`:

```bash
AUTO_LOAD_CSV=radar.csv npm run dev
```

This will automatically open your browser to:
`http://localhost:8080/?sheetId=http://localhost:8080/files/radar.csv`

## Manual Access

Without the environment variable, you can still manually access files at:
- `http://localhost:8080/files/radar.csv`
- `http://localhost:8080/files/your-file.json`

Just paste the full URL into the radar input field, or use the query parameter:
`http://localhost:8080/?sheetId=http://localhost:8080/files/your-file.csv`

## File Format

Your CSV should have the following columns:
- `name` - Technology name
- `ring` - Adopt, Trial, Assess, or Hold
- `quadrant` - Techniques, Platforms, Tools, or Languages & Frameworks
- `isNew` - TRUE or FALSE
- `description` - HTML description (can include links)

See `radar.csv` in this directory for a complete example.
