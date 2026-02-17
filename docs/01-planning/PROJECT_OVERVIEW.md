# WeChat Viral 项目概述

**项目**: WeChat Viral Marketing System  
**用途**: 微信生态病毒式营销系统（公众号 + 小程序）  
**关联项目**: TradeIntel / FengTalk  
**更新日期**: 2026-02-17

---

## 🎯 项目定位

**独立项目，但服务 TradeIntel/FengTalk**

```
TradeIntel/FengTalk (主站)
        ↓ API 调用
WeChat Viral (微信生态获客)
        ↓
   微信服务号
   微信小程序
   裂变海报系统
```

---

## 📋 核心功能

### 1. 用户系统
- 微信小程序登录 (UnionID)
- 公众号关注绑定
- 用户信息管理

### 2. 邀请系统
- 唯一邀请码
- 小程序参数化二维码
- 公众号参数化二维码
- 邀请关系链追踪

### 3. 积分系统
- 积分账户管理
- 任务奖励 (注册、邀请、分享)
- 积分排行榜
- 积分兑换

### 4. 奖励系统
- 奖励列表
- 积分兑换
- 兑换记录

### 5. 公众号集成
- 参数化二维码
- 扫码事件处理
- 自动回复
- 海报生成

### 6. 管理后台
- 事件日志
- 实时统计
- 用户管理
- 活动设置

---

## 🏗️ 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Node.js + TypeScript |
| 数据库 | Supabase (PostgreSQL) |
| 部署 | Vercel |
| 小程序 | 微信小程序原生 |
| 公众号 | 微信官方 API |

---

## 📁 项目结构

```
wechat-viral/
│
├── 📂 backend/           # 后端服务
│   ├── api/             # API 端点
│   ├── services/        # 业务逻辑
│   └── utils/           # 工具函数
│
├── 📂 miniprogram/       # 微信小程序
│   ├── pages/           # 页面
│   ├── components/      # 组件
│   └── utils/           # 工具
│
├── 📂 admin/             # 管理后台
│   └── dashboard/       # 仪表盘
│
├── 📂 database/          # 数据库
│   ├── migrations/      # 迁移文件
│   └── schemas/         # 表结构
│
├── 📂 docs/              # 文档
│   ├── 01-planning/     # 规划
│   ├── 02-integration/  # 集成
│   └── 03-technical/    # 技术
│
└── 📄 README.md          # 项目说明
```

---

## 🔗 与 TradeIntel/FengTalk 集成

### 使用场景

**场景 1: 裂变获客**
```
FengTalk 网站
    ↓
用户提交表单但没购买
    ↓
7天后收到微信消息
    ↓
"分享海报到朋友圈赚积分换免费报告"
    ↓
生成带参数的海报
    ↓
朋友扫码 → 关注公众号 → 填写表单
    ↓
原用户获得积分
    ↓
达到积分 → 兑换免费报告
```

**场景 2: 参数化二维码**
```
FengTalk Form 提交
    ↓
生成 Token (UUID)
    ↓
调用 WeChat Viral API
    ↓
生成带 scene 参数的公众号二维码
    ↓
用户扫码关注
    ↓
自动关联 Form 数据
    ↓
发送个性化欢迎消息
```

**场景 3: UnionID 打通**
```
用户 A 在小程序注册 (UnionID: xxx)
    ↓
用户 A 在网页提交 Form (邮箱: a@example.com)
    ↓
通过 UnionID 关联
    ↓
统一用户画像
```

---

## 📊 数据流

```
用户操作 (扫码/关注/分享)
        ↓
微信服务器推送事件
        ↓
WeChat Viral 后端接收
        ↓
处理业务逻辑 (积分/邀请/奖励)
        ↓
更新数据库
        ↓
调用 TradeIntel API (如有需要)
        ↓
发送微信消息给用户
```

---

## 🔐 关键配置

### 微信配置
- 小程序 AppID/AppSecret
- 公众号 AppID/AppSecret
- 支付配置 (如有)

### 数据库
- Supabase URL/Key
- 数据库连接

### 其他
- Vercel 部署配置
- 环境变量

---

## 📅 开发状态

| 功能 | 状态 |
|------|------|
| 用户系统 | ✅ 完成 |
| 邀请系统 | ✅ 完成 |
| 积分系统 | ✅ 完成 |
| 奖励系统 | ✅ 完成 |
| 公众号集成 | ✅ 完成 |
| 管理后台 | ✅ 完成 |
| 小程序 | ✅ 完成 |
| TradeIntel 集成 | 🚧 待开发 |

---

## 🚀 下一步

1. **API 接口文档** - 供 TradeIntel 调用
2. **UnionID 关联** - 打通网页和小程序用户
3. **积分兑换对接** - 积分换 TradeIntel 报告
4. **事件回调** - 通知 TradeIntel 用户行为

---

## 📞 相关项目

- **TradeIntel**: 海关数据分析系统
- **FengTalk**: 官方网站 (fengtalk.ai)
- **Data Product**: data.fengtalk.ai

---

**最后更新**: 2026-02-17
