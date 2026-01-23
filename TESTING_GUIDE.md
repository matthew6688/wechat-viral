# 🧪 Complete MVP Testing Guide

This guide walks you through testing the WeChat Viral Marketing MVP with all available debugging tools.

---

## 📋 Table of Contents

1. [Pre-Test Checklist](#pre-test-checklist)
2. [Debugging Tools Overview](#debugging-tools-overview)
3. [Test Flow: Step by Step](#test-flow-step-by-step)
4. [Quick Reference: Where to Find Data](#quick-reference-where-to-find-data)
5. [Common Issues & Solutions](#common-issues--solutions)
6. [Success Criteria](#success-criteria)

---

## 📋 Pre-Test Checklist

Before starting, verify your environment:

### 1. Backend Server Running

```bash
cd backend
npm run dev
```

You should see: `Server running on port 3000`

### 2. Cloudflare Tunnel Running

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the HTTPS URL (e.g., `https://xxx.trycloudflare.com`)

### 3. Admin Dashboard Access

Open: `http://localhost:3000/admin/dashboard.html`

### 4. WeChat Developer Tools

- Open the Mini Program project
- Ensure it compiles without errors

---

## 🔧 Debugging Tools Overview

| Tool | Location | What It Shows |
|------|----------|---------------|
| **System Health** | Infrastructure → System Health | All services status at a glance |
| **Tunnel Status** | Infrastructure → Tunnel | Cloudflare connection details |
| **WeChat OA Status** | Infrastructure → WeChat OA | OA API connection & token |
| **Database Status** | Infrastructure → Database | Supabase connection |
| **Backend Status** | Infrastructure → Backend | Server health |
| **Live Logs** | Monitoring → Live Logs | Real-time event stream (SSE) |
| **Event History** | Monitoring → Event History | All past events with search/filter |
| **Campaign Debug** | Campaigns → Debug | Campaign-specific data & metrics |
| **Backend Console** | Terminal running `npm run dev` | Server-side logs |
| **Mini Program Console** | WeChat DevTools → Console | Frontend logs |
| **Supabase Dashboard** | https://supabase.com/dashboard | Direct database access |

---

## 🚀 Test Flow: Step by Step

### **Step 1: Verify Infrastructure**

**Action:** Go to Admin Dashboard → Infrastructure → System Health

**Click "Check Now"** to validate all systems.

**What to Check:**

| Service | Expected Status |
|---------|-----------------|
| Backend Server | ✅ Connected |
| Database (Supabase) | ✅ Connected |
| Cloudflare Tunnel | ✅ Running |
| WeChat OA | ✅ Token valid |

**Debug if issues:**

| Issue | Solution |
|-------|----------|
| Tunnel disconnected | Run `cloudflared tunnel --url http://localhost:3000` |
| OA token invalid | Check `OA_APPID` and `OA_SECRET` in `.env` |
| Database disconnected | Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env` |
| Backend not responding | Restart with `npm run dev` |

---

### **Step 2: Verify Webhook URL**

**Action:** Go to Infrastructure → Tunnel tab

**What to Check:**
- Current Tunnel URL matches what's configured in WeChat OA backend
- Webhook URL format: `https://xxx.trycloudflare.com/api/oa/webhook`

**How to Update WeChat OA Webhook:**

1. Copy the webhook URL from Admin Dashboard
2. Go to [WeChat Official Account Platform](https://mp.weixin.qq.com)
3. Navigate to: Development → Basic Configuration
4. Update the Server URL (服务器地址)
5. Click Submit

**Note:** The tunnel URL changes each time you restart `cloudflared`. You'll need to update the webhook URL in WeChat OA backend accordingly.

---

### **Step 3: Open Live Logs**

**Action:** Go to Monitoring → Live Logs

**What to Check:**
- Connection status shows "Connected" (green dot)
- Keep this open in a separate browser tab during testing

**Events you'll see:**

| Event Type | Meaning |
|------------|---------|
| 🔔 `oa_subscribe` | Someone followed the OA |
| 📷 `oa_scan` | Existing follower scanned QR |
| 🔕 `oa_unsubscribe` | Someone unfollowed the OA |
| 👥 `campaign_helper_recorded` | Helper contribution recorded |
| 🎫 `campaign_qr_created` | QR code generated for campaign |
| 🎁 `campaign_reward_claimed` | User claimed a reward |

---

### **Step 4: Select or Create a Test Campaign**

**Action:** Go to Campaigns → Management

#### Option A: Use Existing Campaign
- Find a campaign with status "进行中" (Active)
- Note the campaign ID

#### Option B: Create New Test Campaign

1. Click "Create Campaign"
2. Fill in:
   - **Name:** "Test Campaign"
   - **Description:** "Testing MVP flow"
   - **Rewards:**
     - Tier 1: 1 helper required → "Free PDF"
     - Tier 2: 3 helpers required → "Video Course"
     - Tier 3: 5 helpers required → "1-on-1 Call"
3. Click Save

---

### **Step 5: Open Campaign Debug**

**Action:** Go to Campaigns → Debug → Select your campaign

**What You'll See:**

| Metric | Description |
|--------|-------------|
| Participants | Users who joined this campaign |
| Valid Helpers | Currently valid helper contributions |
| Unfollowed | Helpers who later unfollowed |
| Retention Rate | % of helpers still following |
| Conversion Rate | Helpers per participant |
| Rewards Claimed | Total rewards given out |

**Keep this tab open** to monitor changes during testing.

---

### **Step 6: Test as User A (Join Campaign)**

**In WeChat Developer Tools:**

1. **Open Mini Program**
2. **Navigate to Campaign Page**
   - Use compile path: `pages/campaign/index?id=YOUR_CAMPAIGN_ID`
   - Or navigate through the app UI

3. **Join the Campaign**
   - Click "Join" or "参与活动"
   - You'll receive a unique referral code (e.g., `CMSFJE`)

**What to Check in Admin Dashboard:**

| Location | What to Look For |
|----------|------------------|
| Live Logs | Event: `campaign_joined` |
| Campaign Debug | Participants count: +1 |
| Event History | Search for your user ID |

**Backend Console should show:**
```
[Campaign] User xxx joined campaign yyy
[Campaign] Generated referral code: CMSFJE
```

---

### **Step 7: Generate Poster/QR Code**

**In Mini Program (as User A):**

1. Click "Generate Poster" or "生成海报"
2. Wait for poster to load (may take a few seconds)
3. Long-press to save poster to album

**What to Check:**

| Location | What to Look For |
|----------|------------------|
| Live Logs | Event: `campaign_qr_created` |
| Campaign Debug | QR generation timestamp |
| Backend Console | `[OA] Creating QR code with scene: camp_xxx_ref_CMSFJE` |

**Debug if poster doesn't generate:**

| Check | How |
|-------|-----|
| Access token valid? | Infrastructure → WeChat OA |
| IP whitelisted? | Backend console for "not in whitelist" error |
| Scene format correct? | Check backend logs for scene string |

---

### **Step 8: Test as User B (Scan & Follow)**

> ⚠️ **This is the critical step!** You need a second WeChat account.

**Using a Second WeChat Account:**

1. Open WeChat camera
2. Scan the QR code from User A's poster
3. Follow the Official Account when prompted

**What Should Happen (in order):**

1. WeChat sends `subscribe` event to your webhook
2. Backend parses scene string: `camp_xxx_ref_CMSFJE`
3. Backend finds User A by referral code
4. Backend records User B as helper for User A
5. Backend sends auto-reply message to User B

**What to Check Immediately:**

| Location | What to Look For |
|----------|------------------|
| **Live Logs** | 🔔 `oa_subscribe` with scene string |
| **Live Logs** | 👥 `campaign_helper_recorded` |
| **Campaign Debug** | Valid Helpers: +1 |
| **Campaign Debug** | Recent Helpers: shows User B |
| **Backend Console** | `[OA] Subscribe event received` |
| **Backend Console** | `[Campaign] Helper recorded: xxx helped yyy` |

**Debug if helper not recorded:**

1. **Check Live Logs** - Did `oa_subscribe` event appear?
   - **No** → Webhook URL is likely wrong. Check Infrastructure → Tunnel.
   - **Yes** → Continue to step 2.

2. **Check Event History** - Search for `oa_subscribe`
   - Click "View Raw JSON" to see the payload
   - Look for `EventKey` field - should contain `camp_xxx_ref_xxx`

3. **Check Campaign Debug** - Look for error events

4. **Check Backend Console** for errors:
   ```
   [OA] Invalid scene format
   [Campaign] Referral code not found
   [Campaign] User already helped this participant
   ```

---

### **Step 9: Verify Helper Count Updated**

**In Mini Program (as User A):**

1. Go back to the campaign page
2. Pull to refresh or tap refresh button
3. Check your helper count

**Expected Changes:**

| Before | After |
|--------|-------|
| Helpers: 0 | Helpers: 1 |
| Progress: 0% | Progress: 100% (if tier 1 = 1 helper) |
| Tier 1: 🔒 Locked | Tier 1: ✅ Unlocked |

**In Admin Dashboard:**
- Campaign Debug → Participants table → Your user should show "1" in helpers column

---

### **Step 10: Test Reward Claiming**

**In Mini Program (as User A):**

1. Ensure you have enough helpers for Tier 1
2. Click "Claim Reward" or "领取奖励" on the unlocked tier
3. Follow the claim flow

**What to Check:**

| Location | What to Look For |
|----------|------------------|
| Live Logs | `campaign_reward_claimed` |
| Campaign Debug | Rewards Claimed: +1 |
| Campaign Debug | Participant row: shows claimed tier |

---

### **Step 11: Test Unfollow Scenario**

**Using User B's WeChat:**

1. Go to the Official Account profile
2. Tap "Unfollow" (取消关注)

**What Should Happen:**

1. WeChat sends `unsubscribe` event
2. Backend marks helper as `is_valid = false`
3. User A's **valid** helper count decreases

**What to Check:**

| Location | What to Look For |
|----------|------------------|
| Live Logs | 🔕 `oa_unsubscribe` |
| Campaign Debug | Unfollowed count: +1 |
| Campaign Debug | Retention: decreases |
| Campaign Debug | Recent Helpers: User B shows "Invalid" with reason |

**Important:** The helper count for User A will only update when:
- User A refreshes their campaign page
- User A tries to claim a reward (re-validation happens)

---

## 📊 Quick Reference: Where to Find Data

### Admin Dashboard Locations

| Data | Location |
|------|----------|
| All events (real-time) | Monitoring → Live Logs |
| All events (searchable) | Monitoring → Event History |
| Campaign stats | Campaigns → Debug |
| Campaign list | Campaigns → Management |
| System status | Infrastructure → System Health |
| Tunnel URL | Infrastructure → Tunnel |

### Database Tables (via Supabase Dashboard)

| Table | What It Contains |
|-------|------------------|
| `users` | All registered users |
| `campaigns` | Campaign configurations |
| `campaign_participants` | Who joined which campaign |
| `campaign_helpers` | Who helped whom (with validity status) |
| `campaign_rewards` | Reward tiers per campaign |
| `campaign_reward_claims` | Who claimed what reward |
| `event_logs` | All system events with metadata |

### Useful SQL Queries

**Check campaign participants:**
```sql
SELECT 
  p.*, 
  u.name, 
  u.wechat_nickname 
FROM campaign_participants p
JOIN users u ON p.user_id = u.id
WHERE p.campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY p.joined_at DESC;
```

**Check helpers for a campaign:**
```sql
SELECT 
  h.*,
  helper.wechat_nickname as helper_name,
  participant.wechat_nickname as participant_name
FROM campaign_helpers h
LEFT JOIN users helper ON h.helper_user_id = helper.id
LEFT JOIN users participant ON h.participant_user_id = participant.id
WHERE h.campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY h.created_at DESC;
```

**Check recent events:**
```sql
SELECT * FROM event_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 50;
```

**Check valid vs invalid helpers:**
```sql
SELECT 
  is_valid,
  COUNT(*) as count
FROM campaign_helpers
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
GROUP BY is_valid;
```

---

## 🐛 Common Issues & Solutions

### Webhook Issues

| Issue | Check | Solution |
|-------|-------|----------|
| No events in Live Logs | Infrastructure → Tunnel | Verify tunnel is running and URL is updated in WeChat OA |
| Events appear but no helper recorded | Event History → View Raw JSON | Check if scene string format is correct |

### QR Code Issues

| Issue | Check | Solution |
|-------|-------|----------|
| QR code not generating | Backend console | Check for "IP not in whitelist" error |
| QR code invalid | Infrastructure → WeChat OA | Verify access token is valid |

### Helper Recording Issues

| Issue | Check | Solution |
|-------|-------|----------|
| Helper not recorded | Live Logs | Check if `oa_subscribe` event has scene string |
| Helper count not updating | Campaign Debug | Refresh the page; check if helper is marked valid |
| Duplicate helper rejected | Backend console | Same user can only help once per participant |

### Reward Issues

| Issue | Check | Solution |
|-------|-------|----------|
| Can't claim reward | Campaign Debug | Check if enough **valid** helpers (some may have unfollowed) |
| Reward already claimed | Campaign Debug | User can only claim each tier once |

---

## ✅ Success Criteria

Your MVP is working correctly if:

- [ ] **Infrastructure:** All 4 services show "Connected" in System Health
- [ ] **Join Campaign:** User A can join and get a referral code
- [ ] **Generate Poster:** User A can generate a poster with embedded QR code
- [ ] **Scan & Follow:** User B scanning QR leads to OA follow
- [ ] **Helper Recorded:** User B's follow is recorded as helper for User A
- [ ] **Count Updated:** User A sees helper count increase after refresh
- [ ] **Reward Claim:** User A can claim reward when threshold met
- [ ] **Unfollow Handling:** User B unfollowing marks helper as invalid
- [ ] **Events Logged:** All actions appear in Live Logs and Event History

---

## 🔄 Testing Workflow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     TESTING WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SETUP                                                       │
│     ├── Start backend: npm run dev                              │
│     ├── Start tunnel: cloudflared tunnel --url localhost:3000   │
│     ├── Update webhook URL in WeChat OA                         │
│     └── Open Admin Dashboard                                    │
│                                                                 │
│  2. VERIFY                                                      │
│     ├── Check System Health (all green)                         │
│     ├── Open Live Logs (keep visible)                           │
│     └── Select/Create test campaign                             │
│                                                                 │
│  3. TEST USER A                                                 │
│     ├── Join campaign → Get referral code                       │
│     ├── Generate poster → Save QR code                          │
│     └── Monitor: Live Logs, Campaign Debug                      │
│                                                                 │
│  4. TEST USER B                                                 │
│     ├── Scan QR code                                            │
│     ├── Follow Official Account                                 │
│     └── Verify: oa_subscribe + campaign_helper_recorded         │
│                                                                 │
│  5. VERIFY RESULTS                                              │
│     ├── User A: Helper count increased                          │
│     ├── User A: Can claim reward                                │
│     └── Campaign Debug: All metrics updated                     │
│                                                                 │
│  6. TEST EDGE CASES                                             │
│     ├── User B unfollows → Helper invalidated                   │
│     ├── User B re-follows → Helper revalidated                  │
│     └── Duplicate scan → Rejected                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Notes

- **Tunnel URL Changes:** Every time you restart `cloudflared`, you get a new URL. Remember to update WeChat OA webhook.
- **Test Accounts:** You need at least 2 WeChat accounts to test the full flow.
- **Rate Limits:** WeChat has API rate limits. Don't generate too many QR codes in quick succession.
- **Debug Mode:** Keep Live Logs and Campaign Debug open during testing for real-time feedback.

---

*Last Updated: January 2026*
