# River Dynamic Site — Codex Guide

## What this repo does

A static website that runs a DuckDB model **in the browser** with DuckDB-WASM and renders the results with Chart.js. When a user picks a scenario, `public/river-api.js` fetches `script.sql`, patches it with that scenario's parameter values, loads the input CSVs into DuckDB-WASM's in-memory filesystem, runs the script, and reads the requested output CSV back as row objects. There is no backend: everything under `public/` can be served by any static host. `start.bat` (PowerShell, no install, Windows) and `server.js` (Node) are only local static servers.

## What to touch vs. leave alone

| File | When to edit |
|------|-------------|
| `public/config.json` | Always — this is the main configuration surface |
| `public/*.html` | To add or customise chart pages |
| `public/river-api.js` | Only if changing the client API contract |
| `server.js`, `serve.ps1`, `start.bat` | Rarely — they only serve `public/` locally |
| `public/model/` | User-supplied model files; do not modify programmatically |

## Onboarding a new model

When a user says they have a new model, do these steps in order:

**1. Confirm the model directory exists and contains the required files:**
- `script.sql` — DuckDB script with `SET VARIABLE` lines at the top
- `scenario_definitions.json` — array of scenario objects with a `parameters` map
- `inputs/` — input CSV files referenced by `script.sql`
- `outputs/` — output CSVs from a run in River; only used here to read column headers (the browser writes outputs in memory)

**2. Read `scenario_definitions.json` to discover:**
- The scenario names (these become the UI buttons)
- Which parameters exist and what values they take
- Any `null` values — these indicate parameters not set for that scenario (warn the user; running the model with unset parameters will likely error)

**3. Read the headers of each output CSV the user wants to expose:**
```bash
head -1 public/model/outputs/Out_something.csv
```
Use these to populate the `columns` map in `public/config.json`. Infer types: years/counts → `integer`, monetary/physical quantities → `float`, everything else → `string`.

**4. Update `public/config.json`** — add one entry per output to the `outputs` array:
```json
{
  "id": "my_output",
  "label": "Human-readable label",
  "file": "outputs/Out_something.csv",
  "columns": {
    "ColumnName": "string|integer|float"
  }
}
```

**5. Build the chart page** — see chart page pattern below.

## `config.json` schema

```json
{
  "port": 3000,                    // local server only (start.bat / server.js)
  "modelDir": "model",
  "scriptFile": "script.sql",
  "scenarioDefsFile": "scenario_definitions.json",
  "outputs": [
    {
      "id":      "string — used in API calls and river-api.js",
      "label":   "string — shown in UI",
      "file":    "string — path relative to modelDir",
      "columns": { "ColumnName": "string|integer|float" }
    }
  ]
}
```

`modelDir` is relative to `public/` (the site root); `file` is relative to `modelDir`.

## `river-api.js` — client API

Include in any HTML page with `<script src="/river-api.js"></script>`, then:

```js
const api = new RiverAPI();              // site root = page's folder; pass a URL if config.json lives elsewhere

await api.scenarios();                   // → string[]  e.g. ["Baseline", "Ambitious"]
await api.outputs();                     // → [{ id, label, columns: string[] }]

await api.run(scenario, outputId, {      // runs the model in DuckDB-WASM, returns output rows
  columns: ['Col1', 'Col2'],             // optional — subset of columns to return
  filters: { Country: 'Austria' },       // optional — equality filter applied in SQL
});
// returns { data: object[], elapsed: string, scenario, output }
```

`columns` and `filters` are both optional. Omit both to get all rows and all columns.

## Chart page pattern

Create `public/my-chart.html`. A minimal working page:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <script src="/river-api.js"></script>
</head>
<body>
  <!-- scenario buttons, filter controls, canvas -->
  <script>
    const api = new RiverAPI();

    async function run(scenario) {
      const result = await api.run(scenario, 'my_output', {
        columns: ['Year', 'Value', 'Category'],
      });
      renderChart(result.data);
    }

    function renderChart(data) {
      // build Chart.js datasets from data
    }
  </script>
</body>
</html>
```

Look at `public/index.html` for a complete reference implementation: scenario buttons, country filter dropdown, Chart.js line chart with a generated colour palette, loading/error status bar, and client-side filtering without re-running the model.

## DuckDB-WASM

`river-api.js` loads DuckDB-WASM from the jsDelivr CDN (version pinned in `DUCKDB_WASM_VERSION`), so viewers need internet access. Each `run()` starts a fresh in-memory database in a Web Worker. The page must be served over HTTP: opening it from `file://` won't work. Double-click `start.bat` (Windows, nothing to install) or run `npm start` locally, or upload `public/` to any static host.

## Key constraints

- **Do not rename or restructure `SET VARIABLE` lines in `script.sql`** — `river-api.js` matches them with the regex `(SET VARIABLE <param> = ')[^']*(')`; any other format will silently fail to patch.
- **`null` parameters in `scenario_definitions.json` are left at their `script.sql` default** — they are not an error at patch time, but may cause a DuckDB error at runtime if the variable has no sensible default. Surface this to the user before they try to run the scenario.
- **File paths inside `script.sql` must start with `inputs/` or `outputs/`** (relative to `modelDir`; `\` is also accepted) — `river-api.js` finds them by that prefix, fetches the inputs and registers them in DuckDB-WASM's virtual filesystem. Any other path will not be found.
- **Everything in `public/model/` is downloadable by viewers**, including `script.sql` and the input CSVs. Don't deploy models with confidential inputs this way.
- **One run at a time per page** — a second `run()` while one is in progress throws `Model is already running, please wait.`
