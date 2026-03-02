# FitGrade — Web Frontend Rules (`apps/web`)

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Recharts + SWR**

Read these rules before writing any web frontend code. See also [`CLAUDE.md`](../CLAUDE.md) for global rules.

---

## Hebrew & RTL — CRITICAL (Read First)

This application is **Hebrew-only with RTL layout**. These rules are non-negotiable.

### Root Layout
The root `app/layout.tsx` must always have:
```tsx
<html lang="he" dir="rtl">
```
This single attribute flips the entire browser layout to RTL. It must never be removed.

### Tailwind — Logical Properties Only

**BANNED physical directional classes** (will break RTL layout):
```
ml-* mr-* pl-* pr-* text-left text-right left-* right-*
border-l border-r rounded-l rounded-r float-left float-right
```

**REQUIRED logical equivalents** (RTL-safe):
```
ms-* me-* ps-* pe-* text-start text-end start-* end-*
border-s border-e rounded-s rounded-e
```

Cheat sheet:
| Banned (physical) | Use instead (logical) |
|-------------------|----------------------|
| `ml-4` | `ms-4` |
| `mr-4` | `me-4` |
| `pl-4` | `ps-4` |
| `pr-4` | `pe-4` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `left-0` | `start-0` |
| `right-0` | `end-0` |
| `border-l` | `border-s` |
| `border-r` | `border-e` |
| `rounded-tl-*` | `rounded-ts-*` |
| `rounded-tr-*` | `rounded-te-*` |

### Grade Labels
**Never render a raw grade number (0–100) as a user-facing label.** Always use:
```ts
import { getHebrewGradeLabel } from '@fitgrade/types';
// Renders: "מצטיין", "טוב מאוד", "טוב", "עובר", "נכשל"
<span>{getHebrewGradeLabel(result.effectiveGrade)}</span>
```

---

## Next.js App Router Rules

- **App Router only** — all pages live in `app/`. Never create files in a `pages/` directory.
- **Default to Server Components.** Add `'use client'` only when the component genuinely needs:
  - Browser event handlers (`onClick`, `onChange`, etc.)
  - React hooks (`useState`, `useEffect`, `useRef`, etc.)
  - Browser-only APIs (`window`, `document`, `localStorage`)
- Server Components fetch data directly (async component + `fetch()` or Prisma via server action).
- Client Components fetch data with **SWR** (`useSWR`).

```tsx
// CORRECT — Server Component (default)
export default async function ClassPage({ params }: { params: { classId: string } }) {
  const classData = await fetchClass(params.classId); // server-side fetch
  return <ClassView class={classData} />;
}

// CORRECT — Client Component (only when needed)
'use client';
export function AttendanceToggle({ studentId }: { studentId: string }) {
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
  // ...
}
```

### Route Structure

```
app/
├── layout.tsx                    # Root: <html lang="he" dir="rtl">
├── page.tsx                      # Redirect → /login or /dashboard
├── (auth)/
│   ├── login/page.tsx            # Teacher Google OAuth login
│   └── student-login/page.tsx    # Student code + password login
├── (teacher)/
│   ├── layout.tsx                # Teacher shell (sidebar + header)
│   ├── dashboard/page.tsx        # Class overview
│   ├── classes/
│   │   ├── page.tsx              # Class list
│   │   ├── new/page.tsx          # Create class
│   │   └── [classId]/
│   │       ├── page.tsx          # Class detail
│   │       ├── attendance/page.tsx
│   │       ├── tests/page.tsx    # Test session list
│   │       └── tests/[sessionId]/page.tsx  # Grade entry
│   ├── exports/page.tsx          # Excel/PDF download
│   └── loading.tsx               # Shared loading state
└── (student)/
    ├── layout.tsx                # Student shell (minimal)
    └── progress/page.tsx         # Student's own progress charts
```

### Loading & Suspense

- Every route segment must have a `loading.tsx` sibling that renders a skeleton or spinner.
- Wrap async data sections in `<Suspense fallback={<Skeleton />}>` for fine-grained loading.
- Server actions that mutate data must show a loading indicator (use `useFormStatus` or a `pending` state).

---

## Forms

- All forms use **`react-hook-form`** with **Zod** schema validation.
- Import Zod schemas from `packages/types` — never redefine validation schemas in the web app.
- Use `zodResolver` from `@hookform/resolvers/zod`.
- Show inline validation errors below each field, in Hebrew.
- Disable the submit button while the form is submitting.

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createStudentSchema, type CreateStudentDto } from '@fitgrade/types';

