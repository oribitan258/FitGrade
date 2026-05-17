# FitGrade — Session Handoff: Performance & Anti-Lag Testing Phase 1

> **Purpose:** This file is a complete cold-start brief for the next Claude session. After reading this end-to-end, the next session has everything it needs to begin implementing Phase 1 of the Performance Testing Architecture without re-exploring the codebase.

---

## 1. Project Context

**FitGrade** is a Hebrew-language, RTL Physical Education grade and attendance tracking SaaS for Israeli schools. It replaces paper-based grading with a digital system optimized for non-tech-savvy PE teachers running fitness tests **live in the field** with up to 30 students per session.

**Stack (fixed, no alternatives):**
- **Web:** Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui + Recharts + SWR + Framer Motion
- **Mobile:** Expo + React Native + React Query + MMKV (teachers only)
- **API:** NestJS + Prisma + PostgreSQL + Passport (Google OAuth + JWT)
- **Shared:** `packages/types` (interfaces, Zod schemas, `getHebrewGradeLabel()`)
- **Tooling:** pnpm workspaces + Turborepo
- **Testing:** Jest + Playwright + Artillery + fast-check

**Design system: "Prismatic Glassmorphism"** — pervasive `backdrop-filter: blur(20–40px)`, radial-gradient layers, animated orbs, layered box-shadows. The sidebar combines `blur(40px) saturate(200%)` + 4 animated radial glows + 10-item stagger nav. Heavy CSS keyframes in `globals.css` (5 parallel `repeat:Infinity` animations).

**Critical constraint: ZERO TOLERANCE FOR LAG.** Teachers use weak Chromebooks/tablets outdoors in bright sunlight under time pressure. A stutter mid-fitness-test breaks teacher trust. Every interaction must feel instantaneous.

