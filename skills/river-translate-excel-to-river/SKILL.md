---
name: river-translate-excel-to-river
description: Convert an existing Excel model into a River model (Excel add-in) living in the same workbook, through the River MCP server. Use when the user wants to translate, migrate, port, convert or rebuild an Excel workbook, its formulas or its calculation sheets as a River flow, or move data processing out of Excel formulas into River.
---

# Translate an Excel model to River

This skill rebuilds the data processing of an existing Excel model as a River flow in the same workbook. River takes over the calculations; dashboards and visualizations stay in Excel and are fed by River output tables.

Ground rules:
- Existing data and formulas are never modified. Data River needs is copied into new Excel Tables (ListObjects) that feed River input nodes.
- Work in phases and get an explicit yes from the user before moving from understanding to design, and from design to implementation.

## Tools

Load the River MCP tools with ToolSearch if they are not in the tool list (their names contain `River_MCP_server`, with a prefix that depends on the client).

Every River tool takes a required `workbook` parameter, set to a name returned by `list_workbooks`. Use the same name on every call.

- Discovery: `list_workbooks`, `get_node_types` (types accepted by `create_node`, with descriptions and Excel equivalents), `get_documentation`.
- Nodes: `create_node`, `create_excel_input_node` (kind `Input` or `Assumption`), `create_excel_output_node`, `connect_nodes`, `disconnect_nodes`, `get_connections`.
- Configuration: `get_node_config` (returns XML), `update_node_config` (takes the edited XML), `get_node_info` (validity, status, errors).
- Data outputs: `read_node_output` (schema, row counts and a sample of a node's result, with optional filter and columns), `run_scenarios` (refills Combine scenarios nodes).
- Layout and structure: `get_node_position`, `set_node_position`, `create_group`, `update_group`, `get_groups`.
- Excel reading: `get_workbook_structure` (sheets, tables, names, charts and their sources, PivotTables, dropdowns), `read_range` (values and/or formulas, row-limited).
- Excel cells: `create_sheet` (new empty sheet), `select_range` (activates the workbook and sheet and selects cells), `copy_range` (copies cells within the workbook; `valuesOnly` true pastes values only).

`create_excel_input_node` and `create_excel_output_node` create their Excel Table at the cell currently selected in Excel, in the active workbook. Before each call, place the selection with `select_range` on an empty cell outside any existing table. `select_range` and `copy_range` change what the user sees in Excel, and `copy_range` overwrites its destination and cannot be undone: only ever target sheets and cells you created.

## Step 0: setup

1. Call `list_workbooks` and confirm with the user which workbook to convert.
2. Tell the user the workbook will be modified (new tables, sheets and a River flow) and ask them to save a copy first.

## Step 1: understand the workbook

Read the workbook live with `get_workbook_structure`, then `read_range` on the blocks that matter (mode `both` on calculation blocks, a small `maxRows` first), to get a high-level structure that can be described in business terms. Do not go into cell-level detail yet. Look for:
- a readme or documentation sheet;
- clear input, calculation and output sheets;
- blocks of cells and their orientation (time running horizontally vs records running vertically);
- Excel Tables used as inputs or in calculations;
- what feeds the dashboards and charts;
- assumptions and scenarios: blocks of alternative values (Low / Base / High), the dropdown cells choosing between them (`get_workbook_structure` lists dropdowns), a master scenario cell or table driving several dropdowns, and Data Tables or blocks repeating results per scenario.

## Step 2: feedback

1. Tell the user what you understood of the structure, in a few bullets.
2. Point out unclear structural elements and ask clarifying questions.
3. Ask whether to proceed to a conceptual design (no implementation yet). Wait for the answer.

## Step 3: conceptual design

1. Identify the main blocks of logic River will handle. They can be hierarchical.
2. Map dependencies between blocks. They should flow in one direction.
3. Map assumptions and scenarios to River's pattern (see "Assumptions and scenarios" below): one Assumption node per assumption block, one Scenarios node for the scenario switch, a Combine scenarios node where results are compared across scenarios.
4. Identify where River output must go back to Excel. River has no visualization or dashboarding, so every table a dashboard or chart reads needs an Excel output.
5. Present the design as hierarchical bullet points: for each block a title, a one-line description, its inputs and its outputs.
6. Ask the user to confirm or adjust, and whether to build everything at once or pause for review after each block. Do not touch the flow until they confirm.

## Step 4: implementation

Go block by block. Each block becomes one River documentation group of at most 10 nodes; split larger blocks. For each block, add nodes with the procedure below, then group them (step 5).

### Adding a node

1. **Choose the node.**
   - Data that lives in Excel: create an Excel input (kind `Input` for data, `Assumption` for parameters and assumptions) and copy the source data into it. Never move or overwrite the original data.
     1. Once per model, `create_sheet` for the River input tables (e.g. `River inputs`). Leave a few empty columns between tables.
     2. `select_range` on the cell where the table goes, then `create_excel_input_node`.
     3. `copy_range` the source block without header row, onto the new table's top-left cell with `valuesOnly` true (River works on values; formulas would keep pointing at the original sheets). If the source has no header row, ask the user for column names. If it has, use `copy_range` a second time on the header row only.
     4. Check with `get_node_config` and `get_node_info` that the node sees the expected columns and rows. If the table did not grow to fit the pasted data, ask the user to resize it (Table Design > Resize Table) and check again.
   - Processing steps: call `get_node_types` once and pick the type matching the Excel operation, using the descriptions and Excel equivalents. Create it with `create_node`.
   - Results needed in Excel: see step 7 below.
2. **Connect** it to its inputs with `connect_nodes`.
3. **Configure** it: `get_node_config`, edit the XML, `update_node_config`. Some nodes have collections that start empty, so you need to know how to configure them:
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
          <!-- Aggregation types are: AVG, COUNT, SUM, MIN, MAX, FIRST, LAST, MEDIAN, GEOMEAN, PRODUCT, BOOL_AND, BOOL_OR -->
          <NewName>new_column_name</NewName>
        </AggregationItem>
      </Aggregations>
      ```
   - Excel Output:
     ```xml
       <Columns>
        <ColumnSlotViewModel>
          <AssignedColumnName>input_column</AssignedColumnName>
        </ColumnSlotViewModel>
      </Columns>
      ```
    - Lookup, Breakdown, Filter By Table and Compare:
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
4. **Verify** with `get_node_info`:
   - `isValid` true means the configuration is valid;
   - status `Done` means it executed;
   - `Initialized` means it is not fully connected or its configuration is invalid;
   - `Error` means an internal execution error (read the errors);
   - `Invalid` means an upstream node is in error.
5. **Iterate** on connections (`disconnect_nodes` / `connect_nodes`) or configuration until the node is `Done`. If you cannot fix it after a few attempts, stop and report the error to the user.
6. **Check results** against the original Excel values where possible: `read_node_output` (filter on a few keys, e.g. one product and year) and `read_range` on the matching Excel cells. Tell the user about any mismatch.
7. **Output to Excel** where the design calls for it: `create_sheet` once for the River outputs (e.g. `River outputs`) unless the design puts them elsewhere, `select_range` on the target cell, `create_excel_output_node`, connect it, and set its columns through its configuration.
8. **Place** the node with `set_node_position`, using `get_node_position` of its neighbours. River flows read left to right: inputs on the left, outputs on the right.

### Assumptions and scenarios

River separates the three things Excel mixes in dropdowns and lookup formulas:
- an **Assumption** node holds every option of one assumption in long format (dimension columns, one option column, value columns) and outputs only the rows of the selected option (`SetPointValue`), without the option column;
- the calculation reads that output with a **Lookup** on the remaining dimensions, like the INDEX/MATCH or XLOOKUP it replaces;
- the flow's **scenarios** are named combinations of options, one per Assumption node. They belong to the flow (`get_scenarios` / `update_scenarios`); the single **Scenarios** node is their editor in River and outputs the selected options. It has no wires: it finds every Assumption node by itself.

| In Excel | In River |
|---|---|
| Options side by side (Low / Base / High columns) | Excel `Input` copy, then **Unpivot** the option columns to rows, then **Assumption** |
| Options already as rows | `create_excel_input_node` kind `Assumption` |
| Dropdown cell choosing the option | `SetPointValue` of that Assumption node, set to the value currently selected in Excel |
| INDEX/MATCH, XLOOKUP, VLOOKUP, CHOOSE, OFFSET reading the active option | **Lookup** on the Assumption output (**All Combinations** if it has no dimensions left), then **Column formulas** |
| Master scenario cell (IF/CHOOSE on it), scenario table (one row per scenario, one choice per assumption), Scenario Manager | **Scenarios** node, one scenario per row |
| Data Table, or results repeated per scenario | **Combine scenarios** node (type `MultiScenarioOutput`, title "Multi-scenarios") before the Excel output |

Procedure:
1. Build each Assumption node and get it to `Done` before creating the Scenarios node. In its config, mark the option column `IsSetPointColumn` (it must also be a dimension) and set `SetPointValue`. After a run, `SetPointValues` lists the valid options.
2. `create_node` type `Scenarios` (only one per flow; connect nothing) so the user can edit and see the scenarios in River. Then `get_scenarios`, add one `Scenario` per scenario, each with one `Assumption` entry per Assumption node: `Id` is the Assumption node id, `SetPointColumnName` its option column, `SetPointValue` one of its `SetPointValues` (keep the `xsi:type` attribute, the value is typed). Set `ScenarioMode` true and `SelectedScenario` to Excel's active scenario, and pass the XML to `update_scenarios`:
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
3. Check with `read_node_output` on the Scenarios node: one row per assumption with its option selected. Switch `SelectedScenario` with `update_scenarios` and check that a downstream result changes as the Excel model does.
4. Combine scenarios: connect its input to the result to compare, call `run_scenarios`, then `read_node_output` (it adds a `scenario` column). Call `run_scenarios` again after any upstream change: until then the node has no data.

## Step 5: structure

1. After each block, create a group with `create_group` whose rectangle fully contains the block's nodes (and nothing else), with a short sentence-case header and a one-to-three sentence comment saying what the block does. Check with `get_groups` that it has no overlaps.
2. At the end, review the whole flow (`get_documentation` with `includeUngroupedNodes=true`) and add parent groups if they help. For detailed grouping rules and geometry, use the river-model-structure skill.

## Step 6: dashboards and visualizations

Out of scope. Dashboards stay in Excel; do not rewire charts or dashboard formulas to the River outputs. If the user asks for this, say it is not supported yet by this skill.

## Step 7: summary

Report briefly: the blocks and groups created, the sheets created, the Excel input and output tables (sheet and location) and the source range each input was copied from, any table the user still has to resize or fill, any node that is not `Done` or any result mismatch, and what remains in Excel.

## Step 8 (optional): comparisons

Ask the user if they would like to add a comparison stage. If they want it:
1. Identify the matching tables between the original Excel model and the data created for the Excel Output components.
2. Create a new Excel Input for each of the original tables, and copy the values.
3. For each, add a Compare component, link it to the matching pairs of tables.

This logic can't compare data across multiple scenarios. While River has the Multi-scenarios component that turns any table into a combined multi-scenario table, this can't be linked to Excel. As result, the comparison is only valid for the scenario that was selected before the hard copy.

## Style

- Be concise. Lead with findings and the design, not the method.
- Refer to blocks and groups by title, to nodes by id and name.
- Ask for confirmation at the end of steps 2, 3, 7 and at each pause the user asked for; otherwise run the implementation without extra questions.
