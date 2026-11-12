---
name: river-build-dynamic-website
description: Set up a River Dynamic Website from a River model. Clones the repo containing template files to a target folder, optionally guides the SQL bundle export via the River connector, and configures the site for the model’s scenarios and outputs.
---

# Set up a River dynamic site

You are setting up a River Dynamic Website — a lightweight web application that runs a River/DuckDB model on demand and displays the results as interactive charts. Follow the steps below precisely, in order. At each decision point wait for an explicit user response before continuing.

## Step 1 — Check River connector

Silently check whether the River MCP connector is available by attempting to list River tools (look for `mcp__river__*` tools in your available tool set).

Note that the River Excel Add-In is only available on Windows, so if the user is on a Mac, they can only use a SQL bundle already exported by someone else.

-   **If the connector is available:** tell the user “River connector detected — your model is open in River.” Then ask: “Would you like me to guide you through exporting the SQL bundle from the currently open model, or will you export it yourself and place the files in the model folder?”  
    Wait for the answer. Record it as **extract = yes** or **extract = no**.
    
-   **If the connector is not available:** tell the user “River connector not detected — you will need to export the SQL bundle from River manually and place it in the model folder later.” Set **extract = no** and continue.
    

---

## Step 2 — Get target folder

Ask the user: “Where would you like to set up the site? Please provide the full path to the target folder (it will be created if it doesn’t exist).”

Wait for a path. Call it **TARGET**.

---

## Step 3 — Download and install the latest release of the River dynamic site templates

The release ZIP is always available at:
```
https://riversolutions.blob.core.windows.net/software/River.DynamicSite/Release/river-dynamic-site.zip
```

**If TARGET already contains an installation** (i.e. `server.js` and `config.json` both exist), tell the user: "An existing installation of the River template files was found at `<TARGET>`. Downloading the latest release will overwrite the files but will not touch `config.json` or the `model/` folder. Proceed?" Wait for confirmation before continuing.

Download and extract the ZIP into **TARGET**. Use whichever method is available on the platform:

On Windows (PowerShell):
```powershell
New-Item -ItemType Directory -Force -Path "<TARGET>" | Out-Null
Invoke-WebRequest -Uri "https://riversolutions.blob.core.windows.net/software/River.DynamicSite/Release/river-dynamic-site.zip" -OutFile "$env:TEMP\river-dynamic-site.zip"
Expand-Archive -Path "$env:TEMP\river-dynamic-site.zip" -DestinationPath "<TARGET>" -Force
Remove-Item "$env:TEMP\river-dynamic-site.zip"
```

On macOS/Linux:
```bash
mkdir -p "<TARGET>"
curl -L "https://riversolutions.blob.core.windows.net/software/River.DynamicSite/Release/river-dynamic-site.zip" -o /tmp/river-dynamic-site.zip
unzip -o /tmp/river-dynamic-site.zip -d "<TARGET>"
rm /tmp/river-dynamic-site.zip
```

Confirm to the user that the files are in place and show the resolved folder path.

---

## Step 4 — Export the SQL bundle (if extract = yes)

Tell the user:

> "Please export the SQL bundle from River now:
> 
> 1.  In River, go to **File → Export → Export to SQL bundle** (or use the equivalent menu item in your version)
> 2.  When prompted for a destination, choose: `<TARGET>/model/`
> 3.  Let River complete the export, then tell me when it’s done."

Wait for the user to confirm the export is complete.

Once confirmed, verify the required files are present:

bash

Copy

```bash
ls "<TARGET>/model/script.sql"ls "<TARGET>/model/scenario_definitions.json"ls "<TARGET>/model/inputs/"
```

If any file is missing, tell the user exactly which file is absent and ask them to re-export or place it manually before continuing.

**If extract = no:** ask the user to place the exported model files at `<TARGET>/model/` now, and wait for confirmation before continuing. Verify the same three items above.

---

## Step 5 — Inspect the model

Read the following files to understand the model before configuring the site.

**a) Scenarios and parameters:**  
Read `<TARGET>/model/scenario_definitions.json`.

-   Note the scenario names — these become the UI buttons.
-   Check every scenario for `null` parameter values. If any exist, warn the user: “Scenario X has unset parameters (null values). Running it may cause DuckDB errors. Verify this in scenario\_definitions.json before proceeding.”

**b) Assumptions:**  

Read `<TARGET>/model/assumption_definitions.json`.

- This file describes the individual assumptions with their possible values 
- This is used if the user wants to give controls over individual assumptions, not just scenarios. Scenarios are combinations of settings of individual assumptions.

**c) Output CSV headers:**  
List the files in `<TARGET>/model/outputs/`:

bash

Copy

```bash
ls "<TARGET>/model/outputs/"
```

For each CSV file the user will want to chart, read its header row:

bash

Copy

```bash
head -1 "<TARGET>/model/outputs/<filename>.csv"
```

Ask the user which output CSVs they want to expose, if there are multiple and it is not obvious.

Infer column types from the header names:

-   Year, count-like names → `integer`
-   Price, volume, ratio, quantity-like names → `float`
-   Everything else → `string`

---

## Step 6 — Configure `config.json`

Read `<TARGET>/config.json` to see its current state.

Update it with:

-   The correct `modelDir` (should remain `"./model"` unless the user placed the model elsewhere)
-   One entry per selected output CSV in the `outputs` array, using the column types inferred above

json

Copy

```json
{  "port": 3000,  "modelDir": "./model",  "scriptFile": "script.sql",  "scenarioDefsFile": "scenario_definitions.json",  "duckdbCommand": "duckdb",  "outputs": [    {      "id": "short_snake_case_id",      "label": "Human-readable label",      "file": "outputs/<filename>.csv",      "columns": {        "ColumnName": "string|integer|float"      }    }  ]}
```

Write the updated file to `<TARGET>/config.json`.

---

## Step 7 — Build the chart page

Ask the user: “What kind of chart would you like? Please describe what you want to show — which output, which column on each axis, and any filters (e.g. a country dropdown, a sector selector).”

Wait for the answer, then create `<TARGET>/public/index.html` using `river-api.js` as the API client. Follow the chart page pattern in `<TARGET>/CLAUDE.md` (section “Chart page pattern”). Use `public/index.html` in the same repo as the reference implementation for layout, status bar, colour palette generation, and Chart.js integration.

Key rules when writing the chart page:

-   Always `<script src="/river-api.js"></script>` — do not inline or duplicate its logic.
-   Scenario buttons and a run-triggered `api.run(scenario, outputId, { columns: [...] })` call are required.
-   Filters that don’t require re-running the model (e.g. a dropdown that slices already-loaded data) should be handled client-side.
-   Filters that the server should apply before returning data (reducing payload size) go in the `filters` parameter of `api.run()`.

---

## Step 8 — Install dependencies and verify

bash

Copy

```bash
cd "<TARGET>" && npm install
```

Then start the server and confirm it responds:

bash

Copy

```bash
npm start &sleep 2 && curl -s http://localhost:3000/api/scenarios
```

Report the resolved DuckDB path (printed in the server startup log) and the scenario list to the user. If the scenarios list is empty or an error is returned, diagnose before declaring success.

Tell the user: “Setup complete. Open [http://localhost](http://localhost): in your browser and click a scenario to run the model.”
