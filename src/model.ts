import joplin from "api";
import { ModelType } from "api/types";

export namespace model {
    export const SECTION = 'TodoLootboxSettings';
    export const numTodosToEarnLootbox = 'numTodosToEarnLootbox';
    export const numLootboxesEarned = 'numLootboxesEarned';
    export const numScorableTodos = 'numScorableTodos';
    export const prevCompletedKey = 'lootbox:prev_completed';
    export const attributedKey = 'lootbox:attributed';
}

export async function handleNoteChange(itemChangeEvent: any): Promise<void> {
    try {
        const note = await joplin.data.get(['notes', itemChangeEvent.id], { fields: "id, is_todo, todo_completed" });
        if (!note || !note.is_todo) return;
        console.log('user_data: ', note.user_data);
        const attributed = await isAttributed(note.id);
        if (attributed) return;

        if (itemChangeEvent.event == 1 && note.todo_completed) {
            // TODO: test if rollbacks actually hit this case
            console.log('Handling case where deleted note is rolled back by user');
            await incrementScorableTodos();
        }

        if (itemChangeEvent.event == 2) {
            const prevCompleted = await getPrevCompletedTime(note.id);
            if (prevCompleted == 0 && note.todo_completed) {
                await incrementScorableTodos();
            } else if (prevCompleted > 0 && note.todo_completed == 0) {
                await decrementScorableTodos();
            }

            if (prevCompleted != note.todo_completed) {
                // update prevCompleted timestamp so we can tell if it changes again
                console.log(`Updating prev_completed time for note ${note.id} from ${prevCompleted} to ${note.todo_completed}`);
                
                // avoid edge case where todo_completed > 0 and prev_completed > todo_completed from sync 
                // (persist most recent timestamps between the two)
                if (note.todo_completed > 0 && prevCompleted > note.todo_completed) {
                    console.log(`Edge case hit where prev_completed (${prevCompleted}) is greater than todo_completed (${note.todo_completed}). Updating todo_completed instead.`);
                    await joplin.data.put(['notes', note.id], null, { todo_completed: prevCompleted });
                    return;
                }
                // in all other cases we update prev_completed to reflect the new state of the note
                await updatePrevCompleted(note.id, note.todo_completed);
            }
        }

        if (itemChangeEvent.event == 3 && note.todo_completed) {
            await decrementScorableTodos();
        }
    } catch (error) {
        console.error('Error handling note change: ', error);
    }
}

export async function handleSettingsChange(event: any): Promise<void> {
    try {
        const watchedSettings = new Set([model.numTodosToEarnLootbox, model.numScorableTodos]);
        if (!event.keys.some((k: string) => watchedSettings.has(k))) return;

        // TODO: optimize this by only refreshing the lootbox count if numScorableTodos or numTodosToEarnLootbox changes (currently we refresh on any setting change which is unnecessary overhead)
        if (event.keys.includes(model.numTodosToEarnLootbox)) {
            console.info('Number of todos to earn lootbox changed', await joplin.settings.value(model.numTodosToEarnLootbox));
        }
        if (event.keys.includes(model.numScorableTodos)) {
            console.info('Number of scorable todos changed', await joplin.settings.value(model.numScorableTodos));
        }
        // at this point we should've exited if we don't need to update the lootbox state
        await refreshLootboxCount();
    } catch (error) {
        console.error('Error handling settings change: ', error);
    }
}

async function getPrevCompletedTime(noteId: string): Promise<number> {
    try {
        const prevCompletedTime = await joplin.data.userDataGet(ModelType.Note, noteId, model.prevCompletedKey);
        console.log(`prev_completed Value for note ${noteId}: ${prevCompletedTime}`);
        return prevCompletedTime ? Number(prevCompletedTime) : 0;
    } catch (error) {
        console.error('Error checking if todo is complete: ', error);
        return 0;
    }
}

async function isAttributed(noteId: string): Promise<boolean> {
    try {
        const attributedValue = await joplin.data.userDataGet(ModelType.Note, noteId, model.attributedKey);
        return !!attributedValue; // convert to boolean
    } catch (error) {
        console.error('Error checking if todo is attributed: ', error);
        return false; // default to false on error
    }
}

async function updatePrevCompleted(noteId: string, ts: number): Promise<void> {
    // ts has to be the same unit joplin uses to measure todo_completed, which conceivably won't be changed from Unix time (ms since epoch)
    // sidenote: this value will stop working in 2038 (https://en.wikipedia.org/wiki/Year_2038_problem)
    try {
        await joplin.data.userDataSet(ModelType.Note, noteId, model.prevCompletedKey, ts);
    } catch (error) {
        console.error('Error updating prev_completed: ', error);
    } finally {
        console.log(`Updated todo ${noteId} user_data with timestamp ${ts}`);
    }
}

