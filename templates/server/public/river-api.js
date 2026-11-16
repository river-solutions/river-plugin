/**
 * RiverAPI — client library for the River Dynamic Site backend.
 *
 * Usage:
 *   const api = new RiverAPI();                  // defaults to same origin
 *   const api = new RiverAPI('http://localhost:3000');
 *
 *   const scenarios = await api.scenarios();
 *   const outputs   = await api.outputs();
 *   const result    = await api.run('Climact', 'free_allocation', {
 *     columns: ['BM name', 'Year', 'EUA', 'Country'],
 *     filters: { Country: 'Austria' },
 *   });
 *   // result.data    → array of row objects
 *   // result.elapsed → seconds the model took
 */
class RiverAPI {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async _get(path) {
    const res = await fetch(this.baseUrl + path);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `GET ${path} failed (${res.status})`);
    return body;
  }

  async _post(path, payload) {
    const res = await fetch(this.baseUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `POST ${path} failed (${res.status})`);
    return body;
  }

  /** Returns an array of scenario name strings. */
  scenarios() {
    return this._get('/api/scenarios');
  }

  /**
   * Returns configured outputs:
   *   [{ id, label, columns: string[] }, ...]
   */
  outputs() {
    return this._get('/api/outputs');
  }

  /**
   * Run the model for a scenario and return data from one output.
   *
   * @param {string} scenario   - scenario name
   * @param {string} output     - output id (from config.json)
   * @param {object} [options]
   * @param {string[]} [options.columns]  - subset of columns to return
   * @param {object}  [options.filters]  - e.g. { Country: 'Austria' }
   * @returns {Promise<{ data: object[], elapsed: string, scenario: string, output: string }>}
   */
  run(scenario, output, { columns = null, filters = null } = {}) {
    return this._post('/api/run', { scenario, output, columns, filters });
  }
}

// Works as an ES module, a CommonJS module, or a plain <script> tag.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RiverAPI;
} else if (typeof window !== 'undefined') {
  window.RiverAPI = RiverAPI;
}
