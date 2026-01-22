# 服务号配置获取指南

## 一、OA_APPID 和 OA_SECRET（服务号AppID和Secret）

### 获取步骤：

1. **登录微信公众平台**
   - 访问：https://mp.weixin.qq.com/
   - 使用服务号管理员微信扫码登录

2. **进入基本配置页面**
   - 左侧菜单：**开发** → **基本配置**

3. **查看AppID和AppSecret**
   - **AppID(应用ID)**：页面顶部显示，直接复制
   - **AppSecret(应用密钥)**：
     - 如果已设置，点击"重置"旁边的"查看"
     - 如果未设置，点击"生成"创建新的Secret
     - ⚠️ **注意**：Secret只显示一次，请立即保存

4. **配置到 `.env` 文件**
   ```env
   OA_APPID=wx1234567890abcdef  # 您的服务号AppID
   OA_SECRET=your_secret_here    # 您的服务号Secret
   ```

---

## 二、OA_TOKEN（服务器配置Token）

### 说明：
- **Token是您自己设置的**，用于验证微信服务器推送的消息
- 可以是任意字符串，建议使用随机字符串
- 长度建议：3-32个字符

### 生成方法：

**方法1：使用在线工具生成**
- 访问：https://www.random.org/strings/
- 生成一个32位的随机字符串

**方法2：使用命令行生成**
```bash
# macOS/Linux
openssl rand -hex 16

# 或使用Node.js
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**方法3：手动设置**
- 可以是任何字符串，例如：`my_wechat_token_2024`

### 配置到 `.env` 文件
```env
OA_TOKEN=your_random_token_string_here
```

⚠️ **重要**：这个Token需要与微信公众平台的服务器配置中的Token**完全一致**

---

## 三、OA_ENCODING_AES_KEY（消息加解密密钥）

### 获取步骤：

1. **进入基本配置页面**
   - 左侧菜单：**开发** → **基本配置**

2. **找到"消息加解密方式"**
   - 点击"修改"或"设置"

3. **选择加解密方式**
   - **安全模式（推荐）**：需要EncodingAESKey
   - **兼容模式**：可以使用EncodingAESKey或明文
   - **明文模式**：不需要EncodingAESKey（不推荐，安全性低）

4. **获取EncodingAESKey**
   - 如果选择"安全模式"或"兼容模式"
   - 点击"随机生成"按钮
   - 系统会生成一个43位的字符串
   - ⚠️ **注意**：只显示一次，请立即保存

5. **配置到 `.env` 文件**
   ```env
   OA_ENCODING_AES_KEY=your_43_character_encoding_aes_key_here
   ```

### EncodingAESKey格式：
- 长度：43个字符
- 格式：Base64编码的32字节密钥
- 示例：`abcdefghijklmnopqrstuvwxyz0123456789ABCDEF`

---

## 四、完整配置示例

### `.env` 文件完整配置：

```env
# 小程序配置
WECHAT_APPID=wxb00a7034897b60fe
WECHAT_SECRET=your_miniprogram_secret

# 服务号配置
OA_APPID=wx1234567890abcdef          # 从"基本配置"页面获取
OA_SECRET=your_official_account_secret # 从"基本配置"页面获取
OA_TOKEN=my_custom_token_2024        # 自己设置，用于服务器验证
OA_ENCODING_AES_KEY=abcdefghijklmnopqrstuvwxyz0123456789ABCDEF # 从"基本配置"页面生成

# Supabase配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# JWT配置
JWT_SECRET=your_jwt_secret_key

