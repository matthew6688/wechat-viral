# Vercel Supabase DNS 解析失败修复指南

## 问题

Vercel serverless function 返回错误：
```
Error: getaddrinfo ENOTFOUND fseyfnuqxvrcwrpshxyv.supabase.co (ENOTFOUND)
```

这表明 Vercel 无法解析 Supabase 域名。

## 可能的原因

1. **Vercel 网络配置问题** - 某些区域的 serverless function 可能无法解析某些域名
2. **DNS 缓存问题** - Vercel 的 DNS 缓存可能有问题
3. **环境变量格式问题** - URL 格式可能不正确

## 解决方案

### 方案 1: 验证环境变量格式（推荐）

确保在 Vercel Dashboard 中，`SUPABASE_URL` 的值是：
```
https://fseyfnuqxvrcwrpshxyv.supabase.co
```

**不要包含**：
- 尾随斜杠 `/`
- 路径 `/rest/v1`
- 协议前缀重复

### 方案 2: 检查 Vercel 区域设置

1. 登录 Vercel Dashboard
2. 进入项目 → **Settings** → **General**
3. 检查 **Region** 设置
4. 如果可能，尝试切换到不同的区域（如 `us-east-1`）

### 方案 3: 使用 Supabase 的直接 IP（不推荐）

如果 DNS 持续失败，可以尝试使用 Supabase 的 IP 地址，但这不推荐，因为 IP 可能会变化。

### 方案 4: 检查 Vercel 网络配置

1. 登录 Vercel Dashboard
2. 进入项目 → **Settings** → **Functions**
3. 检查是否有网络限制或防火墙设置

### 方案 5: 重新部署

有时简单的重新部署可以解决 DNS 缓存问题：

1. 在 Vercel Dashboard 中，进入 **Deployments**
2. 点击最新部署右侧的 **...** 菜单
3. 选择 **Redeploy**

## 验证修复

修复后，检查 Vercel Function Logs：

1. 进入项目 → **Deployments**
2. 点击最新部署
3. 查看 **Function Logs**
4. 查找 `[Supabase]` 开头的日志
5. 应该看到 `[Supabase] Client initialized successfully`

## 如果问题仍然存在

如果以上方案都无法解决问题，可能需要：

1. **联系 Vercel 支持** - 这可能是 Vercel 平台的问题
2. **使用 Supabase 的 Edge Functions** - 作为替代方案
3. **使用其他托管服务** - 如 Railway、Render 等

## 临时解决方案

如果急需修复，可以尝试：

1. 在代码中添加 DNS 预解析
2. 使用 axios 替代 fetch（如果 Supabase 支持）
3. 添加更长的超时时间

## 相关文件

- `backend/src/config/supabase.ts` - Supabase 客户端配置
- `backend/src/index.ts` - 环境变量加载
