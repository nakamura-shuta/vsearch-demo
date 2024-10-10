const { parentPort, workerData } = require('worker_threads');
const { uploadToS3, transcribeAudio } = require('../services/transcription');
const { insertTranscript, generateEmbeddings } = require('../config/database');
const fs = require('fs-extra');
const path = require('path');

/**
 * ファイルを処理する非同期関数
 */
async function processFile() {
  const { fileName } = workerData;
  const mediaDir = path.join(__dirname, '..', 'media');
  const metadataPath = path.join(mediaDir, `${fileName}_metadata.json`);

  /**
   * ステータスを更新する非同期関数
   * @param {string} status - 更新するステータス
   */
  async function updateStatus(status) {
    await fs.writeJson(metadataPath, { status, fileName });
    parentPort.postMessage({ status, fileName });
  }

  try {
    await updateStatus('uploading');
    await uploadToS3(fileName);
    
    await updateStatus('transcribing');
    const transcriptData = await transcribeAudio(fileName);
    
    await updateStatus('saving');
    await saveTranscriptData(fileName, transcriptData);
    
    await updateStatus('completed');
  } catch (error) {
    console.error('Error in processFile:', error);
    await updateStatus('error');
  }
}

/**
 * トランスクリプトデータを保存する非同期関数
 * @param {string} fileName - ファイル名
 * @param {Object} transcriptData - トランスクリプトデータ
 */
async function saveTranscriptData(fileName, transcriptData) {
  const mediaDir = path.join(__dirname, '..', 'media');
  const metadataPath = path.join(mediaDir, `${fileName}_metadata.json`);
  
  await fs.writeJson(metadataPath, {
    ...transcriptData,
    status: 'completed',
    fileName: fileName
  });

  await insertTranscript(fileName, transcriptData);
  await generateEmbeddings(fileName);

  console.log('Transcription completed, embeddings generated, and metadata saved.');
}

processFile();