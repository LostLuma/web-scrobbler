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

    let _prefixLength;

    function resetPrefixLength() {
        _prefixLength = null;
    }

    async function getHashPrefix(sha1) {
        if (!_prefixLength) {
            const resp = await fetch("https://music-metadata.lostluma.dev/v1/prefix-length");
            const data = await resp.text();

            _prefixLength = Number(data);
        }

        return sha1.slice(0, _prefixLength);
    }

    async function videoIsKnown(uniqueId) {
        const sha1 = await sha1HexDigest(uniqueId);

        // This might need to be re-tried if the cached prefix length is wrong
        while (true) {
            const prefix = await getHashPrefix(sha1);

            const resp = await fetch(`https://music-metadata.lostluma.dev/v1/range/${prefix}`);
            const data = await resp.text();

            if (resp.ok) {
                return data.includes(sha1);
            }

            if (resp.status === 400 && data.includes("Incorrect prefix length requested.")) {
                resetPrefixLength();
            } else {
                throw new Error("Received currently unhandled HTTP response from scrobble API.");
            }
        }
    }

    async function getVideoInfo(uniqueId) {
        const resp = await fetch(`https://music-metadata.lostluma.dev/v1/youtube-video/${uniqueId}`);
        return await resp.json();
    }

	/**
	 * Add song info provided by the API.
	 * @param  {Object} song Song instance
	 */
	async function process(song) {
        try {
            const uniqueId = song.getUniqueId();
            const isYoutube = song.connectorLabel.toLowerCase().includes("youtube");

            if (!uniqueId || !isYoutube) {
                return;
            }

            const songInfoAvailable = await videoIsKnown(uniqueId);

            if (!songInfoAvailable) {
                return;
            }

            const songInfo = await getVideoInfo(uniqueId);
            Util.debugLog(`Loaded song info from scrobble API: ${JSON.stringify(songInfo)}`);

            for (const field in songInfo) {
                const data = songInfo[field];

                if (data) {
                    song.processed[field] = data;
                }
            }

            song.flags.isCorrectedByUser = true;
        } catch(e) {
            Util.debugLog(`Failed to apply external info: ${e}.`);
        }
	}

	return { process };
});
