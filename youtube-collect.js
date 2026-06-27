const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_ID = process.env.NOTION_DB_ID;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function notionRequest(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.notion.com/v1/${endpoint}`, opts);
  return await res.json();
}

// 유튜브 URL에서 Video ID 추출
function extractYoutubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

async function getYoutubeStats(videoId) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`);
  const data = await res.json();
  if (data.items && data.items.length > 0) return data.items[0].statistics;
  return null;
}

async function main() {
  const pages = await notionRequest(`databases/${NOTION_DB_ID}/query`, 'POST', {
    filter: { and: [ { property: '플랫폼', select: { equals: 'YouTube' } }, { property: '원본 URL', url: { is_not_empty: true } } ] }
  });
  
  for (const page of pages.results || []) {
    const url = page.properties['원본 URL'].url;
    const videoId = extractYoutubeId(url);
    if (!videoId) continue;
    
    const stats = await getYoutubeStats(videoId);
    if (!stats) continue;
    
    await notionRequest(`pages/${page.id}`, 'PATCH', {
      properties: {
        '조회수': { number: parseInt(stats.viewCount || 0) },
        '좋아요': { number: parseInt(stats.likeCount || 0) },
        '댓글': { number: parseInt(stats.commentCount || 0) },
        'YouTube ID': { rich_text: [{ type: 'text', text: { content: videoId } }] },
        '마지막 수집일': { date: { start: new Date().toISOString() } }
      }
    });
    console.log(`Updated Video ID: ${videoId}`);
  }
}
main();
