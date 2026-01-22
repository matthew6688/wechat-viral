# 小程序故障排查指南

## 当前问题：按钮点击无响应

### 可能原因

1. **模块加载失败**
   - 错误：`module 'services/api.js' is not defined`
   - 解决：已创建 `services/api.js` 文件

2. **路由跳转失败**
   - 检查控制台是否有错误
   - 检查页面路径是否正确

3. **API 调用失败**
   - 检查后端服务器是否运行
   - 检查 API_BASE_URL 是否正确

### 调试步骤

1. **查看控制台日志**
   - 点击按钮后，应该看到：
     - `CTA button clicked`
     - `Current user: ...`
     - `No user, navigating to register` 或 `User exists, switching to home`
     - `Navigate to register success` 或 `Switch to home success`

2. **检查后端服务器**
   ```bash
   curl http://localhost:3000/health
   ```
   应该返回：`{"status":"ok"}`

3. **检查 API 配置**
   - 文件：`miniprogram/utils/config.js`
   - 确保 `API_BASE_URL` 正确

4. **测试按钮点击**
   - 在 landing 页面点击"立即开始"按钮
   - 查看控制台输出
   - 如果没有任何日志，可能是事件绑定问题

### 如果仍然无法跳转

1. **检查页面路径**
   - 确保 `app.json` 中包含了所有页面路径
   - 确保页面文件存在

2. **检查网络请求**
   - 在 Network 面板查看是否有请求
   - 检查请求是否成功

3. **清除缓存**
   - 在微信开发者工具中：工具 → 清除缓存
   - 重新编译项目

## 文件结构检查

确保以下文件存在：
- ✅ `app.js`
- ✅ `app.json`
- ✅ `services/api.js`
- ✅ `services/storage.js`
- ✅ `utils/config.js`
- ✅ 所有页面的 `.js` 文件

## 下一步

如果按钮点击后仍然没有跳转，请：
1. 查看控制台日志
2. 告诉我具体的错误信息
3. 检查后端服务器是否运行
