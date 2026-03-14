import joplin from 'api';
import { ViewHandle } from 'api/types';
import { openOneLootbox, openTenLootboxes, LootboxData, cdnDomain } from './lootbox';
import { model } from './model';
import { verboseLogs } from './util';

let lootboxPanelHandle: ViewHandle;

export async function createLootboxPanel(): Promise<ViewHandle> {
	lootboxPanelHandle = await joplin.views.panels.create('lootboxPanel');
	console.log("createLootboxPanel started");

	setupLootboxMessageHandler();
	console.log("setupMessageHandler registered");

	// Set HTML content
	await joplin.views.panels.setHtml(lootboxPanelHandle, getLootboxHtmlContent());
	console.log("HTML content set");

	// Add external CSS and JS files
	await joplin.views.panels.addScript(lootboxPanelHandle, './webview.css');
	console.log("Webview CSS added");
	await joplin.views.panels.addScript(lootboxPanelHandle, './webview.js');
	console.log("Webview JS added");

	return lootboxPanelHandle;
}

export async function updateLootboxPanelCount(): Promise<void> {
	if (!lootboxPanelHandle) return;
	verboseLogs && console.log("updatePanelCount triggered");
	const count = await joplin.settings.value(model.numLootboxesEarned);
	// Send fire-and-forget message to webview
	joplin.views.panels.postMessage(lootboxPanelHandle, {
		type: 'updateCount',
		count: count
	});
}

