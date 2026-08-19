## Requirements Summary: Admin Sidebar Notifications

### Problem
Admin cannot see new inbound items (payments, parent diary reports, account requests, practitioner approvals) until they open each page. They need a red-dot indicator on the left sidebar.

### Scope
- System: Autibile admin website
- Direction: inbound (parent/app submits data; admin sees a sidebar indicator)
- Trigger: pending workflow status, or a diary report created in the last 24 hours that has not been opened
- Display: red dot only (no numeric badge)
- Refresh: poll every 60 seconds; also refresh after admin action
- Role: admin only

### Stories
1. Pending payment indicator on Payment / Pending Approvals
2. Unseen diary indicator on Diary Report (last 24 hours, cleared when opened)
3. Pending account request indicator on Account Requests
4. Pending practitioner indicator on Manage User / Users Approval
5. Indicators clear after approve/reject or opening the relevant diary

### Acceptance Criteria
**Payment**
- `GET /api/admin/notifications/counts` returns `paymentPendingCount`
- Count is `payment` rows with `status = "Pending"` and `deleted_at = null`
- Red dot on Payment parent and Pending Approvals when count > 0
- Dot clears after all pending payments are approved or rejected

**Diary Report**
- `diary_report.admin_seen_at` is nullable
- Count is reports with `deleted_at = null`, `admin_seen_at = null`, and `created_at` within the last 24 hours
- Red dot on Diary Report when count > 0
- Opening `/diaryReport/view/:patientId` as admin sets `admin_seen_at` for that patient's unseen reports in the 24-hour window
- After 24 hours, unseen reports stop counting even if never opened

**Account Requests**
- Count is `account_requests` with `status = "Pending"` and `deleted_at = null`
- Red dot on Account Requests when count > 0

**Users Approval**
- Count is `user_practitioners` with `status = "Pending"` and `deleted_at = null`
- Red dot on Manage User parent and Users Approval when count > 0

**API**
- Counts endpoint is admin-only (`401` unauthenticated, `403` non-admin)
- Sidebar polls every 60 seconds

### Out of Scope
- Header bell dropdown
- Push / email / WhatsApp notifications
- Doctor notifications
- Screening responses, appointments, community posts, FAQ, Tech Support
- Notification inbox page

### Confirmed decisions
- Sources for V1: Payment, Diary, Account Requests, Users Approval
- Indicator: red dot only
- Diary rule: last 24 hours AND not yet opened
