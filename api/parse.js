// 最简化版本 - 用于测试
export default async function handler(req, res) {
  console.log('函数被调用了');
  
  // 基础 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 简单测试
  if (req.method === 'GET') {
    console.log('GET请求成功');
    return res.status(200).json({
      success: true,
      message: 'API正常运行',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    console.log('POST请求，Body:', req.body);
    
    try {
      const { share_url } = req.body;
      
      if (!share_url) {
        return res.status(400).json({
          success: false,
          error: '缺少链接参数'
        });
      }

      // 直接返回测试数据
      return res.status(200).json({
        code: 0,
        msg: '测试成功',
        data: {
          play_url: 'https://test-video-url.com/test.mp4',
          desc: '测试视频',
          author: { nickname: '测试用户' },
          video_type: 'test'
        }
      });

    } catch (error) {
      console.error('错误:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: '不支持的方法'
  });
}
