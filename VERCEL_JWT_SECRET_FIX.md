# Vercel JWT_SECRET 配置指南

## 问题

小程序显示 "Invalid token" 错误，即使已经禁用了密码保护。

## 原因

当从本地服务器切换到 Vercel 服务器时，如果 `JWT_SECRET` 不同，之前用本地服务器生成的 JWT token 将无法在 Vercel 上验证。

## 解决方案

### 1. 确保 Vercel 上的 JWT_SECRET 配置正确

1. 登录 Vercel Dashboard：https://vercel.com/dashboard
2. 进入你的项目 → **Settings** → **Environment Variables**
3. 检查 `JWT_SECRET` 是否存在
4. 如果不存在或值不正确：
   - 点击 **Add New**
   - **Key**: `JWT_SECRET`
   - **Value**: 使用与本地 `.env` 文件相同的值（或生成新的强随机字符串）
   - **Environment**: 选择 **Production**, **Preview**, **Development**（全选）
   - 点击 **Save**

### 2. 生成新的 JWT_SECRET（如果需要）

如果你需要生成一个新的强随机字符串作为 `JWT_SECRET`：

```bash
# 使用 OpenSSL
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. 重新部署（如果修改了环境变量）

修改环境变量后，Vercel 会自动触发重新部署。如果没有自动部署：

1. 进入项目 → **Deployments**
2. 点击最新的部署右侧的 **...** 菜单
3. 选择 **Redeploy**

### 4. 清除小程序缓存并重新登录

由于 token 已失效，小程序会自动：
- 检测到 401 错误
- 清除旧的 token
- 自动触发重新登录
- 使用新的 JWT_SECRET 生成新的 token

**如果自动重新登录失败，可以手动清除缓存：**

1. 在微信开发者工具中：
   - 点击 **清缓存** → **清除数据缓存**
   - 或删除小程序并重新添加

2. 在真机上：
   - 删除小程序
   - 重新扫码添加

## 验证修复

修复后，小程序应该能够：
1. 自动检测到 token 无效
2. 清除旧 token
3. 自动重新登录
4. 成功加载活动数据

## 注意事项

- **JWT_SECRET 必须一致**：本地开发环境和 Vercel 生产环境应该使用相同的 `JWT_SECRET`，或者确保用户在不同环境之间切换时重新登录
- **安全性**：`JWT_SECRET` 应该是一个强随机字符串，不要使用默认值 `'your-secret-key'`
- **环境变量同步**：确保所有环境（Production, Preview, Development）都配置了相同的 `JWT_SECRET`

## 相关文件

- `backend/src/middleware/auth.ts` - JWT 验证中间件
- `backend/src/routes/auth.ts` - 登录路由，生成 JWT token
- `miniprogram/services/api.js` - API 服务，处理 401 错误
- `miniprogram/pages/home/index.js` - 首页，自动重新登录逻辑
