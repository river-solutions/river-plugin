---
name: river-build-dynamic-website
description: Set up a River Dynamic Website from a River model. Offers two templates (a Node.js server running DuckDB, or a static site running DuckDB-WASM in the browser), explains their trade-offs in plain language, copies the chosen template to a target folder, optionally exports the SQL bundle via the River connector, configures the site for the model's scenarios and outputs, and (browser mode) prepares a folder to share on OneDrive or SharePoint.
---

# Set up a River dynamic site

You are setting up a River Dynamic Website: a small website where people pick a scenario, the River model runs, and the results appear as interactive charts. Follow the steps below in order. At each decision point, wait for an explicit user response before continuing.

**Who you are talking to:** the user is a capable analyst who knows their model well, but is not necessarily a software or web developer. When you talk to them:
- Use plain language. Avoid jargon such as Node.js, npm, WASM, CDN, static host, HTTP, localhost or port, unless you explain it in a few words or the user uses it first.
- Do the technical work yourself (copying files, running commands, editing config). Only ask the user for decisions and for things only they can do.
- Explain results in terms of what they will see ("a page opens in your browser with one button per scenario"), not in terms of files and commands.

The templates ship with this plugin in `${CLAUDE_PLUGIN_ROOT}/templates/` (if the variable is not expanded, it is the `templates/` folder two levels above this `SKILL.md`):

| Template | Folder | Engine |
|----------|--------|--------|
| **Server** | `templates/server/` | Node.js + Express; DuckDB runs on the server (`@duckdb/node-api`) |
| **Browser** | `templates/browser/` | Static site; DuckDB-WASM runs in each viewer's browser |

---

## Step 1 — Choose where the model runs

Explain the choice to the user in these terms (you may shorten it, but keep the substance), then ask which one they want. Record the answer as **MODE = server** or **MODE = browser**.

> There are two ways to build the site. The difference is **where the model's calculations happen**, and that decides who can see your data and how easy the site is to share.
>
> **Option 1 — The model runs in each viewer's browser** *(easiest to share)*
> The whole model, including its input data, is sent to the viewer's computer, and their web browser does the calculations.
> - **Easy to share:** I can prepare a folder that you copy to a shared drive such as OneDrive or SharePoint. A Windows colleague double-clicks a file in it to open the site, with nothing to install; a Mac or Linux colleague types one short command. (It cannot be sent by email: email servers block this type of file.) It can also be put on almost any website, without a dedicated server.
> - **Your model and data are not private:** anyone who receives the site can open the model's logic and every input table. Only choose this if you are comfortable sharing the inputs with everyone who gets the site.
> - **Depends on the viewer's computer:** a very large model may be slow or fail on an ordinary laptop. The first run takes a little longer.
> - Viewers need an internet connection while using it.
>
> **Option 2 — The model runs on a server** *(keeps your data private)*
> The model stays on one computer you control (your own PC, or a server your IT team provides). Viewers only receive the results shown in the charts, never the model or its input data.
> - **Private:** the model's logic and input data never leave that computer.
> - **Handles large models:** it uses the server's power, not the viewer's laptop.
> - **Harder to share:** that computer must stay on and run the site. To let other people use it, someone (usually IT) needs to set it up on a server. It cannot simply be copied to a shared drive.
> - **One run at a time:** it is designed for one user or a small team. If two people click a scenario at the same moment, the second gets a "please wait, model is already running" message.
>
> **In short:** if the inputs are confidential or the model is very large, choose the server. If you want to send the site to people easily and the inputs can be shared, choose the browser.
>
> Which would you like?

The paths below depend on MODE:

| | MODE = server | MODE = browser |
|---|---|---|
| **CONFIG** (config file) | `<TARGET>/config.json` | `<TARGET>/public/config.json` |
| **MODEL** (model folder) | `<TARGET>/model` | `<TARGET>/public/model` |
| `modelDir` value in CONFIG | `"./model"` (relative to TARGET) | `"model"` (relative to `public/`) |

