# 下一步操作指南

## ✅ 当前状态
- ✅ 服务号配置已填写到 `.env` 文件
- ✅ AppID: `wx8ac32e041766b617`
- ✅ AppSecret: `53ef6c6ebabb52af28deda3efcc48665`
- ✅ Token: `1310fd175b28a5021a422a22786b7cb3`
- ✅ EncodingAESKey: `GT7YEwNZzxxLd4RJNcBsuehCj1LLOpT0ayNMhmDvu6H`

## 📋 下一步操作清单

### 1. 确认微信公众平台配置
在微信公众平台的"配置消息推送"对话框中，确保：
- ✅ URL: `https://yourdomain.com/api/oa/webhook`（或ngrok URL）
- ✅ Token: `1310fd175b28a5021a422a22786b7cb3`（与.env一致）
- ✅ EncodingAESKey: `GT7YEwNZzxxLd4RJNcBsuehCj1LLOpT0ayNMhmDvu6H`（与.env一致）
- ✅ 消息加密: 安全模式（推荐）
- ✅ 数据格式: XML

**重要**：点击"确定"后，微信会验证服务器。确保后端服务器已启动。

---

### 2. 安装依赖
```bash
cd backend
npm install xml2js @types/xml2js sharp
```

---

### 3. 执行数据库迁移
在Supabase SQL Editor中执行：
```sql
-- 执行迁移文件
-- database/migrations/003_oa_qrcode_system.sql
```

---

### 4. 设置管理员用户
在Supabase SQL Editor中执行：
```sql
-- 替换为您的手机号或用户ID
UPDATE users SET is_admin = TRUE WHERE phone = 'YOUR_PHONE_NUMBER';
```

---

### 5. 启动后端服务器
```bash
cd backend
npm run dev
```

服务器应该运行在 `http://localhost:3000`

---

### 6. 配置微信公众平台服务器URL

**选项A：如果已有服务器**
- URL: `https://yourdomain.com/api/oa/webhook`

**选项B：本地开发测试（使用ngrok）**
```bash
# 1. 安装ngrok（如果还没有）
brew install ngrok

# 2. 启动ngrok（在另一个终端）
ngrok http 3000

# 3. 复制ngrok提供的HTTPS URL
# 例如：https://abc123.ngrok-free.app

# 4. 在微信公众平台配置
# URL: https://abc123.ngrok-free.app/api/oa/webhook
```

---

### 7. 验证配置
1. 在微信公众平台点击"确定"
2. 查看后端服务器日志，应该看到验证请求
3. 如果验证成功，配置保存成功
4. 如果验证失败，检查：
   - 后端服务器是否运行
   - URL是否正确
   - Token是否匹配

---

### 8. 测试功能

**测试二维码生成**：
```bash
# 在小程序中进入"邀请"页面
# 切换到"服务号二维码"标签
# 应该能看到二维码
```

**测试事件推送**：
1. 扫描生成的服务号二维码
2. 关注服务号
3. 检查后端日志，应该看到事件推送
4. 检查数据库，应该记录到 `oa_follow_events` 表

**测试管理员功能**：
1. 使用管理员账号登录小程序
2. 进入管理员页面
3. 查看Debug数据和统计数据

---

## 🔍 故障排查

### 如果服务器验证失败：
1. 检查后端服务器是否运行：`curl http://localhost:3000/health`
2. 检查Token是否匹配（.env和微信平台）
3. 检查URL是否正确（注意是 `/api/oa/webhook`）
4. 查看后端日志，看是否有错误

### 如果二维码生成失败：
1. 检查OA_APPID和OA_SECRET是否正确
2. 检查后端日志，看是否有API错误
3. 确认服务号有生成二维码的权限

### 如果事件推送没有收到：
1. 确认服务器配置已启用
2. 检查服务器URL是否可访问
3. 检查后端日志，看是否有请求
4. 确认Token和EncodingAESKey匹配

---

## ✅ 完成检查清单

- [ ] 已安装依赖（xml2js, sharp）
- [ ] 已执行数据库迁移
- [ ] 已设置管理员用户
- [ ] 后端服务器已启动
- [ ] 微信公众平台服务器配置已填写
- [ ] 微信公众平台配置已提交并验证成功
- [ ] 已测试二维码生成
- [ ] 已测试事件推送
- [ ] 已测试管理员功能

---

## 🚀 快速启动命令

```bash
# 1. 安装依赖
cd backend && npm install xml2js @types/xml2js sharp

# 2. 启动服务器
npm run dev

# 3. 在另一个终端启动ngrok（如果需要）
ngrok http 3000
```

配置完成后，系统就可以正常工作了！
