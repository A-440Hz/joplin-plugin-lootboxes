import joplin from "api";
import { model } from "./model";
import { verboseLogs, fallbackMap } from "./util";

export const cdnDomain = 'https://raw.githubusercontent.com/A-440Hz/squids/main/'
const mapPath = 'map.json'
let cacheMap: LootboxMap = {};

export interface UserLootboxes {
    [lootboxId: string]: number;
}

export interface LootboxData {
    Name: string;
    Value: string;
    Type: string;
    Filename: string;
}

export interface OpenedLootbox {
    col: {
        Collectable: LootboxData;
        Quantity: number;
    }
}

export interface LootboxMap {
    [lootboxId: string]: LootboxData;
}

/**
 * requestNewMap fetches the map.json file from the CDN and returns it as a LootboxMap object. If any errors occur, an empty object is returned.
*/ 
async function requestNewMap(): Promise<LootboxMap> {
    try {
        const resp = await fetch(cdnDomain + mapPath);
        if (!resp.ok) throw new Error("HTTP error requesting collectables map");
        const data = await resp.json();
        if (!data || typeof data !== 'object'|| Array.isArray(data) || Object.keys(data).length === 0) {
            throw new Error("Invalid or empty JSON response");
        }
        return data as LootboxMap;
    } catch (err) {
        console.error('Error fetching new map from CDN:', err);
        return {};
    }
}

/**
 * initCacheMap is called on startup to populate the cacheMap variable from the CDN or the joplin stored settings object.
 * After this, cacheMap is assumed to be always accurate (it uses the fallback from util.ts if nothing else).
 * This function is also called on joplin sync start, to ensure the map value is fresh
 */
export async function initCacheMap() {
    cacheMap = await updateStorageMap();
}

/**
 * isValidMap checks that an object is a map and has at least one key-value pair.
 */
const isValidMap = (map: any) => map && typeof map === 'object' && !Array.isArray(map) && Object.keys(map).length > 0;

/**
 * updateInternalMap compares the map.json file from the CDN to the current stored map
 * by length, and overwrites accordingly. Returns the most recent map to use for the cache value.
 * sidenote: i don't have any validation functions so just never mess up the formatting :p
 */
async function updateStorageMap(): Promise<LootboxMap> {
    try {
        const newMap = await requestNewMap();
        const currentMap = await joplin.settings.value(model.mapStorageKey) || {};

        if (!isValidMap(newMap)) {
            verboseLogs && console.warn('No valid map fetched from CDN, checking stored map for fallback...');
            if(!isValidMap(currentMap)) {
                verboseLogs && console.warn('No valid map found from stored value, using fallback map.');
                await joplin.settings.setValue(model.mapStorageKey, fallbackMap);
                return fallbackMap;
            }
            return currentMap;
        }
        
        // Update if no existing map or new map has more entries
        if (!isValidMap(currentMap) || Object.keys(newMap).length > Object.keys(currentMap).length) {
            verboseLogs && console.log('Updating internal map with new data from CDN...');
            await joplin.settings.setValue(model.mapStorageKey, newMap);
            return newMap;
        }
        // If new map is not better than current, keep existing map
        verboseLogs && console.log('Current map is up to date, no update needed.');
        return currentMap;
    } catch (err) {
        console.error('Error during map update process:', err);
        // attempt to get the stored map again; otherwise resort to fallback map
        // I am not overwriting the stored map with the fallback here because I don't want to risk losing a valid synced stored map
        // due to a transient error; the fallback will be used in-memory for the cache until the next successful update
        try {
            const currentMap = await joplin.settings.value(model.mapStorageKey) || {};
            if (isValidMap(currentMap)) {
                verboseLogs && console.warn('Error fetching new map, but current stored map is valid. Using stored map as fallback.', err);
                return currentMap;
            }
        } catch (err) {
            console.error('Error retrieving current map from storage after failed update:', err);
        }
        console.warn('No valid map found from CDN or storage, using fallback map.');
        return fallbackMap;
    }
}

function getLootboxByID(id: number): LootboxData {
    const n = Object.keys(cacheMap).length
    if (id > n) {
        throw new Error(`requested lootbox id ${id} exceeds max len ${n} of cache map`)
    }
    const lootbox = cacheMap[id.toString()];
    if (!lootbox) {
        throw new Error(`lootbox with id ${id} not found in cache map`);
    }
    return lootbox;
}

export async function openOneLootbox(): Promise<OpenedLootbox> {
    const n = Object.keys(cacheMap).length
    const randomId = crypto.getRandomValues(new Uint32Array(1))[0] % n + 1;
    let inventory = {} as UserLootboxes;
    let numBoxes = 0;
    try {
        inventory = await joplin.settings.value(model.earnedLootboxesKey) as UserLootboxes;
        numBoxes = await joplin.settings.value(model.numLootboxesEarned) as number;
    } catch (err) {
        // exit early if unable to retrieve current inventory to avoid overwriting a valid inventory with the fallback map in case of an error
        throw new Error('Error retrieving user-earned lootboxes from settings: ' + err);
    }

    // Validate inventory
    if (!inventory || typeof inventory !== 'object') {
        inventory = {};
    }

    if (numBoxes <= 0) {
        throw new Error('No lootboxes available to open. Current number of earned lootboxes: ' + numBoxes);
    }

    const randomIdStr = randomId.toString();
    verboseLogs && console.log(`Opening lootbox with id ${randomId}...`, getLootboxByID(randomId), 'Current inventory before opening:', inventory);
    inventory[randomIdStr] = (inventory[randomIdStr] || 0) + 1; // increment count of this lootbox in inventory
    verboseLogs && console.log('Updated inventory after opening:', inventory);

    const lootboxData = getLootboxByID(randomId);

    try {
        await joplin.settings.setValue(model.earnedLootboxesKey, inventory);
        await joplin.settings.setValue(model.numLootboxesEarned, numBoxes - 1); // decrement available lootboxes by 1
    } catch (err) {
        console.error('Error updating user-earned lootboxes in settings:', err);
    }

    return {
        col: {
            Collectable: lootboxData,
            Quantity: inventory[randomIdStr]
        }
    };
}
