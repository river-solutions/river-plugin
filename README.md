# River plugin for Claude and Codex

AI skills for working with River models (Excel add-in), plus the River MCP server (Windows only), which installs with the plugin.

As this plugin bundles a local MCP server, **it only works in Claude Code/Codex, and has been tested only with the Desktop apps**.

| Skill | What it does | Uses the River MCP server? 
|-------|--------------|----------------------------
| `river-model-structure` | Reviews, plans and applies a documentation group structure for a River flow, through the River MCP server. | **Yes** 
| `river-build-model` | Guides building or extending a River model with River's patterns, reading the River help through the MCP server. | **Yes** 
| `river-translate-excel-to-river` | Convert an existing Excel model into a River model (Excel add-in) living in the same workbook. | **Yes** 
| `river-documentation` | Turns a River documentation export into a user-facing documentation draft (`documentation_draft.md`). | Optional 
| `river-build-dynamic-website` | Turns a River model into a website where results displayed can be dynamically recalculated based on user inputs. | Optional 

**Note**: the documentation and website-building skills require a Trial or Publisher license to be able to fully export the model.

## Installing the plugin

The River plugin includes the skill files (instructions for the AI tool) as well as the local MCP server, a small local program that connects the AI tool to River. It is distributed by the River Solutions Marketplace, a public Github repository.

**Note**: Anthropic and OpenAI update their desktop apps **extremely frequently**. Expect the instructions below to be temporarily inaccurate as we catch up.

## Claude Desktop


1. In Claude Desktop, open **Customize** and select **Plugins**
2. Click the **Add** button → **Add marketplace**
3. Select **Add from a repository**
4. Paste `https://github.com/river-solutions/river-plugin.git` then select it and click **Sync**
5. Make sure **Sync automatically** is toggled on
6. The list of plugin will now show a new plugin called **River**. 
7. Click on **Add to this computer** to make the plugin available in all your projects. It will inform you that the plugin includes a local MCP server, which is the component that is used to connect to River in Excel. Click **Continue**.
8. If you want to check the list of skills, click the plugin card.

## Codex

In the ChatGPT app:
1. Switch to the Codex mode (top left)
2. click the **Plugins** icon in the left side-bar
3. On the top right click the **Add** button then **Add a marketplace**
4. Paste `https://github.com/river-solutions/river-plugin.git` then click
5. Click **Add marketplace**
6. Once you're back on the plugin list, click the River plugin
7. On the next page, click **Install Plugin** on the top right

## Updating the plugin

From this point, the skills are available in Claude or Codex. They will update automatically when a new version is published.

The MCP connector will check that your version of the plugin is compatible with the version of the Excel Add-In and let you know.

If your version of the Excel Add-in is outdated, fully close Excel and reopen it while online, it will automatically download and install the newest version.

If your version of the plugin is outdated and doesn't update automatically, you can force a refresh. In Claude:
- Go to **Customize** and click on **Plugins**.
- Click the **+ Add** button on the top right and select **Manage marketplaces**
- Click the 3 dots next to **river-solutions** and select **Check for updates**
- Go back to the Plugins screen, select the **River** plugin. You should see a button **Update** on the top right. Click on it to update the plugin. 
- Confirm that the indicated version is the latest.

In Codex
- Click on **Plugins** in the side bar
- Click the **River** plugin, and in the top bar menu select **Marketplace**
- Click the **Upgrade** button next to **river-solutions** marketplace
- After the update, click the **Plugins** in the top menu bar, select **river** and check that the version is current.

## Using the skills

1. Make sure you are in "Claude Code" or "Codex" mode (icon at the top left)
2. Click "+ New" to start a new session
3. If you plan to use the `river-build-dynamic-website` skill, you need to select a working folder, which is where Claude will create your website. Otherwise you don't need to select a folder.
4. Just ask, e.g. *"Is my River model well structured?"* or *"Write the documentation for this River model."* Claude picks the matching skill automatically. You can also use a slash command by typing `/river-` and select the skill you want to use.
