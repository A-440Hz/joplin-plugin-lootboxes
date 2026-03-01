import joplin from "api";
import { SettingItemType, SettingStorage } from "api/types";
import { model } from "./model";

export async function registerSettings() {
    await joplin.settings.registerSection(model.SECTION, {
        label: "Todo Lootbox Settings",
        iconName: "fas fa-th", //fa-cubes also looks good
    }).then(() => {
        console.info('Registered settings section: ', model.SECTION);
    });

    await joplin.settings.registerSettings({
        [model.numTodosToEarnLootbox]: {
            value: 1,
            type: SettingItemType.Int,
            section: model.SECTION,
            public: true,
            label: 'Number of Todos to Complete to Earn a Lootbox',
            step: 1,
            minimum: 1,
            storage: SettingStorage.Database,
        },
    }).then(() => {
        console.info('Registered numTodosToEarnLootbox setting: ', joplin.settings.value(model.numTodosToEarnLootbox));
    })

    await joplin.settings.registerSettings({
        [model.numLootboxesEarned]: {
            value: 0,
            type: SettingItemType.Int,
            section: model.SECTION,
            public: false,
            label: 'Number of Lootboxes Earned',
            step: 1,
            minimum: 0,
            storage: SettingStorage.Database, // explicitly persist this value across sessions
        },
    }).then(() => {
        console.info('Registered numLootboxesEarned setting: ', joplin.settings.value(model.numLootboxesEarned));
    })
}
