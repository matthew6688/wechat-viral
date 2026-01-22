# Migration Guide: Local Development to Production

This guide provides step-by-step instructions for migrating the WeChat Viral Marketing System from local development to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Database Migration](#database-migration)
4. [Cloudflare Tunnel / Production Hosting](#cloudflare-tunnel--production-hosting)
5. [WeChat Configuration](#wechat-configuration)
6. [Testing & Validation](#testing--validation)
7. [Monitoring & Maintenance](#monitoring--maintenance)

## Prerequisites

Before starting the migration, ensure you have:

- ✅ Production Supabase project created
- ✅ Production domain or Cloudflare tunnel configured
- ✅ WeChat Official Account and Mini Program credentials
- ✅ SSL certificate (if using custom domain)
- ✅ Production server/VPS (if not using Cloudflare tunnel)

## Environment Variables

### Required Variables

Update your production `.env` file with the following:

```bash
# Node Environment
NODE_ENV=production

# Supabase (Production)
SUPABASE_URL=https://your-production-project.supabase.co
SUPABASE_SERVICE_KEY=your-production-service-key
SUPABASE_ANON_KEY=your-production-anon-key

# WeChat Mini Program
WECHAT_APPID=your-miniprogram-appid
WECHAT_SECRET=your-miniprogram-secret

# WeChat Official Account
OA_APPID=your-oa-appid
OA_SECRET=your-oa-secret
OA_TOKEN=your-webhook-token
OA_ENCODING_AES_KEY=your-encoding-aes-key

# Server
PORT=3000

# Cloudflare Tunnel (if using)
CLOUDFLARE_TUNNEL_URL=https://your-production-url.com
```

### Environment Variable Checklist

- [ ] All required variables are set
- [ ] Production Supabase credentials are correct
- [ ] WeChat credentials match production accounts
- [ ] Webhook token and encoding key are configured
- [ ] Port is set correctly (or use default 3000)

## Database Migration

### Step 1: Connect to Production Supabase

1. Log in to your Supabase dashboard
2. Select your production project
3. Navigate to SQL Editor

### Step 2: Run Migrations in Order

Execute the following migrations in sequence:

```sql
-- Migration 003: OA QR Code System
-- File: database/migrations/003_oa_qrcode_system.sql

-- Migration 004: Setup Admin User
-- File: database/migrations/004_setup_admin_user.sql
-- Note: Update with your admin user ID/email/phone

-- Migration 005: Add WeChat Profile Fields
-- File: database/migrations/005_add_wechat_profile_fields.sql

-- Migration 006: Add Email Password Auth
-- File: database/migrations/006_add_email_password_auth.sql

-- Migration 007: Create Event Logs
-- File: database/migrations/007_create_event_logs.sql

-- Migration 008: Add Debug Settings
-- File: database/migrations/008_add_debug_settings.sql
```

### Step 3: Verify Database Schema

Run this query to verify all tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users', 'activities', 'invites', 'points_accounts', 
  'points_transactions', 'tasks', 'rewards', 'redemptions',
  'oa_qrcodes', 'oa_scan_events', 'oa_follow_events', 
  'poster_templates', 'event_logs', 'debug_settings'
);
```

### Step 4: Create Admin User

Run the admin user creation script:

```bash
cd backend
node scripts/create-admin-user.js your-email@example.com your-password "Admin Name"
```

Or manually set admin via SQL:

```sql
UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';
```

## Cloudflare Tunnel / Production Hosting

### Option A: Cloudflare Tunnel (Recommended for Quick Setup)

#### 1. Install Cloudflare Tunnel

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
```

#### 2. Login to Cloudflare

```bash
cloudflared tunnel login
```

#### 3. Create Named Tunnel

```bash
cloudflared tunnel create wechat-viral-prod
```

#### 4. Create Configuration

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id-from-step-3>
credentials-file: /Users/your-user/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3000
  - service: http_status:404
```

#### 5. Run Tunnel

```bash
cloudflared tunnel run wechat-viral-prod
```

Or set up as a service (see Cloudflare documentation).

### Option B: VPS / Cloud Hosting

#### 1. Deploy Backend

```bash
# On your production server
git clone your-repo
cd wechat-viral/backend
npm install
npm run build
```

#### 2. Set Up Process Manager (PM2)

```bash
npm install -g pm2
pm2 start dist/index.js --name wechat-viral
pm2 save
pm2 startup
```

#### 3. Configure Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 4. Set Up SSL (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## WeChat Configuration

### Step 1: Update Webhook URL

1. Log in to [WeChat Official Account Platform](https://mp.weixin.qq.com/)
2. Navigate to: **Settings** → **Public Account Settings** → **Message Push**
3. Update the webhook URL:
   - **URL**: `https://your-production-domain.com/api/oa/webhook`
   - **Token**: Your `OA_TOKEN` value
   - **EncodingAESKey**: Your `OA_ENCODING_AES_KEY` value
   - **Message Encryption**: Select "Security Mode" or "Compatible Mode"

### Step 2: Configure IP Whitelist

1. Navigate to: **Settings** → **Public Account Settings** → **IP Whitelist**
2. Add your production server IP address
3. If using Cloudflare tunnel, you may need to allow Cloudflare IP ranges

### Step 3: Verify Webhook

1. Click "Submit" in the webhook configuration
2. WeChat will send a verification request
3. Check your server logs to ensure verification succeeds
4. If verification fails, check:
   - URL is accessible from internet
   - Token matches exactly
   - EncodingAESKey is correct
   - Server is running and responding

### Step 4: Test Webhook

1. Send a test message to your Official Account
2. Check event logs in admin dashboard
3. Verify events are being logged correctly

## Testing & Validation

### Step 1: Run Environment Validation

1. Access admin dashboard: `https://your-domain.com/admin/dashboard.html`
2. Log in with admin credentials
3. Navigate to "Environment Validation" section
4. Click "Run Full Validation"
5. Verify all services show "healthy" status

### Step 2: Test WeChat APIs

1. In admin dashboard, click "Test" on WeChat Mini Program card
2. Click "Test" on WeChat Official Account card
3. Verify both return successful responses

### Step 3: Test Database Connection

1. Click "Test" on Database card
2. Verify connection is successful
3. Check response time is acceptable (< 100ms)

### Step 4: Test Cloudflare Tunnel

1. Verify tunnel URL is displayed correctly
2. Click "Copy" to copy URL
3. Test URL accessibility from external network

### Step 5: Test Mini Program

1. Open WeChat Developer Tools
2. Update API base URL to production
3. Test login, registration, and QR code generation
4. Verify all features work correctly

### Step 6: Test Official Account

1. Scan QR code from Official Account
2. Verify webhook receives scan event
3. Follow the Official Account
4. Verify follow event is logged
5. Test automatic reply messages

## Monitoring & Maintenance

### Enable Production Monitoring

1. In admin dashboard, go to "Debug Settings"
2. Enable:
   - ✅ Error Tracking
   - ✅ API Logging
   - ✅ Performance Monitoring (optional)
3. Set appropriate log retention period

### Regular Maintenance Tasks

#### Daily
- [ ] Check error logs in admin dashboard
- [ ] Monitor event logs for anomalies
- [ ] Verify WeChat API connectivity

#### Weekly
- [ ] Review database performance
- [ ] Check disk space usage
- [ ] Review and clean old event logs (if retention enabled)

#### Monthly
- [ ] Update dependencies
- [ ] Review security settings
- [ ] Backup database
- [ ] Review and optimize database queries

### Backup Strategy

#### Database Backups

Supabase provides automatic backups, but you can also:

1. Export data manually via Supabase dashboard
2. Set up automated backups using Supabase CLI
3. Use pg_dump for manual backups

#### Code Backups

- Use Git for version control
- Tag production releases
- Keep deployment documentation updated

### Troubleshooting

#### Webhook Not Receiving Events

1. Check webhook URL is accessible
2. Verify token and encoding key
3. Check server logs for errors
4. Verify IP whitelist includes server IP
5. Test webhook manually using curl

#### Database Connection Issues

1. Verify SUPABASE_URL and SUPABASE_SERVICE_KEY
2. Check Supabase project status
3. Verify network connectivity
4. Check firewall rules

#### WeChat API Errors

1. Verify credentials are correct
2. Check IP whitelist settings
3. Review API rate limits
4. Check WeChat platform status

## Rollback Plan

If issues occur after migration:

1. **Immediate Rollback**: Switch webhook URL back to development
2. **Database Rollback**: Restore from backup if needed
3. **Code Rollback**: Deploy previous version from Git
4. **Investigate**: Review logs and identify issues
5. **Fix**: Apply fixes and test in development
6. **Re-deploy**: Deploy fixes to production

## Post-Migration Checklist

- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] Admin user created
- [ ] Webhook URL updated in WeChat platform
- [ ] IP whitelist configured
- [ ] SSL certificate installed (if custom domain)
- [ ] Environment validation passes
- [ ] All WeChat APIs tested
- [ ] Mini Program tested end-to-end
- [ ] Official Account tested end-to-end
- [ ] Monitoring enabled
- [ ] Backup strategy in place
- [ ] Documentation updated

## Support

For issues or questions:

1. Check admin dashboard environment validation
2. Review server logs
3. Check WeChat platform status
4. Review this migration guide
5. Consult project documentation

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [WeChat Official Account Documentation](https://developers.weixin.qq.com/doc/offiaccount/en/Getting_Started/Overview.html)
- [WeChat Mini Program Documentation](https://developers.weixin.qq.com/miniprogram/en/dev/framework/)
