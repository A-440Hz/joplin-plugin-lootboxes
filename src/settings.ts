import joplin from "api";
import { SettingItemType, SettingStorage } from "api/types";
import { model } from "./model";
import {UserLootboxes} from "./lootbox";
import { fallbackMap } from "./util";

export async function registerSettings() {
    await joplin.settings.registerSection(model.SECTION, {
        label: "Lootboxes",
        iconName: "fas fa-cubes",
    }).then(() => {
        console.info('Registered settings section: ', model.SECTION);
    });

    await joplin.settings.registerSettings({
        [model.numTodosToEarnLootbox]: {
            value: 1,
            type: SettingItemType.Int,
            section: model.SECTION,
            public: true,
            label: 'Number of to-dos to complete to earn a lootbox',
            step: 1,
            minimum: 1,
            storage: SettingStorage.Database,
        },
    }).then(() => {
        console.info('Registered numTodosToEarnLootbox setting: ', joplin.settings.value(model.numTodosToEarnLootbox));
    })

    await joplin.settings.registerSettings({
        [model.showToolbarIcon]: {
            value: true,
            type: SettingItemType.Bool,
            section: model.SECTION,
            public: true,
            label: "Show the 'toggle lootbox panel' button in the toolbar",
            description: '(applies on restart)',
            storage: SettingStorage.Database,
        },
    }).then(() => {
        console.info('Registered showToolbarIcon setting: ', joplin.settings.value(model.showToolbarIcon));
    })

    await joplin.settings.registerSettings({
        [model.panelAlwaysStartsClosed]: {
            value: false,
            type: SettingItemType.Bool,
            section: model.SECTION,
            public: true,
            label: "Always hide lootbox panel when joplin opens",
            description: '(applies on restart)',
            storage: SettingStorage.Database,
        },
    }).then(() => {
        console.info('Registered panelAlwaysStartsClosed setting: ', joplin.settings.value(model.panelAlwaysStartsClosed));
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

    await joplin.settings.registerSettings({
        [model.mapStorageKey]: {
            value: fallbackMap,
            type: SettingItemType.Object,
            section: model.SECTION,
            public: false,
            label: 'Internal Collectables Map',
            storage: SettingStorage.Database, // explicitly persist this value across sessions
        },
    }).then(() => {
        console.info('Registered internal collectables map setting: ', joplin.settings.value(model.mapStorageKey));
    })

    await joplin.settings.registerSettings({
        [model.earnedLootboxesKey]: {
            value: {} as UserLootboxes,
            type: SettingItemType.Object,
            section: model.SECTION,
            public: false,
            label: 'User-Earned Lootboxes',
            storage: SettingStorage.Database, // explicitly persist this value across sessions
        },
    }).then(() => {
        console.info('Registered user-earned lootboxes setting: ', joplin.settings.value(model.earnedLootboxesKey));
    })
}
