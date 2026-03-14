import joplin from 'api';
import { ToolbarButtonLocation } from 'api/types';
import { model, refreshLootboxCount, handleSettingsChange } from './model';
import { registerSettings } from './settings';
import { initCacheMap, openOneLootbox } from './lootbox';
import { verboseLogs } from './util';
import { createLootboxPanel, updateLootboxPanelCount } from './panel';

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

		// create lootbox panel
		const lootboxPanelHandle = await createLootboxPanel();

		// handle sync events
		await joplin.workspace.onSyncStart(() => {
			verboseLogs && console.info('Sync start detected');
			// try fetching new CDN map each sync
			initCacheMap();
		});

		await joplin.commands.register({
			name: 'toggleLootboxPanel',
			label: 'Toggle Lootbox Panel',
			iconName: 'fas fa-cubes',
			execute: async () => {
				const isOpen = (await joplin.views.panels.visible(lootboxPanelHandle)).valueOf()
				await refreshLootboxCount()
				await updateLootboxPanelCount()
				verboseLogs && console.log("count: ", await joplin.settings.value(model.numLootboxesEarned))
				await joplin.views.panels.show(lootboxPanelHandle, !isOpen);				
			},
		});
		await joplin.views.toolbarButtons.create('toggleLootboxPanelButton', 'toggleLootboxPanel', ToolbarButtonLocation.NoteToolbar);
	},
});
