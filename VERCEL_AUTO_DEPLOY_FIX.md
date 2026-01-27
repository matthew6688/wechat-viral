# Vercel 自动部署修复指南

## ✅ 代码已成功推送

代码已推送到 GitHub: `https://github.com/matthew6688/wechat-viral.git`

## 🔍 检查 Vercel 自动部署

### 1. 检查 Vercel 项目是否连接到 GitHub

1. 登录 Vercel Dashboard: https://vercel.com/dashboard
2. 找到你的项目
3. 点击项目进入设置
4. 查看 "Git" 部分：
   - **Repository**: 应该显示 `matthew6688/wechat-viral`
   - **Production Branch**: 应该是 `main` 或 `master`

### 2. 如果项目未连接 GitHub

**方法 1: 重新导入项目**
1. 在 Vercel Dashboard，点击 "Add New..." → "Project"
2. 选择 GitHub 仓库 `matthew6688/wechat-viral`
3. 如果项目已存在，选择 "Import Existing Project"
4. 确认 Git 连接

**方法 2: 手动连接**
1. 进入项目设置 → Git
2. 点击 "Connect Git Repository"
3. 选择 `matthew6688/wechat-viral`
4. 确认连接

### 3. 检查自动部署设置

1. 进入项目设置 → Git
2. 确认以下设置：
   - ✅ **Production Branch**: `main` (或 `master`)
   - ✅ **Auto-deploy**: 应该启用
   - ✅ **Deploy Hooks**: 检查是否有 webhook

### 4. 检查 GitHub Webhook

1. 在 GitHub 仓库页面: https://github.com/matthew6688/wechat-viral
2. 进入 Settings → Webhooks
3. 查找 Vercel webhook (URL 应该包含 `vercel.com`)
4. 如果不存在，Vercel 可能没有正确连接

### 5. 手动触发部署

如果自动部署未触发，可以手动触发：

**方法 1: 在 Vercel Dashboard**
1. 进入项目页面
2. 点击 "Deployments" 标签
3. 点击 "Redeploy" 按钮
4. 选择最新的 commit (`f2c6cf8`)

**方法 2: 使用 Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel --prod
```

**方法 3: 创建空提交触发**
```bash
git commit --allow-empty -m "Trigger Vercel deployment"
git push origin main
```

## 🔧 常见问题

### 问题 1: Vercel 显示 "No deployments"

**解决方案:**
- 确认项目已连接到 GitHub 仓库
- 检查 Vercel 项目设置中的 Git 配置
- 尝试手动触发部署

### 问题 2: 自动部署被禁用

**解决方案:**
1. 进入项目设置 → Git
2. 启用 "Auto-deploy from Git"
3. 保存设置

### 问题 3: 部署失败但未触发

**解决方案:**
- 检查 Vercel Dashboard 中的 "Deployments" 标签
- 查看是否有失败的部署记录
- 检查构建日志中的错误

### 问题 4: GitHub Webhook 未配置

**解决方案:**
1. 在 Vercel Dashboard → 项目设置 → Git
2. 断开并重新连接 GitHub 仓库
3. 这会自动创建新的 webhook

## 📋 验证清单

- [ ] 代码已推送到 GitHub (`f2c6cf8`)
- [ ] Vercel 项目已连接到 GitHub 仓库
- [ ] Production Branch 设置为 `main`
- [ ] 自动部署已启用
- [ ] GitHub Webhook 已配置
- [ ] 最新部署显示在 Vercel Dashboard

## 🚀 下一步

1. **检查 Vercel Dashboard** - 查看是否有新的部署
2. **如果未自动部署** - 按照上述步骤手动触发
3. **查看部署日志** - 确认构建是否成功
4. **测试部署** - 访问 `https://your-app.vercel.app/health`

## 📞 需要帮助？

如果问题仍然存在：
1. 查看 Vercel 官方文档: https://vercel.com/docs/concepts/git
2. 检查 Vercel 状态页面: https://www.vercel-status.com
3. 联系 Vercel 支持
