# Hide M-CHAT-R/F Questionnaire Implementation

## Overview
Hide the M-CHAT-R/F questionnaire (ID: 2) from the admin interface and all client-facing views without deleting data.

## Files Updated

### 1. Prisma Schema Update
**File:** `prisma/schema.prisma`
- Added `hidden` field to `questionnaires` model
- Type: `Boolean?` with default value `false`
- This allows soft-hiding without data loss

### 2. Backend API Updates

#### a) `server/api/questionnaire/listQuestionnaires.get.js`
- Added filter: `hidden: { not: true }`
- Excludes hidden questionnaires from the response
- Used by admin questionnaire list page

#### b) `server/api/apps/questionnaire/listQuestionnaire.get.js`
- Added filter: `hidden: { not: true }`
- Excludes hidden questionnaires from the response
- Used by mobile and other app views

#### c) `server/api/apps/questionnaire/mobile.get.js`
- Changed from `findUnique` to `findFirst` (required for complex filters)
- Added filter: `hidden: { not: true }`
- Prevents access to hidden questionnaires even by direct ID

## Migration Steps

### 1. Run the migration (DO NOT RUN YET)
**File:** `prisma/migrations/add_hidden_to_questionnaires.sql`

```bash
npx prisma migrate dev --name add_hidden_to_questionnaires
```

Or run the SQL directly:
```sql
ALTER TABLE `questionnaires` ADD COLUMN `hidden` BOOLEAN DEFAULT false;
UPDATE `questionnaires` SET `hidden` = true WHERE `questionnaire_id` = 2;
```

### 2. What This Does
- ✅ Adds `hidden` column to questionnaires table with default value of `false`
- ✅ Sets M-CHAT-R/F (questionnaire_id = 2) to `hidden = true`
- ✅ All other questionnaires default to `hidden = false` (visible)

## Result After Implementation

### What Gets Hidden
- ❌ M-CHAT-R/F no longer appears in admin questionnaire list
- ❌ M-CHAT-R/F no longer appears in mobile app questionnaire list
- ❌ Direct access attempts return "not found" error

### What's Preserved
- ✅ All question data remains intact
- ✅ All user responses remain intact
- ✅ All scoring data remains intact
- ✅ All historical data preserved

## How to Unhide (if needed later)

If you need to unhide M-CHAT-R/F:
```sql
UPDATE `questionnaires` SET `hidden` = 0 WHERE `questionnaire_id` = 2;
```

Or programmatically set `hidden = false` in the admin panel (optional UI enhancement).

## Client Benefit
- Supervisor requirement met: "boleh hide MChatRF ni? sbb tak nak client ingat kita nak buat"
- Client won't see M-CHAT-R/F in any interface
- Data is still safely stored for future use if needed