const form = useForm<CreateStudentDto>({
  resolver: zodResolver(createStudentSchema),
});
```

---

## shadcn/ui Rules

- shadcn/ui components live in `components/ui/` — **never modify these files directly**.
- To customize a component, create a **wrapper** in `components/` that imports from `components/ui/`.
- Only install shadcn/ui components via `npx shadcn-ui@latest add <component>`.
- Test every shadcn/ui component in RTL mode — some (like `Dropdown`, `Dialog`) may need RTL-specific config.

---

## Charts (Recharts)

- All charts live in `components/charts/` as named wrappers (e.g., `ProgressBarChart.tsx`).
- Never use Recharts directly in page components — always go through a wrapper.
- Charts for student progress show semester A vs. B side-by-side.
- Use positive framing only in student-facing charts: green for improvement, avoid red.
- Grade labels on chart axes must use `getHebrewGradeLabel()`, not raw numbers.
- Charts must be `'use client'` components (Recharts requires browser APIs).

---

## Component Organization

```
apps/web/
├── app/                          # Next.js routes (see above)
├── components/
│   ├── ui/                       # shadcn/ui primitives (do not edit)
│   ├── charts/                   # Recharts wrappers
│   ├── forms/                    # Form components (react-hook-form)
│   ├── layout/                   # Shell, sidebar, header, nav
│   └── [domain]/                 # Domain-specific: StudentCard, GradeCell, etc.
├── lib/
│   ├── api.ts                    # Typed fetch wrapper for API calls
│   ├── auth.ts                   # Auth utilities (session, token)
│   └── utils.ts                  # cn() helper, date formatting, etc.
├── hooks/                        # Custom SWR hooks (useStudents, useClassResults, etc.)
└── types/                        # Web-only type extensions (if any)
```

---

## Data Fetching

### Server Components
```tsx
// Use fetch with Next.js caching — tag for revalidation
const results = await fetch(`${process.env.API_URL}/results?classId=${classId}`, {
  headers: { Authorization: `Bearer ${token}` },
  next: { tags: [`class-${classId}-results`] },
});
```

### Client Components (SWR)
```tsx
const { data: students, isLoading, error } = useSWR(
  `/api/students?classId=${classId}`,
  fetcher,
);
```

- Create a centralized `fetcher` function in `lib/api.ts` that handles auth headers and error parsing.
- On 401 responses, redirect to login.
- On any API error, display a Hebrew toast using shadcn/ui `<Toast>`.

---

## UX Rules (Non-Tech-Savvy Teacher Design)

1. **Large buttons**: minimum `h-12` (48px) for all primary interactive elements.
2. **Clear Hebrew labels**: no icons without text labels for primary actions.
3. **Error forgiveness**: every destructive action (delete student, remove result) requires confirmation via a `<Dialog>` with a clear Cancel option.
4. **Optimistic UI for attendance**: toggle state immediately, revert on API error with a toast undo option.
5. **Undo window**: after attendance or grade changes, show a toast with "בטל" (undo) action for 10 seconds.
6. **Loading feedback**: every form submission and page transition must show a visible loading indicator.
7. **Empty states**: every list has a meaningful Hebrew empty state message (not just a blank page).

---

## Accessibility

- All interactive elements must have `aria-label` in Hebrew (when icon-only).
- Use semantic HTML: `<nav>`, `<main>`, `<header>`, `<table>`, `<button>`, `<form>`.
- Keyboard navigation must work for all primary flows (tab, enter, escape).
- Focus management: after closing a dialog, return focus to the trigger element.
- Color is never the only indicator — use text or icons alongside color for status.

---

## Export Flow (Teacher)

- Export triggers a download via a direct API link or a `fetch()` call with `blob()` response.
- Show a loading spinner during export generation.
- On success, trigger download via `URL.createObjectURL()`.
- On error, show a Hebrew error toast.
- Excel button: "ייצוא לאקסל" | PDF button: "ייצוא ל-PDF"

---

## Testing

- Use **React Testing Library** + **Jest** for component tests.
- Test interactive components: form submission, attendance toggle, stopwatch tap.
- Mock SWR responses in tests using `jest.mock('swr')`.
- Snapshot tests for static display components (StudentCard, GradeCell).
- Accessibility: use `@testing-library/jest-dom` matchers to assert aria attributes.
