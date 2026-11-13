---
name: river-build-model
description: Design, build, extend or fix a River model (Excel add-in) through the River MCP server, using River's modelling patterns. Use when the user wants to build a River model, add a calculation or step to one, asks which River component to use (Lookup vs Breakdown vs All Combinations vs Union, Summarize, Pivot, Cumulative, Iterative, Forecast...), or works with dimensions, assumptions, scenarios, time series or data quality checks in River.
---

# Build a River model

This skill helps the user build River models the River way: tables with explicit dimensions, standard components, data quality checks, assumptions and scenarios managed by River. It gives the patterns; the full help articles are available through `get_help`.

## Tools

Load the River MCP tools with ToolSearch if they are not in the tool list (their names contain `river`, with a prefix that depends on the client).

Every River tool except `get_help` and `get_node_types` takes a required `workbook` parameter, set to a name returned by `list_workbooks`. Use the same name on every call.

- Help: `get_node_types` provides quick summary of usage, and links with Excel and SQL patterns.
- Detailed help: `get_help` (no topic = help index; topics are the link targets in articles, e.g. `Dimension`, `LookupNodeViewModel`). Read the article of a component if needing detailed guidance. If `get_help` fails (older add-in), rely on this skill and suggest updating River.
- Discovery: `list_workbooks`, `get_node_types` (creatable types with descriptions, SQL and Excel equivalents), `get_documentation`.
- Nodes: `create_node`, `create_excel_input_node` (kind `Input` or `Assumption`), `create_excel_output_node`, `connect_nodes`, `disconnect_nodes`, `get_connections`.
- Configuration: `get_node_config` (XML), `update_node_config` (edited XML), `get_node_info` (validity, status, errors).
- Data: `read_node_output` (schema, row counts, sample with filter), `run_scenarios`, `get_scenarios`, `update_scenarios`.
- Layout: `get_node_layout` (all nodes at once), `get_node_position`, `set_node_position`, `update_layout` (many moves and group updates at once), `create_group`, `update_group`, `get_groups`.
- Excel: `get_workbook_structure`, `read_range`, `create_sheet`, `select_range`, `copy_range`.

`create_excel_input_node` and `create_excel_output_node` create their Excel Table at the cell selected in Excel: call `select_range` first on an empty cell outside any table. `copy_range` overwrites its destination and cannot be undone: only target sheets and cells you created.

## Workflow

1. **Understand the goal**: what result the user needs, from which data, and where it must land in Excel (River has no charts; dashboards stay in Excel, fed by Excel outputs).
2. **Describe every table by its dimensions**: "sales *by country and year*", "population share *by country and city*". Granularity drives every merge choice below. Ask when unclear.
3. **Sketch blocks**: title, one-line purpose, inputs, outputs; dependencies flow one way, left to right (inputs → cleaning and validation → core logic → outputs). Name the component for each step and why (one line, from the pattern guide).
4. **Confirm with the user** before touching the flow. Point out risks you see (duplicates, missing matches, granularity changes).
5. **Build block by block** with the node procedure below, checking row counts after each step that may change them.
6. **Structure**: one documentation group per block, at most ~10 nodes each (details in the river-model-structure skill).
7. **Report**: blocks built, Excel input/output tables and their locations, data quality checks failing or disabled, nodes not `Done`.

## Core concepts

- **Tables, not cells.** Every component takes tables and outputs a table; formulas apply to every row. Expressions are DuckDB SQL: no `=`, columns by name, `"Name with spaces"` in double quotes, text in single quotes. `get_help('WritingExpressions')`, `get_help('ExpressionFunctionsAndOperators')`, `get_help('AggregationFunctions')`.
- **Dimensions** are the categorical columns that define granularity. Mark them in the Excel input / Validate configuration right after import and cleaning, before any modelling component. Decimal columns cannot be dimensions; a dimension cannot be unset downstream (copy it with Column formulas if needed). Matching, grouping, pivoting and time-ordered components need dimensions. `get_help('Dimension')`.
- **Master dimensions** hold the authoritative list of values of a dimension (e.g. countries); other Validate components check against them. Use them for keys that match several sources. `get_help('MasterDimension')`.
- **Missing values** propagate in formulas (`A + B` is null if either is), are ignored in aggregations and in Lookup/Breakdown matching; `AND`/`OR` differ from Excel. Handle them explicitly with `IFNULL`, `COALESCE`, `IS NOT NULL`. `get_help('NullValues')`.
- **Data quality checks** are non-blocking warnings: mandatory (always on), recommended (on by default), optional (off). Keep them on; disable one only for a clear, documented reason and tell the user. `get_help('DataQualityChecks')`.
- Types and dates: `get_help('DataTypes')`, `get_help('WorkingWithDatesAndTimes')`.

## Pattern guide

### Inputs and cleaning

