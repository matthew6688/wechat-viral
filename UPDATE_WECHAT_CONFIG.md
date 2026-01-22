# 更新微信公众平台配置

## 步骤

### 1. 获取 Cloudflare Tunnel URL

Cloudflare Tunnel 启动后，会输出一个 URL，格式类似：
```
https://xxx-xxx-xxx.trycloudflare.com
```

### 2. 在微信公众平台配置

在"配置消息推送"对话框中：

1. **URL**: `https://xxx-xxx-xxx.trycloudflare.com/api/oa/wh`
   - 将 `xxx-xxx-xxx.trycloudflare.com` 替换为您的实际 URL
   - 使用 `/api/oa/wh` 路径（短路径，避免截断）

2. **Token**: `1310fd175b28a5021a422a22786b7cb3`

3. **EncodingAESKey**: `GT7YEwNZzxxLd4RJNcBsuehCj1LLOpT0ayNMhmDvu6H`

4. **消息加密**: 
   - 推荐先使用 **"兼容模式"**（更容易通过验证）
   - 或使用 **"安全模式"**（如果兼容模式成功）

5. **数据格式**: XML

6. 点击"确定"提交

### 3. 检查验证结果

提交后，查看：
- **服务器日志**（运行 `npm run dev` 的终端）
- **Cloudflare Tunnel 日志**（运行 `cloudflared tunnel` 的终端）

应该看到验证请求和成功响应。

## 优势

使用 Cloudflare Tunnel 相比 ngrok：
- ✅ 没有浏览器验证页面
- ✅ 不会阻止微信服务器的请求
- ✅ 更稳定可靠
- ✅ 免费使用
