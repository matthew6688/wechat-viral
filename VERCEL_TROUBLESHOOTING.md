# Vercel 部署故障排除指南

## 当前问题

小程序返回 "TypeError: fetch failed" 错误，即使 Vercel URL 已配置。

## 可能的原因

1. **Vercel 函数无法正确加载 Express app**
2. **环境变量未正确配置**
3. **编译后的代码有问题**
4. **微信小程序域名白名单未配置**

## 解决步骤

### 1. 检查 Vercel 部署日志

1. 登录 Vercel Dashboard
2. 进入项目 → **Deployments**
3. 点击最新的部署
4. 查看 **Build Logs** 和 **Function Logs**
5. 查找错误信息

### 2. 验证环境变量

确保以下环境变量都已配置：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `WECHAT_APPID`
- `WECHAT_SECRET`
- `JWT_SECRET`
- `OA_APPID` (如果使用)
- `OA_SECRET` (如果使用)
- `OA_TOKEN` (如果使用)
- `OA_ENCODING_AES_KEY` (如果使用)

### 3. 测试 Vercel API

使用 curl 测试 API 端点：

```bash
# 测试健康检查
curl https://your-vercel-url.vercel.app/health

# 测试活动列表（公开端点）
curl https://your-vercel-url.vercel.app/api/campaigns

# 测试登录（需要 code）
curl -X POST https://your-vercel-url.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}'
```

### 4. 配置微信小程序域名白名单

在微信小程序后台：
1. 进入 **开发** → **开发管理** → **开发设置** → **服务器域名**
2. 在 **request合法域名** 中添加：
   - `https://wechat-viral-4lq4hct57-matthews-projects-09dd8000.vercel.app`

### 5. 检查 Vercel 函数配置

确保 `vercel.json` 配置正确：

```json
{
  "version": 2,
  "buildCommand": "cd backend && npm install --include=dev && npm run build",
  "installCommand": "cd backend && npm install --include=dev",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api/index"
    }
  ],
  "functions": {
    "api/index.ts": {
      "includeFiles": "admin/**"
    }
  }
}
```

### 6. 重新部署

如果修改了配置或代码：
1. 推送到 GitHub
2. Vercel 会自动重新部署
3. 等待部署完成
4. 检查部署日志

### 7. 本地测试编译

在本地测试编译过程：

```bash
cd backend
npm install --include=dev
npm run build
node dist/index.js
```

如果本地运行正常，但 Vercel 失败，可能是环境变量或构建配置问题。

## 常见错误

### "TypeError: fetch failed"
- **原因**: Vercel 函数无法正确加载或执行
- **解决**: 检查部署日志，确保所有依赖都已安装

### "Cannot find module"
- **原因**: 依赖未正确安装或路径错误
- **解决**: 检查 `package.json` 和 `installCommand`

### "Environment variable not set"
- **原因**: 环境变量未在 Vercel Dashboard 中配置
- **解决**: 在 Vercel Dashboard → Settings → Environment Variables 中添加

## 调试技巧

1. **添加详细日志**: 在代码中添加 `console.log` 来追踪执行流程
2. **检查函数日志**: 在 Vercel Dashboard 中查看实时函数日志
3. **使用健康检查端点**: 测试 `/health` 端点确认服务器运行正常
4. **逐步测试**: 先测试简单的端点（如 `/health`），再测试复杂端点

## 联系支持

如果问题仍然存在：
1. 收集 Vercel 部署日志
2. 收集函数执行日志
3. 收集错误堆栈信息
4. 联系 Vercel 支持或检查文档