| Need | Component |
|---|---|
| Data in an Excel Table | Excel input (`create_excel_input_node` kind `Input`); it includes Validate: mark dimensions there |
| Parameters with alternative options | Excel input kind `Assumption` (see Assumptions and scenarios) |
| CSV file | CSV Import, then Validate |
| Rename, drop or retype columns | Rename and Convert (`Select`) |
| Re-check structure after cleaning | Validate (`DataValidation`): dimensions, master dimensions, checks |

Place a Validate after each import or cleaning stage, before core logic. Excel Input and Excel Assumption have their own validation built-in. `get_help('Tutorials/05_Importing_data.en-US.md')`.

### Merging two tables

Ask first: *should the output have the same rows as the main table, more rows, or the sum of both?*

| Situation | Component | Output rows |
|---|---|---|
| Add columns from a table of the **same or coarser** granularity (VLOOKUP/XLOOKUP) | **Lookup** | = Main |
| Expand to a **finer** granularity (country → city), e.g. allocation by shares | **Breakdown** (matching columns + breakdown columns) | > Main |
| Every pairing, **no shared dimension** (apply a scalar assumption to all products) | **All Combinations** (`CrossJoin`) | Main × Other |
| **Stack** tables with the same kind of data (region A + region B) | **Union** (columns matched by name; missing ones become null) | Main + Other |
| Keep rows whose keys exist in another table, add nothing | **Filter by table** | ≤ Main |
| Check two tables agree (e.g. River vs original Excel) | **Compare** | one row per difference |

- Lookup: the lookup table must be unique on the matching columns (mandatory check); keep "values not found" on (the `#N/A` equivalent).
- Breakdown: unique on matching + breakdown columns; keep "missing values" on. Follow it with Column formulas (e.g. `Sales * "Population share"`).
- All Combinations grows fast: check row counts.
- Only use the creatable types from `get_node_types`
- There is no database-style join in River. 

`get_help('Tutorials/07_Merging_data.en-US.md')` and each component's article.

### Filtering and reshaping

| Need | Component |
|---|---|
| Keep rows matching a condition | Filter (boolean expression) |
| Distinct rows | Remove duplicates (`Unique`) |
| Order rows | Sort (row order does not matter to other components; sort only for output) |
| Wide → long (years or options as columns) | Unpivot |
| One column of variable names, years as columns (typical Excel layout) → long | Transpose (Unpivot + Pivot in one step) |
| Long → wide, for presentation | Pivot (reduces granularity) |
| Cell with several answers `a, b, c` → one row each | Split multiple choice |

Work in long format (one row per dimension combination) inside the model; pivot to wide only just before an Excel output when the user needs that layout.

### Calculating and time series

| Need | Component |
|---|---|
| Row-by-row formula | Column formulas (`Formula`) |
| Aggregate to fewer dimensions (SUMIFS, PivotTable) | Summarize (`GroupBy`) |
| Running totals, rolling windows of aggregations | Cumulative aggregations (partition + order-by dimension) |
| Formulas using neighbouring rows (previous period, differences, moving averages) | Window formulas |
| A value that depends on its own previous value non-linearly (stock floored at 0, thresholds) | Iterative formulas (previous row = column name + `_`, e.g. `GREATEST(inventory_ + supply - demand, 0)`) |
| Extend history to a forecast horizon | Forecast (`ForecastHorizon`): base year, end year, increment, base columns |
| Net present value | Valuation |

- The order-by column must be a dimension; it can be an integer year.
- Prefer Cumulative or Window over Iterative: Iterative is slow and only needed when the recursion is non-linear.
- Keep time aggregation in Cumulative/Window and row logic in Column formulas, in separate nodes.
- Forecast pattern: Forecast then Column formulas, e.g. `IF(year <= year_base, revenue, revenue_base * (1 + growth) ^ (year - year_base))`; no link to the previous year needed.

### Assumptions and scenarios

River separates what Excel mixes in dropdowns and lookup formulas:
- an **Assumption** node holds every option of one assumption in long format (dimension columns, one option column, value columns) and outputs only the rows of the selected option (`SetPointValue`), without the option column;
- the calculation reads that output with a **Lookup** on the remaining dimensions (**All Combinations** if none is left), then Column formulas;
- the flow's **scenarios** are named combinations of options, one per Assumption node. They belong to the flow (`get_scenarios` / `update_scenarios`); the single **Scenarios** node is their editor and outputs the selected options. It has no wires: it finds every Assumption node by itself;
- a **Combine scenarios** node (type `MultiScenarioOutput`, title "Multi-scenarios") stacks a result across all scenarios with a `scenario` column, for comparison.

| Starting point | Pattern |
|---|---|
| Options side by side (Low / Base / High columns) | Excel `Input`, **Unpivot** the option columns to rows, then **Assumption** |
| Options already as rows | `create_excel_input_node` kind `Assumption` |
| Several assumptions switched together | **Scenarios** node, one scenario per combination |
| Results compared across scenarios | **Combine scenarios** before the Excel output |

