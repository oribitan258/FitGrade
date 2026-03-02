# FitGrade — Mobile Rules (`apps/mobile`)

Stack: **Expo SDK + React Native + TypeScript + Expo Router + React Query (TanStack)**

Read these rules before writing any mobile code. See also [`CLAUDE.md`](../CLAUDE.md) for global rules.

**Audience**: This app is used exclusively by **teachers**, outdoors, on a phone, often in bright sunlight and under time pressure. Design accordingly.

---

## Hebrew & RTL — CRITICAL (Read First)

### RTL Configuration (Mandatory)
In `app/_layout.tsx`, **before** the NavigationContainer or Expo Router stack renders:

```ts
import { I18nManager } from 'react-native';

// Force RTL at app startup — must run before any navigation
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
```

This must be the first code in `_layout.tsx`. React Native will automatically mirror most flex layouts, icons, and navigation animations when RTL is forced.

### StyleSheet Positioning
Use `start`/`end` instead of `left`/`right` in all `StyleSheet` definitions:

```ts
// CORRECT
const styles = StyleSheet.create({
  container: { paddingStart: 16, paddingEnd: 16 },
  label:     { textAlign: 'right' }, // 'right' = end-of-line in Hebrew → correct for RTL
  icon:      { marginEnd: 8 },
});

// WRONG
const styles = StyleSheet.create({
  container: { paddingLeft: 16, paddingRight: 16 },   // breaks in RTL
  icon:      { marginRight: 8 },                       // breaks in RTL
});
```

### Text Alignment in RTL
- For Hebrew body text: `textAlign: 'right'` is correct (reads as "align to the start of the text direction")
- React Native handles RTL text rendering automatically when `I18nManager.forceRTL(true)` is set
- Do **not** manually set `writingDirection: 'rtl'` on text — this conflicts with the global setting

### Grade Labels
Always use `getHebrewGradeLabel(score)` from `packages/types`. Never render a raw 0–100 number as a grade label.

---

## App Structure (Expo Router)

```
apps/mobile/
├── app/
│   ├── _layout.tsx              # Root: RTL config + auth guard + navigation stack
│   ├── login.tsx                # Google OAuth login screen
│   ├── (teacher)/
│   │   ├── _layout.tsx          # Teacher tab navigator (Classes / Active Session)
│   │   ├── index.tsx            # Class list
│   │   ├── classes/
│   │   │   └── [classId]/
│   │   │       ├── index.tsx    # Class detail: student list + session options
│   │   │       ├── attendance.tsx  # Attendance marking screen
│   │   │       └── tests/
│   │   │           ├── index.tsx      # Test type picker
│   │   │           ├── stopwatch.tsx  # Stopwatch mode
│   │   │           └── manual.tsx     # Manual entry (reps / pass-fail / general)
│   │   └── session/[sessionId]/
│   │       └── results.tsx     # Live results during a session
├── components/
│   ├── StudentListItem.tsx      # Reusable student row (large touch target)
│   ├── AttendanceToggle.tsx     # Checkbox/toggle with haptics
│   ├── StopwatchButton.tsx      # Full-width student tap button
│   ├── GradeBadge.tsx           # Shows getHebrewGradeLabel() with color coding
│   └── ErrorBoundary.tsx        # Catches render errors, shows Hebrew error screen
├── hooks/
│   ├── useStudents.ts           # React Query hook: GET /students?classId=
│   ├── useAttendance.ts         # React Query hook + optimistic mutation
│   └── useStopwatch.ts          # Stopwatch session state management
├── lib/
│   ├── api.ts                   # Typed fetch wrapper with JWT auth header
│   ├── storage.ts               # MMKV wrapper (typed get/set)
│   └── haptics.ts               # expo-haptics helper
└── constants/
    └── ui.ts                    # MIN_TOUCH_TARGET = 56, colors, etc.
```

---

## Routing (Expo Router)

- Use Expo Router's **file-based routing** — same mental model as Next.js App Router.
- All screens live in `app/`. Use `(group)` folders for tab/stack nesting.
- Navigate with `router.push('/classes/abc123/attendance')` — use typed route strings.
- Protect teacher routes with a layout-level auth check that redirects to `/login` if no JWT.
- Never use React Navigation directly — use Expo Router's `<Link>` and `router` object.

---

## Touch Targets — Outdoor Use

Teachers use this app outdoors, possibly wearing gloves, under time pressure.

- **Minimum touch target: 56px** (`MIN_TOUCH_TARGET = 56` in `constants/ui.ts`).
- Student name buttons in stopwatch mode must be **full-width, minimum 72px tall**.
- Use `hitSlop` for smaller icons that must remain compact visually but need a larger tap area:
  ```ts
  <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
  ```
