# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Joplin plugin that gamifies todo completion by rewarding users with collectible "lootboxes" containing squid images/videos. Users earn lootboxes by completing todo notes, which they can then open to receive random collectibles.

### Development History

Claude (claude.ai/code) was primarily used to translate React code from a separate project (haotianswebsite.com) into a format suitable for Joplin panels. The original React components in `/reference` (possibly removed from the main branch) were adapted to vanilla JavaScript/HTML/CSS using Joplin's webview API, since Joplin plugins don't support React. This translation involved:
- Converting React components to vanilla JS with DOM manipulation
- Replacing React hooks (useState, useEffect) with plain JavaScript state management
- Adapting Tailwind CSS to Joplin's CSS variables for theme compatibility
- Implementing message-passing architecture between plugin and webview
- Adding proper preloading for images and videos

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

**Backend (TypeScript):**
- **src/index.ts** - Plugin entry point. Registers settings, commands, toolbar buttons, panel, and event handlers
- **src/model.ts** - Core scoring and attribution logic:
  - `refreshLootboxCount()` - Queries completed todos, attributes them, awards lootboxes
  - `getAttributedTagId()` - Manages the "lootbox:attributed" tag for tracking scored todos
  - `handleSettingsChange()` - Triggers refresh when conversion rate changes
- **src/settings.ts** - Registers plugin settings in Joplin's settings UI
- **src/lootbox.ts** - Collectable map management and lootbox opening:
  - `initCacheMap()` - Fetches map.json from CDN or uses cached/fallback version
  - `openOneLootbox()` - Returns opened lootbox data with collectable and quantity
  - `openTenLootboxes()` - Opens 10 lootboxes sequentially, returns array of results
  - Exports `OpenedLootbox` interface and `cdnDomain` constant for type safety
- **src/panel.ts** - Panel setup and message handler:
  - `createLootboxPanel()` - Creates panel, loads HTML/CSS/JS, registers message handler
  - `updateLootboxPanelCount()` - Sends count updates to webview
  - `setupLootboxMessageHandler()` - Handles messages from webview (ready, openOne, openTen, refreshCount, magnifyCollectable)
  - `showMagnifiedDialog()` - Creates Joplin dialog with full-size collectable image/video
- **src/util.ts** - Utilities and fallback collectable map

**Frontend (Webview):**
- **src/webview.js** - Vanilla JavaScript for panel UI logic:
  - State management (inventory, waiting, ready, animating, complete, ten-results)
  - Unified `createCollectableElement()` function for creating grid items and large displays
  - DOM manipulation and event handlers
  - Message passing with plugin via `webviewApi.postMessage()`
  - Image/video preloading with progress indicators and fallback placeholders
  - Animation sequences (600ms transitions)
  - Magnified dialog view (clicks media to open full-size in Joplin dialog)
- **src/webview.css** - All panel styles using Joplin CSS variables for theme compatibility
  - Responsive grid breakpoints (3/4/5 columns based on width)
  - Flexbox layout for centered incomplete rows
  - CSS variable `--panel-min-width` for consistent sizing

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
- `earnedLootboxesKey` (private) - User inventory: `{ "1": 3, "2": 1, "5": 2 }` (lootbox ID → quantity owned)
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
- Non-TS files (CSS, JS) in /src are copied to /dist
- External scripts loaded via `joplin.views.panels.addScript()`
- Reference files excluded from compilation (webpack.config.js line 184)

### Panel Architecture

The panel uses a message-passing architecture between plugin and webview:

**Plugin → Webview (fire-and-forget):**
```typescript
joplin.views.panels.postMessage(handle, { type: 'updateCount', count: 5 });
```

**Webview → Plugin (request-response):**
```javascript
const response = await webviewApi.postMessage({ message: 'openOne' });
// response = { result: { col: { Collectable, Quantity } } }
```

**Message Handler:**
```typescript
joplin.views.panels.onMessage(handle, async (message) => {
  if (message.message === 'openOne') {
    const result = await openOneLootbox();
    return { result }; // Response sent back to webview
  }
});
```

**UI State Flow (Open 1):**
1. User clicks "Open 1" → webview sends `{message: 'openOne'}`
2. Plugin calls `openOneLootbox()` → returns lootbox data
3. Plugin returns `{result: {...}}` → webview receives response
4. Webview shows "waiting" state → preloads media
5. When loaded → progresses to "ready" state (clickable)
6. User clicks → "animating" state (600ms)
7. → "complete" state (shows collectable details)
8. Click media → opens magnified dialog with full-size image/video

