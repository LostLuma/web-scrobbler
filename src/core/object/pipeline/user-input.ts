/**
 * The pipeline stage applies custom song info data to given song info.
 * Plus, it saves the song info to browser storage.
 */

import SavedEdits from '@/core/storage/saved-edits';
import Song from '@/core/object/song';
import { debugLog } from '@/core/content/util';

/**
 * Fill song info by user defined values.
 * @param song - Song instance
 */
export async function process(song: Song): Promise<void> {
	let isSongInfoLoaded = false;
	try {
		isSongInfoLoaded = await SavedEdits.loadSongInfo(song);
	} catch (err) {
		debugLog(err, 'error');
	}

	// This may already be set from external-info
	if (!song.flags.isCorrectedByUser) {
		song.flags.isCorrectedByUser = isSongInfoLoaded;
	}
}
