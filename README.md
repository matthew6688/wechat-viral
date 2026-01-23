# WeChat Viral Marketing System

一个基于微信小程序和公众号的病毒式营销系统，通过二维码推广、邀请奖励和积分系统实现用户增长。

[![GitHub](https://img.shields.io/github/license/matthew6688/wechat-viral)](https://github.com/matthew6688/wechat-viral)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

## 📋 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [数据库迁移](#数据库迁移)
- [版本历史](#版本历史)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

## ✨ 功能特性

### 核心功能

#### 1. 用户系统
- ✅ 微信小程序登录（支持 UnionID 跨平台识别）
- ✅ 用户注册和信息完善
- ✅ 微信头像和昵称自动获取
- ✅ 邮箱/密码登录（管理员）

#### 2. 邀请系统
- ✅ 唯一邀请码生成
- ✅ 小程序二维码生成（带邀请参数）
- ✅ 公众号参数化二维码生成
- ✅ 邀请关系链追踪
- ✅ 邀请奖励积分

#### 3. 积分系统
- ✅ 积分账户管理
- ✅ 任务系统（注册、邀请等）
- ✅ 积分获取和消费记录
- ✅ 积分排行榜

#### 4. 奖励系统
- ✅ 奖励列表展示
- ✅ 积分兑换奖励
- ✅ 兑换记录查询
- ✅ 多种奖励类型支持

#### 5. 公众号集成
- ✅ 参数化二维码生成
- ✅ 扫码事件处理
- ✅ 关注/取消关注事件
- ✅ 自动回复消息
- ✅ 海报生成（带二维码）

#### 6. 管理后台
- ✅ 统一事件日志系统
- ✅ 实时统计数据
- ✅ 用户管理
- ✅ 邀请关系链查看
- ✅ OA 事件监控
- ✅ 活动设置管理

#### 7. UI/UX
- ✅ 极简设计风格（Attio/Linear 风格）
- ✅ 大量留白设计
- ✅ 响应式布局
- ✅ 流畅的用户体验

### 事件日志系统

系统自动记录以下事件：
- 🔐 **登录事件** - 微信小程序登录、邮箱登录
- 📝 **注册事件** - 用户注册和信息完善
- 📱 **扫描二维码** - 小程序码和公众号二维码扫描
- 👥 **关注事件** - 公众号关注/取消关注
- 🎁 **邀请事件** - 邀请关系建立
- 🎁 **兑换事件** - 积分兑换奖励

所有事件都包含：
- 用户信息
- 时间戳
- IP 地址
- User Agent
- 事件相关数据（邀请码、场景值等）

## 🛠 技术栈

### 后端
- **Node.js** + **Express** - Web 框架
- **TypeScript** - 类型安全
- **Supabase (PostgreSQL)** - 数据库
- **JWT** - 身份认证
- **Bcrypt** - 密码加密
- **Sharp** - 图片处理（海报生成）
- **xml2js** - XML 解析（微信事件）
- **wechat-crypto** - 微信消息加解密

### 前端
- **WeChat Mini Program** - 小程序（原生 WXML/WXSS/JS）
- **HTML/CSS/JavaScript** - 管理后台

### 基础设施
- **Supabase** - 数据库和认证
- **Cloudflare Tunnel** - 本地开发隧道
- **WeChat Official Account API** - 公众号接口
- **WeChat Mini Program API** - 小程序接口

## 📁 项目结构

```
WeChat Viral/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   ├── middleware/     # 中间件（认证、权限）
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑服务
│   │   └── types/          # TypeScript 类型定义
│   ├── scripts/            # 工具脚本
│   └── package.json
├── miniprogram/            # 微信小程序
│   ├── pages/              # 页面
│   ├── services/           # API 服务
│   ├── utils/              # 工具函数
│   └── app.js/ts           # 小程序入口
├── admin/                  # 管理后台
│   ├── login.html          # 登录页面
│   └── dashboard.html      # 仪表盘
├── database/
│   └── migrations/         # 数据库迁移文件
└── README.md
```

## 🚀 快速开始

### 前置要求

- Node.js 18+ 
- npm 或 yarn
- Supabase 账户
- 微信小程序和公众号账号

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/matthew6688/wechat-viral.git
cd wechat-viral
```

2. **安装后端依赖**
```bash
cd backend
npm install
```

3. **配置环境变量**

在 `backend/` 目录创建 `.env` 文件：

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# JWT
JWT_SECRET=your_jwt_secret

# WeChat Mini Program
WECHAT_APPID=your_miniprogram_appid
WECHAT_SECRET=your_miniprogram_secret

# WeChat Official Account
OA_APPID=your_oa_appid
OA_SECRET=your_oa_secret
OA_TOKEN=your_oa_token
OA_ENCODING_AES_KEY=your_encoding_aes_key

# Server
PORT=3000
```

4. **运行数据库迁移**

在 Supabase SQL Editor 中依次运行：
- `database/migrations/003_oa_qrcode_system.sql`
- `database/migrations/005_add_wechat_profile_fields.sql`
- `database/migrations/006_add_email_password_auth.sql`
- `database/migrations/007_create_event_logs.sql`

5. **启动后端服务**
```bash
cd backend
npm run dev
```

6. **配置小程序**

在微信开发者工具中：
- 导入 `miniprogram/` 目录
- 配置 `utils/config.ts` 中的 API 地址
- 配置合法域名

7. **配置公众号**

- 在微信公众平台配置服务器 URL
- 设置 Token 和 EncodingAESKey
- 配置 IP 白名单

## ⚙️ 配置说明

### 微信小程序配置

1. 获取 AppID 和 AppSecret
2. 在 `backend/src/config/wechat.ts` 中配置
3. 在小程序后台配置服务器域名

### 公众号配置

1. 获取 OA_APPID 和 OA_SECRET
2. 设置 OA_TOKEN（自定义）
3. 生成 OA_ENCODING_AES_KEY
4. 配置服务器 URL（需要 HTTPS）
5. 配置 IP 白名单

详细配置指南请参考：
- `OA_CONFIG_GUIDE.md`
- `WEBHOOK_TROUBLESHOOTING.md`

### 管理员设置

创建管理员用户：
```bash
cd backend
node scripts/create-admin-user.js email@example.com password "Admin Name"
```

或使用 SQL：
```sql
UPDATE users SET is_admin = true WHERE id = 'user_id';
```

## 📊 数据库迁移

所有数据库迁移文件位于 `database/migrations/`：

1. **003_oa_qrcode_system.sql** - OA 二维码系统和管理员支持
2. **004_setup_admin_user.sql** - 管理员用户设置模板
3. **005_add_wechat_profile_fields.sql** - 微信头像和昵称字段
4. **006_add_email_password_auth.sql** - 邮箱密码认证
5. **007_create_event_logs.sql** - 统一事件日志表

按顺序执行所有迁移文件。

## 📝 版本历史

详细的版本历史请查看 [CHANGELOG.md](CHANGELOG.md)

### v1.2.0 (2026-01-23) - Latest

#### 🎯 Admin Dashboard Enhancements

**All Contacts Page (New)**
- Unified user management with WeChat profile display
- Avatar, nickname, location, OpenID, UnionID
- User actions: delete, block, admin management
- Search, filter, pagination

**Overview Redesign**
- "Today's Pulse" dashboard with key business metrics
- Net Growth, Viral Coefficient, Reward Cost
- Campaign summary with performance breakdown
- Client-side caching with manual refresh

**Event History Improvements**
- Compact table layout (replaced card view)
- User column first, inline copy buttons
- Expandable rows for details

**Campaign Debug**
- Full event table in debug panel
- Same format as Event History

**Campaign Management**
- Delete campaign with cascading deletion

#### 🔧 WeChat Profile Capture

- Official Account: Full profile capture (avatar, nickname, location, gender)
- Mini Program: `wx.getUserProfile()` integration
- Profile authorization modal

#### 🐛 Bug Fixes

- WeChat OA profile not captured
- Duplicate webhook events
- Campaign events not showing in debug
- Mini Program registration form input issues

---

### v1.1.0 (2026-01-22)

#### 🎨 Complete UI Redesign

- Modern card-based layouts with rounded corners
- New color palette: Dark navy (#1a1a2e), Green accent (#10b981)
- Custom tab bar with icons
- Real-time SSE debug logs

---

### v1.0.0 (2026-01-22)

#### 🎉 初始发布

- WeChat Mini Program login and user system
- Invite code and QR code system
- Points and rewards system
- Official Account integration
- Admin dashboard with event logging

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👤 作者

**Matthew**

- GitHub: [@matthew6688](https://github.com/matthew6688)

## 🙏 致谢

- [Supabase](https://supabase.com/) - 优秀的 BaaS 平台
- [WeChat Open Platform](https://open.weixin.qq.com/) - 微信开放平台
- [Attio](https://attio.com/) & [Linear](https://linear.app/) - UI 设计灵感

## 📞 支持

如有问题或建议，请：
- 提交 [Issue](https://github.com/matthew6688/wechat-viral/issues)
- 查看 [文档](https://github.com/matthew6688/wechat-viral/tree/main/docs)

---

⭐ 如果这个项目对你有帮助，请给个 Star！
