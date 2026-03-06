# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Joplin plugin that gamifies todo completion by rewarding users with collectible "lootboxes" containing squid images/videos. Users earn lootboxes by completing todo notes, which they can then open to receive random collectibles.

## Build Commands

- `npm run dist` - Build the plugin (.jpl archive and .json manifest in /publish)
- `npm run updateVersion` - Bump the patch version in both package.json and manifest.json
- `npm run update` - Update the Joplin plugin framework via yeoman generator

To test the plugin in Joplin:
1. Build with `npm run dist`
2. In Joplin, go to Settings > Plugins > Install from file
3. Select the .jpl file from the /publish directory

## Architecture

### Core Files

- **src/index.ts** - Plugin entry point. Registers settings, commands, toolbar buttons, and event handlers (sync, settings changes)
- **src/model.ts** - Core scoring and attribution logic:
  - `refreshLootboxCount()` - Queries completed todos, attributes them, awards lootboxes
  - `getAttributedTagId()` - Manages the "lootbox:attributed" tag for tracking scored todos
  - `handleSettingsChange()` - Triggers refresh when conversion rate changes
- **src/settings.ts** - Registers plugin settings in Joplin's settings UI
- **src/lootbox.ts** - Collectable map management and lootbox opening:
  - `initCacheMap()` - Fetches map.json from CDN or uses cached/fallback version
  - `openOneLootbox()` - Converts one unopened lootbox into an opened one
- **src/panel.ts** - Panel UI (currently empty, work in progress)
- **src/util.ts** - Utilities and fallback collectable map

### Attribution System

The plugin uses a tag-based attribution system to track which completed todos have been scored:
- Completed todos without the "lootbox:attributed" tag are "scorable"
- When enough scorable todos accumulate to earn lootbox(es), they are tagged with "lootbox:attributed"
- This prevents double-counting while allowing the user to complete more todos for future lootboxes
- Uses pagination to query all scorable todos (50 per page)

### CDN Integration

- Fetches collectable data from: `https://raw.githubusercontent.com/A-440Hz/squids/main/map.json`
- Map structure: `{ "1": { "Name": "tiny_squid", "Value": "C", "Type": "image", "Filename": "1-tiny_squid-C.jpg" }, ... }`
- Rarity tiers: C (Common), B (Rare), A (Epic), S (Legendary)
- Falls back to hardcoded map in src/util.ts if CDN fetch fails
- Map is cached in Joplin settings and refreshed on sync start

### Settings Storage

Settings are stored in Joplin's database:
- `numTodosToEarnLootbox` (public, default: 1) - Conversion rate
- `numLootboxesEarned` (private) - Current lootbox count
- `collectablesMap` (private) - Cached collectable data from CDN

## Reference Files (Do Not Modify)

The `/reference` folder contains React components from a separate web application. These files:
- Are NOT part of the Joplin plugin codebase
- Are explicitly excluded from webpack compilation (see webpack.config.js line 184)
- Serve as reference for the target UI/UX that should be adapted to Joplin's plugin API
- Should NOT be imported or used directly in the plugin code

When implementing UI features, use these as visual/UX reference but implement using Joplin's API:
- Panels: `joplin.views.panels`
- Dialogs: `joplin.views.dialogs`
- Webviews with HTML/CSS (not React)

## Development Notes

### Joplin Plugin API
- API types are in `/api` (auto-generated, do not modify)
- Plugins run in Node.js/Electron environment, not a browser
- No React - use vanilla JS/HTML/CSS for UI
- Access Joplin data via `joplin.data` and `joplin.workspace` APIs

### Webpack Configuration
- Main entry: src/index.ts
- TypeScript compiled to JavaScript in /dist
- Non-TS files in /src are copied to /dist
- Extra scripts can be defined in plugin.config.json (currently empty)

### Current Branch: hz-panel-layout
This branch is implementing the panel UI for viewing and opening lootboxes. The scoring/attribution system is complete, but the panel display is not yet implemented.

## Common Tasks

### Adding a New Setting
1. Add setting key to `model` namespace in src/model.ts
2. Register in `registerSettings()` in src/settings.ts
3. Update `handleSettingsChange()` if the setting requires reactive behavior

### Testing the Attribution System
Use the toolbar buttons registered in src/index.ts:
- "Check custom setting values" - Logs current settings to console
- "Refresh Lootbox Count" - Manually triggers the scoring refresh

### Debugging
- Enable verbose logging by setting `verboseLogs = true` in src/util.ts
- Check Joplin's developer console (Help > Toggle Development Tools)
- Use `console.info()` and `console.error()` for logging

## Plugin Distribution

The plugin is published to npm as "joplin-plugin-lootboxes" and auto-discovered by Joplin's plugin repository:
- Package name must start with "joplin-plugin-"
- Keywords must include "joplin-plugin"
- /publish directory must contain .jpl and .json files
