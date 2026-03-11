(function() {
	var currentState = 'inventory';
	var currentResult = null;
	var isPreloaded = false;

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
		preloadSpinner: document.getElementById('preload-spinner'),
		collectableImage: document.getElementById('collectable-image'),
		collectableVideo: document.getElementById('collectable-video'),
		colName: document.getElementById('col-name'),
		colRarity: document.getElementById('col-rarity'),
		colQuantity: document.getElementById('col-quantity'),
		backBtn: document.getElementById('back-btn'),
		errorMessage: document.getElementById('error-message')
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
				if (response && response.error) {
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

	function handleOpenResult(result) {
		console.log('Handling open result:', result);
		currentResult = result;
		currentState = 'waiting';
		isPreloaded = false;

		showState('waiting');
		preloadCollectable(result);
	}

	function preloadCollectable(result) {
		var collectable = result.col && result.col.Collectable;

		if (!collectable) {
			markAsReady();
			return;
		}

		elements.preloadSpinner.style.display = 'flex';

		var cdnUrl = 'https://raw.githubusercontent.com/A-440Hz/squids/main/';
		var mediaUrl = cdnUrl + collectable.Filename;

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

	function markAsReady() {
		isPreloaded = true;
		elements.preloadSpinner.style.display = 'none';
		currentState = 'ready';
		showState('ready');
	}

	function startAnimation() {
		if (!isPreloaded) return;

		currentState = 'animating';
		showState('animating');

		setTimeout(function() {
			currentState = 'complete';
			displayResult();
			showState('complete');
		}, 600);
	}

	function displayResult() {
		if (!currentResult || !currentResult.col) return;

		var collectable = currentResult.col.Collectable;
		var quantity = currentResult.col.Quantity;

		var cdnUrl = 'https://raw.githubusercontent.com/A-440Hz/squids/main/';
		var mediaUrl = cdnUrl + collectable.Filename;

		// Show appropriate media type and add click handler for magnification
		if (collectable.Type === 'image') {
			elements.collectableImage.src = mediaUrl;
			elements.collectableImage.style.display = 'block';
			elements.collectableImage.style.cursor = 'pointer';
			elements.collectableVideo.style.display = 'none';

			// Remove old listener if any, then add new one
			elements.collectableImage.onclick = function() {
				magnifyCollectable(collectable);
			};
		} else {
			elements.collectableVideo.src = mediaUrl;
			elements.collectableVideo.style.display = 'block';
			elements.collectableVideo.style.cursor = 'pointer';
			elements.collectableImage.style.display = 'none';

			// Remove old listener if any, then add new one
			elements.collectableVideo.onclick = function() {
				magnifyCollectable(collectable);
			};
		}

		// Update info
		var formattedName = formatName(collectable.Name);
		elements.colName.textContent = formattedName;
		elements.colName.className = getRarityClass(collectable.Value);

		var rarityName = getRarityName(collectable.Value);
		elements.colRarity.textContent = rarityName;
		elements.colRarity.className = getRarityClass(collectable.Value);

		elements.colQuantity.textContent = quantity;
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

	function showState(state) {
		if (state === 'inventory') {
			elements.inventoryView.style.display = 'block';
			elements.animationContainer.style.display = 'none';
			return;
		}

		elements.inventoryView.style.display = 'none';
		elements.animationContainer.style.display = 'flex';

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
})();
