# AGENTS.md - WeChat Viral 项目

## 项目信息

- **项目名称**: WeChat Viral Marketing System
- **项目类型**: 微信生态营销系统
- **技术栈**: Node.js + TypeScript + Supabase + 微信小程序
- **关联项目**: TradeIntel / FengTalk

---

## 技术偏好

### 后端
- **语言**: TypeScript (严格模式)
- **框架**: Express.js / Next.js API Routes
- **数据库**: Supabase (PostgreSQL)
- **ORM**: Prisma (推荐)

### 微信生态
- **小程序**: 微信原生小程序
- **公众号**: 微信官方 API
- **登录**: UnionID (跨平台识别)

### 部署
- **首选**: Vercel (已配置)
- **数据库**: Supabase Cloud
- **静态资源**: 腾讯云 COS (可选)

---

## 代码风格

- 函数式编程优先
- 严格 TypeScript 类型
- 错误处理: try/catch + 日志记录
- API 返回统一格式: `{ success, data, error }`

---

## 微信开发原则

1. **UnionID 优先**: 跨平台识别用户的核心
2. **事件驱动**: 所有微信交互都是异步事件
3. **幂等性**: 重复事件不重复处理
4. **安全**: 签名验证、Token 加密

---

## API 设计规范

```typescript
// 统一返回格式
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// 错误码规范
enum ErrorCode {
  INVALID_PARAM = 'INVALID_PARAM',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  WECHAT_ERROR = 'WECHAT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
```

---

## 与 TradeIntel 集成

- 提供 RESTful API 供 TradeIntel 调用
- 事件回调通知 TradeIntel
- 数据格式: JSON
- 认证: JWT 或 API Key

---

## 注意事项

- 微信 API 有调用频率限制
- UnionID 不是所有情况都能获取
- 小程序和公众号的 OpenID 不同
- 用户可能拒绝授权某些权限