async function markTodoAttributed(noteId: string): Promise<void> {
    const n = Date.now();
    try {
        await joplin.data.userDataSet(ModelType.Note, noteId, model.attributedKey, n);
    } catch (error) {
        console.error('Error marking todo attributed: ', error);
    } finally {
        console.log(`Marked todo ${noteId} attributed with timestamp ${n}`);
    }
}

async function getScorableTodos(page:number): Promise<any> {
    // request all completed todo notes
	return await joplin.data.get(['search'], {
		query: "type:todo iscompleted:1",
		fields: "id, created_time, title, user_data",
        order_by: 'created_time',
        order_dir: 'ASC',
        limit: 50,
        page: page,
		
	});
}

/*
 * getXScorableTodos returns X scorable todo notes without pagination
 * structure borrowed from: https://github.com/TheScriptingGuy/Joplin-Repeating-Todos-Plugin/blob/main/src/core/joplin.ts#L22
 */
async function getXScorableTodos(X: number=0): Promise<any[]> {
    const allNotes: any[] = [];
    let page = 1;
    do {
        const response = await getScorableTodos(page);
        console.log(`Fetched page ${page} of scorable todos: `, response.items);
        page++;
        // filter out notes that have already been attributed
        allNotes.push(...response.items.filter((note:any) => {
        const ud = note.user_data ? JSON.parse(note.user_data) : {};
        return !ud || ud[model.attributedKey] == undefined;
    }));

        if (!response.has_more || X != 0 && allNotes.length >= X) break;
    } while (true);
    if (X == 0) {
        return allNotes;
    }
    return allNotes.slice(0, X);
}



/*
 * refreshLootboxCount checks numScorableTodos against numTodosToEarnLootbox and updates numLootboxesEarned accordingly;
 * also handles the case of earning multiple lootboxes at once if the user has a large number of scorable todos.
 */
export async function refreshLootboxCount(): Promise<void> {
	const numScorableTodos = await joplin.settings.value(model.numScorableTodos);
	const numTodosToEarnLootbox = await joplin.settings.value(model.numTodosToEarnLootbox);
    console.log('Refreshing lootbox count. Current scorable todos: ', numScorableTodos, 'Current todos to earn lootbox: ', numTodosToEarnLootbox);
    if (numScorableTodos >= numTodosToEarnLootbox) {
        const overflow = Math.floor(numScorableTodos / numTodosToEarnLootbox);
        try {
            // TODO: confirm we are sorting correctly by completion time so we attribute the oldest todos first
            const notes = await getXScorableTodos(overflow);
            if (notes.length < overflow) {
                console.error(`Error: expected to find at least ${overflow} scorable todos, but only found ${notes.length}`);
                // TODO: gracefully handle this page
                // TODO: identify potential causes of this discrepancy 
                return;
            }
            await Promise.all(notes.map((note: any) => markTodoAttributed(note.id))); 
            
            // adjust state variables
            const numLootboxesEarned = await joplin.settings.value(model.numLootboxesEarned)
            await joplin.settings.setValue(model.numScorableTodos, numScorableTodos - overflow);
            await joplin.settings.setValue(model.numLootboxesEarned, numLootboxesEarned + overflow)
        } catch (error) {
            console.error('Error updating lootbox count: ', error);
        } finally {
            console.log('Updated lootbox count. Current scorable todos: ', await joplin.settings.value(model.numScorableTodos), 'Current lootboxes earned: ', await joplin.settings.value(model.numLootboxesEarned));
        }
    } 
}

/*
 * incrementScorableTodos updates the synced joplin settings value that represents the number of
 * scorable todos to be coverted into lootboxes.
 */
async function incrementScorableTodos(count: number = 1): Promise<void> {
    try {
        const numScorableTodos = await joplin.settings.value(model.numScorableTodos);
        await joplin.settings.setValue(model.numScorableTodos, numScorableTodos + count);
    } catch (error) {
        console.error('Error incrementing scorable todos: ', error);
    } finally {
        console.log('Incremented scorable todos. Current count: ', await joplin.settings.value(model.numScorableTodos));
    }
}

async function decrementScorableTodos(count: number = 1): Promise<void> {
    try {
        const numScorableTodos = await joplin.settings.value(model.numScorableTodos);
        await joplin.settings.setValue(model.numScorableTodos, Math.max(0, numScorableTodos - count));
    } catch (error) {
        console.error('Error decrementing scorable todos: ', error);
    } finally {
        console.log('Decremented scorable todos. Current count: ', await joplin.settings.value(model.numScorableTodos));
    }
}
