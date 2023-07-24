import { debugLog } from '@/core/content/util';
import Song from '@/core/object/song';
import SharedSavedEdits from '@/core/storage/shared-saved-edits';

export async function process(song: Song): Promise<void> {
	try {
		const edit = await SharedSavedEdits.get(song);

		if (!edit) {
			return;
		}

		// This is *somewhat* true ??
		song.flags.isCorrectedByUser = true;

		for (const field of Song.BASE_FIELDS) {
			const data = edit[field];

			if (data) {
				song.processed[field] = data;
			}
		}
	} catch (e) {
		debugLog(`Failed to apply external info pipeline: ${e}.`);
	}
}
