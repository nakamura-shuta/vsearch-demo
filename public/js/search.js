/**
 * 検索を実行する非同期関数
 */
async function search() {
  const keyword = document.getElementById('searchInput').value;
  const fileName = document.getElementById('videoPlayer').getAttribute('data-filename');
  try {
    const response = await fetch(`/search?keyword=${encodeURIComponent(keyword)}&fileName=${encodeURIComponent(fileName)}&useEmbedding=true`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const results = await response.json();
    console.log('Search results:', results);
    displayResults(results, keyword);
  } catch (error) {
    console.error('Search failed:', error);
    alert('検索中にエラーが発生しました。');
  }
}

/**
 * 検索結果を表示する関数
 * @param {Array} results - 検索結果の配列
 * @param {string} keyword - 検索キーワード
 */
function displayResults(results, keyword) {
  const resultsContainer = document.getElementById('searchResults');
  resultsContainer.innerHTML = '';
  if (results.length === 0) {
    resultsContainer.innerHTML = `<p>"${keyword}" に一致する結果が見つかりませんでした。</p>`;
    return;
  }
  results.forEach(result => {
    const resultElement = document.createElement('div');
    resultElement.className = 'search-result';
    const formattedStartTime = formatTime(result.start_time);
    const formattedEndTime = formatTime(result.end_time);
    
    resultElement.innerHTML = `
      <span class="timestamp">${formattedStartTime} - ${formattedEndTime}</span>
      <p>${result.context}</p>
      <small>Similarity: ${result.similarity.toFixed(2)}</small>
    `;
    resultElement.onclick = () => playFromTimestamp(result.start_time);
    resultsContainer.appendChild(resultElement);
  });
}

/**
 * 指定された時間から動画を再生する関数
 * @param {number} startTime - 再生開始時間（秒）
 */
function playFromTimestamp(startTime) {
  const video = document.getElementById('videoPlayer');
  video.currentTime = startTime;
  video.play();
}

/**
 * 秒数を時:分:秒の形式にフォーマットする関数
 * @param {number} seconds - 秒数
 * @returns {string} フォーマットされた時間文字列
 */
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const formattedHrs = hrs > 0 ? `${hrs}:` : '';
  const formattedMins = `${hrs > 0 && mins < 10 ? '0' : ''}${mins}:`;
  const formattedSecs = secs < 10 ? `0${secs}` : secs;

  return `${formattedHrs}${formattedMins}${formattedSecs}`;
}