**UI State Flow (Open 10):**
1. User clicks "Open 10" → webview sends `{message: 'openTen'}`
2. Plugin calls `openTenLootboxes()` → opens 10 sequentially
3. Plugin returns `{result: [array of 10 results]}` → webview receives response
4. Webview shows "waiting" state with spinner → preloads all media
5. Pre-creates all grid items using `createCollectableElement()`
6. When all loaded → progresses to "ready" state (clickable)
7. User clicks → "ten-results" state (shows 5×2 grid of collectables)
8. Click any grid item → opens magnified dialog

### Current Branch: hz-panel-layout
This branch implements the panel UI for viewing and opening lootboxes. Both the scoring/attribution system and panel display are complete and functional.

### Important Implementation Patterns

**Unified Element Creation:**
- `createCollectableElement(collectable, quantity, 'grid', clickable)` creates both grid items and large displays
- `createMediaElement(collectable, mediaUrl, useExistingElements)` handles img/video creation with error fallbacks
- Reusing these functions prevents code duplication and ensures consistent behavior

**Preloading Strategy:**
- Single lootbox: Preloads one image/video, shows spinner until ready
- Ten lootboxes: Pre-creates all grid items (which creates media elements), tracks when all load
- **Critical:** `markAsReady()` checks `currentState === 'waiting'` before transitioning to prevent race conditions where late-loading media regresses the state after user has already proceeded

**State Management Gotchas:**
- States are dynamically configured (`configureWaitingState()`, `configureReadyState()`) to reuse HTML elements for both "open 1" and "open 10" flows
- `openMode` variable tracks which flow is active ('one' or 'ten')
- Always check current state before transitioning to prevent stale event handlers from overriding

**Media Error Handling:**
- Images: `onerror` sets `src` to SVG placeholder with "?" icon
- Videos (grid): `poster` attribute shows placeholder before/during load
- Videos (large display): On error, hides video and shows placeholder image instead

**CSS Responsive Grid:**
- Uses Flexbox instead of CSS Grid to center incomplete rows
- `flex: 0 0 calc((100% - gaps) / columns)` for precise column widths
- Breakpoints: 3 columns (≤500px), 4 columns (501-700px), 5 columns (≥701px)

## Common Tasks

### Adding a New Setting
1. Add setting key to `model` namespace in src/model.ts
2. Register in `registerSettings()` in src/settings.ts
3. Update `handleSettingsChange()` if the setting requires reactive behavior

### Testing the Plugin

**Toolbar Buttons (registered in src/index.ts):**
- "Check custom setting values" - Logs current settings to console
- "Refresh Lootbox Count" - Manually triggers the scoring refresh and updates panel
- "Toggle Lootbox Panel" - Shows/hides the lootbox panel

**Panel Testing:**
1. Complete some todo notes in Joplin
2. Click "Refresh Lootbox Count" to earn lootboxes
3. Open the panel (View > Change application layout)
4. **Test "Open 1":**
   - Click "Open 1" to open a lootbox
   - Watch the animation: waiting → ready → animating → complete
   - Click the collectable image/video to open magnified view
   - Click "Open More Lootboxes" to return to inventory
5. **Test "Open 10"** (requires 10+ lootboxes):
   - Click "Open 10" to open ten lootboxes
   - Watch: waiting (with spinner) → ready → ten-results grid (5×2 layout)
   - Click any grid item to open magnified view
   - Click "Open More Lootboxes" to return to inventory

### Debugging
- Enable verbose logging by setting `verboseLogs = true` in src/util.ts
- Check Joplin's developer console (Help > Toggle Development Tools)
- Use `console.info()` and `console.error()` for logging
- Panel logs appear in the console with prefixes:
  - "Plugin received message:" - Message handler in panel.ts
  - "Webview received message:" - Webview receiving fire-and-forget messages
  - "Sending openOne message..." - Webview sending request to plugin
  - "Video preloaded successfully" - Media preload completion
  - "Preloaded X/10 collectables" - Multi-lootbox preload progress

**Common Issues:**
- **State regressing unexpectedly:** Check if late-loading media handlers are calling `markAsReady()` after user has already proceeded. Solution: `markAsReady()` should check `currentState === 'waiting'`
- **"Open 10" shows wrong state:** Ensure `startAnimation()` doesn't have logic for both 'one' and 'ten' modes, or use `openMode` to branch correctly
- **Panel width changing:** All views should use consistent `min-width` (check CSS variable or hardcoded values)
- **Media not loading:** Check CDN URL, test with placeholder fallback, verify `onerror` handlers are attached

## Plugin Distribution

The plugin is published to npm as "joplin-plugin-lootboxes" and auto-discovered by Joplin's plugin repository:
- Package name must start with "joplin-plugin-"
- Keywords must include "joplin-plugin"
- /publish directory must contain .jpl and .json files
