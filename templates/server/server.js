const express = require('express');
const { DuckDBInstance, version: duckdbVersion } = require('@duckdb/node-api');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

// ── Config ─────────────────────────────────────────────────────────────────
function readJson(filePath) {
  const buf = fs.readFileSync(filePath);
  const start = (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) ? 3 : 0;
  return JSON.parse(buf.slice(start).toString('utf8'));
}

const CONFIG_PATH = path.join(__dirname, 'config.json');
const config = readJson(CONFIG_PATH);

const PORT = config.port || 3000;
const MODEL_DIR = path.resolve(__dirname, config.modelDir || './model');
const SCRIPT_PATH = path.join(MODEL_DIR, config.scriptFile || 'script.sql');
const SCENARIO_DEFS_PATH = path.join(MODEL_DIR, config.scenarioDefsFile || 'scenario_definitions.json');

// DuckDB runs in-process, so relative paths in script.sql resolve against cwd.
// ponytail: global chdir, fine because one model per server
process.chdir(MODEL_DIR);

// ── Helpers ────────────────────────────────────────────────────────────────
function outputById(id) {
  return (config.outputs || []).find(o => o.id === id) || null;
}

function castValue(value, type) {
  if (value === '' || value === null || value === undefined) return null;
  if (type === 'integer') return parseInt(value, 10);
  if (type === 'float') return parseFloat(value);
  return value;
}

function readCsv(outputConfig, { columns: requestedColumns, filters } = {}) {
  const csvPath = path.join(MODEL_DIR, outputConfig.file);
  const csvContent = fs.readFileSync(csvPath, 'utf8');

  const columnTypes = outputConfig.columns || {};

  let records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, ctx) => castValue(value, columnTypes[ctx.column]),
  });

  if (filters && typeof filters === 'object') {
    records = records.filter(row =>
      Object.entries(filters).every(([col, val]) => row[col] === val)
    );
  }

  if (requestedColumns && requestedColumns.length > 0) {
    records = records.map(row => {
      const out = {};
      for (const col of requestedColumns) out[col] = row[col];
      return out;
    });
  }

  return records;
}

function patchScript(sql, parameters) {
  for (const [param, value] of Object.entries(parameters)) {
    if (value !== null) {
      sql = sql.replace(
        new RegExp(`(SET VARIABLE ${param} = ')[^']*(')`),
        `$1${value}$2`
      );
    }
  }
  return sql;
}

// ── Server ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let isRunning = false;

// List available scenarios
app.get('/api/scenarios', (req, res) => {
  try {
    const defs = readJson(SCENARIO_DEFS_PATH);
    res.json(defs.map(d => d.scenario));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List configured outputs (id, label, available columns)
app.get('/api/outputs', (req, res) => {
  const outputs = (config.outputs || []).map(o => ({
    id: o.id,
    label: o.label,
    columns: Object.keys(o.columns || {}),
  }));
  res.json(outputs);
});

// Run the model for a scenario, return data from one output
// Body: { scenario, output, columns?, filters? }
//   scenario  – scenario name (required)
//   output    – output id from config.outputs (required)
//   columns   – array of column names to return (optional, default: all)
//   filters   – { columnName: value } applied server-side (optional)
app.post('/api/run', async (req, res) => {
  if (isRunning) {
    return res.status(429).json({ error: 'Model is already running, please wait.' });
  }

  const { scenario, output: outputId, columns: requestedColumns, filters } = req.body;

  if (!scenario) return res.status(400).json({ error: 'Missing required field: scenario.' });
  if (!outputId) return res.status(400).json({ error: 'Missing required field: output.' });

  const outputConfig = outputById(outputId);
  if (!outputConfig) {
    return res.status(400).json({ error: `Unknown output id: "${outputId}". Check config.json.` });
  }

  let defs;
  try {
    defs = readJson(SCENARIO_DEFS_PATH);
  } catch (err) {
    return res.status(500).json({ error: `Failed to read scenario definitions: ${err.message}` });
  }

  const scenarioDef = defs.find(d => d.scenario === scenario);
  if (!scenarioDef) {
    return res.status(400).json({ error: `Unknown scenario: "${scenario}".` });
  }

  let sql;
  try {
    sql = fs.readFileSync(SCRIPT_PATH, 'utf8');
  } catch (err) {
    return res.status(500).json({ error: `Failed to read script: ${err.message}` });
  }

  sql = patchScript(sql, scenarioDef.parameters);

  isRunning = true;
  const startTime = Date.now();

  try {
    // Fresh in-memory instance per run so no tables/variables leak between scenarios.
    // ponytail: no run timeout, add a conn.interrupt() timer if a script ever hangs
    const db = await DuckDBInstance.create(':memory:');
    try {
      const conn = await db.connect();
      try {
        await conn.run(sql);
      } finally {
        conn.closeSync();
      }
    } finally {
      db.closeSync();
    }
  } catch (err) {
    return res.status(500).json({ error: `DuckDB failed: ${err.message}` });
  } finally {
    isRunning = false;
  }

  try {
    const records = readCsv(outputConfig, { columns: requestedColumns, filters });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    res.json({ data: records, elapsed, scenario, output: outputId });
  } catch (parseErr) {
    res.status(500).json({ error: `Failed to read output CSV: ${parseErr.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`River Dynamic Site running at http://localhost:${PORT}`);
  console.log(`DuckDB ${duckdbVersion()} (in-process), model dir: ${MODEL_DIR}`);
});