function getLootboxHtmlContent(): string {
	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
	${getLootboxHtmlBody()}
</body>
</html>
	`;
}

// CSS now in external file: webview.css

function getLootboxHtmlBody(): string {
	return `
		<div id="lootbox-container">
			<!-- Inventory View -->
			<div id="inventory-view">
				<div class="lootbox-header">
					<h2 id="lootbox-count">0</h2>
					<p id="lootbox-label">Lootboxes Available</p>
				</div>
				<div class="lootbox-buttons">
					<button id="open-one-btn" disabled>Open 1</button>
					<button id="open-ten-btn" disabled>Open 10</button>
					<button id="view-collection-btn">View Collection</button>
				</div>
				<div id="error-message"></div>
			</div>

			<!-- Animation Container (hidden by default) -->
			<div id="animation-container" style="display: none;">
				<!-- Waiting State (loading/preloading) -->
				<div id="state-waiting" class="animation-state">
					<h3 id="waiting-title">Preparing your lootbox...</h3>
					<div id="waiting-emoji" class="lootbox-emoji">📦</div>
					<div id="preload-spinner" style="display: none;">
						<div class="spinner"></div>
					</div>
				</div>

				<!-- Ready State (click to proceed) -->
				<div id="state-ready" class="animation-state" style="display: none;">
					<h3 id="ready-title">Ready to Open!</h3>
					<div id="ready-emoji" class="lootbox-emoji">📦</div>
					<p id="ready-instruction">Click to open your lootbox</p>
				</div>

				<!-- Animating State -->
				<div id="state-animating" class="animation-state" style="display: none;">
					<h3>Opening...</h3>
					<div class="lootbox-emoji">📦</div>
					<div class="spinner"></div>
				</div>

				<!-- Complete State -->
				<div id="state-complete" class="animation-state" style="display: none;">
					<h3>Lootbox Opened!</h3>
					<div id="collectable-display">
						<img id="collectable-image" style="display: none;" />
						<video id="collectable-video" style="display: none;" autoplay loop muted playsinline></video>
					</div>
					<div id="collectable-info">
						<p><strong>Name:</strong> <span id="col-name"></span></p>
						<p><strong>Rarity:</strong> <span id="col-rarity"></span></p>
						<p><strong>Number Owned:</strong> <span id="col-quantity"></span></p>
					</div>
					<button id="back-btn">Open More Lootboxes</button>
				</div>
			</div>

			<!-- Ten Results View (hidden by default) -->
			<div id="ten-results-view" style="display: none;">
				<h3>You Opened 10 Lootboxes!</h3>
				<div id="ten-results-grid">
					<!-- Grid items will be populated by JavaScript -->
				</div>
				<button id="ten-back-btn">Open More Lootboxes</button>
			</div>

			<!-- Collectables Inventory View (hidden by default) -->
			<div id="collectables-view" style="display: none;">
				<div class="collectables-header">
					<button id="collectables-back-btn">← Back</button>
					<h3>Opened Lootboxes</h3>
					<button id="sort-order-btn" title="Toggle sort order">ID ↑</button>
				</div>
				<div id="collectables-grid"></div>
			</div>
		</div>
	`;
}

function setupLootboxMessageHandler(): void {
	// Handler receives messages from webview and returns responses
	joplin.views.panels.onMessage(lootboxPanelHandle, async (message: any) => {
		console.log("Plugin received message:", message);

		try {
			// Use .message property for mobile compatibility
			switch(message.message) {
				case 'ready':
					verboseLogs && console.log("Handling 'ready' message");
					const count = await joplin.settings.value(model.numLootboxesEarned);
					// Return response to webview's postMessage
					return { count: count };

				case 'openOne':
					verboseLogs && console.log("Handling 'openOne' message");
					try {
						const result = await openOneLootbox();
						return { result: result };
					} catch (err) {
						return { error: err.message || 'Failed to open lootbox' };
					}

				case 'openTen':
					verboseLogs && console.log("Handling 'openTen' message");
					try {
						const result = await openTenLootboxes();
						return { result: result};
					} catch (err) {
						return { error: err.message || 'Failed to open lootbox' };
					}

				case 'refreshCount':
					verboseLogs && console.log("Handling 'refreshCount' message");
					const newCount = await joplin.settings.value(model.numLootboxesEarned);
					return { count: newCount };

				case 'magnifyCollectable':
					verboseLogs && console.log("Handling 'magnifyCollectable' message");
					await showMagnifiedDialog(message.collectable);
					return { success: true };

				case 'getInventory':
					verboseLogs && console.log("Handling 'getInventory' message");
					try {
						const inventoryData = await joplin.settings.value(model.earnedLootboxesKey);
						const collectablesMapData = await joplin.settings.value(model.mapStorageKey);
						return { inventory: inventoryData || {}, collectablesMap: collectablesMapData || {} };
					} catch (err) {
						return { error: err.message || 'Failed to retrieve inventory' };
					}

			default:
					console.warn("Unknown message type:", message.message);
					return { error: 'Unknown message type' };
			}
		} catch (err) {
			console.error('Error handling panel message:', err);
			return { error: err.message || 'Internal error' };
		}
	});
}

async function showMagnifiedDialog(collectable: LootboxData): Promise<void> {
	// Generate unique ID for each dialog invocation (dialogs persist after closing and cannot be reopened)
	const randomId = Math.random().toString(36).substring(2, 15);
	const dialogHandle = await joplin.views.dialogs.create('magnifiedCollectable_' + randomId);

	const mediaUrl = cdnDomain + collectable.Filename;

	// Format name: "tiny_squid" → "Tiny Squid"
	const formattedName = collectable.Name.replace(/_/g, ' ')
		.split(' ')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');

	// Determine rarity name and CSS class
	const rarityNameMap: { [key: string]: string } = {
		'C': 'Common',
		'B': 'Rare',
		'A': 'Epic',
		'S': 'Legendary'
	};
	const rarityName = rarityNameMap[collectable.Value] || 'Unknown';
	const rarityClassMap: { [key: string]: string } = {
		'C': 'rarity-common',
		'B': 'rarity-rare',
		'A': 'rarity-epic',
		'S': 'rarity-legendary'
	};
	const rarityClass = rarityClassMap[collectable.Value] || '';

	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<style onload=\"document.getElementById('autofocus-target').focus()\" src=\"#\">
				body {
					margin: 0;
					padding: 0;
					background: #000;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					min-height: 400px;
					cursor: pointer;
				}
				.dialog-container {
					text-align: center;
					padding: 20px;
					max-width: 90vw;
				}
				h2 {
					color: white;
					font-size: 32px;
					margin: 0 0 10px 0;
					font-weight: bold;
				}
				.rarity {
					font-size: 18px;
					font-weight: bold;
					margin-bottom: 20px;
				}
				img, video {
					/* Show natural size for magnified view */
					max-width: 85vw;
					max-height: 80vh;
					width: auto;
					height: auto;
					border-radius: 12px;
					box-shadow: 0 0 30px rgba(245, 158, 11, 0.6);
					border: 4px solid #f59e0b;
				}
			</style>
		</head>
		<body>
		<div class="dialog-container" id="dialog-content" style="pointer-events: none;">
		<h2>${formattedName}</h2>
		<p class="rarity ${rarityClass}">${rarityName}</p>
		${collectable.Type === 'image'
			? `<img src="${mediaUrl}" alt="${formattedName}" />`
			: `<video src="${mediaUrl}" autoplay loop muted playsinline></video>`
		}
		</div>
		</body>
		</html>
		`;
	// workaround for dialog focus issue: from https://github.com/alondmnt/plugin-templates/blob/master/src/utils/dialogHelpers.ts

	await joplin.views.dialogs.setHtml(dialogHandle, html);

	// Load shared CSS file for rarity colors
	await joplin.views.dialogs.addScript(dialogHandle, './webview.css');

	// Disable fit-to-content so dialog uses full 90vw × 80vh
	await joplin.views.dialogs.setFitToContent(dialogHandle, false);

	await joplin.views.dialogs.setButtons(dialogHandle, [
		{ id: 'close', title: 'Close' }
	]);

	await joplin.views.dialogs.open(dialogHandle);
}