Technical notes for you (no need to tell the user unless relevant): server mode needs Node.js 18+ and `npm install` on the host, and rejects concurrent runs with HTTP 429. Browser mode loads DuckDB-WASM and Chart.js from the jsDelivr CDN, caps memory at about 4 GB per tab, cannot be opened from `file://`, and needs every file path in `script.sql` to start with `inputs/` or `outputs/` (River's SQL export already does this).

---

## Step 2 — Check the River connector

Check whether the River MCP connector is available: look for River tools such as `export_to_sql` and `list_workbooks` (names like `mcp__river__*` or `mcp__plugin_river_river__*`) in your tool set.

The River Excel add-in only runs on Windows. A Mac user can only use a model export that someone else made.

- **If the connector is available:** ask: "I can see your River model open in Excel. Shall I export it for the website myself, or would you rather export it yourself?" Record the answer as **extract = yes** or **extract = no**.
- **If it is not available:** tell the user: "I can't connect to River from here, so you will need to export the model from River yourself (River's *Export to SQL* feature). I'll tell you where to save it." Set **extract = no**.

---

## Step 3 — Get the target folder

Ask: "In which folder should I create the website? For example `C:\Users\<you>\Documents\My model site`. I'll create the folder if it doesn't exist."

Call the answer **TARGET**.

---

## Step 4 — Copy the template

**If TARGET already contains an installation** (CONFIG exists), tell the user: "There is already a site in this folder. I can update it to the latest version; your model, settings and charts will be kept. Shall I go ahead?" Wait for confirmation. In that case, copy everything **except** the CONFIG file.

Copy the contents of `templates/<MODE>/` (including dotfiles such as `.gitignore`) into TARGET.

Windows (PowerShell):
```powershell
New-Item -ItemType Directory -Force -Path "<TARGET>" | Out-Null
Copy-Item -Path "${CLAUDE_PLUGIN_ROOT}\templates\<MODE>\*" -Destination "<TARGET>" -Recurse -Force
```

macOS/Linux:
```bash
mkdir -p "<TARGET>"
cp -R "${CLAUDE_PLUGIN_ROOT}/templates/<MODE>/." "<TARGET>/"
```

Create the MODEL folder if it does not exist. Tell the user the site files are in place, and show the folder path.

---

## Step 5 — Get the model export into MODEL

**If extract = yes:** call `list_workbooks` to find the open workbook (if there are several, ask "Which workbook contains the model?"), then call `export_to_sql` with that workbook and `outputDirectory` = the absolute path of MODEL. If the tool fails, fall back to the manual export below.

**If extract = no:** tell the user: "Please export the model from River using *Export to SQL*, and choose this folder as the destination: `<MODEL>`. Let me know when it's done."

Then check that these exist:
- `<MODEL>/script.sql`
- `<MODEL>/scenario_definitions.json`
- `<MODEL>/inputs/`
- `<MODEL>/outputs/` (output CSVs from a River run; used to read the column names)

If something is missing, say in plain terms what is missing (for example "the export doesn't contain the scenario list") and ask the user to export again.

---

## Step 6 — Inspect the model

**a) Scenarios:** read `<MODEL>/scenario_definitions.json`.
- The scenario names become the buttons on the site.
- Check every scenario for `null` parameter values. If any exist, warn the user: "In scenario X, some assumptions have no value selected. That scenario will probably fail to run. You may want to complete it in River and export again."

**b) Assumptions:** read `<MODEL>/assumption_definitions.json` if it exists. It lists each assumption and its possible values. Use it if the user wants the site to let viewers change individual assumptions, not just pick a whole scenario.

**c) Outputs:** list the CSV files in `<MODEL>/outputs/` and read the header row of each one. If there are several, show the user the list by name (and their columns, briefly) and ask: "Which of these results should appear on the site?"

Infer column types from the header names (do not ask the user about types):
- Year and count-like names → `integer`
- Price, volume, ratio and quantity-like names → `float`
- Everything else → `string`

---

## Step 7 — Configure CONFIG

