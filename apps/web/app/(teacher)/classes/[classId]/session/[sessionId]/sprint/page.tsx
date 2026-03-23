'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

import { SprintHeatMode }           from '@/components/sprint/SprintHeatMode';
import { PreTestRosterSelection }   from '@/components/pre-test-roster-selection';
import { useTestSession }           from '@/hooks/use-test-session';
import type { SessionStudent }      from '@fitgrade/types';

const DEFAULT_TEST_NAME = 'ריצת 60 מטר';

export default function SprintSessionPage(): React.ReactNode {
  const { sessionId } = useParams<{ classId: string; sessionId: string }>();
  const { data: session, isLoading } = useTestSession(sessionId);

  // null → roster phase; SessionStudent[] → test phase with filtered roster
  const [activeStudents, setActiveStudents] = useState<SessionStudent[] | null>(null);

  if (activeStudents === null) {
    return (
      <PreTestRosterSelection
        students={session?.students ?? []}
        testName={session?.testNameHe ?? DEFAULT_TEST_NAME}
        isLoading={isLoading}
        onConfirm={setActiveStudents}
      />
    );
  }

  return (
    <SprintHeatMode
      testName={session?.testNameHe ?? DEFAULT_TEST_NAME}
      activeStudents={activeStudents}
    />
  );
}
