/**
 * One-off script: shifts all seeded ScheduleEntry rows for today (dayOfWeek=6)
 * forward by exactly +12 hours (wraps around midnight).
 *
 * Run with:
 *   cd apps/api && npx ts-node prisma/update-schedule-times.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Adds 12 hours to an "HH:MM" string, wrapping around 24:00. */
function addTwelveHours(time: string): string {
  const parts = time.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const totalMin = (h * 60 + m + 12 * 60) % (24 * 60);
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  console.log('FitGrade — Schedule time shift (+12 hours)\n');

  const teacher = await prisma.user.findFirst({
    where: { email: 'teacher@test.com' },
    select: { id: true },
  });

  if (teacher === null) {
    console.error('Dev teacher not found. Run the seed first.');
    process.exit(1);
  }

  /* Use unknown cast — scheduleEntry is available after prisma migrate dev */
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
    console.log('No entries found for dayOfWeek=6. Nothing to update.');
    process.exit(0);
  }

  const sorted = [...entries].sort((a, b) => a.period - b.period);

  for (const entry of sorted) {
    const newTime = addTwelveHours(entry.startTime);
    await se.update({ where: { id: entry.id }, data: { startTime: newTime } });
    console.log(`  Period ${entry.period}: ${entry.startTime}  →  ${newTime}`);
  }

  console.log('\n✓ Done. SWR will auto-refresh the dashboard in ≤60 s.');
}

main()
  .catch((e: unknown) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
