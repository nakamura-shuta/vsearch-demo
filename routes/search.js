const { searchTranscripts } = require('../config/database');

/**
 * 検索ルートの設定
 * @param {Object} fastify - Fastifyインスタンス
 * @param {Object} options - オプション
 */
async function routes(fastify, options) {
  fastify.get('/', async (request, reply) => {
    const { keyword, fileName, exactMatch, useEmbedding } = request.query;
    console.log('Search request received:', { keyword, fileName, exactMatch, useEmbedding });

    if (!keyword || !fileName) {
      return reply.status(400).send({ error: 'Keyword and fileName are required' });
    }

    try {
      const searchOptions = {
        exactMatch: exactMatch === 'true',
        useEmbedding: useEmbedding === 'true'
      };
      const results = await searchTranscripts(keyword, fileName, searchOptions);
      console.log('Search results:', results);
      return results;
    } catch (error) {
      console.error('Search error:', error);
      return reply.status(500).send({ error: 'An error occurred during search' });
    }
  });
}

module.exports = routes;