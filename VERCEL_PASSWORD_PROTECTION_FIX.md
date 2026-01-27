# Vercel 密码保护问题修复

## 问题

Vercel 部署显示 "Authentication Required"，导致 API 无法访问，小程序返回 401 错误。

## 原因

Vercel 的预览部署（Preview Deployments）默认启用密码保护。这会影响：
- API 端点无法访问
- 小程序无法获取数据
- 返回 401 错误

## 解决方案

### 方法 1: 禁用预览部署的密码保护（推荐）

1. 登录 Vercel Dashboard
2. 进入项目设置：Settings → Deployment Protection
3. 找到 "Preview Deployments" 部分
4. 将 "Password Protection" 设置为 **Disabled**
5. 保存设置

### 方法 2: 配置生产部署为公开访问

1. 进入项目设置：Settings → Deployment Protection
2. 找到 "Production Deployments" 部分
3. 确保 "Password Protection" 为 **Disabled**
4. 保存设置

### 方法 3: 使用生产域名（如果已配置自定义域名）

如果你有自定义域名：
1. 在 Vercel Dashboard → Settings → Domains
2. 添加你的自定义域名
3. 配置 DNS 记录
4. 使用自定义域名访问（通常没有密码保护）

## 验证修复

修复后，测试 API 端点：

```bash
curl https://your-vercel-url.vercel.app/api/campaigns
```

应该返回 JSON 数据，而不是认证页面。

## 注意事项

- 禁用密码保护后，所有部署都是公开访问的
- 如果担心安全性，可以考虑：
  - 使用环境变量保护敏感端点
  - 配置 IP 白名单（Vercel Pro 功能）
  - 使用 API 密钥验证
