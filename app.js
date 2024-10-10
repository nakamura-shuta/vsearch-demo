require('dotenv').config();

const fastify = require('fastify')({
  logger: true,
  ignoreTrailingSlash: true
});

const path = require('path');
const fs = require('fs-extra');
const { initDatabase } = require('./config/database');

// @fastify/multipart の登録
fastify.register(require('@fastify/multipart'), {
  limits: {
    fieldNameSize: 100, // Max field name size in bytes
    fieldSize: 100,     // Max field value size in bytes
    fields: 10,         // Max number of non-file fields
    fileSize: 100000000, // For multipart forms, the max file size in bytes
    files: 1,           // Max number of file fields
    headerPairs: 2000   // Max number of header key=>value pairs
  }
});

// テンプレートエンジンの設定
fastify.register(require('@fastify/view'), {
  engine: {
    ejs: require('ejs')
  },
  root: path.join(__dirname, 'views'),
});

// 静的ファイルの提供
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/'
});

// メディアディレクトリの設定
const mediaDir = path.join(__dirname, 'media');
fs.ensureDirSync(mediaDir);

// ルートの登録
fastify.register(require('./routes/search'), { prefix: '/search' });
fastify.register(require('./routes/play'), { prefix: '/play' });
fastify.register(require('./routes/upload'), { prefix: '/' });

// 静的ファイルの提供 (メディアファイル用)
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'media'),
  prefix: '/media/',
  decorateReply: false
});

// データベースの初期化
initDatabase();

// サーバーの起動
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3300 });
    fastify.log.info(`サーバーが起動しました: ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();


fastify.setErrorHandler(function (error, request, reply) {
  console.error('Error occurred:', error);
  reply.status(500).send({ error: 'An error occurred on the server' });
});