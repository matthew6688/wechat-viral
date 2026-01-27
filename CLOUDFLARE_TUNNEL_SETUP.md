# Cloudflare Tunnel 设置指南

## 安装 Cloudflare Tunnel

### macOS
```bash
brew install cloudflare/cloudflare/cloudflared
```

### 或下载二进制文件
访问：https://github.com/cloudflare/cloudflared/releases

## 设置步骤

### 1. 登录 Cloudflare
```bash
cloudflared tunnel login
```
这会打开浏览器，选择您的域名并授权。

### 2. 创建 Tunnel
```bash
cloudflared tunnel create wechat-viral
```

### 3. 创建固定域名（推荐）

如果你有域名 `fengtalk.ai`，推荐绑定一个固定子域名，例如：
`api.fengtalk.ai`

先创建 DNS 绑定（只需做一次）：

```bash
cloudflared tunnel route dns wechat-viral api.fengtalk.ai
```

### 4. 创建配置文件
创建文件：`~/.cloudflared/config.yml`

```yaml
tunnel: <tunnel-id>
credentials-file: /Users/matthew/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.fengtalk.ai
    service: http://localhost:3000
  - service: http_status:404
```

### 5. 运行 Tunnel
```bash
cloudflared tunnel run wechat-viral
```

### 6. 或者直接运行（临时，不需要配置文件）
```bash
cloudflared tunnel --url http://localhost:3000
```

这会给出一个类似 `https://xxx.trycloudflare.com` 的 URL。

## 快速启动（最简单的方法）

如果您只是想快速测试，可以直接运行：

```bash
cloudflared tunnel --url http://localhost:3000
```

这会输出一个 URL，例如：
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://xxx-xxx-xxx.trycloudflare.com                                                     |
+--------------------------------------------------------------------------------------------+
```

然后使用这个 URL 配置到微信公众平台：
```
https://xxx-xxx-xxx.trycloudflare.com/api/oa/wh
```

## 小程序域名白名单（必须）

在微信小程序后台 → 开发 → 开发管理 → 开发设置 → 服务器域名  
将以下域名加入 `request合法域名`：

```
https://api.fengtalk.ai
```

## 优势

- ✅ 免费且稳定
- ✅ 没有浏览器验证页面
- ✅ 不会阻止微信服务器的请求
- ✅ 支持自定义域名（如果有 Cloudflare 账户）
