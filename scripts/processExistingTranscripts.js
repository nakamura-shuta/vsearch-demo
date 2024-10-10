require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { db, initDatabase, insertTranscript, generateEmbeddings } = require('../config/database');

const mediaDir = path.join(__dirname, '..', 'media');

// データベースの初期化
initDatabase();

/**
 * 指定されたファイルのトランスクリプトを処理する非同期関数
 * @param {string} fileName - 処理するファイル名
 */
async function processTranscript(fileName) {
  const metadataFile = `${fileName}_metadata.json`;
  const metadataPath = path.join(mediaDir, metadataFile);

  console.log(`Processing ${fileName}...`);

  try {
    if (await fs.pathExists(metadataPath)) {
      const transcriptData = await fs.readJson(metadataPath);
      await insertTranscript(fileName, transcriptData);
      await generateEmbeddings(fileName);
      console.log(`Successfully processed ${fileName}`);
    } else {
      console.error(`Metadata file not found for ${fileName}`);
    }
  } catch (error) {
    console.error(`Error processing ${fileName}:`, error);
  }
}

/**
 * 既存のトランスクリプトを処理する非同期関数
 * @param {string} [specifiedFileName] - 処理する特定のファイル名（オプション）
 */
async function processExistingTranscripts(specifiedFileName) {
  try {
    if (specifiedFileName) {
      await processTranscript(specifiedFileName);
    } else {
      const files = await fs.readdir(mediaDir);
      const metadataFiles = files.filter(file => file.endsWith('_metadata.json'));

      for (const metadataFile of metadataFiles) {
        const fileName = metadataFile.replace('_metadata.json', '');
        await processTranscript(fileName);
      }

      console.log('All existing transcripts have been processed.');
    }
  } catch (error) {
    console.error('Error reading media directory:', error);
  }
}

// コマンドライン引数からファイル名を取得
const specifiedFileName = process.argv[2];

if (specifiedFileName) {
  console.log(`Processing specified file: ${specifiedFileName}`);
} else {
  console.log('Processing all files in the media directory.');
}

processExistingTranscripts(specifiedFileName);