const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { getEmbedding } = require('../services/embedding');

// コサイン類似度計算関数
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
  return (magnitudeA === 0 || magnitudeB === 0) ? 0 : dotProduct / (magnitudeA * magnitudeB);
}

// データベースの初期化
const adapter = new FileSync('db.json');
const db = low(adapter);

function initDatabase() {
  db.defaults({ transcripts: [], embeddings: [] }).write();
}

// トランスクリプトの挿入または更新
function insertTranscript(fileName, transcriptData) {
  const existingTranscript = db.get('transcripts').find({ fileName }).value();
  if (existingTranscript) {
    db.get('transcripts').find({ fileName }).assign({ transcript: transcriptData }).write();
  } else {
    db.get('transcripts').push({ fileName, transcript: transcriptData }).write();
  }
  console.log(`Inserted/Updated transcript for ${fileName}`);
}

// 埋め込みベクトルの生成
async function generateEmbeddings(fileName) {
  const transcriptEntry = db.get('transcripts').find({ fileName }).value();
  if (!transcriptEntry || !transcriptEntry.transcript || !transcriptEntry.transcript.results) {
    console.log('Transcript not found or invalid for:', fileName);
    return;
  }

  const items = transcriptEntry.transcript.results.items;
  if (!items || !Array.isArray(items)) {
    console.log('Invalid items array in transcript');
    return;
  }

  // セグメントの生成（20語ごと）
  const chunkSize = 20;
  const chunks = [];
  let currentChunk = [];
  for (let item of items) {
    if (item.type === 'pronunciation') {
      currentChunk.push(item);
      if (currentChunk.length >= chunkSize) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // 埋め込みの生成と保存
  for (let chunk of chunks) {
    const text = chunk.map(item => item.alternatives[0].content).join(' ');
    const start_time = parseFloat(chunk[0].start_time);
    const end_time = parseFloat(chunk[chunk.length - 1].end_time);
    try {
      const embedding = await getEmbedding(text);
      db.get('embeddings').push({
        fileName,
        text,
        embedding,
        start_time,
        end_time,
      }).write();
    } catch (error) {
      console.error('Error generating embedding for chunk:', error);
    }
  }

  console.log(`Generated and stored embeddings for ${fileName}`);
}

// トランスクリプトの検索
async function searchTranscripts(keyword, fileName, options = {}) {
  console.log('Searching for:', { keyword, fileName, options });

  const embeddings = db.get('embeddings').filter({ fileName }).value();
  if (!embeddings || embeddings.length === 0) {
    console.log('No embeddings found for file:', fileName);
    return [];
  }

  let results = [];

  if (options.useEmbedding) {
    try {
      const keywordEmbedding = await getEmbedding(keyword);
      console.log('Using OpenAI embedding for search');

      results = embeddings.map(embeddingEntry => ({
        text: embeddingEntry.text,
        start_time: embeddingEntry.start_time,
        end_time: embeddingEntry.end_time,
        similarity: cosineSimilarity(keywordEmbedding, embeddingEntry.embedding),
      }));

    } catch (error) {
      console.error('Error in embedding-based search:', error);
      return [];
    }

    // 類似度のフィルタリングとソート
    const similarityThreshold = 0.5;
    results = results.filter(result => result.similarity >= similarityThreshold)
                     .sort((a, b) => b.similarity - a.similarity);

    // 結果を制限
    const MAX_RESULTS = 5;
    results = results.slice(0, MAX_RESULTS);

    // コンテキストの追加とハイライト
    results = results.map(result => ({
      ...result,
      context: result.text.replace(new RegExp(keyword, 'gi'), match => `<mark>${match}</mark>`),
    }));

  } else {
    // キーワード検索のフォールバック
    const transcriptEntry = db.get('transcripts').find({ fileName }).value();
    const fullTranscript = transcriptEntry.transcript.results.transcripts[0].transcript;

    results = performExactMatch(keyword, fullTranscript, embeddings);

    // 結果を制限
    const MAX_RESULTS = 5;
    results = results.slice(0, MAX_RESULTS);

    results = results.map(result => ({
      ...result,
      context: result.text.replace(new RegExp(keyword, 'gi'), match => `<mark>${match}</mark>`),
    }));
  }

  console.log('Final search results:', results.length);
  return results;
}

// 完全一致検索の実行
function performExactMatch(keyword, fullTranscript, embeddings) {
  const regex = new RegExp(keyword, 'gi');
  let match;
  const results = [];

  while ((match = regex.exec(fullTranscript)) !== null) {
    const matchedText = match[0];
    for (let embeddingEntry of embeddings) {
      if (embeddingEntry.text.includes(matchedText)) {
        results.push({
          text: embeddingEntry.text,
          start_time: embeddingEntry.start_time,
          end_time: embeddingEntry.end_time,
          similarity: 1.0,
        });
        break;
      }
    }
  }

  return results;
}

module.exports = { db, initDatabase, insertTranscript, generateEmbeddings, searchTranscripts };