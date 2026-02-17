# TradeIntel 集成讨论记录 - 2026-02-17

**日期**: 2026-02-17  
**参与者**: Matthew + OpenClaw Agent  
**主题**: WeChat Viral 与 TradeIntel/FengTalk 的集成方案

---

## 🎯 集成目标

WeChat Viral 系统为 TradeIntel/FengTalk 提供微信生态的获客和裂变能力：

1. **参数化二维码** - Form 提交后生成带 Token 的二维码
2. **用户关联** - UnionID 打通网页和小程序用户
3. **裂变机制** - 分享海报赚积分换免费报告
4. **消息推送** - 通过公众号进行客户培育和转化

---

## 📋 讨论内容

### 1. 项目定位

**Q**: WeChat Viral 是独立项目还是 TradeIntel 的一部分？

**A**: 
- 技术上：独立项目，独立仓库、独立部署
- 业务上：服务 TradeIntel/FengTalk，通过 API 集成
- 品牌上：归属于 FengTalk 峰说品牌体系

```
FengTalk.ai (品牌)
├── fengtalk-website/     # 官方网站
├── data.fengtalk.ai/     # 海关数据产品
└── wechat-viral/         # 微信生态获客 (本项目)
    ├── 公众号
    ├── 小程序
    └── 裂变系统
```

### 2. 核心使用场景

#### 场景 A: Form → 微信关注 (已完成)

```
FengTalk 网站用户提交表单
    ↓
后端生成 UUID Token
    ↓
调用 WeChat Viral API: /api/generate-qr
    ↓
生成带 scene 参数的公众号二维码
    ↓
用户扫码关注
    ↓
微信推送关注事件 (含 scene)
    ↓
WeChat Viral 转发事件给 TradeIntel
    ↓
TradeIntel 匹配 Token 和 Form 数据
    ↓
发送个性化欢迎消息
```

**API 设计**:
```typescript
POST /api/wechat/generate-qr
Request:
{
  "token": "lead_a1b2c3d4",
  "userData": {
    "email": "user@example.com",
    "product": "注射器",
    "country": "哥伦比亚"
  }
}

Response:
{
  "qrCodeUrl": "https://mp.weixin.qq.com/...",
  "ticket": "gQH47joAAAAAAAAAAS...",
  "expireSeconds": 2592000
}
```

#### 场景 B: UnionID 用户打通

**问题**: 用户在小程序注册过，又在网页提交表单，如何识别是同一个人？

**方案**:
```
小程序注册时:
├── 获取 UnionID (微信返回)
├── 保存: {unionId, openId, userInfo}
└── 同时询问邮箱 (optional)

网页提交表单时:
├── 如果用户在小程序已注册
│   └── 通过 UnionID 关联
├── 如果用户先在网页提交
│   └── 小程序登录时通过 UnionID 关联
└── 统一用户画像
```

**数据表设计**:
```sql
CREATE TABLE unified_users (
  id UUID PRIMARY KEY,
  union_id VARCHAR(64) UNIQUE,  -- 微信 UnionID
  email VARCHAR(255),
  phone VARCHAR(20),
  mini_program_open_id VARCHAR(64),
  oa_open_id VARCHAR(64),
  form_submissions JSONB,       -- 提交的表单数据数组
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP
);
```

#### 场景 C: 裂变积分换报告

**机制**:
```
用户提交表单后 7天未购买
    ↓
TradeIntel 调用 WeChat Viral API
    ↓
发送消息: "分享赚积分换免费报告"
    ↓
用户点击生成海报
    ↓
WeChat Viral 生成带邀请参数的海报
    ↓
用户分享到朋友圈
    ↓
朋友扫码 → 关注 → 填写表单
    ↓
原用户获得积分
    ↓
积分达到阈值 → 调用 TradeIntel API 生成报告
```

**积分规则 (灵活配置)**:
| 行为 | 积分 | 说明 |
|------|------|------|
| 分享到朋友圈 | 1 | 生成并分享海报 |
| 获得 1 个点赞 | 2 | 朋友点赞 |
| 带来 1 个新用户 | 10 | 新用户填写表单 |
| 新用户购买 | 50 | 高价值转化 |

**兑换规则 (后台可配置)**:
```
5 分 = Demo 数据
10 分 = 单份完整报告 ($99)
20 分 = 月度会员体验
50 分 = 年度会员折扣
```

### 3. 技术对接

#### API 列表 (WeChat Viral 提供)

| 接口 | 用途 | 调用方 |
|------|------|--------|
| `POST /api/qr/generate` | 生成参数化二维码 | TradeIntel |
| `POST /api/message/send` | 发送模板消息 | TradeIntel |
| `GET /api/user/:unionId` | 查询用户信息 | TradeIntel |
| `POST /api/points/add` | 给用户加积分 | TradeIntel |
| `POST /api/webhook/event` | 微信事件回调 | WeChat Viral → TradeIntel |

#### 事件回调 (WeChat Viral → TradeIntel)

```typescript
POST https://tradeintel/api/webhook/wechat

// 关注事件
{
  "event": "subscribe",
  "unionId": "o123456789",
  "openId": "o987654321",
  "scene": "lead_a1b2c3d4",  // 如果有
  "timestamp": "2026-02-17T12:00:00Z"
}

// 扫码事件
{
  "event": "scan",
  "unionId": "o123456789",
  "openId": "o987654321",
  "scene": "invite_xyz789",  // 邀请码
  "timestamp": "2026-02-17T12:00:00Z"
}

// 分享事件
{
  "event": "share",
  "unionId": "o123456789",
  "shareType": "timeline",  // 朋友圈
  "contentId": "report_001",
  "timestamp": "2026-02-17T12:00:00Z"
}
```

### 4. 安全考虑

- **API 认证**: JWT Token 或 API Key
- **IP 白名单**: TradeIntel 服务器 IP
- **签名验证**: 微信消息签名验证
- **频率限制**: API 调用频率控制

### 5. 待开发功能

- [ ] API 接口文档完善
- [ ] TradeIntel 调用 SDK
- [ ] 事件回调配置界面
- [ ] 积分兑换对接
- [ ] 数据同步机制

---

## 📅 后续计划

1. **Phase 1**: API 接口开发 (Week 1)
2. **Phase 2**: UnionID 关联实现 (Week 2)
3. **Phase 3**: 积分系统对接 (Week 3)
4. **Phase 4**: 完整测试 (Week 4)

---

## 🔗 相关文档

- [TradeIntel PRD](https://github.com/matthew6688/fengtalk.ai/blob/main/PRD.md)
- [FengTalk 网站项目](https://github.com/matthew6688/fengtalk.ai)
- [微信官方文档](https://developers.weixin.qq.com/)

---

**记录时间**: 2026-02-17 13:20
