'use strict';

/**
 * Experimental pipeline stage to load song info from an external API.
 * Allows collaborating with others on a bigger shared saved edits library.
 *
 * To protect privacy the extension first anonymously checks whether the video is
 * known to the server, and only then requests the actual information about song.
 */

define((require) => {
    const Util = require("../util/util");

    // Copied from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
    async function sha1HexDigest(message) {
        const bytes = new TextEncoder().encode(message);
        const digest = await crypto.subtle.digest('SHA-1', bytes);

        const hashArray = Array.from(new Uint8Array(digest));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

	/**
	 * Add song info provided by the API.
	 * @param  {Object} song Song instance
	 */
	async function process(song) {
        const uniqueId = song.getUniqueId();
        const isYoutube = song.connectorLabel.toLowerCase().includes("youtube");

        if (!uniqueId || !isYoutube) {
            return;
        }

        let prefixLength; // TODO: Cache this value later

        try {
            const resp = await fetch("https://scrobble-api.lostluma.dev/v1/prefix-length");
            const data = await resp.text();

            prefixLength = Number(data);
        } catch {
            return;
        }

        const sha1 = await sha1HexDigest(uniqueId);
        const prefix = sha1.slice(0, prefixLength);

        let songInfoAvailable;

        try {
            const resp = await fetch(`https://scrobble-api.lostluma.dev/v1/range/${prefix}`);
            const data = await resp.text();

            songInfoAvailable = data.includes(sha1);
        } catch(e) {
            return;
        }

        if (!songInfoAvailable) {
            return;
        }

        let songInfo;

        try {
            const resp = await fetch(`https://scrobble-api.lostluma.dev/v1/youtube-video/${uniqueId}`);
            songInfo = await resp.json();
        } catch {
            return;
        }

        Util.debugLog(`Loaded song info from scrobble API: ${JSON.stringify(songInfo)}`);

        for (const field in songInfo) {
            song.processed[field] = songInfo[field];
        }

		song.flags.isCorrectedByUser = true;
	}

	return { process };
});
