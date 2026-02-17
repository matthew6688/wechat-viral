# 开发环境指南

**项目**: WeChat Viral Marketing System  
**更新**: 2026-02-17

---

## 🚀 快速启动

### 1. 进入项目目录

```bash
cd ~/wechat-viral
# 或
cd /path/to/wechat-viral
```

### 2. 安装后端依赖

```bash
cd backend
npm install
```

### 3. 配置环境变量

```bash
# .env 文件已创建，包含:
SUPABASE_URL=https://qkfyktfgbrslbmtaxghb.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=3002
```

### 4. 启动后端服务

```bash
# 开发模式
npm run dev

# 或生产模式
npm run build
npm start
```

### 5. 访问服务

```
Backend API: http://localhost:3002
Admin Dashboard: http://localhost:3002/admin/dashboard.html
```

---

## 🛠️ 常用命令

### Backend
```bash
cd backend

npm run dev      # 开发模式 (热重载)
npm run build    # 编译 TypeScript
npm start        # 生产模式
```

### 数据库
```bash
# 查看 Supabase 表
# 登录 https://app.supabase.com → qkfyktfgbrslbmtaxghb

# 或用 SQL 客户端
psql "postgresql://postgres:password@qkfyktfgbrslbmtaxghb.supabase.co:5432/postgres"
```

---

## 🔐 环境变量

### 必需配置
```env
SUPABASE_URL=https://qkfyktfgbrslbmtaxghb.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=3002
```

### 微信配置 (需要额外设置)
```env
WECHAT_APPID=wx...
WECHAT_SECRET=...
WECHAT_TOKEN=...
WECHAT_ENCODING_AES_KEY=...
```

---

## 🐛 调试方法

### 1. API 调试

```bash
# 测试后端是否运行
curl http://localhost:3002/api/health

# 测试微信接口
curl http://localhost:3002/api/wechat/qr
```

### 2. 日志查看

```bash
# 开发模式实时日志
npm run dev

# 查看错误
npm run dev 2>&1 | grep -i error
```

### 3. Supabase 调试

```bash
# 检查数据库连接
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('users').select('count').then(console.log);
"
```

### 4. 微信调试

```bash
# 使用微信开发者工具
# 下载: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

# 导入小程序项目
# 选择 miniprogram/ 文件夹
```

---

## ⚠️ 常见错误 & 解决

### 错误 1: Supabase 连接失败

**现象**:
```
Error: connect ETIMEDOUT
Error: supabaseUrl is required
```

**解决**:
```bash
# 检查 .env 文件
ls -la .env
cat .env

# 检查网络
ping qkfyktfgbrslbmtaxghb.supabase.co

# 重新启动服务
npm run dev
```

---

### 错误 2: 端口被占用

**现象**:
```
Error: listen EADDRINUSE: address already in use :::3002
```

**解决**:
```bash
# 修改 .env 中的 PORT
PORT=3003

# 或杀死占用进程
lsof -ti:3002 | xargs kill -9
```

---

### 错误 3: TypeScript 编译错误

**现象**:
```
error TS2345: Argument of type 'xxx' is not assignable
```

**解决**:
```bash
# 检查类型定义
npx tsc --noEmit

# 或忽略类型检查（不推荐）
# tsconfig.json: "strict": false
```

---

### 错误 4: 微信接口报错

**现象**:
```
Error: invalid appid
Error: access_token expired
```

**解决**:
```bash
# 检查微信配置
# 登录微信开放平台: https://open.weixin.qq.com/

# 确认:
# - AppID 正确
# - AppSecret 未过期
# - IP 白名单已添加
# - 服务器配置正确
```

---

### 错误 5: 数据库表不存在

**现象**:
```
Error: relation "users" does not exist
```

**解决**:
```bash
# 检查数据库迁移
# 登录 Supabase Dashboard
# 查看 Table Editor 确认表是否存在

# 如需重新创建，运行 SQL 迁移
```

---

## 🔧 项目结构

```
wechat-viral/
├── backend/              # Node.js + Express 后端
│   ├── src/
│   │   ├── api/          # API 路由
│   │   ├── services/     # 业务逻辑
│   │   └── utils/        # 工具函数
│   ├── .env              # 环境变量
│   └── package.json
├── miniprogram/          # 微信小程序
│   ├── pages/            # 页面
│   ├── components/       # 组件
│   └── app.js
├── admin/                # 管理后台 (HTML)
│   ├── dashboard.html
│   └── login.html
└── docs/                 # 文档
```

---

## 🌐 服务地址

| 服务 | 地址 | 说明 |
|------|------|------|
| Backend API | http://localhost:3002 | REST API |
| Admin | http://localhost:3002/admin/dashboard.html | 管理后台 |
| 微信小程序 | 微信开发者工具 | 小程序预览 |
| 公众号 | 需配置服务器 | 微信服务号 |

---

## 📝 开发工作流

### 修改后端 API

```bash
# 1. 编辑 backend/src/api/xxx.ts

# 2. 自动重载 (开发模式)

# 3. 测试
curl http://localhost:3002/api/xxx
```

### 修改小程序

```bash
# 1. 编辑 miniprogram/pages/xxx/xxx.js

# 2. 微信开发者工具自动刷新

# 3. 预览和调试
```

### 数据库变更

```bash
# 1. 在 Supabase Dashboard 修改表结构

# 2. 同步到代码 (如有迁移文件)
```

---

## 📞 获取帮助

1. 检查后端日志
2. 确认 Supabase 连接
3. 验证微信配置
4. 查看网络请求

---

**最后更新**: 2026-02-17
