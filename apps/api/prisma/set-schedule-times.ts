/**
 * One-off script: sets absolute startTimes for the dev teacher's Saturday entries
 * so the timeline shows active NOW / NEXT states at ~20:25.
 *
 * Period mapping:
 *   0 → 07:30 (PAST)
 *   1 → 10:00 (PAST)
 *   2 → 13:15 (PAST)
 *   3 → 19:50 (NOW  at 20:25 — lesson window 19:50–20:35)
 *   4 → 20:45 (NEXT at 20:25)
 *
 * Run with:
 *   cd apps/api && npx ts-node prisma/set-schedule-times.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_TIMES: Record<number, string> = {
  0: '07:30',
  1: '10:00',
  2: '13:15',
  3: '19:50',
  4: '20:45',
};

async function main(): Promise<void> {
  console.log('FitGrade — Schedule absolute time set\n');

  const teacher = await prisma.user.findFirst({
    where: { email: 'teacher@test.com' },
    select: { id: true },
  });

  if (teacher === null) {
    console.error('Dev teacher not found. Run the seed first.');
    process.exit(1);
  }

  type Row = { id: string; startTime: string; period: number };
  type Delegate = {
    findMany: (args: unknown) => Promise<Row[]>;
    update:   (args: unknown) => Promise<unknown>;
  };
  const se = (prisma as unknown as { scheduleEntry: Delegate }).scheduleEntry;

  const entries = await se.findMany({
    where:  { teacherId: teacher.id, dayOfWeek: 6 },
    select: { id: true, startTime: true, period: true },
  });

  if (entries.length === 0) {
    console.log('No Saturday entries found. Run the seed first.');
    process.exit(0);
  }

  for (const entry of entries) {
    const newTime = TARGET_TIMES[entry.period];
    if (newTime === undefined) {
      console.log(`  Period ${entry.period}: no target defined — skipped`);
      continue;
    }
    await se.update({ where: { id: entry.id }, data: { startTime: newTime } });
    console.log(`  Period ${entry.period}: ${entry.startTime}  →  ${newTime}`);
  }

  console.log('\n✓ Done. At 20:25 — Period 3 is NOW, Period 4 is NEXT.');
}

main()
  .catch((e: unknown) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
