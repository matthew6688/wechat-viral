# UnionID 跨渠道用户统一测试指南

本指南将帮助你测试小程序和公众号之间的用户统一识别功能。

---

## 📋 测试前准备

### 1. 确认绑定状态
- ✅ 小程序已绑定到微信开放平台
- ✅ 服务号已绑定到同一个微信开放平台
- ✅ 后端服务器正在运行 (`http://localhost:3000`)
- ✅ Admin 后台可访问 (`http://localhost:3000/admin/dashboard.html`)

### 2. 准备测试账号
- **账号 A**：你的主微信账号（用于测试）
- **账号 B**：另一个微信账号（可选，用于完整流程测试）

---

## 🧪 测试场景 1：先登录小程序，再关注公众号

### 步骤 1：在小程序中登录

1. **打开微信开发者工具**
   - 打开你的小程序项目
   - 确保编译路径正确

2. **触发登录**
   - 小程序会自动调用 `wx.login()` 获取 code
   - 发送到后端 `/api/auth/login`

3. **查看后端日志**
   ```bash
   # 在运行 npm run dev 的终端中查看
   # 应该看到类似输出：
   # Login request received: { code: 'present' }
   # code2Session success, openid: oxxxxxx...
   # Looking up user, unionid: oUxxxxxx... openid: oxxxxxx...
   # Found user by unionid: xxx 或 Found user by openid: xxx
   ```

4. **检查 Admin 后台**
   - 打开 `http://localhost:3000/admin/dashboard.html`
   - 进入「用户管理 → 全部用户」
   - 找到你的用户记录
   - **检查字段**：
     - `MP OpenID`：应该有值（小程序 OpenID）
     - `UnionID`：应该有值（如果已绑定开放平台）
     - `OA OpenID`：可能为空（还未关注公众号）

### 步骤 2：关注公众号

1. **用同一个微信账号关注服务号**
   - 可以通过扫描活动海报二维码
   - 或直接搜索并关注服务号

2. **查看后端日志**
   ```bash
   # 应该看到类似输出：
   # [OA] Subscribe event received
   # WeChat user info received: { openid: ..., unionid: ..., nickname: ... }
   # Found user by unionid: xxx 或 Found user by openid_oa: xxx
   ```

3. **再次检查 Admin 后台**
   - 刷新用户列表
   - 找到你的用户记录
   - **检查字段**：
     - `MP OpenID`：应该保持不变
     - `UnionID`：应该保持不变（如果之前有）
     - `OA OpenID`：**现在应该有值了** ✅
     - 如果之前没有 UnionID，现在应该有

4. **查看事件日志**
   - 进入「监控 → 事件历史」
   - 搜索 `follow_oa` 或 `oa_subscribe`
   - 查看最新事件，确认：
     - `UnionID` 字段有值
     - `OpenID (小程序)` 和 `OpenID (公众号)` 都有值
     - 来源显示为 `🔗 小程序+公众号`

---

## 🧪 测试场景 2：先关注公众号，再登录小程序

### 步骤 1：先关注公众号

1. **用微信扫描活动海报二维码**
   - 或直接关注服务号
   - **注意**：确保这是第一次关注（如果之前关注过，先取消关注再重新关注）

2. **查看后端日志**
   ```bash
   # 应该看到：
   # [OA] Subscribe event received
   # WeChat user info received: { openid: ..., unionid: ..., nickname: ... }
   # Created new user: xxx
   ```

3. **检查 Admin 后台**
   - 进入「用户管理 → 全部用户」
   - 找到新创建的用户
   - **检查字段**：
     - `OA OpenID`：应该有值 ✅
     - `UnionID`：应该有值（如果已绑定）✅
     - `MP OpenID`：可能为空（还未登录小程序）

### 步骤 2：登录小程序

1. **打开小程序并登录**
   - 小程序会自动调用登录接口

2. **查看后端日志**
   ```bash
   # 关键：应该看到以下之一：
   # ✅ 成功情况：
   # Found user by unionid: xxx  ← 通过 UnionID 找到已有用户
   # Updated user with MP openid  ← 更新了小程序 OpenID
   # 
   # ❌ 失败情况：
   # Created new user: xxx  ← 创建了新用户（说明 UnionID 未正确关联）
   ```

3. **再次检查 Admin 后台**
   - 刷新用户列表
   - **关键检查**：
     - `MP OpenID`：现在应该有值 ✅
     - `UnionID`：应该保持不变 ✅
     - **应该是同一个用户记录**（不是新建的）✅

4. **查看登录事件日志**
   - 进入「监控 → 事件历史」
   - 搜索 `login` 事件
   - 查看最新登录事件
   - **检查 `event_data` 字段**：
     ```json
     {
       "found_by": "unionid",  // ✅ 应该是 "unionid"，不是 "created"
       "is_new_user": false,   // ✅ 应该是 false
       "unionid": "oUxxxxxx...",
       "openid": "oxxxxxx..."
     }
     ```

---

## 🧪 测试场景 3：验证 UnionID 关联（关键测试）

### 步骤 1：在 Admin 后台验证用户详情

1. **查看用户详情**
   - 进入「用户管理 → 全部用户」
   - 点击任意用户，查看详情
   - **确认以下字段都有值**：
     ```
     MP OpenID: oxxxxxx... (小程序)
     OA OpenID: oxxxxxx... (公众号)
     UnionID: oUxxxxxx... (统一标识)
     ```

