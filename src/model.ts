import joplin from "api";
import { verboseLogs } from "./util";

export namespace model {
    export const SECTION = 'TodoLootboxSettings';
    export const numTodosToEarnLootbox = 'numTodosToEarnLootbox';
    export const numLootboxesEarned = 'numLootboxesEarned';
    export const mapStorageKey = 'collectablesMap'
    export const earnedLootboxesKey = 'earnedLootboxes';
}
const attributedKey = 'lootbox:attributed';

export async function handleSettingsChange(event: any): Promise<void> {
    const watchedSettings = new Set([model.numTodosToEarnLootbox]);
    if (!event.keys.some((k: string) => watchedSettings.has(k))) return;
    // when the conversion rate changes, refresh lootbox count to check if any new lootboxes can be earned
    if (event.keys.includes(model.numTodosToEarnLootbox)) {
        console.info('Number of todos to earn lootbox changed', await joplin.settings.value(model.numTodosToEarnLootbox));
        try {
            await refreshLootboxCount();
        } catch (error) {
            console.error('Error handling settings change: ', error);
        }
    }
}

/**
 * getAttributedTagId finds the tag with title `attributedKey` or creates a new one. Calling this function asynchronously in practice leads to the creation of multiple tags with different ids.
 */
export async function getAttributedTagId(): Promise<string> {
    // pattern from: https://github.com/TheScriptingGuy/Joplin-Repeating-Todos-Plugin/blob/1d75241af3b0d89f8be2e6e58e9be5c16c8a50d1/src/core/database.ts#L82
    const allTags = await joplin.data.get(['tags'], { fields: ['id', 'title'] });
    const foundTag = (allTags?.items || []).find((tag:any) => tag.title === attributedKey);
    if (foundTag) return foundTag.id;

    const newTag = await joplin.data.post(['tags'], null, { title: attributedKey });
    return newTag.id;
}

/**
 * markTodoAttributed is expected to be called asynchronously to attach the Attributed tag to a todo note after it has been counted towards earning a lootbox
 */
async function markTodoAttributed(noteId: string, tagId: string): Promise<void> {
    if (!noteId) {
        throw new Error('markTodoAttributed called without a noteId');
    }
    await joplin.data.post(['tags', tagId, 'notes'], null, { id: noteId });
}

/**
 * getScorableTodos request all completed todo notes without the Attributed tag
 */
async function getScorableTodos(page:number): Promise<any> {
	const query = `type:todo iscompleted:1 -tag:"${attributedKey}"`;
	verboseLogs && console.log('Running search query for scorable todos:', query);
	try {
        const resp = await joplin.data.get(['search'], {
            query,
            fields: "id, created_time, title",
            order_by: 'created_time',
            order_dir: 'ASC', // attribute oldest notes first 
            limit: 50, // TODO: keep this value in mind if problems arise later
            page: page,
        });
        return resp;
    } catch (error) {
        console.error('Error fetching scorable todos:', error);
        throw error;
    }
}

/**
 * getXScorableTodos returns X scorable todo notes without pagination
 * returns all notes if X == 0
 * structure borrowed from: https://github.com/TheScriptingGuy/Joplin-Repeating-Todos-Plugin/blob/main/src/core/joplin.ts#L22
 */
async function getXScorableTodos(X: number=0): Promise<any[]> {
    const allNotes: any[] = [];
    let page = 1;
    try {
        do {
            const response = await getScorableTodos(page);
            console.log(`Fetched page ${page} of scorable todos.`);
            verboseLogs && console.log(response.items)
            allNotes.push(...response.items);
            page++;
            // exit early if we have more than we need
            if (!response.has_more || X != 0 && allNotes.length >= X) break;
        } while (true);
        if (X == 0) {
            return allNotes;
        }
        return allNotes.slice(0, X);
    } catch (error) {
        console.error('Error fetching scorable todos with pagination: ', error);
        return allNotes; // return what we have so far in case of error
    }
}

/**
 * refreshLootboxCount checks numScorableTodos against numTodosToEarnLootbox and updates numLootboxesEarned accordingly;
 * also handles the case of earning multiple lootboxes at once if the user has a large number of scorable todos.
 */
export async function refreshLootboxCount(): Promise<void> {
    verboseLogs && console.log('Refreshing lootbox count...');
    const numTodosToEarnLootbox = await joplin.settings.value(model.numTodosToEarnLootbox);
    const scorableNotes = await getXScorableTodos();
    if (scorableNotes.length < numTodosToEarnLootbox) {
        console.info(`Not enough scorable todos to earn a lootbox. Current scorable todos: ${scorableNotes.length}, todos needed to earn lootbox: ${numTodosToEarnLootbox}`);
        return;
    }
    try {
        const numToScore = Math.floor(scorableNotes.length / numTodosToEarnLootbox) * numTodosToEarnLootbox; // round down to nearest multiple of numTodosToEarnLootbox
        const numLootboxesGained = numToScore / numTodosToEarnLootbox;
        verboseLogs && console.log(`User has enough scorable todos to earn ${numLootboxesGained} lootbox(es). Scoring ${numToScore} todos...`);
    
        const tagId = await getAttributedTagId();
        await Promise.all(scorableNotes.slice(0, numToScore).map((note: any) => {
            verboseLogs && console.log(`Attributing todo with id ${note.id} and title "${note.title}"...`);
            markTodoAttributed(note.id, tagId);
        }));
    
        const curEarned = await joplin.settings.value(model.numLootboxesEarned);
        await joplin.settings.setValue(model.numLootboxesEarned, numLootboxesGained + curEarned);
    } catch (error) {
        console.error('Error refreshing lootbox count: ', error);
    } finally {
        verboseLogs && console.log('Finished refreshing lootbox count. Current lootboxes earned: ', await joplin.settings.value(model.numLootboxesEarned));
    }
}
