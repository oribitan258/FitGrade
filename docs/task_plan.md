# Task Plan: Schedule & Live Lesson

## Schema Assessment

### Schedule (מערכת שעות)
**No DB model needed.** The schedule is teacher-local UI state (which class is in which time slot).
- Store as JSON in `localStorage` under key `fitgrade-schedule-v1`
- Format: `Record<"day-period", classId>` — e.g., `{ "0-2": "cls_abc", "3-5": "cls_xyz" }`
- Data is seeded from the teacher's real class list via `useClasses()`

### Injuries / Exemptions (פצוע/פטור)
**No schema changes needed.** Use existing `AttendanceStatus.EXCUSED`.
- API: `POST /classes/:classId/attendance` (already exists)
- Body: `{ date: "YYYY-MM-DD", records: [{ studentId, status: "EXCUSED" | "PRESENT" }] }`
- Upsert semantics — safe to call per-student toggle

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/web/app/(teacher)/schedule/page.tsx` | Premium weekly calendar calendar |
| `apps/web/app/(teacher)/classes/[classId]/lesson/page.tsx` | Unified live lesson (test picker + roster + injury toggle) |

---

## Design Specifications

### Schedule Page (`/schedule`)

- **Grid**: 5 days (ראשון–חמישי) × 8 periods with period times
- **Class blocks**: Same accent color system as `/classes` page
- **Empty cell**: Click → class picker modal listing all teacher classes
- **Assigned cell**: Click → navigate to `/classes/{classId}/lesson`
- **Remove assignment**: ✕ button on hover / tap
- **Storage**: `useEffect` reads from `localStorage`, updates persist on every change
- **RTL**: Days go right→left (ראשון on the right)

### Live Lesson Page (`/classes/[classId]/lesson`)

Two-phase UI (state machine):

**Phase 1 — Test Selection (`select`):**
- Pill-button grid of all test types from Ministry DB
- Student roster visible with **injury toggles** (big red toggle per row)
- "התחל מבחן" button enabled only when test type is selected
- Exempt students shown grayed immediately (attendance saved optimistically)

**Phase 2 — Entry (`active`):**
- Session created on transition (POST /classes/:classId/sessions)
- Student roster split into:
  - **Active students**: inline numeric/PASS_FAIL entry + grade badge + injury toggle
  - **Exempt section**: animated slide-in at bottom, grayed cards
- Injury toggle remains usable during entry — toggling exempt removes from active grid
- "סיים שיעור" → PATCH complete session → navigate back to class page

### Injury Toggle UX
- Large orange/red button with shield icon: `פצוע/פטור`
- Loading spinner while attendance POST is in-flight
- Toggle OFF restores student to active (POST PRESENT)
- Framer Motion `layout` + `AnimatePresence` for smooth section transitions

---

## API Calls Summary

| Action | Method | Path | Body |
|--------|--------|------|------|
| Load students | GET | `/classes/:classId/students` | — |
| Load test types | GET | `/tests/types` | — |
| Create session | POST | `/classes/:classId/sessions` | `{ testTypeId, notes: '' }` |
| Submit result | POST | `/sessions/:sessionId/results` | `{ studentId, rawValue }` |
| Delete result (re-entry) | DELETE | `/sessions/:sessionId/results/:studentId` | — |
| Complete session | PATCH | `/sessions/:sessionId/complete` | — |
| Mark exempt | POST | `/classes/:classId/attendance` | `{ date, records: [{studentId, status: 'EXCUSED'}] }` |
| Un-mark exempt | POST | `/classes/:classId/attendance` | `{ date, records: [{studentId, status: 'PRESENT'}] }` |
