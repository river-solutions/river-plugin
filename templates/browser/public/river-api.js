/**
 * RiverAPI — runs the River DuckDB model in the browser with DuckDB-WASM.
 * No backend: config.json, the scenario definitions, script.sql and the
 * input CSVs are fetched as static files.
 *
 * Usage:
 *   const api = new RiverAPI();                  // site root = same folder as the page
 *   const api = new RiverAPI('https://host/site'); // or where config.json lives
 *
 *   const scenarios = await api.scenarios();
 *   const outputs   = await api.outputs();
 *   const result    = await api.run('Base case', 'beds', {
 *     columns: ['DRG Classification', 'Year', 'Bed_gap'],
 *     filters: { 'DRG Classification': 'MDC 13 - Female Reproductive System' },
 *   });
 *   // result.data    → array of row objects
 *   // result.elapsed → seconds the model took
 */
const DUCKDB_WASM_VERSION = '1.33.1-dev57.0';

class RiverAPI {
  constructor(baseUrl = '') {
    this.base = new URL(baseUrl.replace(/\/?$/, '/'), location.href);
    this.isRunning = false;
    this.db = null;
  }

  async _json(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
    return res.json(); // UTF-8 decode strips a BOM
  }

  _config() {
    return (this._configP ??= this._json(new URL('config.json', this.base)));
  }

  async _modelUrl(file) {
    const cfg = await this._config();
    return new URL(`${cfg.modelDir || 'model'}/${file.replace(/\\/g, '/')}`, this.base);
  }

  async _scenarioDefs() {
    const cfg = await this._config();
    return this._json(await this._modelUrl(cfg.scenarioDefsFile || 'scenario_definitions.json'));
  }

  /** Returns an array of scenario name strings. */
  async scenarios() {
    return (await this._scenarioDefs()).map(d => d.scenario);
  }

  /** Returns configured outputs: [{ id, label, columns: string[] }, ...] */
  async outputs() {
    return ((await this._config()).outputs || []).map(o => ({
      id: o.id,
      label: o.label,
      columns: Object.keys(o.columns || {}),
    }));
  }

  // ponytail: fresh DuckDB instance per run so tables from a previous run can't leak in.
  // The wasm module is cached by the browser; keep one instance + db.reset() if startup cost matters.
  async _newDb() {
    const duckdb = await import(`https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_WASM_VERSION}/+esm`);
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), new Worker(workerUrl));
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(workerUrl);
    return db;
  }

  /**
   * Run the model for a scenario and return data from one output.
   *
   * @param {string} scenario   - scenario name
   * @param {string} output     - output id (from config.json)
   * @param {object} [options]
   * @param {string[]} [options.columns]  - subset of columns to return
   * @param {object}  [options.filters]  - e.g. { Year: 2030 }
   * @returns {Promise<{ data: object[], elapsed: string, scenario: string, output: string }>}
   */
  async run(scenario, output, { columns = null, filters = null } = {}) {
    if (this.isRunning) throw new Error('Model is already running, please wait.');
    if (!scenario) throw new Error('Missing required field: scenario.');
    if (!output) throw new Error('Missing required field: output.');
    this.isRunning = true;
    try {
      const cfg = await this._config();
      const outputCfg = (cfg.outputs || []).find(o => o.id === output);
      if (!outputCfg) throw new Error(`Unknown output id: "${output}". Check config.json.`);
      const scenarioDef = (await this._scenarioDefs()).find(d => d.scenario === scenario);
      if (!scenarioDef) throw new Error(`Unknown scenario: "${scenario}".`);

      const res = await fetch(await this._modelUrl(cfg.scriptFile || 'script.sql'));
      if (!res.ok) throw new Error(`Failed to read script (${res.status})`);
      // River on Windows writes "inputs\x.csv"; the wasm filesystem needs forward slashes.
      const sql = patchScript(await res.text(), scenarioDef.parameters)
        .replace(/(["'])(inputs|outputs)\\([^"']+)\1/g, '$1$2/$3$1');

      const startTime = Date.now();
      if (this.db) await this.db.terminate();
      const db = this.db = await this._newDb();

      // Map the script's relative paths onto the wasm virtual filesystem.
      // ponytail: regex relies on River's generated bundle format (inputs/ and outputs/ prefixes).
      const paths = prefix => [...new Set([...sql.matchAll(new RegExp(`["'](${prefix}/[^"']+)["']`, 'g'))].map(m => m[1]))];
      await Promise.all(paths('inputs').map(async p => {
        const r = await fetch(await this._modelUrl(p));
        if (!r.ok) throw new Error(`Failed to fetch input ${p} (${r.status})`);
        await db.registerFileBuffer(p, new Uint8Array(await r.arrayBuffer()));
      }));
      const outFiles = [...new Set([...paths('outputs'), outputCfg.file])];
      for (const p of outFiles) await db.registerEmptyFileBuffer(p);

      const conn = await db.connect();
      try {
        await conn.query(sql);
      } catch (err) {
        throw new Error(`DuckDB failed: ${err.message}`);
      }

      const types = outputCfg.columns || {};
      const sqlType = { integer: 'INTEGER', float: 'DOUBLE' };
      const q = name => `"${String(name).replace(/"/g, '""')}"`;
      const selectCols = columns && columns.length ? columns : Object.keys(types);
      const select = selectCols.length
        ? selectCols.map(c => `CAST(${q(c)} AS ${sqlType[types[c]] || 'VARCHAR'}) AS ${q(c)}`).join(', ')
        : '*';
      const filterEntries = Object.entries(filters || {});
      const where = filterEntries.length
        ? ' WHERE ' + filterEntries.map(([c]) => `CAST(${q(c)} AS ${sqlType[types[c]] || 'VARCHAR'}) = ?`).join(' AND ')
        : '';
      const stmt = await conn.prepare(
        `SELECT ${select} FROM read_csv('${outputCfg.file.replace(/'/g, "''")}', all_varchar = true)${where}`
      );
      let table;
      try {
        table = await stmt.query(...filterEntries.map(([, v]) => v));
      } catch (err) {
        throw new Error(`Failed to read output CSV: ${err.message}`);
      }
      const data = table.toArray().map(r => r.toJSON());
      await stmt.close();
      await conn.close();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      return { data, elapsed, scenario, output };
    } finally {
      this.isRunning = false;
    }
  }
}

// Replaces the quoted value of each `SET VARIABLE <param> = '...'` line.
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

if (typeof window !== 'undefined') window.RiverAPI = RiverAPI;
