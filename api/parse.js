export default async function handler(req, res) {
  // 设置 CORS 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET请求返回简单状态
  if (req.method === 'GET') {
    return res.status(200).json({
      success: false,
      error: '只允许 POST 请求',
      status: 'API 运行正常',
      timestamp: new Date().toISOString()
    });
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: '只允许 POST 请求'
    });
  }

  try {
    console.log('收到请求:', req.body);
    
    const { share_url, url } = req.body;
    const videoUrl = share_url || url;
    
    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: '缺少视频链接参数'
      });
    }

    // 标准化抖音链接
    const normalizedUrl = normalizeDouyinUrl(videoUrl);
    console.log('标准化链接:', normalizedUrl);
    
    // 添加超时控制的解析
    const result = await Promise.race([
      parseDouyinVideo(normalizedUrl),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('请求超时')), 25000)
      )
    ]);
    
    if (result.success) {
      return res.status(200).json({
        code: 0,
        msg: '解析成功',
        data: {
          play_url: result.video_url,
          direct_video_url: result.video_url,
          desc: result.description || '无描述',
          author: {
            nickname: result.author || '未知作者'
          },
          cover_url: result.cover_url || '',
          video_type: result.video_url && result.video_url.includes('toutiaovod.com') ? 'toutiaovod' : 'other'
        }
      });
    } else {
      return res.status(500).json({
        code: 1,
        msg: result.error || '解析失败'
      });
    }

  } catch (error) {
    console.error('处理错误:', error.message);
    
    if (error.message === '请求超时') {
      return res.status(408).json({
        code: 1,
        msg: '请求超时，请稍后重试'
      });
    }
    
    return res.status(500).json({
      code: 1,
      msg: '服务器错误: ' + error.message
    });
  }
}

// 标准化抖音链接
function normalizeDouyinUrl(url) {
  if (!url) return url;
  
  // 移除末尾标点符号
  url = url.replace(/[!"'！。.,，、？?；;：:\]\[]+$/, '');
  
  // 支持modal_id格式
  if (url.includes('modal_id=')) {
    const match = url.match(/modal_id=(\d+)/);
    if (match) {
      return `https://www.douyin.com/video/${match[1]}`;
    }
  }
  
  // 支持短链接
  if (url.includes('v.douyin.com')) {
    const match = url.match(/https?:\/\/v\.douyin\.com\/[^\s]+/);
    if (match) {
      return match[0];
    }
  }
  
  // 支持直接链接
  if (url.includes('www.douyin.com/video/')) {
    const match = url.match(/https?:\/\/www\.douyin\.com\/video\/\d+/);
    if (match) {
      return match[0];
    }
  }
  
  return url;
}

// 解析抖音视频（优化版本）
async function parseDouyinVideo(url) {
  try {
    // 创建一个带超时的 fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时
    
    const response = await fetch('https://min.taoanlife.com/dy/api/de-url', {
      method: 'POST',
      headers: {
        'de-secret-key': 'CB9c3aOfTzFqePMjUARg6JQiLHlNnxut',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        share_url: url,
        de_type: 1
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('API响应:', data);

    if (data.code === 0 && data.data) {
      // 提取视频链接
      const videoUrl = extractVideoUrl(data.data);
      
      if (videoUrl) {
        return {
          success: true,
          video_url: videoUrl,
          description: data.data.desc || '无描述',
          author: data.data.author?.nickname || '未知作者',
          cover_url: data.data.cover_url || ''
        };
      } else {
        return {
          success: false,
          error: '未能提取到视频链接'
        };
      }
    } else {
      return {
        success: false,
        error: data.msg || '解析API返回错误'
      };
    }

  } catch (error) {
    console.error('解析失败:', error);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: '第三方API响应超时'
      };
    }
    
    return {
      success: false,
      error: '网络请求失败: ' + error.message
    };
  }
}

// 提取视频链接
function extractVideoUrl(data) {
  if (!data) return null;
  
  // 尝试多种字段
  const fields = [
    'play_url',
    'video_url', 
    'url',
    'video',
    'play_addr',
    'download_url'
  ];
  
  for (const field of fields) {
    if (data[field]) {
      let url = data[field];
      if (typeof url === 'object') {
        url = url.url || url.play_url;
      }
      if (url && typeof url === 'string' && url.startsWith('http')) {
        console.log(`找到视频链接 (${field}):`, url);
        return url;
      }
    }
  }
  
  return null;
}
