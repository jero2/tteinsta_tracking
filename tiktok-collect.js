const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_ID = process.env.NOTION_DB_ID;

async function notionRequest(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.notion.com/v1/${endpoint}`, opts);
  return await res.json();
}

// 무료 Public API를 활용한 틱톡 데이터 우회 수집 로직
async function getTiktokStats(url) {
  try {
    const res = await fetch(`https://tikwm.com/api/?url=${url}`);
    const json = await res.json();
    
    if (json.code === 0 && json.data) {
      return {
        views: parseInt(json.data.play_count || 0),
        likes: parseInt(json.data.digg_count || 0),
        comments: parseInt(json.data.comment_count || 0),
        shares: parseInt(json.data.share_count || 0)
      };
    }
    return null;
  } catch (error) {
    console.error('TikTok Fetch Error:', error);
    return null;
  }
}

async function main() {
  // 플랫폼이 'TikTok'인 줄만 찾아서 가져옵니다.
  const pages = await notionRequest(`databases/${NOTION_DB_ID}/query`, 'POST', {
    filter: { and: [ { property: '플랫폼', select: { equals: 'TikTok' } }, { property: '원본 URL', url: { is_not_empty: true } } ] }
  });
  
  for (const page of pages.results || []) {
    const url = page.properties['원본 URL'].url;
    
    const stats = await getTiktokStats(url);
    if (!stats) {
      console.log(`Failed to fetch stats for: ${url}`);
      continue;
    }
    
    await notionRequest(`pages/${page.id}`, 'PATCH', {
      properties: {
        '조회수': { number: stats.views },
        '좋아요': { number: stats.likes },
        '댓글': { number: stats.comments },
        '저장': { number: stats.shares }, // 틱톡은 공유수(shares)를 저장 칸에 기록합니다.
        '마지막 수집일': { date: { start: new Date().toISOString() } }
      }
    });
    console.log(`Updated TikTok: ${url}`);
  }
}
main();
