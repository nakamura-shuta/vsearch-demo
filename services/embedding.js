const fetch = require('node-fetch');
const { encode, decode } = require('gpt-3-encoder');

const MAX_TOKENS = 8000; // APIの制限よりも少し小さい値に設定

/**
 * テキストの埋め込みベクトルを取得する非同期関数
 * @param {string} text - 埋め込みベクトルを取得するテキスト
 * @returns {Promise<number[]>} 埋め込みベクトル
 */
async function getEmbedding(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is empty');
  }

  // トークン数のチェックと分割（必要に応じて）
  const tokens = encode(text);
  if (tokens.length > MAX_TOKENS) {
    text = decode(tokens.slice(0, MAX_TOKENS));
  }

  return await getEmbeddingForChunk(text);
}

/**
 * テキストチャンクの埋め込みベクトルを取得する非同期関数
 * @param {string} chunk - 埋め込みベクトルを取得するテキストチャンク
 * @returns {Promise<number[]>} 埋め込みベクトル
 */
async function getEmbeddingForChunk(chunk) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: chunk,
      model: "text-embedding-ada-002"
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const result = await response.json();
  if (!result.data || !result.data[0] || !result.data[0].embedding) {
    throw new Error('Unexpected response format from OpenAI API');
  }

  return result.data[0].embedding;
}

module.exports = { getEmbedding };