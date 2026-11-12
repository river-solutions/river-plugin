---
name: river-documentation
description: Write a user-facing documentation draft (documentation_draft.md) for an Excel model built with the River add-in, from the markdown documentation exported by River and its flow diagrams. Use when the user asks to document, write up, or produce user documentation, a model guide or a model description for a River model, or to turn a River documentation export into readable documentation.
---

# River model documentation

This skill turns the documentation exported from a River model into a user-facing documentation draft in markdown, for the user to review and edit. A Word version is a separate, later pass: do not produce one unless asked.

## Background: River

River is an Excel add-in that describes a calculation model as a flow of components connected by connections. Each connection carries exactly one data table. Inputs come from external files or from Excel Tables in the same workbook.

Components can be grouped into groups: containers that represent units of logic. Groups can be nested.

## Source material

1. **The exported markdown file** (primary reference). It contains:
   - the high-level logic of the model as a diagram;
   - one section per group describing inputs, outputs, assumptions and calculation logic.
2. **The pictures** referenced in the markdown file, which are generated flow diagrams.
3. **The Excel model itself.** Read it only when you need the sheet structure or the input tables.

Ask the user which folder holds the export if it is not obvious. If there is no export but the River MCP server is connected (tool names contain `River_MCP_server`; load them with ToolSearch), you can generate one with `get_documentation` (call `list_workbooks` first for the `workbook` name; ask the user if several are open), passing `graphDirectory` so the diagrams are written to disk. Say that you did so.

## Ground rules

- **Ground everything in the source material.** Do not invent numbers, mechanics, references or behaviour.
- If something is not supported by the files, omit it or flag it explicitly as **[TO CONFIRM]** rather than guessing.
- Reference the existing diagram images with relative paths; do not redraw them.

## Document structure

Follow the actual modelling logic flow as the backbone of the document.

1. **Introduction and purpose**: what the model is for, what it does and does not cover, and how scenarios are built from assumptions.
2. **Overall architecture and logic flow**: one clear walkthrough of the whole chain. Include the overall flow diagram if it is the first element of the markdown file.
3. **One section per logical group.** Follow the structure of the markdown file, but reorder the groups so the logic is easy to follow. Each section contains:
   1. a clear description, based on the markdown file;
   2. a calculation logic summary, based on the "Calculation steps" table. Summarise it; do not explain each step, only what is needed to understand the processing in this group;
   3. the flow diagram, if the markdown file provides one (only when the group itself contains several groups);
   4. the remaining elements of the markdown file, where they exist: inputs from other groups, outputs to other groups, Excel inputs, Excel outputs, assumptions.
4. **Inputs, outputs and assumptions reference**:
   - a table of every assumption, grouped by group, with its description and its options;
   - a summary of the output tables.

## Delivery

Write `documentation_draft.md` in the export folder (next to the images, so relative image paths resolve). Then report briefly: the section order you chose and why, and the list of [TO CONFIRM] items for the user to resolve.
