# 数据库迁移指南 (Database Migration Guide)

## 如何运行 SQL 迁移文件

### 方法 1: 使用 Supabase Dashboard (推荐)

1. **登录 Supabase**
   - 访问 https://supabase.com/dashboard
   - 登录你的账户
   - 选择你的项目

2. **打开 SQL Editor**
   - 在左侧菜单中找到 "SQL Editor"
   - 点击进入

3. **创建新查询**
   - 点击 "New query" 按钮
   - 会打开一个 SQL 编辑器

4. **复制 SQL 代码**
   - 打开文件：`database/migrations/008_add_debug_settings.sql`
   - 复制所有内容（Ctrl+C / Cmd+C）

5. **粘贴并运行**
   - 在 Supabase SQL Editor 中粘贴代码（Ctrl+V / Cmd+V）
   - 点击右上角的 "Run" 按钮（或按 Ctrl+Enter / Cmd+Enter）

6. **验证结果**
   - 应该看到 "Success. No rows returned" 或类似的成功消息
   - 如果看到错误，检查错误信息

### 方法 2: 使用 psql 命令行工具

如果你安装了 PostgreSQL 客户端工具：

```bash
# 连接到 Supabase 数据库
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# 然后运行 SQL 文件
\i database/migrations/008_add_debug_settings.sql
```

### 方法 3: 直接复制 SQL 内容

以下是 `008_add_debug_settings.sql` 的完整内容，你可以直接复制到 Supabase SQL Editor：

```sql
-- Debug Settings Migration
-- Migration 008: Add debug settings table for admin configuration

CREATE TABLE IF NOT EXISTS debug_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_settings_key ON debug_settings(key);
CREATE INDEX IF NOT EXISTS idx_debug_settings_updated_at ON debug_settings(updated_at DESC);

-- Insert default debug settings
INSERT INTO debug_settings (key, value, description) VALUES
    ('log_level', '"info"', 'Logging level: debug, info, warn, error'),
    ('debug_mode', 'false', 'Enable debug mode (more verbose logging)'),
    ('event_log_enabled', 'true', 'Enable event logging'),
    ('api_logging', 'true', 'Enable API request/response logging'),
    ('error_tracking', 'true', 'Enable error tracking and reporting'),
    ('performance_monitoring', 'false', 'Enable performance monitoring'),
    ('max_log_retention_days', '30', 'Maximum days to retain logs'),
    ('show_sensitive_data', 'false', 'Show sensitive data in logs (WARNING: security risk)')
ON CONFLICT (key) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE debug_settings IS 'Admin-configurable debug and logging settings';
COMMENT ON COLUMN debug_settings.key IS 'Setting key (unique identifier)';
COMMENT ON COLUMN debug_settings.value IS 'Setting value (JSON format)';
COMMENT ON COLUMN debug_settings.description IS 'Human-readable description of the setting';
```

## 验证迁移是否成功

运行迁移后，在 Supabase SQL Editor 中运行以下查询验证：

```sql
-- 检查表是否存在
SELECT * FROM debug_settings;
```

应该看到 8 行数据，每行对应一个默认设置。

## 常见问题

### Q: 看到 "relation does not exist" 错误
**A:** 可能是表名拼写错误，或者需要先运行之前的迁移。

### Q: 看到 "permission denied" 错误
**A:** 确保你使用的是 Service Role Key，而不是 Anon Key。

### Q: 如何查看所有迁移文件？
**A:** 在项目目录中：
```bash
ls database/migrations/
```

### Q: 迁移可以重复运行吗？
**A:** 是的，这个迁移使用了 `IF NOT EXISTS` 和 `ON CONFLICT DO NOTHING`，可以安全地重复运行。

## 其他需要运行的迁移

如果你还没有运行其他迁移，按顺序运行：

1. `003_oa_qrcode_system.sql` - OA 二维码系统
2. `005_add_wechat_profile_fields.sql` - 微信头像和昵称
3. `006_add_email_password_auth.sql` - 邮箱密码认证
4. `007_create_event_logs.sql` - 事件日志表
5. `008_add_debug_settings.sql` - 调试设置（当前）

## 需要帮助？

如果遇到问题：
1. 检查 Supabase 项目是否正确
2. 确认数据库连接正常
3. 查看 Supabase 日志中的错误信息
4. 检查 SQL 语法是否正确
