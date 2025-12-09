const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 处理
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.sendStatus(204);
  }
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PushMe Fly.io Forwarder', timestamp: new Date().toISOString() });
});

// 主转发端点
app.post('/forward', async (req, res) => {
  try {
    const data = req.body;
    const title = data?.title || data?.Title || 'PushMe通知';
    let content = data?.content || data?.Content || data?.message || data?.desp || data?.text || '';

    if (typeof content === 'object') content = JSON.stringify(content);
    content = String(content);

    // 清理标题
    let cleanTitle = title
      .replace(/^【|】$/g, '')
      .replace(/【微博线报[^】]*】/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanTitle.length > 60) cleanTitle = cleanTitle.substring(0, 57) + '...';

    // 清理内容
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

    // 精简内容
    const lines = cleanContent.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('---') && !trimmed.startsWith('原文链接');
      })
      .slice(0, 3)
      .map(line => line.trim().substring(0, 120))
      .join('\n');

    // 提取链接
    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    const link = urlMatch ? urlMatch[0] : '';

    // 构建最终消息
    let finalMessage = `📢 ${cleanTitle}\n───────────────`;
    if (lines) finalMessage += `\n${lines}`;
    if (link) finalMessage += `\n\n🔗 ${link}`;
    if (finalMessage.length > 1500) finalMessage = finalMessage.substring(0, 1497) + '...';

    // !!! 重要：将 YOUR_NTFY_TOPIC 替换为你的真实主题名 !!!
    const NTFY_TOPIC = '1fwOydlThy9dX51x'; // <<<<< 第64行：必须修改！！！ <<<<<

    // 转发到 ntfy
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
      message: ntfyResponse.ok ? '消息转发成功' : '转发到Ntfy失败',
      ntfyStatus: ntfyResponse.status
    });

  } catch (error) {
    console.error('Fly.io 转发错误:', error);
    res.status(500).json({ success: false, error: '内部服务器错误' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Fly.io 转发器运行在端口 ${PORT}`);
});
