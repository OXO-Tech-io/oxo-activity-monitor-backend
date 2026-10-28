'use strict';

const IF_ABSENT_HEADER = 'x-goog-if-generation-match';

function createGcsSigner( storage, bucketName) {
    const bucket = storage.bucket(bucketName);

    return async function sign(objectName, contentType, ttlSeconds){
        const [url] = await bucket.file(objectName).getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + (ttlSeconds * 1000),
            contentType,
            extensionHeaders: { [IF_ABSENT_HEADER]: '0'},
        })

        return {url, headers: {'Content-Type': contentType,[IF_ABSENT_HEADER]: '0'}};
    };
}

module.exports = {createGcsSigner, IF_ABSENT_HEADER}