**Hebrew RTL is mandatory.** `<html lang="he" dir="rtl">` in root layout, only logical Tailwind properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`) — physical directional classes (`ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`) are BANNED and CI-enforced. All UI text is in Hebrew. Grades stored as Int 0–100, always rendered via `getHebrewGradeLabel()` (returns "מצטיין"/"טוב מאוד"/"טוב"/"עובר"/"נכשל").

---

## 2. Current Repository State

### Git
- Branch: `main`
- Latest commit (relevant): `c63853b fix: resolve lint and TS errors, update playwright visual snapshots`
- Prior commit: `93a012c UserFirstTimeTour` (the Tour Onboarding feature was completed in the previous mega-session with a full 5-tier test pyramid)

### CI Status — `.github/workflows/ci.yml`
**Currently GREEN on every push:**
- `typecheck` (TypeScript: API, Web, Mobile)
- `rtl-audit` (bans physical directional Tailwind classes, verifies `dir="rtl"`)

**Currently DISABLED with `if: false`** (awaiting CI database/secrets provisioning):
- `unit-tests` (API coverage tests)
- `tour-tests` (Jest onboarding, 90% coverage gates)
- `property-tests` (fast-check, 100 runs)
- `api-e2e` (Supertest)
- `playwright` (browser e2e with live DB)
- `load-tests` (Artillery)
- `accessibility` (placeholder, runs via Playwright a11y.spec.ts)

**Nightly** — `.github/workflows/nightly.yml` (23:00 UTC daily):
- `property-exhaustive` (fast-check 10,000 runs)
- `mutation` (Stryker)
- `timezone-chaos`, `concurrent-sessions` (Playwright)
- Auto-creates GitHub issue on failure with link to run — **reuse this pattern for perf regressions**

### Recent CI fixes already applied (do NOT redo)
- `pnpm/action-setup@v4` no longer has `version:` — relies on `packageManager` field in root `package.json`
- `pnpm --filter=api prisma generate` changed to `pnpm --filter=api exec prisma generate` (needs `exec` to invoke binary)
- Web `tsconfig.json` excludes `**/__tests__/**`, `**/*.test.*`, `**/*.spec.*` so `tsc --noEmit` doesn't pick up Jest globals
- `@types/jest@^29.5.0` added to `apps/web` devDeps
- RTL audit grep has `--exclude-dir="ui"` to skip shadcn auto-generated files in `components/ui/`
- `apps/web/next.config.mjs` has `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` (gated in dedicated CI jobs, not in `next build`)
- Mobile `apps/mobile/app/(teacher)/session/[sessionId].tsx` — `useMemo` added to imports; `tappedMap` declared before `renderListItem` (was used before declaration)
- Mobile `apps/mobile/app/login.tsx` — imports `ApiError` from `@fitgrade/types` (the class), not `../lib/api` (which re-exports as `export type` only)

### Existing testing infrastructure (REUSE — do not duplicate)

**Playwright** — `e2e/playwright.config.ts`:
- Chromium-only, `fullyParallel: false`, `workers: 1` (DB-safe)
- `baseURL: http://localhost:3000`, locale `he-IL`, viewport 1280×720
- Per-test timeout 60s, per-expect 30s
- Reporters: HTML + List + JUnit (`test-results/junit.xml`)
- Retries: 1 in CI, 0 locally
- **No perf helpers exist yet — clean canvas**

**Artillery** — `load-tests/fitgrade.yml`:
- Target `http://localhost:3001/api`
- 4 weighted scenarios: Teacher Dashboard (40%), Class+Student List (30%), Class Report (20%), Concurrent Result Submit (10%)
- Phases: warm 10rps/30s → ramp 10→50rps/60s → sustained 50rps/60s
- Existing thresholds: **p95 ≤ 800 ms, max 5xx = 0**
- Variables seeded from env: `LOAD_TEST_TEACHER_TOKEN`, `LOAD_TEST_CLASS_ID`, `LOAD_TEST_SESSION_ID`

**Tour-specific Jest setup (apps/web)** — already configured:
- `ts-jest` + `jest-environment-jsdom`
- `tsconfig.test.json` (`jsx: "react-jsx"`)
- `jest.setup.ts` with `@testing-library/jest-dom`
- `fast-check@^4.7.0`, `@xstate/test@^0.5.0` in devDeps
- Coverage gates for 6 tour modules at ≥ 90%

**Web perf patterns already in place:**
- `useDeferredValue` in `dashboard/page.tsx`
- SWR config per-hook: `revalidateOnFocus: false`, `dedupingInterval: 30s` (stats) / `60s` (reports), `keepPreviousData: true` (top students)
- 23 `loading.tsx` files using Suspense fallbacks
- `Heebo` font with `display: 'swap'`

**Mobile zero-rerender pattern (reuse philosophy):**
- Timer via `setNativeProps` on `Text` ref every 100ms — zero React renders
- FlatList: `getItemLayout` + `initialNumToRender: 15` + `maxToRenderPerBatch: 10`

**Final plan file** is at `C:\Users\oribi\.claude\plans\lexical-scribbling-wand.md` — read it first for full architecture detail.

---

## 3. Performance & Anti-Lag Testing Architecture (Complete)

### Goals (4 user asks)
1. **INP < 100 ms p75** on live tap, attendance toggle, manual save, modal open
2. **No dropped frames** on grade matrix scroll, semester switch, sidebar mount, splash overlay
3. **LCP < 2 s** on dashboard / live / class-detail; CLS < 0.05 on route transitions
4. **API p95 ≤ 800 ms** under peak morning load (Artillery extended)

### Decisions Locked (user-confirmed via AskUserQuestion)
| Decision | Choice |
|---|---|
| CPU throttling | **Matrix 1× + 4×** (catches Chromebook regressions) |
| Field RUM | **In scope as P5** (`/api/rum` ingest + production beacon) |
| Load test cadence | **Weekly cron + main push** |
| Lighthouse CI | **Skipped** — duplicates web-vitals, masks warm-app perf |
| k6 | **Skipped** — Artillery already configured |
| `web-vitals` library | **Used** (vendored v4, version-locked, offline-safe) |
| FPS source | **CDP `Performance.metrics`** over rAF loop |

### Measurement Layers

| Metric | Tool | Harness | Output |
|---|---|---|---|
| INP per interaction | Playwright + `web-vitals` v4 via `addInitScript` | `e2e/perf/inp/*.spec.ts` | `e2e/perf/.results/inp-*.json` |
| LCP / FCP / CLS | Playwright + `PerformanceObserver` + `web-vitals` | `e2e/perf/vitals/*.spec.ts` | `.results/vitals-*.json` |
| Long-Task / TBT | `PerformanceObserver({type:'longtask'})` | shared helper | per-spec JSON |
| FPS / dropped frames | CDP `page.context().newCDPSession()` → `Performance.metrics` | `e2e/perf/fps/*.spec.ts` | `.results/fps-*.json` |
| API p50/p95/p99 | Artillery (existing config extended) | `load-tests/scenarios/*.yml` | `load-tests/.reports/*.json` |
| Field RUM (P5) | `web-vitals` beacon → `/api/rum` → `rum_metrics` table | production runtime | DB-backed |

### SLA Table (becomes `e2e/perf/_helpers/thresholds.ts`)

| Spec | Metric | Target (1×) | Warn | Hard fail | 4× lane fail |
|---|---|---|---|---|---|
| live-tap | INP p75 | < 100 ms | 120 ms | 150 ms | 300 ms |
| attendance-toggle | INP p75 | < 100 ms | 120 ms | 150 ms | 300 ms |
| manual-save | INP p75 | < 150 ms | 180 ms | 220 ms | 400 ms |
| modal-open | INP p75 | < 150 ms | 200 ms | 250 ms | 450 ms |
| dashboard-lcp | LCP | < 2000 ms | 2400 ms | 2800 ms | 5000 ms |
| live-page-lcp | LCP | < 1500 ms | 1800 ms | 2200 ms | 4000 ms |
| cls-route | CLS | < 0.05 | 0.08 | 0.10 | 0.10 |
| grade-matrix-scroll | dropped / 3 s | < 6 | 10 | 15 | 30 |
| semester-switch | dropped / 1.2 s anim | < 3 | 5 | 8 | 15 |
| sidebar-mount | TBT 3 s window | < 200 ms | 300 ms | 400 ms | 800 ms |
| splash-overlay | max longtask | < 100 ms | 150 ms | 200 ms | 400 ms |
| API endpoints | p95 | ≤ 800 ms | 1000 ms | 1200 ms | n/a |
| live-session-burst | p99 result POST | < 600 ms | 800 ms | 1000 ms | n/a |

### INP Measurement Protocol
1. `page.addInitScript` loads `web-vitals` v4 from vendored `e2e/perf/_helpers/vendor/web-vitals.iife.js` (no CDN — offline-safe)
2. Register `onINP(m => window.__perfMetrics.inp.push(m))` with `reportAllChanges: true`. Also install `onLCP`, `onCLS`, `onFCP`, longtask observer
3. Drive **N=20 interactions** of the same class, each followed by `waitForFunction` on the optimistic-update DOM signal + 250 ms settle
4. `await page.evaluate(() => new Promise(r => requestIdleCallback(r, {timeout:500})))` to flush event-timing
5. Read `window.__perfMetrics.inp`, compute **p75 in Node**, assert against threshold
6. Repeat 3×; median p75 is asserted value (`_helpers/median-of-3.ts`)

### FPS Measurement Protocol
```ts
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const before = await cdp.send('Performance.getMetrics');
// ...drive animation...
const after = await cdp.send('Performance.getMetrics');
const dropped = pick(after,'FramesDropped') - pick(before,'FramesDropped');
```
Assert **dropped frame count**, NOT FPS ratio (ratios hide tail jank).

### Anti-Flake Guarantees
- **Median-of-3**: single-run failures → warning; 2-of-3 → hard fail
- **Production build only**: `playwright.perf.config.ts` `webServer.command = 'pnpm --filter=web start'` with pre-step asserting `.next/BUILD_ID` exists; refuses to run against dev (we previously fought 30s dev-mode cold-compile, never again)
- **Fixed environment**: viewport 1280×720, locale `he-IL`, timezone `Asia/Jerusalem`, `prefers-reduced-motion: no-preference`, `colorScheme: light`
- **CPU throttling matrix**: 1× default + 4× via `PERF_CPU=4` env (CDP `Emulation.setCPUThrottlingRate`); separate threshold lanes
- **Network throttling**: default unthrottled; `PERF_NET=3g` opt-in for vitals only
- **Warm-up**: every spec navigates target once, waits for `networkidle` + 500 ms idle, discards measurements, runs measured pass with primed SWR cache
- **Statistical method per metric** (in `thresholds.ts` comments):
  - INP → p75 across interactions, median across runs
  - LCP → max within run (LCP is monotonic), median across runs
  - CLS → final session value, median across runs
  - Dropped frames → sum within window, median across runs
  - Longtask TBT → sum of `(duration - 50)` for tasks > 50 ms, median across runs
- **Quarantine**: `@perf-quarantine` Playwright tag — report-only for 1 week, then unquarantine or fix

### File Structure

```
e2e/perf/
  _helpers/
    inject-web-vitals.ts        # addInitScript loader + __perfMetrics
    cdp-fps.ts                  # CDP frame-metrics wrapper
    long-task-observer.ts       # longtask PerformanceObserver
    median-of-3.ts              # statistical runner
    perf-fixtures.ts            # Playwright test.extend (warm-up, CPU throttle)
    thresholds.ts               # central SLA constants
    vendor/
      web-vitals.iife.js        # pinned v4, vendored
  inp/
    live-tap.spec.ts            # P1
    attendance-toggle.spec.ts   # P1
    manual-save.spec.ts         # P1
    modal-open.spec.ts          # P2
  vitals/
    dashboard-lcp.spec.ts       # P2
    live-page-lcp.spec.ts       # P2
    class-detail-lcp.spec.ts    # P2
    cls-route-transitions.spec.ts  # P2
  fps/
    grade-matrix-scroll.spec.ts # P3
    semester-switch.spec.ts     # P3
    sidebar-mount.spec.ts       # P3
    splash-overlay.spec.ts      # P3
  playwright.perf.config.ts     # extends e2e/playwright.config.ts, prod-only
  README.md                     # triage playbook
  .results/                     # gitignored

load-tests/
  scenarios/
    live-session-burst.yml      # 30 taps/sec × 10 sessions (P4)
    attendance-burst.yml        # morning bell: 100 teachers/5min (P4)
    report-generation.yml       # extends existing 20% (P4)
  processors/
    race-assertion.js           # validate no duplicate rows (P4)
  fitgrade.yml                  # existing — unchanged

apps/api/src/rum/               # P5
  rum.controller.ts             # POST /api/rum (rate-limited, no auth)
  rum.service.ts                # batch write
  rum.repository.ts             # Prisma write only
apps/web/lib/rum-beacon.ts      # P5
apps/api/prisma/migrations/*    # P5: rum_metrics table
```

### CI Integration
- **`perf-web`** (PR + main): boots `next start` against postgres service, runs `playwright test -c e2e/perf/playwright.perf.config.ts`, **matrix `cpu: [1, 4]`**, uploads `.results/*.json` + `trace.zip`. Soft warn → PR comment table; hard fail → red CI.
- **`perf-load`** (weekly cron + main push): added to both `ci.yml` (gated `if: github.ref == 'refs/heads/main'`) and `nightly.yml`. Sequential Artillery scenarios. Auto-issue on regression via existing pattern.

### Bottleneck Isolation
On failure, artifact bundle contains:
1. Playwright **trace.zip** (`trace: 'on'` for perf config)
2. Chrome perf JSON via CDP `Tracing.start`
3. React Profiler opt-in via `PERF_REACT_PROFILER=1` (off by default — overhead corrupts INP)
4. Longtask observer captures `attribution[0].containerName`
5. `top-renders.json` (components with cumulative actual-duration > 16 ms)

Triage path: **trace → longtask attribution → Profiler rerun locally → fix** (documented in `e2e/perf/README.md`).

### Phased Rollout
| Phase | Scope | New artifacts |
|---|---|---|
| **P1** | `live-tap`, `attendance-toggle`, `manual-save` INP | helpers, prod config, `perf-web` CI job (1× + 4×) |
| **P2** | LCP/FCP/CLS specs + `modal-open` INP | reuses P1 helpers |
| **P3** | FPS specs | `cdp-fps.ts`, `long-task-observer.ts` |
| **P4** | Artillery extensions + `perf-load` CI + weekly cron + auto-issue | `load-tests/scenarios/*.yml` |
| **P5** | RUM (`/api/rum` + Postgres `rum_metrics` + web beacon) + React Profiler wiring | new API module + DB migration |

---

## 4. Critical Selectors / Handlers Already Identified

These were located in Phase 1 exploration. Reuse, don't re-search.

| Flow | File:Line | Handler | Selector |
|---|---|---|---|
| Live tap (WEB) | `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/live/page.tsx:344` | `handleTap` | `aria-label="רשום זמן עבור {firstName} {lastName}"` on `motion.button` line 912 |
| Live tap (MOBILE) | `apps/mobile/app/(teacher)/session/[sessionId].tsx:102` | `handleStudentTap` | accessibility label `רשום זמן עבור {fullName}` |
| Toggle absent | `apps/web/app/(teacher)/classes/[classId]/lesson/page.tsx:452` | `handleToggleAbsent` | `aria-label="סמן כחסר"` / `הסר חיסור` (lines 993, 922) |
| Toggle exempt | `apps/web/app/(teacher)/classes/[classId]/lesson/page.tsx:404` | `handleToggleExempt` | `aria-label="סמן כפצוע/פטור"` / `הסר פטור` (lines 927, 1069) |
| Manual save | `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/manual/page.tsx:225` | `handleSave` | input onBlur or Enter (lines 485–289) |
| AddClassModal | `apps/web/components/classes/add-class-modal.tsx:176` | Dialog `onOpenChange` | trigger button |
| AddStudentDialog | `apps/web/components/students/add-student-dialog.tsx:280` | Dialog `onOpenChange` | trigger button |
| TestTypePicker | `apps/web/components/tests/test-type-picker.tsx:80` | local state | tab buttons + search |
| Dashboard mount | `apps/web/app/(teacher)/dashboard/page.tsx:16-58` | `useDashboardStats` + `useClasses` + `useUpcomingEvent` + `useTodaySchedule` + `useClassAverages` + `useCurrentTeacher` | LCP candidate = hero stat card |
| Grade matrix | `apps/web/components/classes/grade-matrix.tsx` | unvirtualized `.map()` of `students × testSummaries` cells | scroll target for FPS |
| Sidebar | `apps/web/components/layout/sidebar.tsx` | `backdrop-filter blur(40px)` + 4 animated radial glows + `layoutId` semester pill spring stiffness 420 | semester-switch + sidebar-mount targets |
| Splash overlay | `apps/web/components/ui/splash-screen.tsx` | `z-[9999]`, MIN_DISPLAY_MS = 3500 + 600 ms exit | `waitForSplashGone` helper exists in `e2e/tour/_helpers.ts` (reuse pattern) |

**Critical FPS risk surfaces (in priority order):**
1. **Sidebar + semester glows** — persistent backdrop-filter + radial-gradient animate on toggle
2. **Grade matrix** — NO virtualization; 30 × 8 = 240 cells, each with per-cell state
3. **Dashboard page enter** — 8 widget cards stagger + CountUp + Recharts AreaChart all at once
4. **Splash/overlay stack** — z-9999, blur(28–40px), AnimatePresence; **INP measurement trap** if displayed during test
5. **`globals.css`** — 5 parallel `repeat:Infinity` keyframes (glass-ripple, prismatic-sweep, shimmer, ticker-scroll, orb animations)

---

## 5. Immediate Next Action — Execute Phase 1

**Goal:** Land a working `perf-web` CI job (still gated `if: false` until CI DB) that runs 3 INP specs against a local production build and prints p75 INP ≤ 100 ms for live-tap and attendance-toggle, ≤ 150 ms for manual-save.

### Phase 1 deliverables (files to create)

1. **`e2e/perf/_helpers/vendor/web-vitals.iife.js`** — vendor `web-vitals@^4` (pin exact version). Download once, commit. No CDN.
2. **`e2e/perf/_helpers/inject-web-vitals.ts`** — exports `injectWebVitals(page: Page)`:
   - `await page.addInitScript({path: '_helpers/vendor/web-vitals.iife.js'})`
   - Inject a second script that:
     - Creates `window.__perfMetrics = { inp: [], lcp: [], cls: [], fcp: [], longtasks: [] }`
     - Registers `webVitals.onINP(m => window.__perfMetrics.inp.push(m), {reportAllChanges: true})`
     - Same for `onLCP`, `onCLS`, `onFCP`
     - Long-task observer: `new PerformanceObserver(list => list.getEntries().forEach(e => window.__perfMetrics.longtasks.push({duration: e.duration, name: e.name, attribution: e.attribution?.[0]?.containerName})))`.observe({type:'longtask', buffered:true})
3. **`e2e/perf/_helpers/median-of-3.ts`** — `runMedianOf3<T>(label: string, fn: () => Promise<T>, pick: (results: T[]) => number): Promise<{median: number, runs: T[]}>` — runs fn 3×, picks the median number per the picker, returns both median and all runs (for artifact writing).
4. **`e2e/perf/_helpers/thresholds.ts`** — exports the SLA table as typed constants. Two lanes: `THRESHOLDS_1X` and `THRESHOLDS_4X`. Read `PERF_CPU` env to pick the active lane.
5. **`e2e/perf/_helpers/perf-fixtures.ts`** — Playwright `test.extend` with:
   - Auto-injects web-vitals on each page before navigation
   - Applies CPU throttling via CDP if `PERF_CPU=4`
   - Implements warm-up navigation helper
   - Adds `attachPerfArtifacts(testInfo, metrics)` for `.results/` JSON output
6. **`e2e/perf/playwright.perf.config.ts`** — extends `e2e/playwright.config.ts`:
   - `webServer.command = 'pnpm --filter=web start'` (port 3000)
   - Pre-step asserts `apps/web/.next/BUILD_ID` exists (refuse dev mode)
   - `trace: 'on'`, fixed viewport/locale/timezone/colorScheme/reducedMotion
   - Reporters: HTML + List + JUnit (`test-results/perf-junit.xml`)
   - Output dir `e2e/perf/.results/`
7. **`e2e/perf/inp/live-tap.spec.ts`** — drive 20 taps on live page, assert p75 INP ≤ 100 ms (median of 3 runs)
8. **`e2e/perf/inp/attendance-toggle.spec.ts`** — drive 20 absent toggles (or mix absent + exempt), assert p75 INP ≤ 100 ms
9. **`e2e/perf/inp/manual-save.spec.ts`** — type value + Tab/Enter into 20 inputs, assert p75 INP ≤ 150 ms
10. **`.github/workflows/ci.yml`** — add `perf-web` job, `if: false` initially, matrix `cpu: [1, 4]`, depends on the same postgres service block already defined in the disabled `playwright` job (copy the service block)
11. **`e2e/perf/README.md`** — triage playbook (trace → longtask attribution → Profiler rerun → fix)

### Phase 1 verification

```powershell
# Build production web
pnpm --filter=@fitgrade/web build

# Start API + Web (terminals 1 & 2)
$env:PORT = "3001"; pnpm --filter=@fitgrade/api start
pnpm --filter=@fitgrade/web start

# Terminal 3 — single spec smoke
pnpm exec playwright test -c e2e/perf/playwright.perf.config.ts e2e/perf/inp/live-tap.spec.ts

# Terminal 3 — full P1 sweep
pnpm exec playwright test -c e2e/perf/playwright.perf.config.ts e2e/perf/inp

# 4× CPU lane
$env:PERF_CPU = "4"; pnpm exec playwright test -c e2e/perf/playwright.perf.config.ts e2e/perf/inp
```

**Expected:** all 3 specs green in both CPU lanes, JSON artifacts in `e2e/perf/.results/`, no flake across 3 consecutive local runs. Once green locally, commit and confirm `perf-web` CI job shows up as Skipped (not red — it's `if: false`).

### Phase 1 DO-NOT-DO list

- ❌ Do NOT enable `perf-web` (`if: false` stays until CI DB flips on — same gating as `playwright`, `api-e2e`, `load-tests`)
- ❌ Do NOT touch `apps/web/components/classes/grade-matrix.tsx` (that's a P3 target; even if it lags during P1 dev, leave it — we measure first, optimize later)
- ❌ Do NOT install Lighthouse CI or k6 (architecture explicitly skips both)
- ❌ Do NOT add a global SWR provider that disables `revalidateOnFocus` app-wide (it's per-hook by design; don't touch tour's `TourProvider` SWRConfig either)
- ❌ Do NOT remove `eslint.ignoreDuringBuilds` from `next.config.mjs` (the dedicated CI lint job covers it)
- ❌ Do NOT run perf specs against `next dev` — the prod-only guard in `playwright.perf.config.ts` will refuse, by design

### Phase 1 sequencing inside the next session

1. Confirm decisions still hold (re-read this file's §3 "Decisions Locked" table)
2. Vendor `web-vitals.iife.js`
3. Write `_helpers/*` (5 files)
4. Write `playwright.perf.config.ts`
5. Write `inp/live-tap.spec.ts` first (anchor spec — get this green before writing the other two)
6. Write `inp/attendance-toggle.spec.ts` + `inp/manual-save.spec.ts`
7. Add `perf-web` CI job with `if: false`
8. Add `e2e/perf/README.md` triage playbook
9. Run the 4-command verification above
10. Commit. Phase 1 done. Phase 2 (Vitals + modal INP) follows.

---

## 6. Reference Documents

- **Full architecture plan:** `C:\Users\oribi\.claude\plans\lexical-scribbling-wand.md`
- **Project rules:** `.claude/CLAUDE.md` + `.claude/rules/backend.md` + `.claude/rules/web-frontend.md` + `.claude/rules/mobile.md`
- **Memory:** `C:\Users\oribi\.claude\projects\c--Users-oribi-Projects-FitGrade\memory\MEMORY.md`
- **System overview:** `docs/architecture.md` + `docs/database-schema.md`

---

## 7. Tone & Working Mode for Next Session

- User is the senior engineer and PM. Speak directly. No filler.
- Hebrew text in code stays Hebrew. Comments/identifiers/internal reasoning in English.
- Never propose alternative tools that weren't approved here (Lighthouse, k6, Cypress, Vitest, etc.).
- Plan-mode is OFF in the next session unless the user explicitly invokes `/plan`. Default to action: write code, run tests, commit on approval.
- If a perf threshold needs adjustment based on real measurements, surface the data and propose a new number — do not silently widen the gate.
- Every perf assertion must have a corresponding line in `thresholds.ts`. No magic numbers in specs.

**Start the next session by reading this file end-to-end, then beginning at §5 step 1.**