Procedure:
1. Build each Assumption node and get it to `Done` before creating the Scenarios node. In its config, mark the option column `IsSetPointColumn` (it must also be a dimension) and set `SetPointValue`. After a run, `SetPointValues` lists the valid options. Keep other dimensions (e.g. country) when the assumption varies by them.
2. `create_node` type `Scenarios` (only one per flow; connect nothing). Then `get_scenarios`, add one `Scenario` per scenario, each with one `Assumption` entry per Assumption node: `Id` is the Assumption node id, `SetPointColumnName` its option column, `SetPointValue` one of its `SetPointValues` (keep the `xsi:type` attribute, the value is typed). Set `ScenarioMode` true and `SelectedScenario`, and pass the XML to `update_scenarios`:
   ```xml
   <Scenarios>
     <ScenarioMode>true</ScenarioMode>
     <SelectedScenario>Base</SelectedScenario>
     <Scenario>
       <Name>Base</Name>
       <Assumptions>
         <Assumption>
           <SetPointColumnName>Growth option</SetPointColumnName>
           <SetPointValue xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xsd:string">Medium</SetPointValue>
           <Id>12</Id>
         </Assumption>
       </Assumptions>
     </Scenario>
   </Scenarios>
   ```
3. Check with `read_node_output` on the Scenarios node: one row per assumption with its option. Switch `SelectedScenario` with `update_scenarios` and check that a downstream result changes.
4. Combine scenarios: connect its input to the result to compare, call `run_scenarios`, then `read_node_output`. It has no data until `run_scenarios` runs, and loses it after any upstream change.

`get_help('AssumptionNodeViewModel')`, `get_help('ScenariosNodeViewModel')`, `get_help('MultiScenarioNodeViewModel')`.

### Outputs to Excel

- Every table a dashboard, chart or further Excel formula reads needs an Excel output (`create_excel_output_node`). Its columns keep a fixed position, so Excel references do not break when the model changes.
- Users must not type into output tables (River overwrites them) nor filter them with AutoFilter (sort only); filter in River instead.
- Excel formulas reading outputs should use structured references. `get_help('ExcelReferences')`, `get_help('Tutorials/06_Exporting_data.en-US.md')`.

## Adding a node

1. **Choose** the type from the pattern guide; confirm the exact `type` value with `get_node_types` (once per session). Create it with `create_node`, or the Excel input/output tools.
2. **Connect** it with `connect_nodes` (connector titles from `get_node_info`).
3. **Configure** it: `get_node_config`, edit the XML, `update_node_config`. Collections that start empty:
   - Column formulas, Iterative formulas, Window formulas:
     ```xml
     <Columns>
       <FormulaColumn>
         <Name>NewColumn</Name>
         <IsDimension>false</IsDimension>
         <Expression>1=1</Expression>
       </FormulaColumn>
     </Columns>
     ```
   - Summarize, Cumulative aggregations:
     ```xml
     <Aggregations>
       <AggregationItem>
         <ColumnName>input_column</ColumnName>
         <Aggregation>AVG</Aggregation>
         <!-- AVG, COUNT, SUM, MIN, MAX, FIRST, LAST, MEDIAN, GEOMEAN, PRODUCT, BOOL_AND, BOOL_OR -->
         <NewName>new_column_name</NewName>
       </AggregationItem>
     </Aggregations>
     ```
   - Excel output:
     ```xml
     <Columns>
       <ColumnSlotViewModel>
         <AssignedColumnName>input_column</AssignedColumnName>
       </ColumnSlotViewModel>
     </Columns>
     ```
   - Lookup, Breakdown, Filter by table, Compare:
     ```xml
     <Columns>
       <SelectableColumnWithMatch>
         <IsDimension>true</IsDimension>
         <Name>Scope</Name>
         <RiverType>Integer</RiverType>
         <IsSelected>true</IsSelected>
         <IsInSchema>true</IsInSchema>
         <MatchingColumn>Scope</MatchingColumn>
       </SelectableColumnWithMatch>
     </Columns>
     ```
4. **Verify** with `get_node_info`: `isValid` true = valid configuration; status `Done` = executed; `Initialized` = not fully connected or invalid configuration; `Error` = execution error (read the errors); `Invalid` = an upstream node is in error. Also read failing data quality checks.
5. **Iterate** on connections or configuration until `Done`. After a few failed attempts, stop and report the error.
6. **Check the result** with `read_node_output`: row count as expected for the pattern (same, more, fewer), a few key rows filtered, no unexpected nulls.
7. **Place** it with `set_node_position` next to its neighbours (`get_node_position`), left to right.

## Style

- Be concise. Lead with the design and the reason for each component choice.
- Refer to blocks and groups by title, to nodes by id and name.
- Explain River concepts (dimensions, checks, scenarios) briefly when the user seems new to them, linking the help topic.