2. **检查事件历史**
   - 进入「监控 → 事件历史」
   - 筛选你的用户 ID
   - **查看所有相关事件**：
     - `login` 事件应包含 `unionid`
     - `follow_oa` 事件应包含 `unionid`
     - `scan_qr` 事件应包含 `unionid`

### 步骤 2：检查活动事件

1. **进入活动 Debug**
   - 「活动 → Debug」
   - 选择任意活动
   - 查看「最近活动事件」表格

2. **确认每行都有**：
   - `OpenID (小程序)` 列
   - `OpenID (公众号)` 列
   - `UnionID` 列
   - 来源列显示 `🔗 小程序+公众号`（如果已关联）

---

## 🔍 快速验证 SQL 查询

在 Supabase Dashboard 执行以下查询：

### 查询 1：查看所有已关联的用户
```sql
SELECT 
  id,
  name,
  wechat_nickname,
  openid as mp_openid,
  openid_oa,
  unionid,
  CASE 
    WHEN openid IS NOT NULL AND openid_oa IS NOT NULL THEN '✅ 已关联'
    WHEN openid IS NOT NULL THEN '📱 仅小程序'
    WHEN openid_oa IS NOT NULL THEN '📢 仅公众号'
    ELSE '❌ 未关联'
  END as status
FROM users
WHERE unionid IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

### 查询 2：查看登录事件中的 found_by 字段
```sql
SELECT 
  id,
  event_type,
  event_data->>'found_by' as found_by,
  event_data->>'unionid' as unionid,
  event_data->>'is_new_user' as is_new_user,
  created_at
FROM event_logs
WHERE event_type = 'login'
ORDER BY created_at DESC
LIMIT 10;
```

### 查询 3：检查是否有重复用户（同一 UnionID 多个记录）
```sql
SELECT 
  unionid,
  COUNT(*) as user_count,
  array_agg(id) as user_ids,
  array_agg(openid) as mp_openids,
  array_agg(openid_oa) as oa_openids
FROM users
WHERE unionid IS NOT NULL
GROUP BY unionid
HAVING COUNT(*) > 1;
```

---

## ✅ 成功标准

如果测试成功，你应该看到：

| 检查项 | 预期结果 |
|--------|----------|
| **UnionID** | 有值（如 `oUxxxxxx...`） |
| **MP OpenID** | 有值（小程序登录后） |
| **OA OpenID** | 有值（关注公众号后） |
| **事件日志中的 `found_by`** | `"unionid"`（不是 `"created"`） |
| **用户来源** | `🔗 小程序+公众号` |
| **SQL 查询结果** | 同一 UnionID 只有一条用户记录 |

---

## 🐛 常见问题排查

### 问题 1：UnionID 为空

**可能原因**：
- 小程序或服务号未正确绑定到微信开放平台
- 绑定后未等待生效（通常需要几分钟）

**解决方法**：
1. 检查微信开放平台绑定状态
2. 确认小程序和服务号都绑定到同一个开放平台账号
3. 等待几分钟后重试

### 问题 2：创建了重复用户

**检查方法**：
```sql
-- 查看是否有同一 UnionID 的多个用户
SELECT unionid, COUNT(*) 
FROM users 
WHERE unionid IS NOT NULL 
GROUP BY unionid 
HAVING COUNT(*) > 1;
```

**如果发现重复**：
- 检查登录事件日志中的 `found_by` 字段
- 如果显示 `"created"` 而不是 `"unionid"`，说明 UnionID 未正确获取

### 问题 3：事件日志中没有 UnionID

**检查点**：
1. 查看 `backend/src/services/oa-events.ts` 中的 `getUserInfo` 函数
2. 确认调用微信 API 时传递了 `lang: 'zh_CN'` 参数
3. 检查后端日志中是否有错误信息

### 问题 4：先关注公众号再登录小程序，创建了新用户

**预期行为**：
- 应该通过 UnionID 找到已有用户
- 不应该创建新用户

**排查步骤**：
1. 查看登录事件日志，检查 `found_by` 字段
2. 如果是 `"created"`，检查：
   - UnionID 是否正确获取
   - 数据库中是否已有该 UnionID 的用户记录
   - 后端日志中是否有查找用户的错误

---

## 📝 测试检查清单

- [ ] **场景 1**：小程序登录后，Admin 后台能看到 `MP OpenID` 和 `UnionID`
- [ ] **场景 1**：关注公众号后，Admin 后台能看到 `OA OpenID`，且 `UnionID` 保持不变
- [ ] **场景 2**：先关注公众号再登录小程序，不会创建新用户（通过 UnionID 关联）
- [ ] **场景 2**：登录事件日志中 `found_by` 为 `"unionid"`
- [ ] **场景 3**：事件日志中所有相关事件都包含 `UnionID`
- [ ] **场景 3**：活动事件表格中显示 `🔗 小程序+公众号` 来源
- [ ] **SQL 查询**：同一 UnionID 只有一条用户记录
- [ ] **SQL 查询**：已关联用户的状态为 `✅ 已关联`

---

## 🎯 下一步

测试完成后，如果所有检查项都通过，说明 UnionID 跨渠道用户统一功能正常工作！

如果遇到问题，请：
1. 查看后端日志中的错误信息
2. 检查 Admin 后台的事件历史
3. 执行 SQL 查询验证数据
4. 根据上述排查步骤解决问题

---

**测试完成后，告诉我结果，我可以帮你进一步优化或解决问题！** 🚀
