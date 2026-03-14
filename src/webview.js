(function() {
	var currentState = 'inventory';
	var currentResult = null;
	var currentTenResults = null;
	var preloadedGridItems = [];
	var isPreloaded = false;
	var openMode = 'one'; // 'one' or 'ten'
	var recentlyOpenedIds = []; // IDs opened this session; drives "new" badges
	var collectionSortAsc = true;
	var cdnDomain = 'https://raw.githubusercontent.com/A-440Hz/squids/main/';
	var mediaPlaceholder = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="%23999"><rect width="24" height="24" fill="%23f5f5f5"/><text x="12" y="12" text-anchor="middle" dy=".3em" fill="%23999">?</text></svg>';

	// DOM elements
	var elements = {
		count: document.getElementById('lootbox-count'),
		label: document.getElementById('lootbox-label'),
		openOneBtn: document.getElementById('open-one-btn'),
		openTenBtn: document.getElementById('open-ten-btn'),
		inventoryView: document.getElementById('inventory-view'),
		animationContainer: document.getElementById('animation-container'),
		stateWaiting: document.getElementById('state-waiting'),
		stateReady: document.getElementById('state-ready'),
		stateAnimating: document.getElementById('state-animating'),
		stateComplete: document.getElementById('state-complete'),
		waitingTitle: document.getElementById('waiting-title'),
		preloadSpinner: document.getElementById('preload-spinner'),
		readyInstruction: document.getElementById('ready-instruction'),
		collectableImage: document.getElementById('collectable-image'),
		collectableVideo: document.getElementById('collectable-video'),
		colName: document.getElementById('col-name'),
		colRarity: document.getElementById('col-rarity'),
		colQuantity: document.getElementById('col-quantity'),
		backBtn: document.getElementById('back-btn'),
		tenResultsView: document.getElementById('ten-results-view'),
		tenResultsGrid: document.getElementById('ten-results-grid'),
		tenBackBtn: document.getElementById('ten-back-btn'),
		errorMessage: document.getElementById('error-message'),
		collectablesView: document.getElementById('collectables-view'),
		collectablesGrid: document.getElementById('collectables-grid'),
		collectablesBackBtn: document.getElementById('collectables-back-btn'),
		sortOrderBtn: document.getElementById('sort-order-btn'),
		viewCollectionBtn: document.getElementById('view-collection-btn')
	};

	// Initialize - request initial count
	console.log('Webview initializing, sending ready message...');
	webviewApi.postMessage({ message: 'ready' })
		.then(function(response) {
			console.log('Received response from ready:', response);
			if (response && typeof response.count !== 'undefined') {
				updateLootboxCount(response.count);
			}
		})
		.catch(function(err) {
			console.error('Error sending ready message:', err);
		});

	// Handle messages from plugin (fire-and-forget messages)
	webviewApi.onMessage(function(message) {
		console.log('Webview received message:', message);
		switch(message.type) {
			case 'updateCount':
				updateLootboxCount(message.count);
				break;
			case 'openResult':
				handleOpenResult(message.result);
				break;
			case 'error':
				showError(message.error);
				break;
		}
	});

	// Button handlers
	elements.openOneBtn.addEventListener('click', function() {
		elements.openOneBtn.disabled = true;
		elements.openTenBtn.disabled = true;
		elements.errorMessage.style.display = 'none';

		console.log('Sending openOne message...');
		webviewApi.postMessage({ message: 'openOne' })
			.then(function(response) {
				console.log('Received openOne response:', response);
				if (response && response.result) {
					handleOpenResult(response.result);
				} else if (response && response.error) {
					showError(response.error);
				}
			})
			.catch(function(err) {
				console.error('Error opening lootbox:', err);
				showError(err.message || 'Failed to open lootbox');
			});
	});

	elements.openTenBtn.addEventListener('click', function() {
		elements.openOneBtn.disabled = true;
		elements.openTenBtn.disabled = true;
		elements.errorMessage.style.display = 'none';

		console.log('Sending openTen message...');
		webviewApi.postMessage({ message: 'openTen' })
			.then(function(response) {
				console.log('Received openTen response:', response);
				if (response && response.result) {
					handleOpenTenResult(response.result);
				} else if (response && response.error) {
					showError(response.error);
				}
			})
			.catch(function(err) {
				console.error('Error:', err);
				showError(err.message || 'Failed to open lootboxes');
			});
	});

	elements.backBtn.addEventListener('click', function() {
		returnToInventory();
	});

	elements.tenBackBtn.addEventListener('click', function() {
		returnToInventory();
	});

	elements.viewCollectionBtn.addEventListener('click', function() {
		showCollectablesView();
	});

	elements.collectablesBackBtn.addEventListener('click', function() {
		returnToInventory();
	});

	elements.sortOrderBtn.addEventListener('click', function() {
		collectionSortAsc = !collectionSortAsc;
		elements.sortOrderBtn.textContent = collectionSortAsc ? 'ID ↑' : 'ID ↓';
		if (currentState === 'collectables') {
			showCollectablesView();
		}
	});

	// Animation state click handlers
	elements.stateReady.addEventListener('click', function() {
		if (currentState === 'ready' && isPreloaded) {
			startAnimation();
		}
	});

	// Helper functions
	function updateLootboxCount(count) {
		console.log('Updating lootbox count to:', count);
		elements.count.textContent = count;
		elements.label.textContent = count === 1 ? 'Lootbox Available' : 'Lootboxes Available';
		elements.openOneBtn.disabled = count < 1;
		elements.openTenBtn.disabled = count < 10;
	}

	/**
	 * Configures the waiting state text and appearance
	 */
	function configureWaitingState(title) {
		elements.waitingTitle.textContent = title;
	}

	/**
	 * Configures the ready state text and appearance
	 */
	function configureReadyState(instruction) {
		elements.readyInstruction.textContent = instruction;
	}

	function handleOpenResult(result) {
		console.log('Handling open result:', result);
		currentResult = result;
		currentState = 'waiting';
		isPreloaded = false;
		openMode = 'one';

		// Track newly opened ID for "new" badge in collection view
		var col = result && result.col && result.col.Collectable;
		if (col) {
			var newId = getLootboxIdFromFilename(col.Filename);
			if (newId && recentlyOpenedIds.indexOf(newId) === -1) {
				recentlyOpenedIds.push(newId);
			}
		}

		configureWaitingState('Preparing your lootbox...');
		showState('waiting');
		preloadCollectable(result);
	}

	function handleOpenTenResult(results) {
		console.log('Handling open 10 result:', results);
		currentTenResults = results;
		currentState = 'waiting';
		isPreloaded = false;
		openMode = 'ten';

		// Track newly opened IDs for "new" badges in collection view
		if (results) {
			for (var i = 0; i < results.length; i++) {
				var col = results[i] && results[i].col && results[i].col.Collectable;
				if (col) {
					var newId = getLootboxIdFromFilename(col.Filename);
					if (newId && recentlyOpenedIds.indexOf(newId) === -1) {
						recentlyOpenedIds.push(newId);
					}
				}
			}
		}

		configureWaitingState('Preparing your lootboxes...');
		showState('waiting');
		preloadCollectables(results);
	}

	function preloadCollectable(result) {
		var collectable = result.col && result.col.Collectable;

		if (!collectable) {
			markAsReady();
			return;
		}

		elements.preloadSpinner.style.display = 'flex';

		var mediaUrl = cdnDomain + collectable.Filename;

		if (collectable.Type === 'image') {
			var img = new Image();
			img.onload = function() {
				markAsReady();
			};
			img.onerror = function() {
				markAsReady();
			};
			img.src = mediaUrl;
		} else if (collectable.Type === 'media') {
			// Preload video by creating a video element
			var video = document.createElement('video');
			video.preload = 'auto';
			video.muted = true; // Required for autoplay

			video.addEventListener('canplay', function() {
				console.log('Video preloaded successfully');
				markAsReady();
			});

			video.addEventListener('error', function(e) {
				console.error('Video preload error:', e);
				markAsReady();
			});

			video.src = mediaUrl;
			video.load();
		} else {
			// Unknown type, just mark as ready
			markAsReady();
		}
	}

	/**
	 * Preloads media for multiple collectables by pre-creating grid items
	 */
	function preloadCollectables(results) {
		if (!results || results.length === 0) {
			markAsReady();
			return;
		}

		elements.preloadSpinner.style.display = 'flex';
		preloadedGridItems = [];

		var totalItems = results.length;
		var loadedCount = 0;

		function checkAllLoaded() {
			loadedCount++;
			console.log('Preloaded ' + loadedCount + '/' + totalItems + ' collectables');
			if (loadedCount >= totalItems) {
				markAsReady();
			}
		}

		// Create all grid items (which creates and loads media elements)
		for (var i = 0; i < results.length; i++) {
			var result = results[i];
			var collectable = result.col && result.col.Collectable;
			var quantity = result.col && result.col.Quantity;

			if (!collectable) {
				checkAllLoaded();
				continue;
			}

			// Create grid item with media
			var gridItem = createCollectableElement(collectable, quantity, 'grid', true);
			preloadedGridItems.push(gridItem);

			// Find the media element inside and add load handler
			var mediaElement = gridItem.querySelector('img, video');
			if (mediaElement) {
				if (mediaElement.tagName === 'IMG') {
					mediaElement.onload = checkAllLoaded;
					mediaElement.onerror = checkAllLoaded;
				} else if (mediaElement.tagName === 'VIDEO') {
					mediaElement.addEventListener('canplay', checkAllLoaded);
					mediaElement.addEventListener('error', checkAllLoaded);
				}
			} else {
				checkAllLoaded();
			}
		}
	}

	function markAsReady() {
		isPreloaded = true;
		elements.preloadSpinner.style.display = 'none';

		// Only transition to ready state if we're still in waiting state
		// (prevents race condition where slow media loads after user has already proceeded)
		if (currentState === 'waiting') {
			currentState = 'ready';

			// Configure ready state based on mode
			if (openMode === 'one') {
				configureReadyState('Click to open your lootbox');
			} else if (openMode === 'ten') {
				configureReadyState('Click to view your lootboxes');
			}

			showState('ready');
		}
	}

	function startAnimation() {
		if (!isPreloaded) return;

		currentState = 'animating';
		showState('animating');

		setTimeout(function() {
			if (openMode === 'one') {
				displayResult();
			} else if (openMode === 'ten') {
				displayTenResults(currentTenResults);
			}
		}, 600);
	}

	/**
	 * Creates a media element (img or video) for a collectable
	 */
	function createMediaElement(collectable, mediaUrl, useExistingElements) {
		var mediaElement;
		if (collectable.Type === 'image') {
			if (useExistingElements) {
				mediaElement = elements.collectableImage;
				mediaElement.src = mediaUrl;
				mediaElement.onerror = function() {
					mediaElement.src = mediaPlaceholder;
				};
				mediaElement.style.display = 'block';
				elements.collectableVideo.style.display = 'none';
			} else {
				mediaElement = document.createElement('img');
				mediaElement.src = mediaUrl;
				mediaElement.alt = collectable.Name;
				mediaElement.onerror = function() {
					mediaElement.src = mediaPlaceholder;
				};
			}
		} else {
			if (useExistingElements) {
				mediaElement = elements.collectableVideo;
				mediaElement.src = mediaUrl;
				mediaElement.addEventListener('error', function() {
					// On video error, switch to showing placeholder image
					elements.collectableVideo.style.display = 'none';
					elements.collectableImage.src = mediaPlaceholder;
					elements.collectableImage.style.display = 'block';
				});
				mediaElement.style.display = 'block';
				elements.collectableImage.style.display = 'none';
			} else {
				mediaElement = document.createElement('video');
				mediaElement.src = mediaUrl;
				mediaElement.autoplay = true;
				mediaElement.loop = true;
				mediaElement.muted = true;
				mediaElement.setAttribute('playsinline', '');
				// For grid videos that fail, show poster with placeholder
				mediaElement.poster = mediaPlaceholder;
			}
		}
		return mediaElement;
	}

	/**
	 * Creates a collectable display element (grid item or large display)
	 */
	function createCollectableElement(collectable, quantity, displayMode, clickable) {
		var mediaUrl = cdnDomain + collectable.Filename;

		if (displayMode === 'grid') {
			// Grid item (compact)
			var container = document.createElement('div');
			container.className = 'grid-item';

			// Media
			var mediaElement = createMediaElement(collectable, mediaUrl, false);
			container.appendChild(mediaElement);

			// Name
			var nameDiv = document.createElement('div');
			nameDiv.className = 'grid-item-name';
			nameDiv.textContent = formatName(collectable.Name);
			container.appendChild(nameDiv);

			// Rarity
			var rarityDiv = document.createElement('div');
			rarityDiv.className = 'grid-item-rarity ' + getRarityClass(collectable.Value);
			rarityDiv.textContent = getRarityName(collectable.Value);
			container.appendChild(rarityDiv);

			// Add click handler if clickable
			if (clickable) {
				container.style.cursor = 'pointer';
				container.addEventListener('click', function() {
					magnifyCollectable(collectable);
				});
			}

			return container;
		}
		// 'large' mode uses existing DOM elements, so we just update them
		return null;
	}

	function displayResult() {
		if (!currentResult || !currentResult.col) return;
		currentState = 'complete';

		var collectable = currentResult.col.Collectable;
		var quantity = currentResult.col.Quantity;
		var mediaUrl = cdnDomain + collectable.Filename;

		// Update media using existing DOM elements
		var mediaElement = createMediaElement(collectable, mediaUrl, true);
		mediaElement.style.cursor = 'pointer';
		mediaElement.onclick = function() {
			magnifyCollectable(collectable);
		};

		// Update info
		var formattedName = formatName(collectable.Name);
		elements.colName.textContent = formattedName;
		elements.colName.className = getRarityClass(collectable.Value);

		var rarityName = getRarityName(collectable.Value);
		elements.colRarity.textContent = rarityName;
		elements.colRarity.className = getRarityClass(collectable.Value);

		elements.colQuantity.textContent = quantity;
		showState('complete');
	}

	function magnifyCollectable(collectable) {
		console.log('Requesting magnified view for:', collectable.Name);
		webviewApi.postMessage({
			message: 'magnifyCollectable',
			collectable: collectable
		})
		.then(function(response) {
			console.log('Magnify dialog response:', response);
		})
		.catch(function(err) {
			console.error('Error showing magnified view:', err);
		});
	}

	function displayTenResults(results) {
		console.log('Displaying ten results:', results);
		currentState = 'ten-results';

		// Clear the grid
		elements.tenResultsGrid.innerHTML = '';

		// Use preloaded grid items if available, otherwise create them
		if (preloadedGridItems.length > 0) {
			// Append preloaded items
			for (var i = 0; i < preloadedGridItems.length; i++) {
				elements.tenResultsGrid.appendChild(preloadedGridItems[i]);
			}
		} else {
			// Fallback: create items on the fly
			for (var i = 0; i < results.length; i++) {
				var result = results[i];
				var collectable = result.col.Collectable;
				var quantity = result.col.Quantity;
				var gridItem = createCollectableElement(collectable, quantity, 'grid', true);
				elements.tenResultsGrid.appendChild(gridItem);
			}
		}
		showState('ten-results');
	}

	function showState(state) {
		if (state === 'inventory') {
			elements.inventoryView.style.display = 'block';
			elements.animationContainer.style.display = 'none';
			elements.tenResultsView.style.display = 'none';
			elements.collectablesView.style.display = 'none';
			return;
		}

		if (state === 'ten-results') {
			elements.inventoryView.style.display = 'none';
			elements.animationContainer.style.display = 'none';
			elements.tenResultsView.style.display = 'block';
			elements.collectablesView.style.display = 'none';
			return;
		}

		if (state === 'collectables') {
			elements.inventoryView.style.display = 'none';
			elements.animationContainer.style.display = 'none';
			elements.tenResultsView.style.display = 'none';
			elements.collectablesView.style.display = 'block';
			return;
		}

		// most states share common 'single lootbox animation' display settings
		elements.inventoryView.style.display = 'none';
		elements.animationContainer.style.display = 'flex';
		elements.tenResultsView.style.display = 'none';
		elements.collectablesView.style.display = 'none';

		elements.stateWaiting.style.display = 'none';
		elements.stateReady.style.display = 'none';
		elements.stateAnimating.style.display = 'none';
		elements.stateComplete.style.display = 'none';

		if (state === 'waiting') {
			elements.stateWaiting.style.display = 'block';
		} else if (state === 'ready') {
			elements.stateReady.style.display = 'block';
		} else if (state === 'animating') {
			elements.stateAnimating.style.display = 'block';
		} else if (state === 'complete') {
			elements.stateComplete.style.display = 'block';
		}
	}

	function returnToInventory() {
		currentState = 'inventory';
		showState('inventory');
		currentResult = null;

		// Reset media elements
		elements.collectableImage.src = '';
		elements.collectableVideo.src = '';

		console.log('Requesting count refresh...');
		webviewApi.postMessage({ message: 'refreshCount' })
			.then(function(response) {
				console.log('Received refresh response:', response);
				if (response && typeof response.count !== 'undefined') {
					updateLootboxCount(response.count);
				}
			})
			.catch(function(err) {
				console.error('Error refreshing count:', err);
			});
	}

	function showError(error) {
		console.error('Showing error:', error);
		elements.errorMessage.textContent = error;
		elements.errorMessage.style.display = 'block';
		elements.openOneBtn.disabled = false;
		elements.openTenBtn.disabled = false;

		// Re-enable buttons based on count
		var count = parseInt(elements.count.textContent) || 0;
		updateLootboxCount(count);
	}

	function formatName(name) {
		return name.replace(/_/g, ' ')
			.split(' ')
			.map(function(word) {
				return word.charAt(0).toUpperCase() + word.slice(1);
			})
			.join(' ');
	}

	function getRarityName(value) {
		var map = { C: 'Common', B: 'Rare', A: 'Epic', S: 'Legendary' };
		return map[value] || 'Unknown';
	}

	function getRarityClass(value) {
		var map = { C: 'rarity-common', B: 'rarity-rare', A: 'rarity-epic', S: 'rarity-legendary' };
		return map[value] || '';
	}

	function getLootboxIdFromFilename(filename) {
		var match = filename && filename.match(/^(\d+)-/);
		return match ? match[1] : null;
	}

	function createInventoryGridItem(id, collectable, quantity) {
		var container = document.createElement('div');
		container.className = 'grid-item';
		container.style.cursor = 'pointer';

		var mediaUrl = cdnDomain + collectable.Filename;

		// "New" badge - disappears on hover
		if (recentlyOpenedIds.indexOf(id) !== -1) {
			var badge = document.createElement('div');
			badge.className = 'new-badge';
			badge.textContent = 'NEW';
			container.appendChild(badge);

			container.addEventListener('mouseenter', function() {
				var idx = recentlyOpenedIds.indexOf(id);
				if (idx !== -1) {
					recentlyOpenedIds.splice(idx, 1);
				}
				var b = container.querySelector('.new-badge');
				if (b) b.remove();
			});
		}

		// Create media element without autoplay
		var mediaElement;
		if (collectable.Type === 'image') {
			mediaElement = document.createElement('img');
			mediaElement.src = mediaUrl;
			mediaElement.alt = collectable.Name;
			mediaElement.onerror = function() {
				mediaElement.src = mediaPlaceholder;
			};
		} else {
			mediaElement = document.createElement('video');
			mediaElement.src = mediaUrl;
			mediaElement.muted = true;
			mediaElement.loop = true;
			mediaElement.setAttribute('playsinline', '');
			mediaElement.poster = mediaPlaceholder;

			container.addEventListener('mouseenter', function() {
				mediaElement.play().catch(function() {});
			});
			container.addEventListener('mouseleave', function() {
				mediaElement.pause();
				mediaElement.currentTime = 0;
			});
		}
		container.appendChild(mediaElement);

		// Name
		var nameDiv = document.createElement('div');
		nameDiv.className = 'grid-item-name';
		nameDiv.textContent = formatName(collectable.Name);
		container.appendChild(nameDiv);

		// Rarity
		var rarityDiv = document.createElement('div');
		rarityDiv.className = 'grid-item-rarity ' + getRarityClass(collectable.Value);
		rarityDiv.textContent = getRarityName(collectable.Value);
		container.appendChild(rarityDiv);

		// Quantity
		var qtyDiv = document.createElement('div');
		qtyDiv.className = 'grid-item-quantity';
		qtyDiv.textContent = 'x' + quantity;
		container.appendChild(qtyDiv);

		// Click to magnify
		container.addEventListener('click', function() {
			magnifyCollectable(collectable);
		});

		return container;
	}

	function renderCollectablesGrid(inventory, collectablesMap) {
		elements.collectablesGrid.innerHTML = '';

		var ownedItems = [];
		for (var id in inventory) {
			if (!inventory.hasOwnProperty(id)) continue;
			var qty = inventory[id];
			if (qty <= 0) continue;
			var col = collectablesMap[id];
			if (!col) continue;
			ownedItems.push({ id: id, collectable: col, quantity: qty });
		}

		if (ownedItems.length === 0) {
			var emptyMsg = document.createElement('p');
			emptyMsg.style.textAlign = 'center';
			emptyMsg.style.color = 'var(--joplin-color-faded, #666)';
			emptyMsg.textContent = 'No collectables yet. Open some lootboxes!';
			elements.collectablesGrid.appendChild(emptyMsg);
			return;
		}

		ownedItems.sort(function(a, b) {
			var diff = parseInt(a.id, 10) - parseInt(b.id, 10);
			return collectionSortAsc ? diff : -diff;
		});

		for (var i = 0; i < ownedItems.length; i++) {
			var item = ownedItems[i];
			var gridItem = createInventoryGridItem(item.id, item.collectable, item.quantity);
			elements.collectablesGrid.appendChild(gridItem);
		}
	}

	function showCollectablesView() {
		currentState = 'collectables';
		showState('collectables');

		webviewApi.postMessage({ message: 'getInventory' })
			.then(function(response) {
				if (response && response.inventory && response.collectablesMap) {
					renderCollectablesGrid(response.inventory, response.collectablesMap);
				} else {
					elements.collectablesGrid.innerHTML = '<p style="text-align:center; color: var(--joplin-color-faded, #666);">No lootboxes opened yet.</p>';
				}
			})
			.catch(function(err) {
				console.error('Error fetching inventory:', err);
			});
	}
})();
