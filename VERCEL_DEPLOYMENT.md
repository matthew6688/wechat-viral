# Vercel 部署指南

本指南将帮助你将后端部署到 Vercel，以便在真机上正常使用小程序。

## 📋 前置要求

1. GitHub 账号
2. Vercel 账号（免费注册：https://vercel.com）
3. 已配置的环境变量

## 🚀 部署步骤

### 1. 将代码推送到 GitHub

```bash
# 确保所有更改已提交
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. 在 Vercel 导入项目

1. 访问 https://vercel.com 并登录
2. 点击 "Add New..." → "Project"
3. 选择你的 GitHub 仓库
4. 点击 "Import"

### 3. 配置项目设置

在 Vercel 项目配置页面：

**Framework Preset:** 选择 "Other" 或留空

**Root Directory:** 留空（项目在根目录）

**Build Command:** 
```
cd backend && npm install && npm run build
```

**Output Directory:** 
```
backend
```

**Install Command:**
```
cd backend && npm install
```

### 4. 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

#### 必需的环境变量

```
SUPABASE_URL=https://fseyfnuqxvrcwrpshxyv.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
WECHAT_APPID=wxb00a7034897b60fe
WECHAT_SECRET=your_wechat_secret_here
OA_APPID=your_oa_appid_here
OA_SECRET=your_oa_secret_here
OA_TOKEN=your_oa_token_here
OA_ENCODING_AES_KEY=your_oa_encoding_aes_key_here
JWT_SECRET=your_jwt_secret_here
NODE_ENV=production
PORT=3000
```

**⚠️ 需要替换的值：**

1. **SUPABASE_SERVICE_KEY** - 从 Supabase Dashboard → Settings → API → `service_role` key（不是 anon key）
2. **WECHAT_SECRET** - 从微信小程序后台 → 开发 → 开发管理 → 开发设置 → AppSecret
3. **OA_APPID** - 从微信公众平台 → 公众号 AppID
4. **OA_SECRET** - 从微信公众平台 → 公众号 AppSecret
5. **OA_TOKEN** - 在微信公众平台 → 开发 → 基本配置 → 服务器配置中设置的 Token
6. **OA_ENCODING_AES_KEY** - 在微信公众平台 → 开发 → 基本配置 → 服务器配置中的 EncodingAESKey
7. **JWT_SECRET** - 任意随机字符串（用于 JWT 签名，建议使用强随机字符串，例如：`openssl rand -base64 32`）

#### 可选的环境变量

```
PORT=3000
```

**如何添加环境变量：**
1. 在项目设置中，点击 "Environment Variables"
2. 逐个添加上述变量
3. 确保选择正确的环境（Production, Preview, Development）

### 5. 部署

1. 点击 "Deploy" 按钮
2. 等待构建完成（通常 2-5 分钟）
3. 部署成功后，Vercel 会提供一个 URL，例如：`https://your-app.vercel.app`

### 6. 更新小程序配置

部署成功后，更新小程序配置：

1. 打开 `miniprogram/utils/config.js`
2. 找到 `PRODUCTION_URL` 变量（约第 16 行）
3. 替换为你的 Vercel URL：

```javascript
var PRODUCTION_URL = 'https://your-app.vercel.app/api';
```

4. 重新编译小程序

### 7. 配置微信小程序域名白名单

1. 登录微信公众平台：https://mp.weixin.qq.com
2. 进入：开发 → 开发管理 → 开发设置 → 服务器域名
3. 在 `request合法域名` 中添加：
   - `https://your-app.vercel.app`
4. 点击保存

### 8. 测试

1. 在微信开发者工具中重新编译小程序
2. 在真机上测试，确认活动数据可以正常加载

## 🔧 故障排除

### 问题 1: 构建失败

**错误信息：** `Module not found` 或 `TypeScript errors`

**解决方案：**
- 确保 `backend/package.json` 包含所有依赖
- 检查 `backend/tsconfig.json` 配置
- 查看 Vercel 构建日志获取详细错误信息

### 问题 2: 运行时错误

**错误信息：** `Environment variable not set`

**解决方案：**
- 检查 Vercel 环境变量是否全部配置
- 确保环境变量名称正确（区分大小写）
- 重新部署以应用新的环境变量

### 问题 3: API 路由 404

**错误信息：** `Cannot GET /api/...`

**解决方案：**
- 检查 `vercel.json` 配置是否正确
- 确保 `api/index.ts` 文件存在
- 查看 Vercel 函数日志

### 问题 4: 小程序无法连接

**错误信息：** `ERR_NAME_NOT_RESOLVED` 或 `request:fail`

**解决方案：**
- 确认 `PRODUCTION_URL` 已正确配置
- 检查微信小程序域名白名单
- 确认 Vercel 部署状态为 "Ready"

## 📝 注意事项

1. **免费额度：** Vercel 免费版有使用限制，但通常足够小型项目使用
2. **冷启动：** Serverless 函数首次调用可能有延迟（冷启动）
3. **环境变量：** 不要在代码中硬编码敏感信息，使用环境变量
4. **域名：** 可以配置自定义域名（需要验证域名所有权）

## 🔄 更新部署

每次代码更新后：

1. 推送到 GitHub
2. Vercel 会自动检测并重新部署
3. 或手动在 Vercel 控制台点击 "Redeploy"

## 📚 相关文档

- [Vercel 文档](https://vercel.com/docs)
- [Vercel Node.js 支持](https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/node-js)
- [微信小程序网络请求](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html)
