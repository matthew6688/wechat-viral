# Webhook 配置故障排查指南

## 错误信息
"检查消息推送配置失败: invalid args, 200002"

## 可能的原因

### 1. 服务器未运行
- **检查**：访问 `http://localhost:3000/health` 应该返回 `{"status":"ok"}`
- **解决**：启动服务器 `cd backend && npm run dev`

### 2. ngrok URL 不可访问
- **检查**：访问 `https://interrelatedly-unshocking-huong.ngrok-free.dev/api/oa/webhook`
- **解决**：
  - 确保ngrok正在运行：`ngrok http 3000`
  - 如果ngrok已停止，重新启动并更新URL

### 3. Token 不匹配
- **检查**：确保 `.env` 文件中的 `OA_TOKEN` 与微信公众平台配置的Token完全一致
- **当前配置**：
  - `.env`: `OA_TOKEN=1310fd175b28a5021a422a22786b7cb3`
  - 微信平台：应该也是 `1310fd175b28a5021a422a22786b7cb3`

### 4. 路由路径错误
- **检查**：URL应该是 `/api/oa/webhook`（不是 `/webhook`）
- **完整URL**：`https://interrelatedly-unshocking-huong.ngrok-free.dev/api/oa/webhook`

### 5. 服务器需要重启
- **解决**：修改代码后需要重启服务器
  ```bash
  # 停止当前服务器（Ctrl+C）
  # 重新启动
  cd backend && npm run dev
  ```

## 测试步骤

### 步骤1：测试本地服务器
```bash
curl http://localhost:3000/health
# 应该返回：{"status":"ok"}
```

### 步骤2：测试ngrok
```bash
curl https://interrelatedly-unshocking-huong.ngrok-free.dev/api/oa/webhook
# 应该返回错误（因为没有参数），但说明URL可访问
```

### 步骤3：测试webhook验证
```bash
# 模拟微信验证请求
curl "https://interrelatedly-unshocking-huong.ngrok-free.dev/api/oa/webhook?signature=test&timestamp=123&nonce=456&echostr=hello"
# 应该返回 "Invalid signature"（因为签名不正确，但说明路由工作正常）
```

### 步骤4：检查服务器日志
查看后端服务器控制台，应该看到：
```
Webhook verification request: { signature: '...', timestamp: '...', nonce: '...', echostr: '...' }
```

## 快速修复清单

- [ ] 后端服务器正在运行（`npm run dev`）
- [ ] ngrok正在运行（`ngrok http 3000`）
- [ ] ngrok URL已更新到微信公众平台
- [ ] Token在 `.env` 和微信平台完全一致
- [ ] URL路径正确：`/api/oa/webhook`
- [ ] 服务器已重启（如果修改了代码）
- [ ] 检查服务器日志是否有错误

## 常见错误代码

- **200002**: 参数错误（通常是Token不匹配或URL不可访问）
- **200013**: Token验证失败
- **200014**: URL验证失败

## 如果仍然失败

1. **检查ngrok是否还在运行**
   ```bash
   # 查看ngrok进程
   ps aux | grep ngrok
   ```

2. **重新启动ngrok并更新URL**
   ```bash
   # 停止旧ngrok
   pkill ngrok
   
   # 启动新ngrok
   ngrok http 3000
   
   # 复制新的HTTPS URL
   # 更新到微信公众平台
   ```

3. **检查防火墙/网络**
   - 确保本地3000端口没有被防火墙阻止
   - 确保ngrok可以访问本地服务器

4. **查看详细日志**
   - 后端服务器控制台
   - ngrok控制台（http://127.0.0.1:4040）

## 成功标志

当配置成功时，您应该看到：
- 微信公众平台显示"配置成功"
- 后端服务器日志显示验证请求
- 可以正常接收微信事件推送