# 服务器配置
PORT=3000
```

---

## 五、微信公众平台服务器配置

### 配置步骤：

1. **进入基本配置页面**
   - 左侧菜单：**开发** → **基本配置**
   - 找到"服务器配置"部分

2. **填写服务器配置**
   - **URL（服务器地址）**：
     ```
     https://yourdomain.com/api/oa/webhook
     ```
     - 必须是HTTPS
     - 必须是80或443端口
     - 需要公网可访问
   
   - **Token**：
     ```
     与.env中的OA_TOKEN完全一致
     ```
   
   - **EncodingAESKey**：
     ```
     与.env中的OA_ENCODING_AES_KEY完全一致
     ```
   
   - **消息加解密方式**：
     - 选择"安全模式"（如果设置了EncodingAESKey）
     - 或选择"兼容模式"
     - 或选择"明文模式"（不推荐）

3. **提交配置**
   - 点击"提交"按钮
   - 微信会发送GET请求验证您的服务器
   - 如果验证成功，配置保存成功

4. **启用服务器配置**
   - 配置保存后，点击"启用"按钮
   - 启用后，微信会推送事件到您的服务器

---

## 六、验证配置是否正确

### 1. 检查环境变量
```bash
cd backend
# 检查.env文件是否存在
cat .env | grep OA_

# 应该看到：
# OA_APPID=...
# OA_SECRET=...
# OA_TOKEN=...
# OA_ENCODING_AES_KEY=...
```

### 2. 测试Access Token获取
```bash
# 启动服务器
npm run dev

# 在另一个终端测试
curl "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=YOUR_OA_APPID&secret=YOUR_OA_SECRET"
```

如果返回包含 `access_token`，说明AppID和Secret正确。

### 3. 测试服务器配置
- 在微信公众平台点击"提交"时
- 查看后端日志，应该看到验证请求
- 如果验证成功，配置正确

---

## 七、常见问题

### Q1: AppSecret忘记了怎么办？
**A**: 在"基本配置"页面，点击"重置"按钮，生成新的Secret。⚠️ 旧Secret立即失效。

### Q2: Token可以修改吗？
**A**: 可以，但需要同时修改：
- `.env` 文件中的 `OA_TOKEN`
- 微信公众平台服务器配置中的 `Token`
- 两者必须完全一致

### Q3: EncodingAESKey忘记了怎么办？
**A**: 在"基本配置"页面，点击"重置"按钮，生成新的EncodingAESKey。⚠️ 需要同时更新：
- `.env` 文件
- 微信公众平台服务器配置

### Q4: 服务器URL必须是HTTPS吗？
**A**: 是的，微信要求必须是HTTPS。可以使用：
- 自己的域名 + SSL证书
- 内网穿透工具（如ngrok，用于开发测试）

### Q5: 开发环境如何测试？
**A**: 可以使用内网穿透：
```bash
# 安装ngrok
npm install -g ngrok

# 启动本地服务器（端口3000）
cd backend && npm run dev

# 在另一个终端启动ngrok
ngrok http 3000

# 使用ngrok提供的HTTPS URL配置到微信公众平台
# 例如：https://abc123.ngrok.io/api/oa/webhook
```

---

## 八、配置检查清单

- [ ] 已获取服务号AppID
- [ ] 已获取服务号Secret
- [ ] 已设置Token（并保存）
- [ ] 已生成EncodingAESKey（并保存）
- [ ] 已配置到 `.env` 文件
- [ ] 已在微信公众平台配置服务器URL
- [ ] 已在微信公众平台配置Token（与.env一致）
- [ ] 已在微信公众平台配置EncodingAESKey（与.env一致）
- [ ] 已测试服务器验证（点击"提交"成功）
- [ ] 已启用服务器配置

---

## 九、安全建议

1. **不要将 `.env` 文件提交到Git**
   - 添加到 `.gitignore`
   - 使用环境变量或密钥管理服务

2. **定期更换Secret和Token**
   - 如果怀疑泄露，立即重置

3. **使用HTTPS**
   - 确保服务器URL使用HTTPS
   - 使用有效的SSL证书

4. **验证签名**
   - 代码中已实现签名验证
   - 确保 `verifySignature` 函数正常工作

---

## 十、快速配置命令

```bash
# 1. 生成Token
echo "OA_TOKEN=$(openssl rand -hex 16)" >> backend/.env

# 2. 查看当前配置
cd backend && cat .env | grep OA_
```

配置完成后，重启服务器使配置生效。
