---
name: river-model-structure
description: Review, plan and apply a documentation group structure for a River model (Excel add-in) through the River MCP server. Use when the user asks whether a River flow is well structured, wants to organize, group, document or restructure a River model, or wants nodes arranged into documentation groups with titles and descriptions.
---

# River model structure

This skill helps Claude assess, redesign and implement the group structure of a River flow using the River MCP server tools. Groups are what make a River model readable and auditable: they drive the generated documentation (the ribbon's documentation export) and the visual layout on the canvas.

## When to use

Trigger on requests such as "is my model well structured?", "organize / group my River model", "restructure the flow", "document the model", or "add groups". Do not use it for editing node logic, formulas or Excel tables.

## Opening move

Unless the user has already chosen, offer the three modes in one short message and let them pick one or several:

1. **Review**: advise on whether the model is well structured. Read only, changes nothing.
2. **Plan**: propose a new conceptual structure as hierarchical bullet points. Still changes nothing.
3. **Apply**: create the groups in the flow (and move nodes if needed).

The modes build on each other. Apply requires an agreed plan. If the user asks for Apply directly, produce the plan first and get a yes before touching the flow. Changes to a flow are visible and only partly reversible, so never skip that confirmation.

## Tools

Load the River MCP tools with ToolSearch if they are not in the tool list (their names contain `River_MCP_server`, with a prefix that depends on the client).

Start with `list_workbooks`: it returns the open workbooks with River. Every other tool takes a required `workbook` parameter set to one of these names. If several are open, ask the user which one to work on, then pass that same name on every call. Switching windows in Excel does not change which workbook a call targets.

Read tools:
- `get_documentation`: markdown report of the flow. Parameters: `includeUngroupedNodes`, `includeComponents`, `maxLevel`, `graphDirectory`. Call it with `includeUngroupedNodes=true` to see the whole model, and again after changes to verify.
- `get_groups`: all groups with id, header, comment, x, y, width, height, `parentId` and `overlaps`.
- `get_node_position`, `get_node_ids`, `get_nodes_by_type`, `get_node_info`, `get_connections`: node geometry, inventory, details and links.

Write tools:
- `create_group(x, y, width, height, header, comment)`: creates a documentation group. Returns the id.
- `update_group(groupId, header, comment, width, height, x, y)`: changes text, size and position. Only the supplied fields change. Width and height must be given together, and so must x and y (top-left corner).
- `delete_group(groupId)`: deletes a group. Only the group goes: its nodes and sub-groups stay where they are. It refuses ids that are not groups, so it can never delete a node. The user can undo it in River.
- `set_node_position(nodeId, x, y)`: moves a node.

Limits to keep in mind:
- Moving a group with `update_group` moves only its rectangle, not the nodes inside it. To relocate a group together with its content, move the group and then every node in it by the same offset with `set_node_position`. Membership is geometric, so nodes left behind drop out of the group.
- `delete_group` removes only the group. Its nodes and sub-groups lose that parent but are not touched.
- A wrongly placed group can be fixed by resizing, moving or deleting it, but plan geometry carefully before creating anything.
- Membership is purely geometric. A node or group belongs to a group when it lies fully inside its bounds, and `parentId` is the smallest group that fully contains it. Hierarchy is therefore only possible if the canvas layout allows nested rectangles.
- If `get_documentation` shows no groups, or the flow is empty, say so and ask the user to load the right flow.

## What a good structure looks like

Use these principles when reviewing and when designing.

**Group size**
- A group holds 2 to 10 nodes. Fewer than 2 or more than 10 needs a reason.
- Single-node groups are fine for a pure input, an assumption, a scenario selector or an output that needs no pre- or post-processing. They are not fine for a calculation step.

**Cohesion**
- One group, one purpose that can be said in a sentence ("turns population projections into a growth index").
- Keep a processing chain together: Excel input, then its unpivot, forecast horizon and formula nodes belong in one group.
- Put an Excel output in the group that produces its data, so each group ends in a clear deliverable.
- Keep an assumption with its own preparation steps (for example the Excel assumption, the unpivot and the forecast horizon that extends it), not with the calculation that consumes it.

**Narrow interfaces**
- Check the "Outputs to other groups" and "Inputs from other groups" tables in the documentation. A good boundary passes few tables with a clear granularity. 
- Avoid groups that send data back and forth. Dependencies should flow in one direction.

**Hierarchy**
- Use at most 3 levels. Typical top level for a forecasting or quantitative model: inputs and assumptions, then the calculation stages in the order of the logic, then results and outputs.
- Create a parent group only when it has at least 2 children and a meaning of its own.
- Every node should be in a group. Ungrouped nodes mean the model is only partly documented.

**Layout**
- Flow reads left to right. Inputs sit on the left or in a clearly separate band, results on the right.
- Related nodes sit next to each other, otherwise a group around them gets huge and swallows unrelated nodes.
- Groups must not partially overlap. Only full containment is allowed.

**Naming and documentation**
- Titles are short, descriptive, and in sentence case (only the first letter capitalized), for example "Bed-days forecast", not "Calculate Bed Days Forecast Step 2".
- Each description says what the group does and why, names key outputs, and quotes the central formula when there is one. One to three sentences.

## Mode 1: review

1. Call `get_documentation` with `includeUngroupedNodes=true`, then `get_groups`.
2. Inventory: number of nodes, number grouped vs ungrouped, number of groups per level, group sizes, overlaps, and groups with empty or default titles and comments.
3. Check each principle above. Look at the cross-group tables to judge interfaces.
4. Reply with:
   - A verdict in one or two sentences (for example "mostly ungrouped, 26 of 31 nodes outside any group").
   - What works well, briefly.
   - Findings ordered by impact, each with the node or group ids involved and a concrete fix.
   - An offer to move on to Plan, and if the model is already good, say so and stop. Do not invent problems.

Keep the review in prose with a short list of findings. No long tables.

## Mode 2: plan

1. Gather the same information as in review. Trace the data flow using the "Fed by" columns and `get_connections` so the groups follow the actual logic, not the canvas layout.
2. Identify the stages of the model: inputs and assumptions, preparation, core calculation, aggregation, outputs.
3. Propose the structure as hierarchical bullet points. For each group give: **title**, a one-line description, and the node ids it contains in brackets. Mark existing groups that are kept as is.
4. Run the checks: every node assigned exactly once, group sizes in range, exceptions explained, interfaces reasonable.
5. Check feasibility against the canvas (see geometry below). If the current layout cannot support a part of the hierarchy, say so explicitly, name the nodes that would have to move, and offer the alternative of leaving that parent group out.
6. Ask the user to confirm or adjust before applying. Do not write anything to the flow in this mode.

## Mode 3: apply

Only after the user has confirmed a plan.

1. **Snapshot**: record the current positions of every node involved (`get_node_position`) and the existing groups (`get_groups`, including header, comment and bounds, so a deleted group can be recreated). Fetch independent positions in parallel.
2. **Calibrate geometry** from an existing group if there is one: compare its bounds with the positions of the nodes inside it to derive node width and height and the header space. If none exists, assume nodes of about 180 by 120 units, about 70 units of header space above the first row and about 35 to 50 units of margin on the other sides.
3. **Fix the layout first**: if a group would have to contain unrelated nodes or overlap another group, move the offending nodes with `set_node_position` to sit next to the rest of their group. Move as few nodes as possible, keep the left-to-right flow, and note every move for the final report.
4. **Compute rectangles**: for each leaf group take the bounding box of its nodes (top-left corners plus node size), add margins and header space. For a parent group take the bounding box of its children plus margin and header space. Check on paper that no rectangle partially overlaps another, that no parent contains unrelated nodes or groups, and that adjacent rectangles do not touch (leave a gap of at least 10 to 25 units, since touching edges can be reported as overlaps).
5. **Create groups**: if the plan replaces existing groups, delete exactly those with `delete_group` first, so the new rectangles do not overlap them. Never delete a group the plan does not list. Then create leaf groups first, then parents, with `header` and `comment` set in the same call. Create independent groups in parallel. Do not create anything you have not computed in step 4.
6. **Verify**:
   - `get_groups`: each group has the expected `parentId`, and `overlaps` is empty everywhere. If an overlap is reported, fix it with `update_group` (resize or move) rather than creating more groups.
   - `get_documentation` with `includeUngroupedNodes=true`: every node appears in the intended group, the "Outputs to" and "Inputs from" tables read sensibly, and no section for ungrouped components remains (or only the ones the plan left out on purpose).
7. **Report** briefly: the structure that now exists, the nodes that were moved and why, the groups that were deleted or replaced, anything deliberately left out, and the points to check visually on the canvas because node sizes were estimated. Offer to draft the model overview comment.

If a creation goes wrong, do not pile on more groups. Fix it with `update_group` (resize or move). If that is not enough, delete the faulty group with `delete_group` and recreate it from the computed rectangle. Only fall back to telling the user what to undo in River if something other than a group went wrong, such as a misplaced node you can no longer restore from the snapshot.

## Style of the conversation

- Be concise. Lead with the verdict or the plan, not with the method.
- Refer to groups by title and to nodes by id and name.
- Use sentence case for all group titles and headings.
- Ask for confirmation once, at the plan stage, and then execute the whole apply phase without further questions unless something unexpected comes up.