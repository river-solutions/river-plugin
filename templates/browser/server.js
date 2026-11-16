// Local static server only — the model runs in the browser (DuckDB-WASM).
// Any static host serving public/ works the same; file:// does not (fetch + workers).
const express = require('express');
const path = require('path');
const config = require('./public/config.json');

const PORT = config.port || 3000;
express()
  .use(express.static(path.join(__dirname, 'public')))
  .listen(PORT, () => console.log(`River Dynamic Site running at http://localhost:${PORT}`));
