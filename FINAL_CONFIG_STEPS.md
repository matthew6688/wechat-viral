# 最终配置步骤 - 微信公众平台

## ✅ 当前状态
- ✅ 服务器运行正常（端口3000）
- ✅ Webhook路由已配置（`/api/oa/webhook` 和 `/api/oa/wh`）
- ✅ 路由测试通过

## 📋 在微信公众平台配置

### 步骤1：确认ngrok正在运行
```bash
# 检查ngrok进程
ps aux | grep ngrok | grep -v grep

# 如果没有运行，启动ngrok
ngrok http 3000
```

### 步骤2：获取ngrok URL
访问：http://127.0.0.1:4040
查看 "Forwarding" 部分，复制 HTTPS URL

或者使用命令：
```bash
curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1
```

### 步骤3：在微信公众平台配置

在"配置消息推送"对话框中：

**选项A：使用完整URL（推荐）**
- **URL**: `https://interrelatedly-unshocking-huong.ngrok-free.dev/api/oa/webhook`
  - ⚠️ **重要**：确保完整输入，最后是 `webhook`（不是 `webho`）
  - 如果输入框有字符限制导致截断，使用选项B

**选项B：使用短URL（如果选项A被截断）**
- **URL**: `https://interrelatedly-unshocking-huong.ngrok-free.dev/api/oa/wh`
  - 这是更短的别名，避免URL被截断

**其他配置**：
- **Token**: `1310fd175b28a5021a422a22786b7cb3`
- **EncodingAESKey**: `GT7YEwNZzxxLd4RJNcBsuehCj1LLOpT0ayNMhmDvu6H`
- **消息加密**: 安全模式（推荐）
- **数据格式**: XML

### 步骤4：提交配置

1. 点击"确定"按钮
2. **立即查看服务器日志**（运行 `npm run dev` 的终端）

### 步骤5：验证成功标志

如果配置成功，服务器日志应该显示：
```
Webhook verification request: { signature: '...', timestamp: '...', nonce: '...', echostr: '...' }
Signature verified successfully
```

微信公众平台应该显示：
- ✅ "配置成功"
- ✅ 服务器配置状态变为"已启用"

## 🔍 如果仍然失败

### 检查清单

1. **ngrok是否运行？**
   ```bash
   ps aux | grep ngrok | grep -v grep
   ```

2. **ngrok是否指向3000端口？**
   ```bash
   # 应该看到：ngrok http 3000
   ```

3. **服务器是否运行？**
   ```bash
   curl http://localhost:3000/health
   # 应该返回：{"status":"ok"}
   ```

4. **URL是否可以访问？**
   ```bash
   curl "https://your-ngrok-url.ngrok-free.dev/api/oa/webhook?signature=test&timestamp=123&nonce=456&echostr=hello"
   # 应该返回：Invalid signature（这是正常的）
   ```

5. **Token是否匹配？**
   - `.env` 文件：`OA_TOKEN=1310fd175b28a5021a422a22786b7cb3`
   - 微信平台：应该也是 `1310fd175b28a5021a422a22786b7cb3`

6. **URL是否完整？**
   - 检查是否被截断
   - 如果被截断，使用短URL：`/api/oa/wh`

### 常见错误

**错误：invalid args, 200002**
- 原因：URL不可访问或Token不匹配
- 解决：检查ngrok是否运行，URL是否正确，Token是否匹配

**错误：服务器验证失败**
- 原因：服务器没有正确响应验证请求
- 解决：检查服务器日志，确保路由正确

**错误：URL被截断**
- 原因：输入框字符限制
- 解决：使用短URL `/api/oa/wh`

## 📝 测试命令

```bash
# 测试本地服务器
curl http://localhost:3000/health

# 测试webhook路由（本地）
curl "http://localhost:3000/api/oa/webhook?signature=test&timestamp=123&nonce=456&echostr=hello"

# 测试webhook路由（通过ngrok）
curl "https://your-ngrok-url.ngrok-free.dev/api/oa/webhook?signature=test&timestamp=123&nonce=456&echostr=hello"
```

## ✅ 成功后的下一步

配置成功后：
1. 服务器配置状态变为"已启用"
2. 可以开始接收微信事件推送
3. 测试扫描二维码、关注服务号等功能
4. 检查数据库记录（`oa_follow_events`, `oa_scan_events` 表）
