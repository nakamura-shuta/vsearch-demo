const path = require('path');
const fs = require('fs-extra');

/**
 * 再生ルートの設定
 * @param {Object} fastify - Fastifyインスタンス
 * @param {Object} options - オプション
 */
async function routes(fastify, options) {
  const mediaDir = path.join(__dirname, '..', 'media');

  fastify.get('/:fileName', async (request, reply) => {
    const fileName = request.params.fileName;
    console.log('Requested fileName:', fileName);

    // ファイル名から .mp4_metadata.json を取り除く
    const baseFileName = fileName.replace('_metadata.json', '');
    const filePath = path.join(mediaDir, baseFileName);
    const metadataPath = path.join(mediaDir, `${baseFileName}_metadata.json`);

    console.log('File path:', filePath);
    console.log('Metadata path:', metadataPath);  

    if (!await fs.pathExists(filePath)) {
      console.log('File not found:', filePath); 
      return reply.status(404).send('File not found');
    }

    let metadata = null;

    try {
      if (await fs.pathExists(metadataPath)) {
        metadata = await fs.readJson(metadataPath);
      }
      return reply.view('play', { fileName: baseFileName, metadata });
    } catch (error) {
      fastify.log.error('Error loading metadata:', error);
      return reply.status(500).send('メタデータの読み込み中にエラーが発生しました');
    }
  });
}

module.exports = routes;