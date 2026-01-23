# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-01-23

### Added

#### Admin Dashboard - Contacts Page
- New "All Contacts" page for unified user management
- Display WeChat profile (avatar, nickname, location, OpenID, UnionID)
- Show linked Mini Program and Official Account IDs
- User actions: soft delete, hard delete, block/unblock, make/remove admin
- Contact statistics with source breakdown (MP/OA/Registration)
- Search and filter by source, status, admin role
- Pagination support

#### Admin Dashboard - Overview Redesign
- New "Today's Pulse" dashboard with key business metrics
- Net Growth (new users - unfollows)
- Viral Coefficient (helpers per participant)
- Reward Cost tracking
- Campaign summary with performance breakdown
- Recent activity feed
- Client-side caching with manual refresh button
- Removed legacy "Analytics" section

#### Admin Dashboard - Event History Improvements
- Compact table-based layout (replaced card view)
- User column moved to first position
- Inline JSON copy and Event ID copy buttons
- Expandable rows for detailed event data
- User avatar display in event list
- Muted color scheme for better readability

#### Admin Dashboard - Campaign Debug Enhancement
- Full event table in "Recent Campaign Events" section
- Same detailed format as Event History page
- Expandable rows with complete event data
- Inline copy buttons for JSON and Event ID

#### Campaign Management
- Delete campaign option with cascading deletion
- Removes all related data (participants, helpers, rewards, events)
- Double confirmation for safety

#### WeChat Profile Capture
- Official Account: Full profile capture (avatar, nickname, city, province, country, gender)
- Mini Program: `wx.getUserProfile()` integration for user authorization
- Profile authorization modal on campaign and profile pages
- Backend API endpoint for profile updates

#### Event Deduplication
- In-memory cache for WeChat webhook events
- Prevents duplicate event logging within 60-second window
- Handles WeChat's retry mechanism gracefully

### Fixed

- WeChat OA user profile not being captured (avatar, nickname, location)
- Duplicate webhook events from WeChat retries
- `wechat_gender` type mismatch (integer vs string)
- Unique constraint violation for phone placeholder on new OA users
- Campaign events not showing in debug panel (JSONB query fix)
- Foreign key ambiguity in event queries
- QR code ticket duplicate constraint error (upsert handling)
- Mini Program registration form input not responding (CSS conflict)
- Missing `selectRole` function in registration page

### Changed

- Event History UI from colorful cards to minimal table rows
- Overview dashboard from generic stats to business-focused metrics
- Campaign debug events query to filter by `event_data->campaign_id`
- User creation to generate unique phone placeholders for OA users

### Technical

- Database migration: `015_add_contacts_fields_to_users.sql`
- New API endpoints in `backend/src/routes/admin.ts` for contacts
- New API endpoint `PUT /api/users/profile` for Mini Program profile updates
- Enhanced `getCampaignDebugEvents` in campaign-service.ts
- Event deduplication cache in `backend/src/routes/oa.ts`

---

## [1.1.0] - 2026-01-22

### Added

#### UI Redesign
- Modern card-based layouts with rounded corners
- New color palette: Dark navy (#1a1a2e), Green accent (#10b981)
- Light grey background (#f8f9fa) with white cards
- Subtle shadows and refined typography
- Custom tab bar with icons

#### Page Redesigns
- **Landing**: Hero image, icon badge, CTA button with arrow
- **Register**: Role selector buttons (2x2 grid), rounded inputs
- **Home**: User card with avatar, points badge, action buttons, task cards
- **Rewards**: Image cards with points overlay, Details/Earn buttons
- **Invite**: Poster preview with navigation arrows, Save/Copy buttons
- **Profile**: Avatar badge, Role/Balance cards, account details list
- **Admin**: Table view with tabs (Users/Offers/Tasks), stats summary

#### Admin Dashboard Enhancements
- Collapsible sections for Debug Settings and Quick Reference
- Enhanced Recent Events with JSON payload viewer
- Environment validation with current value display
- Real-time SSE debug logs
- Tunnel Manager with status cards

#### Backend Improvements
- Cloudflare tunnel validator service
- Environment validator service
- Event stream service for real-time logs
- Test webhook service for debugging

### Fixed
- 401 Unauthorized errors for admin API calls
- JWT_SECRET loading from .env file
- Duplicate dotenv.config() calls

---

## [1.0.0] - 2026-01-22

### Added

#### Core Features
- WeChat Mini Program login with UnionID support
- User registration and profile management
- Unique invite code generation
- Mini Program QR code generation with invite parameters
- Official Account parametric QR code generation
- Invite relationship chain tracking
- Points system with tasks and rewards
- Reward redemption system

#### Official Account Integration
- Parametric QR code generation
- Scan event handling
- Follow/unfollow event handling
- Auto-reply messages
- Poster generation with QR codes

#### Admin Dashboard
- Unified event logging system
- Real-time statistics
- User management
- Invite chain visualization
- OA event monitoring
- Activity settings management

#### Event Logging
- Login events (Mini Program, email)
- Registration events
- QR code scan events
- Follow/unfollow events
- Invite events
- Redemption events

### Technical
- Node.js/Express backend API
- Supabase (PostgreSQL) database
- JWT authentication
- WeChat API integration
- TypeScript throughout