Read CONFIG, then update it:
- Keep `modelDir` at the value in the table in Step 1, unless the model is somewhere else.
- Add one entry per selected output CSV to `outputs`, with the column types inferred above. Use the CSV's name, made readable, as the `label` (e.g. `Out_free_allocation.csv` → "Free allocation").

```json
{
  "port": 3000,
  "modelDir": "<see Step 1>",
  "scriptFile": "script.sql",
  "scenarioDefsFile": "scenario_definitions.json",
  "outputs": [
    {
      "id": "short_snake_case_id",
      "label": "Human-readable label",
      "file": "outputs/<filename>.csv",
      "columns": { "ColumnName": "string|integer|float" }
    }
  ]
}
```

---

## Step 8 — Build the chart page

Ask, using the actual column names of the chosen output: "What should the chart show? For example: *Year* along the bottom, *EUA* as the value, one line per *Sector*, with a dropdown to choose the *Country*. A line chart, bars, or stacked bars?" If the user is unsure, propose a sensible default based on the columns and ask them to confirm.

Then create `<TARGET>/public/index.html`, using `river-api.js` as the client. The `river-api.js` API is the same in both modes.

**Design: start from the reference page.** Before writing anything, read `examples/index.html` next to this `SKILL.md` (a finished page for a hospital-bed model). It defines the look every River site should have. Build the new page from it:
- **Copy the whole `<style>` block unchanged**: colour tokens, light/dark mode, header, segmented scenario buttons, tabs, filters, KPI cards, chart cards, data tables, status bar and spinner. Do not restyle; add new CSS only for components the reference does not have.
- **Keep the page structure:** a header with the model title, a subtitle and the scenario buttons; a toolbar with tabs (one per output or topic) and the status; then per tab, filters → KPI cards → chart card(s), each with an optional "Show data table".
- **Reuse the script helpers as they are:** `setStatus`, `uniqueSorted`, `fillSelect`, `byYear`, `chartDefaults`, `baseOptions`, `line`, `draw`, `table`, `kpi`, the `ensureData` per-scenario cache, `switchTab`, `switchScenario` and `init`. Take series colours from the `--series-*` CSS tokens so they follow light/dark mode.
- **Replace only what is model-specific:** title and subtitle, tabs, filter dropdowns, KPI definitions, chart datasets, output ids and column names. Remove a tab, KPI row or table if it does not fit the user's request.

Rules for the chart page:
- Always load `<script src="/river-api.js"></script>`; do not inline or duplicate its logic.
- Include scenario buttons, and call `api.run(scenario, outputId, { columns: [...] })` when one is clicked.
- Handle filters that only slice data already loaded (such as a dropdown) in the page, without re-running the model.
- Use the `filters` option of `api.run()` for equality filters applied before rows are returned, to reduce the data size.
- Show a loading/error status, and disable or flag scenarios that have `null` parameters.

---

## Step 9 — Start and test the site

**MODE = server:**
```bash
cd "<TARGET>" && npm install && npm start
```
Run `npm start` in the background, then check that `http://localhost:<port>/api/scenarios` returns the scenario list. If the list is empty or you get an error, fix it before going further. Then tell the user: "The site is running. Open http://localhost:<port> in your web browser and click a scenario. Does the chart look right?"

**MODE = browser:** start any one of these local servers (none of them installs anything into the site):
- Windows, no install: `powershell -NoProfile -ExecutionPolicy Bypass -File "<TARGET>\serve.ps1"` (what `start.bat` runs)
- Node available: `cd "<TARGET>" && npm install && npm start`
- macOS/Linux: `python3 -m http.server <port> -d "<TARGET>/public"`

The model runs in the browser, so you cannot test a run with `curl`. Check that `http://localhost:<port>/config.json` and `http://localhost:<port>/model/script.sql` load, then tell the user: "Open http://localhost:<port> in your web browser and click each scenario. Does the chart appear? If you see an error message, copy it here." If a run fails, check that every file path in `script.sql` starts with `inputs/` or `outputs/` and that no scenario has `null` parameters.

Adjust the chart if the user asks for changes.

