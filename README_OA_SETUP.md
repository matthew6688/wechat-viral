# 服务号二维码裂变系统 - 设置指南

## 一、数据库迁移

1. 执行迁移文件：
```bash
# 在Supabase SQL Editor中执行
database/migrations/003_oa_qrcode_system.sql
```

2. 设置管理员用户：
```sql
-- 在Supabase SQL Editor中执行，替换为实际用户ID或手机号
UPDATE users SET is_admin = TRUE WHERE phone = 'YOUR_PHONE_NUMBER';
-- 或
UPDATE users SET is_admin = TRUE WHERE id = 'YOUR_USER_ID';
```

## 二、后端配置

1. 安装依赖：
```bash
cd backend
npm install
```

2. 配置环境变量（`.env`文件）：
```env
# 小程序配置
WECHAT_APPID=your_miniprogram_appid
WECHAT_SECRET=your_miniprogram_secret

# 服务号配置
OA_APPID=your_official_account_appid          # 从微信公众平台"基本配置"获取
OA_SECRET=your_official_account_secret        # 从微信公众平台"基本配置"获取
OA_TOKEN=your_server_token                    # 自己设置，用于服务器验证
OA_ENCODING_AES_KEY=your_encoding_aes_key     # 从微信公众平台"基本配置"生成

# Supabase配置
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT配置
JWT_SECRET=your_jwt_secret

# 服务器配置
PORT=3000
```

**详细配置获取方法请参考：`OA_CONFIG_GUIDE.md`**

3. 启动服务器：
```bash
npm run dev
```

## 三、微信公众平台配置

1. 登录[微信公众平台](https://mp.weixin.qq.com/)

2. 进入 **开发** → **基本配置**

3. 配置服务器：
   - **服务器URL**: `https://yourdomain.com/api/oa/webhook`
   - **Token**: 与`.env`中的`OA_TOKEN`一致
   - **EncodingAESKey**: 与`.env`中的`OA_ENCODING_AES_KEY`一致
   - **消息加解密方式**: 选择"安全模式"或"兼容模式"

4. 点击"提交"验证服务器配置

5. 启用服务器配置

## 四、功能说明

### 1. 服务号二维码生成
- API: `GET /api/oa/qrcode/:userId`
- 为每个用户生成专属服务号永久二维码
- 二维码参数格式：`ref_{short_code}`

### 2. 海报生成
- API: `GET /api/oa/poster/:userId`
- 生成包含二维码、用户昵称、头像、背景的海报
- 支持自定义模板

### 3. 事件推送处理
- 接收微信推送的关注、取消关注、扫码事件
- 自动识别推荐人
- 记录到数据库
- 自动回复引导消息

### 4. 管理员功能
- 访问路径：小程序 → 我的 → 管理员入口（仅管理员可见）
- Debug数据查看：
  - 扫码事件列表
  - 关注事件列表
  - 推荐关系链
  - 数据统计
- 后台设置：
  - 活动配置
  - 积分规则

## 五、测试步骤

1. **测试二维码生成**：
   - 在小程序中进入"邀请"页面
   - 切换到"服务号二维码"标签
   - 查看是否显示二维码

2. **测试海报生成**：
   - 点击"生成海报"
   - 查看是否生成海报图片
   - 测试保存到相册功能

3. **测试事件推送**：
   - 使用测试号或正式服务号
   - 扫描生成的二维码
   - 检查是否收到关注事件
   - 检查数据库是否记录事件

4. **测试管理员功能**：
   - 使用管理员账号登录小程序
   - 进入管理员页面
   - 查看Debug数据和统计数据

## 六、注意事项

1. **服务号配置**：
   - 需要已认证的服务号
   - 服务器URL必须是HTTPS
   - Token和EncodingAESKey需要妥善保管

2. **依赖安装**：
   - `sharp`用于图片处理（海报生成）
   - `xml2js`用于解析微信推送的XML

3. **性能优化**：
   - 海报生成可能较慢，考虑异步处理
   - 二维码图片可以缓存
   - 事件推送需要快速响应（5秒内）

4. **安全性**：
   - 验证微信推送签名
   - 管理员权限验证
   - JWT token验证
