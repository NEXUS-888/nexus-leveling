---
name: obsidian-sync-guide
description: Manage integration between local Obsidian vaults and the portfolio web dashboard, including note templates, Markdown exports, and obsidian:// URI shortcuts.
---

# Obsidian Sync Guide Skill

Use this skill when helping the user configure, organize, or sync their local Obsidian vault with the portfolio web application.

## Vault Organization Standard
Recommended folder structure for `Engineering Journey` vault:
- `Daily Logs/`: Raw daily engineering notes and scratchpads.
- `Projects/`: Deep-dive technical case studies and system designs.
- `Decisions/`: Architecture Decision Records (ADRs) explaining tradeoffs.
- `Bugs Fixed/`: Post-mortem notes on tricky bugs and resolution steps.
- `Snippets/`: Reusable commands, scripts, and code blocks.

## Export & Sync Workflow
1. **Raw to Refined**: Use Obsidian for rapid daily note-taking and unformatted thoughts.
2. **Markdown Export**: Use the *Export Markdown for Obsidian* button in `log.html` to generate formatted Markdown notes with YAML tags (`#daily-log`, `#engineering-journey`).
3. **URI Linking**: Use `obsidian://open?vault=<VaultName>&file=<FileName>` links to open specific notes in Obsidian directly from the web browser.