**MODE = server — finish here.** Tell the user: "Your site is ready. While this computer keeps the site running, you can use it at http://localhost:<port>. To make it available to colleagues, ask your IT team to host the folder `<TARGET>` on a server; the README file in that folder tells them what they need (Node.js 18 or later)."

---

## Step 10 — Prepare a folder to share (MODE = browser only)

Ask: "Would you like me to prepare a folder you can put on a shared drive such as OneDrive or SharePoint? Colleagues on Windows open it and double-click **start.bat** to use the site, with nothing to install; colleagues on Mac or Linux type one short command, and I'll include instructions for them in the folder. Note that sending the site by email won't work: email servers block this type of file, even inside a zip."

**If yes:** ask where to create it, suggesting a folder inside the user's OneDrive (e.g. `C:\Users\<you>\OneDrive - <company>\<site name>`, with a name based on the model). Call it **SHARE**. Copy only `start.bat`, `serve.ps1` and the `public/` folder into it (not `server.js`, `package.json` or `node_modules`).

Windows (PowerShell):
```powershell
New-Item -ItemType Directory -Force -Path "<SHARE>" | Out-Null
Copy-Item -Path "<TARGET>\start.bat", "<TARGET>\serve.ps1", "<TARGET>\public" -Destination "<SHARE>" -Recurse -Force
```

macOS/Linux:
```bash
mkdir -p "<SHARE>" && cp -R "<TARGET>/start.bat" "<TARGET>/serve.ps1" "<TARGET>/public" "<SHARE>/"
```

Then write `<SHARE>/HOW TO OPEN.txt` for the people who receive the folder, with `<port>` replaced by `port` from CONFIG and `<site name>` by the folder name:

```text
HOW TO OPEN THIS SITE

First, make sure this folder is on your computer: sync it from OneDrive/SharePoint
("Sync" or "Add shortcut to My files"), or download it. It does not work from the
SharePoint web page. You need an internet connection while using the site.

WINDOWS
1. Double-click start.bat. The site opens in your web browser.
   If Windows shows a security warning, click "More info", then "Run anyway".
2. To stop the site, close the black window.

MAC
1. Open Terminal (Applications > Utilities > Terminal).
2. Type  cd  followed by a space, drag the "<site name>" folder onto the Terminal
   window, and press Enter.
3. Type this and press Enter:
       python3 -m http.server <port> -d public
   If your Mac offers to install "command line developer tools", click Install,
   wait for it to finish, then type the command again.
4. Open http://localhost:<port> in your web browser.
5. To stop the site, close the Terminal window.

LINUX
1. Open a terminal in this folder.
2. Run:  python3 -m http.server <port> -d public
3. Open http://localhost:<port> in your web browser. Press Ctrl+C to stop.

If the page says the address is already in use, replace <port> with another
number (for example 8080) in both the command and the web address.
```

Check the copy is complete and report the folder's total size. Then tell the user, in plain words:
- "The folder is ready at `<SHARE>`. Share it with your colleagues from OneDrive or SharePoint, as you would any other folder."
- "Please don't send these files by email: email servers block them, even zipped."
- "Your colleagues need the folder on their own computer: either sync it (in SharePoint/OneDrive, **Sync** or **Add shortcut to My files**), or download it. Then they double-click **start.bat**. The site opens in their browser; closing the black window stops it. It won't run from the SharePoint web page itself."
- "If they downloaded the folder, Windows may show a security warning. They can click **More info → Run anyway**."
- "They need an internet connection while using it, and the first run takes a little longer."
- "start.bat only works on Windows. Colleagues on Mac or Linux open a Terminal window and type one command; step-by-step instructions are in the file **HOW TO OPEN.txt** in the folder. On a Mac, the first time may ask to install Apple's free developer tools."
- "Reminder: anyone with access to this folder can open the model's logic and all of its input data, so share it only with people who may see the inputs."
- "When you update the model, ask me to refresh this folder, and your colleagues will get the new version."

**If no:** tell the user they can ask for the shared folder later, and that the site can also be put on a website by uploading the `public` folder (their IT team will know how).
