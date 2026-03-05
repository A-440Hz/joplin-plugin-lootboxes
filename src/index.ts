import joplin from 'api';
import { ToolbarButtonLocation } from 'api/types';
import { model, refreshLootboxCount, handleSettingsChange } from './model';
import { registerSettings } from './settings';
import { initCacheMap, openOneLootbox } from './lootbox';
import { verboseLogs } from './util';

joplin.plugins.register({
	onStart: async function() {
		console.info('Todo Lootbox plugin started...');
		await registerSettings();
		console.info('Current number of earned lootboxes: ', await joplin.settings.value(model.numLootboxesEarned));
		// set value to 0 if not set yet
		// update as needed...

		// listen for settings changes to trigger conversion of scorable todos to lootboxes
		await joplin.settings.onChange(handleSettingsChange);

		// initialize internal map of collectables from CDN
		await initCacheMap();

		// handle sync events
		await joplin.workspace.onSyncStart(() => {
			verboseLogs && console.info('Sync start detected');
			// try fetching new CDN map each sync
			initCacheMap();
		});



		await joplin.commands.register({
			name: 'checkValues',
			label: 'Check custom setting values',
			iconName: 'fas fa-music',
			execute: async () => {
				const numLootboxesEarned = await joplin.settings.value(model.numLootboxesEarned);
				const numTodosToEarnLootbox = await joplin.settings.value(model.numTodosToEarnLootbox);
				console.info('Current values (numLootboxesEarned, numTodosToEarnLootbox): ', { numLootboxesEarned, numTodosToEarnLootbox });
			},
		});
		await joplin.views.toolbarButtons.create('checkValuesButton', 'checkValues', ToolbarButtonLocation.NoteToolbar);

		await joplin.commands.register({
			name: 'refreshLootboxCount',
			label: 'Refresh Lootbox Count',
			iconName: 'fas fa-drum',
			execute: async () => {
				await refreshLootboxCount();
				const value = await joplin.settings.value(model.numLootboxesEarned);
				console.info('Current value is: ' + value);
			},
		});
		await joplin.views.toolbarButtons.create('refreshLootboxCountButton', 'refreshLootboxCount', ToolbarButtonLocation.NoteToolbar);

		await joplin.commands.register({
			name: 'showUserLootboxes',
			label: 'Show User Lootboxes',
			iconName: 'fas fa-cubes',
			execute: async () => {
				const value = await joplin.settings.value(model.earnedLootboxesKey);
				console.info('Current inventory: ' + JSON.stringify(value));
				openOneLootbox();
				const updatedValue = await joplin.settings.value(model.earnedLootboxesKey);
				console.info('Updated inventory after opening one lootbox: ' + JSON.stringify(updatedValue));
			},
		});
		await joplin.views.toolbarButtons.create('showUserLootboxesButton', 'showUserLootboxes', ToolbarButtonLocation.NoteToolbar);
	},
});
