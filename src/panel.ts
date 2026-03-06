import joplin from 'api';
import { ViewHandle } from 'api/types';
import { openOneLootbox } from './lootbox';
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
				</div>
				<div id="error-message"></div>
			</div>

			<!-- Animation Container (hidden by default) -->
			<div id="animation-container" style="display: none;">
				<!-- Waiting State -->
				<div id="state-waiting" class="animation-state">
					<h3>Preparing your lootbox...</h3>
					<div class="lootbox-emoji">📦</div>
					<div id="preload-spinner" style="display: none;">
						<div class="spinner"></div>
					</div>
				</div>

				<!-- Ready State -->
				<div id="state-ready" class="animation-state" style="display: none;">
					<h3>Ready to Open!</h3>
					<div class="lootbox-emoji">📦</div>
					<p>Click to open your lootbox</p>
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
					return { error: 'Opening 10 lootboxes is not yet implemented' };

				case 'refreshCount':
					verboseLogs && console.log("Handling 'refreshCount' message");
					const newCount = await joplin.settings.value(model.numLootboxesEarned);
					return { count: newCount };

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
