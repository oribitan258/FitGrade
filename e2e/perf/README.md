# FitGrade Performance Test Suite

Zero-tolerance lag policy: every interaction must feel instantaneous on weak Chromebook/tablet hardware used by PE teachers in the field.

## SLA Table

| Spec | Metric | 1× target | 1× warn | 1× fail | 4× fail |
|---|---|---|---|---|---|
| live-tap | INP p75 | < 100 ms | 120 ms | 150 ms | 300 ms |
| attendance-toggle | INP p75 | < 100 ms | 120 ms | 150 ms | 300 ms |
| manual-save | INP p75 | < 150 ms | 180 ms | 220 ms | 400 ms |
| modal-open (P2) | INP p75 | < 150 ms | 200 ms | 250 ms | 450 ms |
| dashboard-lcp (P2) | LCP | < 2000 ms | 2400 ms | 2800 ms | 5000 ms |
| live-page-lcp (P2) | LCP | < 1500 ms | 1800 ms | 2200 ms | 4000 ms |
| cls-route (P2) | CLS | < 0.05 | 0.08 | 0.10 | 0.10 |
| grade-matrix-scroll (P3) | dropped/3 s | < 6 | 10 | 15 | 30 |
| semester-switch (P3) | dropped/1.2 s | < 3 | 5 | 8 | 15 |
| sidebar-mount (P3) | TBT/3 s | < 200 ms | 300 ms | 400 ms | 800 ms |
| splash-overlay (P3) | max longtask | < 100 ms | 150 ms | 200 ms | 400 ms |

## Prerequisites

```powershell
# 1. Build production web (REQUIRED — perf config refuses next dev)
pnpm --filter=@fitgrade/web build

# 2. Start servers (two terminals)
$env:PORT = "3001"; pnpm --filter=@fitgrade/api start
pnpm --filter=@fitgrade/web start

# 3. Set env vars (or use .env.perf)
$env:PERF_TEACHER_TOKEN = "<jwt from POST /api/auth/dev-login>"
$env:PERF_CLASS_ID      = "<seeded class id>"
$env:PERF_SESSION_ID    = "<seeded session id>"
```

## Running the Specs

```powershell
# P1 INP specs — 1× CPU (default)
pnpm exec playwright test -c e2e/perf/playwright.perf.config.ts e2e/perf/inp

# P1 INP specs — 4× CPU (Chromebook simulation)
$env:PERF_CPU = "4"
pnpm exec playwright test -c e2e/perf/playwright.perf.config.ts e2e/perf/inp

# Single spec
pnpm exec playwright test -c e2e/perf/playwright.perf.config.ts e2e/perf/inp/live-tap.spec.ts

# All perf specs (P1-P3 once P2/P3 are implemented)
pnpm exec playwright test -c e2e/perf/playwright.perf.config.ts e2e/perf
```

## Triage Playbook

### Step 1 — Read the trace

CI uploads `perf-results-cpu{1,4}` artifacts. Download and open:

```powershell
pnpm exec playwright show-trace perf-report/trace.zip
```

In the trace viewer:
- Look for **long tasks** (red blocks > 50 ms) in the Main thread timeline.
- The INP culprit is the task that spans the interaction's `processingStart` → `processingEnd`.

### Step 2 — Check longtask attribution

The `.results/*.json` artifact includes `longtasks[].attribution` (container name from the PerformanceObserver). This points to the React component or script block responsible.

Common culprits:
- `sidebar` — backdrop-filter + 4 radial-gradient animations
- `grade-matrix` — unvirtualized 30×8 cell grid re-render
- `dashboard` — CountUp + Recharts AreaChart stagger

### Step 3 — React Profiler rerun (local)

```powershell
$env:PERF_REACT_PROFILER = "1"
pnpm exec playwright test -c e2e/perf/playwright.perf.config.ts e2e/perf/inp/live-tap.spec.ts
```

Open `perf-report/top-renders.json` — components sorted by cumulative actual-duration > 16 ms.

### Step 4 — Fix patterns

| Root cause | Fix |
|---|---|
| Unvirtualized list re-render | Add `React.memo` + `useMemo` to cell; or virtualize with `react-window` |
| Framer Motion layout animation on every tap | Limit `layoutId` scope; remove from list items |
| SWR revalidation on interaction | Set `revalidateOnFocus: false`, `revalidateOnReconnect: false` per hook |
| CSS backdrop-filter on animated element | Promote to compositor layer (`will-change: transform`); avoid filter on frequently repainted elements |
| Prisma N+1 query on tap | Add `include` or batch via `findMany` with `where: { id: { in: ids } }` |

### Step 5 — Quarantine if flaky

Tag the spec `@perf-quarantine` — report-only for 1 week:

```ts
test('p75 INP meets SLA @perf-quarantine', async ({ ... }) => { ... });
```

Then file a GitHub issue with the p75 distribution from 3 runs and the trace.

## File Map

```
e2e/perf/
  _helpers/
    inject-web-vitals.ts    # addInitScript + __perfMetrics + readPerfMetrics()
    median-of-3.ts          # runMedianOf3() statistical runner
    perf-fixtures.ts        # Playwright test.extend (perfPage, warmUp, attachPerfArtifacts)
    thresholds.ts           # SLA constants — THRESHOLDS_1X / THRESHOLDS_4X
    vendor/
      web-vitals.iife.js    # pinned web-vitals@4.2.4, vendored (no CDN)
  inp/
    live-tap.spec.ts        # P1 — stopwatch tap INP
    attendance-toggle.spec.ts  # P1 — absent/exempt toggle INP
    manual-save.spec.ts     # P1 — manual result save INP
  vitals/                   # P2 (planned)
  fps/                      # P3 (planned)
  playwright.perf.config.ts # prod-only config
  .results/                 # gitignored JSON artifacts
```

## Anti-Flake Guarantees

- **Median-of-3**: single-run failure → warn; 2-of-3 → hard fail
- **Production build only**: config guard throws if `apps/web/.next/BUILD_ID` is absent
- **Warm-up pass**: each run navigates once (discards metrics), then measures
- **Fixed environment**: 1280×720, `he-IL`, `Asia/Jerusalem`, `light`, `no-preference` motion
- **CPU throttle matrix**: 1× default + 4× via `PERF_CPU=4` (CDP `Emulation.setCPUThrottlingRate`)
