# River plugin for Claude

Claude skills for working with River models (Excel add-in), plus the River MCP server (Windows only), which installs with the plugin.

As this plugin bundles a local MCP server, **it only works in Claude Code, and has been tested only with the Desktop app**.

| Skill | What it does | Uses the River MCP server? 
|-------|--------------|----------------------------
| `river-model-structure` | Reviews, plans and applies a documentation group structure for a River flow, through the River MCP server. | **Yes** 
| `river-translate-excel-to-river` | Convert an existing Excel model into a River model (Excel add-in) living in the same workbook. | **Yes** 
| `river-documentation` | Turns a River documentation export into a user-facing documentation draft (`documentation_draft.md`). | Optional 
| `river-build-dynamic-website` | Turns a River model into a website where results displayed can be dynamically recalculated based on user inputs. | Optional 

## Claude Desktop

Skills are loaded through plugins distributed by the River Solutions Marketplace.

1. In Claude Desktop, open **Customize** and select **Plugins**
2. Click the **Add** button → **Add marketplace**
3. Select **Add from a repository**
4. Paste `https://github.com/river-solutions/river-claude-plugin.git` then select it
5. Make sure **Sync automatically** is toggled on
6. The list of plugin will now show a new plugin called **River**. 
7. Click on **Install for me** to make the plugin available in all your projects. It will inform you that the plugin includes a local MCP server, which is the component that is used to connect to River in Excel.
8. If you want to check the list of skills, click the plugin card.

From this point, the skills are available in Claude Code. They will update automatically when a new version is published.

The River MCP server comes with the plugin, so no separate installation is needed. If you previously installed the River `.mcpb` extension, remove it (Settings → Desktop → Extensions) to avoid running two `river` servers.

## Using the skills

1. Make sure you are in "Claude Code" mode (icon at the top left)
2. Click "+ New" to start a new session
3. If you plan to use the `river-build-dynamic-website` skill, you need to select a working folder, which is where Claude will create your website. Otherwise you don't need to select a folder.
4. Just ask, e.g. *"Is my River model well structured?"* or *"Write the documentation for this River model."* Claude picks the matching skill automatically. You can also use a slash command by typing `/river-` and select the skill you want to use.
