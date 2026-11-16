# River Dynamic Site — Claude Code Guide

## What this repo does

A Node.js/Express server that runs a DuckDB model on demand and serves the results to browser-based charts. When a user picks a scenario, the server patches `script.sql` with that scenario's parameter values, runs it in-process with DuckDB (`@duckdb/node-api`), reads the resulting output CSV(s), and returns the data as JSON. The browser renders charts using Chart.js via a thin client library (`public/river-api.js`).

## What to touch vs. leave alone

| File | When to edit |
|------|-------------|
| `config.json` | Always — this is the main configuration surface |
| `public/*.html` | To add or customise chart pages |
| `server.js` | Only if adding new API behaviour |
| `public/river-api.js` | Only if changing the client API contract |
| `model/` | User-supplied model files; do not modify programmatically |

## Onboarding a new model

When a user says they have a new model, do these steps in order:

**1. Confirm the model directory exists and contains the required files:**
- `script.sql` — DuckDB script with `SET VARIABLE` lines at the top
- `scenario_definitions.json` — array of scenario objects with a `parameters` map
- `inputs/` — input CSV files referenced by `script.sql`
- `outputs/` — directory where DuckDB writes output CSVs (may be empty before first run)

**2. Read `scenario_definitions.json` to discover:**
- The scenario names (these become the UI buttons)
- Which parameters exist and what values they take
- Any `null` values — these indicate parameters not set for that scenario (warn the user; running DuckDB with unset parameters will likely error)

**3. Read the headers of each output CSV the user wants to expose:**
```bash
head -1 model/outputs/Out_something.csv
```
Use these to populate the `columns` map in `config.json`. Infer types: years/counts → `integer`, monetary/physical quantities → `float`, everything else → `string`.

**4. Update `config.json`** — add one entry per output to the `outputs` array:
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
  "port": 3000,
  "modelDir": "./model",
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

All paths are relative to the project root (`modelDir`) or to `modelDir` itself (`file`).

## `river-api.js` — client API

Include in any HTML page with `<script src="/river-api.js"></script>`, then:

```js
const api = new RiverAPI();              // same-origin; pass a URL string to target a different host

await api.scenarios();                   // → string[]  e.g. ["Baseline", "Ambitious"]
await api.outputs();                     // → [{ id, label, columns: string[] }]

await api.run(scenario, outputId, {      // runs DuckDB, returns parsed CSV rows
  columns: ['Col1', 'Col2'],             // optional — subset of columns to return
  filters: { Country: 'Austria' },       // optional — server-side row filter
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

## DuckDB runtime

DuckDB runs in-process through the `@duckdb/node-api` npm package (prebuilt for Windows, Linux and macOS); `npm install` is the only setup. Each run uses a fresh in-memory database. `script.sql` must be plain SQL: CLI dot-commands (`.mode`, `.read`, ...) are not supported.

## Key constraints

- **Do not rename or restructure `SET VARIABLE` lines in `script.sql`** — the server matches them with the regex `(SET VARIABLE <param> = ')[^']*(')`; any other format will silently fail to patch.
- **`null` parameters in `scenario_definitions.json` are left at their `script.sql` default** — they are not an error at patch time, but may cause a DuckDB error at runtime if the variable has no sensible default. Surface this to the user before they try to run the scenario.
- **The server `chdir`s into `modelDir` at startup** — all paths inside `script.sql` (e.g. `read_csv(...)`, `COPY ... TO ...`) must be relative to `modelDir`, not the project root.
- **Only one model run at a time** — the server rejects concurrent `/api/run` requests with HTTP 429. This is by design for single-user use; see README for production options.
