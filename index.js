const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.sendStatus(204);
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PushMe Home Forwarder', time: new Date().toISOString() });
});

app.post('/forward', async (req, res) => {
  try {
    const data = req.body;
    let title = '通知';
    let content = '';
    
    // 情况1：如果请求体是标准JSON格式（如 {"title": "xx", "content": "yy"}）
    if (data && typeof data === 'object') {
      title = data.title || data.Title || title;
      content = data.content || data.Content || data.message || data.desp || data.text || '';
    } 
    // 情况2：如果请求体是纯文本（即青龙脚本当前发送的格式）
    else if (typeof data === 'string') {
      // 尝试按“标题”和“内容”的分隔符（如两个换行）来拆分
      const parts = data.split(/\n\s*\n/); // 用至少一个空行作为分隔符
      if (parts.length >= 2) {
        title = parts[0].trim(); // 第一部分作为标题
        content = parts.slice(1).join('\n').trim(); // 剩余部分作为内容
      } else {
        // 如果没有明确分隔，整个字符串作为内容
        content = data.trim();
      }
    }
    
    // 将内容转为字符串进行处理
    content = String(content);
    // ... 后续的清洗逻辑保持不变

    let cleanTitle = title.replace(/^【|】$/g, '').replace(/【微博线报[^】]*】/g, '').replace(/\s+/g, ' ').trim();
    if (cleanTitle.length > 60) cleanTitle = cleanTitle.substring(0, 57) + '...';

    if (content.startsWith('{"content":"')) {
      try {
        const parsed = JSON.parse(content);
        content = parsed.content || content;
      } catch (e) {
        content = content.replace(/^{"content":"/, '').replace(/"}$/, '');
      }
    }
    let cleanContent = content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    cleanContent = cleanContent.replace(/^```(json|text)?\s*/gm, '').replace(/```$/gm, '').trim();

    const lines = cleanContent.split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('---') && !line.trim().startsWith('原文链接'))
      .slice(0, 3)
      .map(line => line.trim().substring(0, 120))
      .join('\n');

    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    const link = urlMatch ? urlMatch[0] : '';

    let finalMessage = `📢 ${cleanTitle}\n───────────────`;
    if (lines) finalMessage += `\n${lines}`;
    if (link) finalMessage += `\n\n🔗 ${link}`;
    if (finalMessage.length > 1500) finalMessage = finalMessage.substring(0, 1497) + '...';

    // !!! 重要：修改主题名 !!!
    const NTFY_TOPIC = '1fwOydlThy9dX51x'; // 第58行：修改为你的主题，例如 'my_topic_123'
    const ntfyResponse = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': cleanTitle,
        'Tags': 'incoming_envelope',
        'Priority': '3',
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: finalMessage
    });

    res.json({
      success: ntfyResponse.ok,
      message: ntfyResponse.ok ? '转发成功' : '转发失败',
      ntfyStatus: ntfyResponse.status
    });

  } catch (error) {
    console.error('处理错误:', error);
    res.status(500).json({ success: false, error: '内部服务器错误' });
  }
});

// 在你的 index.js 中，添加以下路由（放在 app.listen 之前）
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'PushMe Forwarder is running on LeanCloud' });
});

// 原有的健康检查接口保持不变
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PushMe Forwarder on LeanCloud', time: new Date().toISOString() });
});

// 然后才是 app.listen(...)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 家庭中转服务已启动: http://0.0.0.0:${PORT}`);
  console.log(`健康检查地址: http://localhost:${PORT}/health`);

});
