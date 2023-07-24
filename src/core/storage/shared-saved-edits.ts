import { debugLog } from '@/core/content/util';
import { SavedEdit } from './options';
import { BaseSong } from '../object/song';

class SharedSavedEditsImpl {
	private prefixLength: number | null = null;

	public async get(song: BaseSong): Promise<SavedEdit | void> {
		const uniqueId = song.getUniqueId();
		const isYoutube = song.connectorLabel.toLowerCase().includes('youtube');

		if (!uniqueId || !isYoutube) {
			return;
		}

		if (await this.isKnownVideo(uniqueId)) {
			const resp = await fetch(
				`https://music-metadata.lostluma.net/v1/youtube-video/${uniqueId}`
			);

			const edit: SavedEdit = await resp.json();

			debugLog(
				`Loaded shared saved edit ${uniqueId}: ${JSON.stringify(edit)}`
			);

			return edit;
		}
	}

	public async put(song: BaseSong, savedEdit: SavedEdit): Promise<boolean> {
		const uniqueId = song.getUniqueId();
		const isYoutube = song.connectorLabel.toLowerCase().includes('youtube');

		if (!uniqueId || !isYoutube) {
			return false;
		}

		const resp = await fetch(
			`https://music-metadata.lostluma.net/v1/youtube-video/${uniqueId}`,
			{ method: 'POST', body: JSON.stringify(savedEdit) }
		);

		return resp.ok;
	}

	private async getHashPrefix(sha1: string): Promise<string> {
		if (!this.prefixLength) {
			const resp = await fetch(
				'https://music-metadata.lostluma.net/v1/prefix-length'
			);
			const data = await resp.text();

			this.prefixLength = Number(data);
		}

		return sha1.slice(0, this.prefixLength);
	}

	private async isKnownVideo(uniqueId: string): Promise<boolean> {
		const sha1 = await this.sha1HexDigest(uniqueId);

		// This might need to be re-tried if the cached prefix length is wrong
		while (true) {
			const prefix = await this.getHashPrefix(sha1);

			const resp = await fetch(
				`https://music-metadata.lostluma.net/v1/range/${prefix}`
			);
			const data = await resp.text();

			if (resp.ok) {
				return data.includes(sha1);
			}

			if (
				resp.status === 400 &&
				data.includes('Incorrect prefix length requested.')
			) {
				this.prefixLength = null;
			} else {
				throw new Error(
					'Received currently unhandled HTTP response from scrobble API.'
				);
			}
		}
	}

	// Copied from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
	private async sha1HexDigest(message: string): Promise<string> {
		const bytes = new TextEncoder().encode(message);
		const digest = await crypto.subtle.digest('SHA-1', bytes);

		const hashArray = Array.from(new Uint8Array(digest));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}
}

export default new SharedSavedEditsImpl();
