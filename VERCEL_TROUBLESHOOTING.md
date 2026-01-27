# Vercel 部署故障排除指南

## 常见错误和解决方案

### 错误 1: FUNCTION_INVOCATION_FAILED (500 Internal Server Error)

**可能原因：**
1. 环境变量未正确配置
2. 路径问题（admin 目录或静态文件）
3. TypeScript 编译问题
4. 依赖项缺失

**解决步骤：**

#### 1. 检查环境变量

在 Vercel Dashboard → Settings → Environment Variables 中确认所有必需的环境变量都已设置：

```
SUPABASE_URL
SUPABASE_SERVICE_KEY
WECHAT_APPID
WECHAT_SECRET
OA_APPID
OA_SECRET
OA_TOKEN
OA_ENCODING_AES_KEY
JWT_SECRET
NODE_ENV=production
```

#### 2. 查看构建日志

1. 在 Vercel Dashboard 中，点击失败的部署
2. 查看 "Build Logs" 标签页
3. 查找错误信息，特别是：
   - TypeScript 编译错误
   - 模块未找到错误
   - 环境变量缺失警告

#### 3. 查看函数日志

1. 在 Vercel Dashboard 中，点击 "Functions" 标签页
2. 点击 `api/index.ts`
3. 查看 "Logs" 标签页
4. 查找运行时错误

#### 4. 测试健康检查端点

部署后，访问：
```
https://your-app.vercel.app/health
```

如果返回 `{"status":"ok"}`，说明基本部署成功。

#### 5. 检查路径问题

如果错误与 admin 目录相关，确保：
- `admin/` 目录在项目根目录
- `vercel.json` 中 `includeFiles` 配置正确

### 错误 2: Module not found

**解决方案：**

1. 确保 `backend/package.json` 包含所有依赖
2. 在 Vercel 项目设置中，确认：
   - **Root Directory:** 留空
   - **Build Command:** `cd backend && npm install && npm run build`
   - **Output Directory:** 留空（Vercel 会自动处理）

### 错误 3: Environment variable not set

**解决方案：**

1. 在 Vercel Dashboard → Settings → Environment Variables
2. 确保所有变量都已添加
3. 确保选择了正确的环境（Production, Preview, Development）
4. 重新部署以应用新的环境变量

### 错误 4: TypeScript compilation errors

**解决方案：**

1. 本地测试编译：
   ```bash
   cd backend
   npm install
   npm run build
   ```
2. 修复所有 TypeScript 错误
3. 确保 `backend/tsconfig.json` 配置正确

### 错误 5: Admin pages not loading

**解决方案：**

1. 确保 `admin/` 目录在项目根目录
2. 检查 `vercel.json` 中的 `includeFiles` 配置
3. 如果仍然有问题，可以暂时禁用 admin 静态文件服务，只使用 API

## 调试技巧

### 1. 添加详细日志

在 `backend/src/index.ts` 中添加：

```typescript
console.log('Environment check:', {
  VERCEL: process.env.VERCEL,
  NODE_ENV: process.env.NODE_ENV,
  SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
  // 不要记录敏感信息
});
```

### 2. 测试最小化部署

创建一个简单的测试端点：

```typescript
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is working',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});
```

### 3. 检查 Vercel 函数大小限制

- 函数代码大小限制：50MB（未压缩）
- 如果超过限制，考虑：
  - 移除不必要的依赖
  - 使用外部 CDN 存储静态文件
  - 优化代码

## 快速修复清单

- [ ] 所有环境变量已配置
- [ ] TypeScript 编译无错误
- [ ] `vercel.json` 配置正确
- [ ] `api/index.ts` 存在且正确
- [ ] `backend/src/index.ts` 导出正确
- [ ] `admin/` 目录在正确位置
- [ ] 构建日志无错误
- [ ] 函数日志无运行时错误

## 获取帮助

如果问题仍然存在：

1. 查看 Vercel 官方文档：https://vercel.com/docs
2. 检查 Vercel 社区论坛
3. 查看项目的 GitHub Issues
