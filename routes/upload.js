const fs = require('fs-extra');
const path = require('path');
const { pipeline } = require('stream');
const util = require('util');
const pump = util.promisify(pipeline);
const { uploadToS3, transcribeAudio } = require('../services/transcription');

/**
 * アップロードルートの設定
 * @param {Object} fastify - Fastifyインスタンス
 * @param {Object} options - オプション
 */
async function routes(fastify, options) {
  const mediaDir = path.join(__dirname, '..', 'media');

  fastify.get('/', async (request, reply) => {
    try {
      const files = await fs.readdir(mediaDir);
      return reply.view('upload.ejs', { files });
    } catch (error) {
      fastify.log.error('Error reading media directory:', error);
      return reply.status(500).send('ファイル一覧の取得中にエラーが発生しました');
    }
  });

  fastify.post('/upload', async (request, reply) => {
    const data = await request.file();
    
    if (!data) {
      return reply.status(400).send('No file uploaded');
    }

    const fileName = `${Date.now()}_${data.filename}`;
    const filePath = path.join(mediaDir, fileName);

    try {
      await pump(data.file, fs.createWriteStream(filePath));
      await uploadToS3(fileName);
      await transcribeAudio(fileName);
      return reply.redirect('/');
    } catch (error) {
      fastify.log.error('Upload error:', error);
      return reply.status(500).send('アップロード中にエラーが発生しました');
    }
  });
}

module.exports = routes;