- Bottom navigation tabs must be at least 64px tall.
- Font size minimums: body text 16px, button labels 18px, stopwatch timer 48px+.

---

## Haptic Feedback

Always use `expo-haptics` for confirmation feedback on critical actions.

```ts
import * as Haptics from 'expo-haptics';

// Student tapped in stopwatch mode — use impact feedback
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// Attendance toggled — use light notification
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Error (e.g., student already recorded) — use error feedback
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
```

---

## Stopwatch Mode

This is the most critical screen. Correctness and reliability are paramount.

```
Stopwatch screen rules:
1. Timer display: use Date.now() math — NEVER setTimeout counting
2. Start time is set SERVER-SIDE: POST /results/stopwatch/start → API returns { startedAt }
3. Tap registration: POST /results/stopwatch/tap { sessionId, studentId }
4. On successful tap:
   - Immediately move student to "completed" section (optimistic)
   - Trigger Haptics.impactAsync(Medium)
   - Show elapsed time next to student name
5. On duplicate tap (409 Conflict): trigger Haptics error, show brief toast "כבר נרשם"
6. On network failure during tap:
   - Retry once automatically (within 2 seconds)
   - If still fails: show "נכשל — נסה שוב" error overlay on that student row
7. Undo: student can be un-tapped within 30 seconds via swipe-to-reveal or long-press
```

Timer display implementation:
```ts
const [startedAt, setStartedAt] = useState<number | null>(null);
const [elapsed, setElapsed] = useState(0);

useEffect(() => {
  if (!startedAt) return;
  const interval = setInterval(() => {
    setElapsed(Date.now() - startedAt);
  }, 100); // Update every 100ms for smooth display
  return () => clearInterval(interval);
}, [startedAt]);

// Display: Math.floor(elapsed / 1000) seconds
```

---

## State Management

- **Server state**: React Query (TanStack Query) for all API data.
- **Local/UI state**: `useState` / `useReducer` — no global state library needed.
- **Persistent local state**: MMKV via `lib/storage.ts` for: auth token, last-used class, offline queue.
- Do not use Redux, Zustand, or Jotai — React Query handles server state adequately.

```ts
// hooks/useStudents.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useStudents(classId: string) {
  return useQuery({
    queryKey: ['students', classId],
    queryFn: () => api.get(`/students?classId=${classId}`),
  });
}
```

---

## Offline Resilience

Teachers use this app in gyms, fields, and areas with poor connectivity.

- Cache the most recent class+student list in MMKV when the app is online.
- If the API is unreachable on app open: show cached data with an "אין חיבור לאינטרנט" banner.
- For attendance mutations: queue failed mutations and retry when connection restores (React Query's `onError` + manual retry).
- For stopwatch taps: fail visibly and loudly (haptic error + visual error state) — **never silently discard a lap tap**.
- Offline indicator: a persistent banner at the top of the screen when `NetInfo.isConnected === false`.

---

## Error Handling

- Wrap every screen in an `<ErrorBoundary>` component that shows a friendly Hebrew error screen with a "נסה שוב" (retry) button.
- React Query `onError` callbacks must show a toast or in-screen error (never silently fail).
- Network errors must show a specific Hebrew message, not a generic "Something went wrong".
- Permission errors (camera, location) must explain why the app needs the permission in Hebrew.

---

## Lists and Scrolling

- Use `FlatList` for all student lists — never `ScrollView` with a fixed-height list of children.
- Set `keyExtractor={item => item.id}` explicitly on all `FlatList` instances.
- Provide `getItemLayout` for fixed-height rows to improve scroll performance.
- Add `initialNumToRender={15}` and `maxToRenderPerBatch={10}` for large class lists.

---

## No Web-Only APIs

Never use:
- `localStorage` or `sessionStorage` — use MMKV
- `window`, `document`, `navigator` — use React Native equivalents
- CSS classes or inline style strings — use `StyleSheet.create()`
- `<div>`, `<span>`, `<p>` — use `<View>`, `<Text>` etc.

---

## Authentication

- Store the JWT access token in MMKV (not `AsyncStorage` — MMKV is synchronous and encrypted).
- On app start, check MMKV for token, validate expiry, redirect to login if expired.
- Attach token to all API calls via `lib/api.ts` fetch wrapper.
- On 401 response: clear token, redirect to `/login`.
- Refresh token flow: store refresh token in MMKV, call `POST /auth/refresh` before access token expires.

---

## Testing

- Use **Jest** + **React Native Testing Library** (`@testing-library/react-native`).
- Test stopwatch timing logic separately from UI (pure function tests).
- Test attendance toggle optimistic update + revert on error.
- Mock `expo-haptics` in tests to avoid native module errors.
- Mock React Query's `useQuery` / `useMutation` for component tests.
