import { debugLog } from '@/core/content/util';
import Song from '@/core/object/song';

type SongInfo = {
	track: string;
	album: string | null;
	artist: string;
	albumArtist: string | null;
};

// Copied from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
async function sha1HexDigest(message: string): Promise<string> {
	const bytes = new TextEncoder().encode(message);
	const digest = await crypto.subtle.digest('SHA-1', bytes);

	const hashArray = Array.from(new Uint8Array(digest));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

let _prefixLength: number | null = null;

function resetPrefixLength(): void {
	_prefixLength = null;
}

async function getHashPrefix(sha1: string): Promise<string> {
	if (!_prefixLength) {
		const resp = await fetch(
			'https://music-metadata.lostluma.net/v1/prefix-length'
		);
		const data = await resp.text();

		_prefixLength = Number(data);
	}

	return sha1.slice(0, _prefixLength);
}

async function videoIsKnown(uniqueId: string): Promise<boolean> {
	const sha1 = await sha1HexDigest(uniqueId);

	// This might need to be re-tried if the cached prefix length is wrong
	while (true) {
		const prefix = await getHashPrefix(sha1);

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
			resetPrefixLength();
		} else {
			throw new Error(
				'Received currently unhandled HTTP response from scrobble API.'
			);
		}
	}
}

async function getVideoInfo(uniqueId: string): Promise<SongInfo> {
	const resp = await fetch(
		`https://music-metadata.lostluma.net/v1/youtube-video/${uniqueId}`
	);
	return await resp.json();
}

/**
 * Add song info provided by the API.
 * @param  {Object} song Song instance
 */
export async function process(song: Song): Promise<void> {
	try {
		const uniqueId = song.getUniqueId();
		const isYoutube = song.connectorLabel.toLowerCase().includes('youtube');

		if (!uniqueId || !isYoutube) {
			return;
		}

		const songInfoAvailable = await videoIsKnown(uniqueId);

		if (!songInfoAvailable) {
			return;
		}

		const songInfo = await getVideoInfo(uniqueId);

		debugLog(
			`Loaded song info from scrobble API: ${JSON.stringify(songInfo)}`
		);

		for (const field of Song.BASE_FIELDS) {
			const data = songInfo[field];

			if (data) {
				song.processed[field] = data;
			}
		}

		song.flags.isCorrectedByUser = true;
	} catch (e) {
		debugLog(`Failed to apply external info: ${e}.`);
	}
}
