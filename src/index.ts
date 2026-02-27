import joplin from 'api';
import { ToolbarButtonLocation } from 'api/types';
import { model, refreshLootboxCount, handleNoteChange, handleSettingsChange } from './model';
import { registerSettings } from './settings';

joplin.plugins.register({
	onStart: async function() {
		console.info('Todo Lootbox plugin started...');
		await registerSettings();

		console.info('Current number of earned lootboxes: ', await joplin.settings.value(model.numLootboxesEarned));
		// set value to 0 if not set yet
		// update as needed...

		// listen for every todo change to check when the checkbox value is flipped
		await joplin.workspace.onNoteChange(handleNoteChange);

		// listen for settings changes to trigger conversion of scorable todos to lootboxes
		await joplin.settings.onChange(handleSettingsChange);

		await joplin.commands.register({
			name: 'checkValues',
			label: 'Check custom setting values',
			iconName: 'fas fa-music',
			execute: async () => {
				const numLootboxesEarned = await joplin.settings.value(model.numLootboxesEarned);
				const numScorableTodos = await joplin.settings.value(model.numScorableTodos);
				const numTodosToEarnLootbox = await joplin.settings.value(model.numTodosToEarnLootbox);
				console.info('Current values (numLootboxesEarned, numScorableTodos, numTodosToEarnLootbox): ', { numLootboxesEarned, numScorableTodos, numTodosToEarnLootbox });
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
