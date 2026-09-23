# Autibile Web — Change Request Specs

> Implement every item below. File paths are relative to `c:\Users\IM\autibile`.
> All database fields already allow NULL (String?/DateTime?), so no Prisma migrations are needed unless stated.

---

## CR1 — Manage Child Table: Parent Username → Parent Full Name

**Goal:** Replace the "Parent Username" column with the parent's full name, and make the search bar search by full name.

### Server
**File:** `server/api/parents/manageChild/listChild.get.js`

1. In the formatted response object (around line 106), change:
   ```js
   parentUsername: p.user?.userUsername || '',
   ```
   to:
   ```js
   parentFullName: p.user?.userFullName || '',
   ```
   Keep `parentUsername` too if it's used elsewhere in that file, otherwise remove it.

### Frontend
**File:** `pages/userManagement/parent/manageChild.vue`

1. In the `columns` array (around line 52), change:
   ```js
   { name: 'parentUsername', label: 'Parent Username' },
   ```
   to:
   ```js
   { name: 'parentFullName', label: 'Parent Full Name' },
   ```

2. In the table template where `parentUsername` is rendered (search for `patient.parentUsername`), change to `patient.parentFullName`.

3. In the search/filter logic, update any reference to `parentUsername` to `parentFullName` so the search bar can match against full names.

4. In the `fetchData` / data-mapping logic, update `parentUsername` → `parentFullName` throughout this file.

---

## CR2 — Dashboard: Remove Total Active Users Card

**Goal:** Remove the "Total Active Users" stat card from the admin dashboard.

### Frontend
**File:** `pages/dashboard/index.vue`

1. Find and **delete** the entire `<rs-card>` block that contains the text "Total Active Users" (around lines 70–80). It looks like:
   ```html
   <rs-card>
     <div class="pt-5 pb-3 px-5 flex items-center gap-4">
       ...
       <span ...>{{ totalUsers }}</span>
       <span ...>Total Active Users</span>
     </div>
   </rs-card>
   ```

### Server (optional cleanup)
**File:** `server/api/dashboard/dashboard.get.js`

2. Remove the `totalUsers` query (around lines 115–117):
   ```js
   const totalUsers = await prisma.user.count({
     where: { userStatus: 'Active' },
   });
   ```
   And remove `totalUsers` from the response object.

---

## CR3 — Remove Username for Parents (Web)

**Goal:** Parents no longer need to provide a username. Remove the username field from the parent registration form, and remove the "Username" column from the parents management table. The `userUsername` DB field stays; new parents just won't have a value.

### Parent Registration Form
**File:** `pages/userManagement/parent/addParents.vue`

1. Find and **delete** the username `<FormKit>` field block (around lines 285–291). It includes a real-time availability check using `/api/parents/checkUsername`.
2. Remove any related `username` variable from `reactive`/`ref` state.
3. Remove any `username` from the submitted form data sent to the API.
4. Remove any username availability check logic (the `watch` or `onInput` handler that calls `checkUsername`).

### Parent Registration API (Web admin-side)
**File:** `server/api/parents/insert.post.js`

5. Make `username` (mapped to `userUsername`) **optional** — if not provided, save `null` or skip setting the field. Do not throw validation error if missing.

### Parents Table
**File:** `pages/userManagement/parent/parents.vue`

6. In the `columns` array (around line 106), **delete** the entry:
   ```js
   { name: 'username', label: 'Username' },
   ```
7. Remove any table cell template that renders `p.username`.

### Parents List API
**File:** `server/api/parents/listParents.get.js`

8. Remove `username: parent.user?.userUsername` (around line 69) from the response object — it no longer needs to be sent to the frontend.

### Manage Child Table
**File:** `pages/userManagement/parent/manageChild.vue`

9. This was handled in CR1 (column renamed to parentFullName). Make sure `parentUsername` references are fully replaced and none remain.

---

## CR4 — Registration Timestamps in All User Tables

**Goal:** Add a "Registration Date" column (sortable) to the Parents, Practitioners, and Admins tables on the web.

The DB already stores:
- `user_parents.created_at` (DateTime, required, no default — set on insert)
- `user_practitioners.created_at` (DateTime, required, no default)
- `user.userCreatedDate` (DateTime?, optional — used for admins and as fallback)

### Parents

**File:** `server/api/parents/listParents.get.js`

1. In the formatted response object, add:
   ```js
   registeredAt: parent.user_parents?.created_at || parent.user?.userCreatedDate || null,
   ```

**File:** `pages/userManagement/parent/parents.vue`

2. Add column definition:
   ```js
   { name: 'registeredAt', label: 'Registered', sortable: true },
   ```
