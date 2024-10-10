const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
const fs = require('fs-extra');
const path = require('path');
const { getEmbedding } = require('./embedding');
const { insertTranscript, generateEmbeddings } = require('../config/database');

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const transcribeClient = new TranscribeClient({ region: process.env.AWS_REGION });

const mediaDir = path.join(__dirname, '..', 'media');

/**
 * ファイルをS3にアップロードする非同期関数
 * @param {string} fileName - アップロードするファイル名
 */
async function uploadToS3(fileName) {
  const filePath = path.join(mediaDir, fileName);
  const fileContent = await fs.readFile(filePath);

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
  };

  try {
    await s3Client.send(new PutObjectCommand(params));
    console.log(`${fileName}をS3にアップロードしました。`);
  } catch (err) {
    console.error('S3へのアップロード中にエラーが発生しました:', err);
    throw err;
  }
}

/**
 * 音声ファイルを文字起こしする非同期関数
 * @param {string} fileName - 文字起こしするファイル名
 */
async function transcribeAudio(fileName) {
  const jobName = `transcribe_${Date.now()}`;
  const mediaFileUri = `s3://${process.env.S3_BUCKET_NAME}/${fileName}`;

  const params = {
    TranscriptionJobName: jobName,
    LanguageCode: 'ja-JP',
    MediaFormat: 'mp4',
    Media: {
      MediaFileUri: mediaFileUri,
    },
    OutputBucketName: process.env.S3_BUCKET_NAME,
  };

  try {
    await transcribeClient.send(new StartTranscriptionJobCommand(params));
    await waitForTranscriptionCompletion(jobName, fileName);
  } catch (err) {
    console.error('文字起こし中にエラーが発生しました:', err);
    throw err;
  }
}

/**
 * 文字起こしジョブの完了を待つ非同期関数
 * @param {string} jobName - 文字起こしジョブ名
 * @param {string} fileName - ファイル名
 */
async function waitForTranscriptionCompletion(jobName, fileName) {
  let jobStatus = '';
  do {
    const job = await transcribeClient.send(new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }));
    jobStatus = job.TranscriptionJob.TranscriptionJobStatus;
    if (jobStatus === 'COMPLETED') {
      const transcriptFileUri = job.TranscriptionJob.Transcript.TranscriptFileUri;
      console.log('TranscriptFileUri:', transcriptFileUri);
      const transcriptData = await fetchTranscriptData(transcriptFileUri);
      await saveTranscriptData(fileName, transcriptData);
      break;
    } else if (jobStatus === 'FAILED') {
      console.error('Transcription job failed:', job.TranscriptionJob.FailureReason);
      break;
    } else {
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  } while (true);
}

/**
 * トランスクリプトデータを取得する非同期関数
 * @param {string} transcriptFileUri - トランスクリプトファイルのURI
 * @returns {Object} トランスクリプトデータ
 */
async function fetchTranscriptData(transcriptFileUri) {
  const url = new URL(transcriptFileUri);
  
  let bucketName, key;

  if (url.hostname === 's3.ap-northeast-1.amazonaws.com') {
    const pathParts = url.pathname.split('/').filter(part => part);
    bucketName = pathParts[0];
    key = pathParts.slice(1).join('/');
  } else {
    bucketName = url.hostname.split('.')[0];
    key = url.pathname.substring(1);
  }

  console.log('Extracted Bucket:', bucketName);
  console.log('Extracted Key:', key);

  const getObjectParams = {
    Bucket: bucketName,
    Key: key,
  };

  try {
    const { Body } = await s3Client.send(new GetObjectCommand(getObjectParams));
    const bodyContents = await streamToString(Body);
    return JSON.parse(bodyContents);
  } catch (error) {
    console.error('Error fetching transcript data:', error);
    throw error;
  }
}

/**
 * ストリームを文字列に変換する関数
 * @param {ReadableStream} stream - 読み取り可能なストリーム
 * @returns {Promise<string>} 文字列に変換されたストリーム
 */
function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

/**
 * トランスクリプトデータを保存する非同期関数
 * @param {string} fileName - ファイル名
 * @param {Object} transcriptData - トランスクリプトデータ
 */
async function saveTranscriptData(fileName, transcriptData) {
  const metadataPath = path.join(mediaDir, `${fileName}_metadata.json`);
  await fs.writeJson(metadataPath, transcriptData);

  // トランスクリプトの保存
  await insertTranscript(fileName, transcriptData);

  // 各セグメントの埋め込みベクトルを生成
  await generateEmbeddings(fileName);

  console.log('Transcription completed, embeddings generated, and metadata saved.');
}

module.exports = { uploadToS3, transcribeAudio };