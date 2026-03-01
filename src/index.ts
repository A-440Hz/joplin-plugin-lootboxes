import joplin from 'api';
import { ToolbarButtonLocation } from 'api/types';
import { model, refreshLootboxCount, handleSettingsChange } from './model';
import { registerSettings } from './settings';

joplin.plugins.register({
	onStart: async function() {
		console.info('Todo Lootbox plugin started...');
		await registerSettings();
		console.info('Current number of earned lootboxes: ', await joplin.settings.value(model.numLootboxesEarned));
		// set value to 0 if not set yet
		// update as needed...

		// listen for settings changes to trigger conversion of scorable todos to lootboxes
		await joplin.settings.onChange(handleSettingsChange);

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

	},
});