3. In the table template, render it as a formatted date:
   ```html
   <td>{{ row.registeredAt ? new Date(row.registeredAt).toLocaleDateString() : '—' }}</td>
   ```

### Practitioners

**File:** `server/api/practitioners/listPractitioners.get.js`

4. In the formatted response, add:
   ```js
   registeredAt: p.user_practitioners?.created_at || p.user?.userCreatedDate || null,
   ```

**File:** `pages/userManagement/practitioners.vue`

5. Add column definition (around line 445):
   ```js
   { name: 'registeredAt', label: 'Registered', sortable: true },
   ```
6. Render in table template the same way as above.

### Admins

**File:** `server/api/admin/listAdmins.get.js`

7. In the formatted response (around line 52), add:
   ```js
   registeredAt: user.userCreatedDate || null,
   ```

**File:** `pages/userManagement/admin/adminPage.vue`

8. Add column definition (around line 75):
   ```js
   { name: 'registeredAt', label: 'Registered', sortable: true },
   ```
9. Render in table template.

---

## CR5 — Remove Nickname for Children (Web)

**Goal:** Nickname should no longer be requested, displayed, or required anywhere for children. Existing data stays in DB; just stop showing/asking for it.

### Add Child Form
**File:** `pages/userManagement/parent/addChild.vue`

1. Find and **delete** the nickname `<FormKit>` field (around line 412):
   ```html
   <FormKit type="text" v-model="form.nickname" label="Nickname" validation="required" validation-visibility="live"/>
   ```
2. Remove `nickname` from `form` reactive state.
3. Remove `nickname` from the data sent to the server.

### Edit Child Form
**File:** `pages/userManagement/parent/editChild.vue`

4. Find and **delete** the nickname `<FormKit>` field (around line 162).
5. Remove `nickname` from form state and submitted data.

### Manage Edit Child Form
**File:** `pages/userManagement/parent/manageEditChild.vue`

6. Find and **delete** the nickname field (around line 135).
7. Remove from form state and submitted data.

### Patient Profile Select Page
**File:** `pages/patientProfile/select.vue`

8. Find all references to `patient.nickname` (around lines 21, 139, 213) and **remove** or hide them. Do not display `"{{ patient.nickname || 'No nickname' }}"`.

### Diary Report View
**File:** `pages/diaryReport/view/[id].vue`

9. Find "Nickname" label and `{{ selectedPatient.nickname || 'N/A' }}` (around lines 360–361) and **remove** that row entirely.

### Questionnaire Results
**File:** `pages/questionnaire/results/index.vue`

10. Find the block that conditionally shows `patientDetails?.nickname` (around lines 416–418) and **remove** it.

### Server API — Insert Child
**File:** `server/api/parents/manageChild/insertChild.post.js`

11. Make `nickname` optional (around lines 9, 24, 48) — if not provided, save `null`. Do not validate/require it.

### Server API — App Add Child
**File:** `server/api/apps/children/addChildren.post.js`

12. Make `nickname` optional (around lines 9, 51). Do not require it.

### Report Utilities (if you want to clean up)
These files reference nickname in reports/PDFs — optionally remove the nickname column/field if it's a simple removal:
- `server/utils/reportDefinitions.js` (line 180)
- `server/utils/diaryReportDocument.js` (lines 114, 203)

> Note: If removing from PDF documents is complex, skip for now and flag for a separate CR.

---

## CR6 — Patient Diary Reports: Show Only Patients With Entries

**Goal:** The Patient Diary Reports table (`pages/diaryReport/index.vue`) should only display children who have at least one diary report entry. Children with no diary entries should not appear in the table.

### Current Behavior
The page fetches all active children from `/api/parents/manageChild/listChild?activeOnly=true` and displays all of them.

### Implementation

**Option A — Filter on server (recommended):**

**File:** `server/api/parents/manageChild/listChild.get.js`

1. Add a query parameter `hasDiary` (boolean). When `hasDiary=true`, filter to only children who have at least one associated diary entry. Check the Prisma schema for the diary entry model name (look for a model with a `patient_id` or `childID` FK). Add a `where` filter like:
   ```js
   // if query.hasDiary === 'true'
   where: {
     diary_reports: { some: {} }   // adjust model name to match schema
   }
   ```

**File:** `pages/diaryReport/index.vue`

2. Change the API call URL from:
   ```
   /api/parents/manageChild/listChild?activeOnly=true
   ```
   to:
   ```
   /api/parents/manageChild/listChild?activeOnly=true&hasDiary=true
   ```

**Option B — Filter on frontend (simpler):**

If the diary entry model lookup is complex, after fetching children, also fetch a list of child IDs that have diary entries, then filter the children array to only include those IDs. Choose whichever option is simpler given the schema.

---

> End of web specs.
