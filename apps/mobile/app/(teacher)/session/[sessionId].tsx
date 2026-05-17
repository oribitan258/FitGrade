/**
 * Session screen — used for both stopwatch (TIME) and manual entry (REPS/PASS_FAIL/GENERAL).
 *
 * Route params (all strings from Expo Router):
 *   sessionId   — created by POST /classes/:classId/sessions
 *   startedAt   — ISO timestamp set server-side (only relevant for TIME)
 *   classId     — used to fetch the student list
 *   inputType   — 'TIME' | 'REPS' | 'PASS_FAIL' | 'GENERAL'
 *   testNameHe  — Hebrew test name shown in the header
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { getHebrewGradeLabel, ApiError } from '@fitgrade/types';
import type { StudentData } from '@fitgrade/types';
import { useClassStudents } from '../../../hooks/use-class-students';
import { api } from '../../../lib/api';
import { enqueueOfflineTap } from '../../../lib/storage';
import type { TestResult } from '../../../hooks/use-test-session';
import {
  COLORS,
  FONT_SIZE_BODY,
  FONT_SIZE_BUTTON,
  FONT_SIZE_STOPWATCH_TIMER,
  MIN_TOUCH_TARGET,
  STOPWATCH_ROW_HEIGHT,
} from '../../../constants/ui';
import type { TestInputType } from '../../../hooks/use-test-types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Undo window in milliseconds (30 seconds). */
const UNDO_WINDOW_MS = 30_000;
const COMPLETED_ROW_HEIGHT = 60;
const MANUAL_ROW_HEIGHT = 72;
const PASSFAIL_ROW_HEIGHT = 80;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formats elapsed milliseconds as MM:SS.T (tenths of a second). */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(tenths)}`;
}

// ─── Stopwatch Mode (TIME) ────────────────────────────────────────────────────

interface TappedEntry {
  studentId: string;
  elapsedMs: number;
  resultId: string;
  recordedAt: number; // Date.now() — used for 30s undo window
  grade: number;
}

interface StopwatchModeProps {
  sessionId: string;
  classId: string;
  startedAt: string; // ISO string from server
}

function StopwatchMode({ sessionId, classId, startedAt }: StopwatchModeProps): React.JSX.Element {
  const { data: students, isLoading } = useClassStudents(classId);

  // Timer — direct DOM write via ref; zero React re-renders while ticking
  const startedAtMs = useRef(new Date(startedAt).getTime());
  const timerTextRef = useRef<React.ElementRef<typeof Text>>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      timerTextRef.current?.setNativeProps({
        text: formatElapsed(Date.now() - startedAtMs.current),
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Per-student tap state
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [tapped, setTapped] = useState<TappedEntry[]>([]);
  const tappedIds = useMemo(() => new Set(tapped.map((t) => t.studentId)), [tapped]);
  /** Students whose tap failed both attempts — shown with a red "נכשל — נסה שוב" overlay. */
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

  const handleStudentTap = useCallback(
    async (student: StudentData): Promise<void> => {
      if (tappedIds.has(student.id) || pendingIds.has(student.id)) return;

      const elapsedMs = Date.now() - startedAtMs.current;
      const rawValue = elapsedMs / 1000; // seconds (decimal)

      // Clear any prior error state so the row reverts to "pending" visually.
      setErrorIds((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });

      // Optimistic: mark as pending immediately
      setPendingIds((prev) => new Set([...prev, student.id]));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const submitOnce = (): Promise<TestResult> =>
        api.post<TestResult>(`/sessions/${sessionId}/results`, {
          studentId: student.id,
          rawValue,
        });

      const recordSuccess = (result: TestResult): void => {
        setTapped((prev) => [
          ...prev,
          {
            studentId: student.id,
            elapsedMs,
            resultId: result.id,
            recordedAt: Date.now(),
            grade: result.calculatedGrade,
          },
        ]);
      };

      try {
        recordSuccess(await submitOnce());
      } catch (firstErr) {
        if (firstErr instanceof ApiError && firstErr.statusCode === 409) {
          // Duplicate tap — result already recorded server-side. No retry, no queue.
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('כבר נרשם', 'תוצאה לתלמיד זה כבר קיימת במפגש זה');
        } else {
          // Transient network failure — auto-retry once after 2 seconds.
          await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
          try {
            recordSuccess(await submitOnce());
          } catch (retryErr) {
            if (retryErr instanceof ApiError && retryErr.statusCode === 409) {
              // Race: another device recorded the same tap between retries.
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('כבר נרשם', 'תוצאה לתלמיד זה כבר קיימת במפגש זה');
            } else {
              // Both network attempts failed — show error row and queue for offline replay.
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              setErrorIds((prev) => new Set([...prev, student.id]));
              enqueueOfflineTap({
                sessionId,
                studentId: student.id,
                elapsedMs,
                rawValue,
                queuedAt: Date.now(),
              });
            }
          }
        }
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(student.id);
          return next;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, pendingIds, tappedIds],
  );

  const handleUndo = useCallback((entry: TappedEntry, studentName: string): void => {
    if (Date.now() - entry.recordedAt > UNDO_WINDOW_MS) {
      Alert.alert('לא ניתן לבטל', 'חלפו יותר מ-30 שניות מרישום התוצאה');
      return;
    }
    Alert.alert('ביטול תוצאה', `לבטל את זמן הריצה של ${studentName}?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'אשר',
        style: 'destructive',
        onPress: () => {
          void api
            .delete(`/sessions/${sessionId}/results/${entry.studentId}`)
            .then(() => {
              setTapped((prev) => prev.filter((t) => t.studentId !== entry.studentId));
            })
            .catch(() => {
              Alert.alert('שגיאה', 'לא ניתן לבטל את התוצאה — נסה שוב');
            });
        },
      },
    ]);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const allStudents = useMemo(() => students ?? [], [students]);
  const tappedMap = useMemo(() => new Map(tapped.map((t) => [t.studentId, t])), [tapped]);

  const renderListItem = useCallback(({ item }: { item: ListItem }) => {
    const fullName = `${item.student.firstName} ${item.student.lastName}`;

    if (item.kind === 'pending') {
      const isPending = pendingIds.has(item.student.id);
      const isError = errorIds.has(item.student.id);
      return (
        <TouchableOpacity
          style={[styles.stopwatchRow, isError && styles.stopwatchRowError]}
          onPress={() => void handleStudentTap(item.student)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel={
            isError
              ? `רישום נכשל עבור ${fullName} — לחץ לניסיון נוסף`
              : `רשום זמן עבור ${fullName}`
          }
        >
          <Text style={styles.stopwatchName}>{fullName}</Text>
          {isPending ? (
            <ActivityIndicator color={COLORS.primary} style={styles.rowIcon} />
          ) : isError ? (
            <Text style={styles.errorTag}>נכשל — נסה שוב</Text>
          ) : (
            <Text style={styles.tapIcon}>⏱</Text>
          )}
        </TouchableOpacity>
      );
    }

    const entry = tappedMap.get(item.student.id);
    if (!entry) return null;
    return (
      <TouchableOpacity
        style={styles.completedRow}
        onLongPress={() => handleUndo(entry, fullName)}
        accessibilityLabel={`${fullName} — ${formatElapsed(entry.elapsedMs)}, לחיצה ארוכה לביטול`}
      >
        <Text style={styles.completedName}>{fullName}</Text>
        <Text style={styles.completedTime}>{formatElapsed(entry.elapsedMs)}</Text>
        <View style={styles.gradePill}>
          <Text style={styles.gradePillText}>{getHebrewGradeLabel(entry.grade)}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [pendingIds, errorIds, tappedMap, handleStudentTap, handleUndo]);
  const pending = useMemo(
    () => allStudents.filter((s) => !tappedIds.has(s.id)),
    [allStudents, tappedIds],
  );

  type ListItem =
    | { kind: 'pending'; student: StudentData }
    | { kind: 'completed'; student: StudentData; entry: TappedEntry };

  const listData = useMemo<ListItem[]>(() => [
    ...pending.map((s) => ({ kind: 'pending' as const, student: s })),
    ...tapped.map((entry) => ({
      kind: 'completed' as const,
      student: allStudents.find((s) => s.id === entry.studentId)!,
      entry,
    })),
  ], [pending, tapped, allStudents]);

  return (
    <View style={styles.sessionContainer}>
      {/* Big timer */}
      <View style={styles.timerContainer}>
        <Text ref={timerTextRef} style={styles.timerText}>{formatElapsed(0)}</Text>
        <Text style={styles.timerSubLabel}>
          {pending.length} ממתינים · {tapped.length} נרשמו
        </Text>
      </View>

      {/* Combined student list — pending tap buttons first, completed entries below */}
      <FlatList<ListItem>
        data={listData}
        keyExtractor={(item) => item.student.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        renderItem={renderListItem}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>אין תלמידים בכיתה זו</Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Manual Entry Mode (REPS / PASS_FAIL / GENERAL / TIME) ──────────────────

interface ManualEntry {
  rawValueText: string;
  minutesText: string;
  secondsText: string;
  submitted: boolean;
  grade: number | null;
  submitting: boolean;
}

interface ManualModeProps {
  sessionId: string;
  classId: string;
  inputType: TestInputType;
}

function ManualMode({ sessionId, classId, inputType }: ManualModeProps): React.JSX.Element {
  const { data: students, isLoading } = useClassStudents(classId);
  const [entries, setEntries] = useState<Record<string, ManualEntry>>({});

  useEffect(() => {
    if (!students) return;
    const initial: Record<string, ManualEntry> = {};
    students.forEach((s) => {
      initial[s.id] = { rawValueText: '', minutesText: '', secondsText: '', submitted: false, grade: null, submitting: false };
    });
    setEntries(initial);
  }, [students]);

  const setSubmitting = useCallback((studentId: string, submitting: boolean): void => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId]!, submitting },
    }));
  }, []);

  const markSubmitted = useCallback((studentId: string, grade: number): void => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId]!, submitted: true, grade, submitting: false },
    }));
  }, []);

  const handlePassFail = useCallback(
    async (studentId: string, pass: boolean): Promise<void> => {
      setSubmitting(studentId, true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const result = await api.post<TestResult>(`/sessions/${sessionId}/results`, {
          studentId,
          rawValue: pass ? 1 : 0,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        markSubmitted(studentId, result.calculatedGrade);
      } catch {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('שגיאה', 'שמירת התוצאה נכשלה. נסה שוב.');
        setSubmitting(studentId, false);
      }
    },
    [sessionId, setSubmitting, markSubmitted],
  );

  const handleSubmitNumeric = useCallback(
    async (studentId: string, rawValueText: string): Promise<void> => {
      const rawValue = parseFloat(rawValueText);
      if (isNaN(rawValue) || rawValue < 0) {
        Alert.alert('שגיאה', 'יש להזין ערך מספרי תקין');
        return;
      }
      setSubmitting(studentId, true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const result = await api.post<TestResult>(`/sessions/${sessionId}/results`, {
          studentId,
          rawValue,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        markSubmitted(studentId, result.calculatedGrade);
      } catch {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('שגיאה', 'שמירת התוצאה נכשלה. נסה שוב.');
        setSubmitting(studentId, false);
      }
    },
    [sessionId, setSubmitting, markSubmitted],
  );

  const handleChangeText = useCallback((studentId: string, text: string): void => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId]!, rawValueText: text },
    }));
  }, []);

  const handleChangeMinutes = useCallback((studentId: string, text: string): void => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId]!, minutesText: text.replace(/\D/g, '') },
    }));
  }, []);

  const handleChangeSeconds = useCallback((studentId: string, text: string): void => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId]!, secondsText: text.replace(/\D/g, '') },
    }));
  }, []);

  const handleSubmitTime = useCallback(
    async (studentId: string, minutesText: string, secondsText: string): Promise<void> => {
      const minutes = parseInt(minutesText || '0', 10);
      const seconds = parseInt(secondsText || '0', 10);
      if (isNaN(minutes) || isNaN(seconds) || seconds >= 60) {
        Alert.alert('שגיאה', 'יש להזין דקות ושניות תקינות (שניות 0–59)');
        return;
      }
      const totalSeconds = minutes * 60 + seconds;
      await handleSubmitNumeric(studentId, String(totalSeconds));
    },
    [handleSubmitNumeric],
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const rowHeight = inputType === 'PASS_FAIL' ? PASSFAIL_ROW_HEIGHT : MANUAL_ROW_HEIGHT;

  return (
    <KeyboardAvoidingView
      style={styles.sessionContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList<StudentData>
        data={students ?? []}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        getItemLayout={(_, index) => ({
          length: rowHeight,
          offset: rowHeight * index,
          index,
        })}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        renderItem={({ item }) => {
          const entry = entries[item.id];
          const isSubmitted = entry?.submitted ?? false;
          const isSubmitting = entry?.submitting ?? false;
          const fullName = `${item.firstName} ${item.lastName}`;

          if (isSubmitted) {
            return (
              <View style={[styles.manualRow, styles.manualRowDone]}>
                <Text style={styles.manualName}>{fullName}</Text>
                <Text style={styles.manualGrade}>
                  {entry?.grade != null ? getHebrewGradeLabel(entry.grade) : '—'}
                </Text>
              </View>
            );
          }

          if (inputType === 'PASS_FAIL') {
            return (
              <View style={[styles.manualRow, { height: PASSFAIL_ROW_HEIGHT }]}>
                <Text style={styles.manualName}>{fullName}</Text>
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <View style={styles.passfailButtons}>
                    <TouchableOpacity
                      style={[styles.passfailBtn, styles.passBtn]}
                      onPress={() => void handlePassFail(item.id, true)}
                      accessibilityRole="button"
                      accessibilityLabel={`${fullName} — עובר`}
                    >
                      <Text style={styles.passfailBtnText}>עובר</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.passfailBtn, styles.failBtn]}
                      onPress={() => void handlePassFail(item.id, false)}
                      accessibilityRole="button"
                      accessibilityLabel={`${fullName} — נכשל`}
                    >
                      <Text style={styles.passfailBtnText}>נכשל</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }

          // TIME: MM:SS dual-field input for distance runs
          if (inputType === 'TIME') {
            return (
              <View style={[styles.manualRow, { height: PASSFAIL_ROW_HEIGHT }]}>
                <Text style={styles.manualName}>{fullName}</Text>
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <View style={styles.numericEntry}>
                    <TouchableOpacity
                      style={styles.numericSaveBtn}
                      onPress={() => void handleSubmitTime(item.id, entry?.minutesText ?? '', entry?.secondsText ?? '')}
                      accessibilityRole="button"
                      accessibilityLabel={`שמור זמן עבור ${fullName}`}
                    >
                      <Text style={styles.numericSaveBtnText}>שמור</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.numericInput, { width: 44 }]}
                      value={entry?.secondsText ?? ''}
                      onChangeText={(text) => handleChangeSeconds(item.id, text)}
                      keyboardType="number-pad"
                      textAlign="center"
                      maxLength={2}
                      placeholder="שנ'"
                      placeholderTextColor={COLORS.muted}
                      accessibilityLabel={`שניות עבור ${fullName}`}
                    />
                    <Text style={{ color: COLORS.muted, fontSize: 16, alignSelf: 'center' }}>:</Text>
                    <TextInput
                      style={[styles.numericInput, { width: 44 }]}
                      value={entry?.minutesText ?? ''}
                      onChangeText={(text) => handleChangeMinutes(item.id, text)}
                      keyboardType="number-pad"
                      textAlign="center"
                      maxLength={2}
                      placeholder="דק'"
                      placeholderTextColor={COLORS.muted}
                      accessibilityLabel={`דקות עבור ${fullName}`}
                    />
                  </View>
                )}
              </View>
            );
          }

          // REPS / GENERAL: text input + save button
          return (
            <View style={styles.manualRow}>
              <Text style={styles.manualName}>{fullName}</Text>
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <View style={styles.numericEntry}>
                  <TouchableOpacity
                    style={styles.numericSaveBtn}
                    onPress={() => void handleSubmitNumeric(item.id, entry?.rawValueText ?? '')}
                    accessibilityRole="button"
                    accessibilityLabel={`שמור תוצאה עבור ${fullName}`}
                  >
                    <Text style={styles.numericSaveBtnText}>שמור</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.numericInput}
                    value={entry?.rawValueText ?? ''}
                    onChangeText={(text) => handleChangeText(item.id, text)}
                    keyboardType="numeric"
                    textAlign="right"
                    placeholder="ערך"
                    placeholderTextColor={COLORS.muted}
                    accessibilityLabel={`הזן תוצאה עבור ${fullName}`}
                  />
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>אין תלמידים בכיתה זו</Text>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

// ─── Session Screen (root) ────────────────────────────────────────────────────

export default function SessionScreen(): React.JSX.Element {
  const { sessionId, startedAt, classId, inputType, testNameHe } =
    useLocalSearchParams<{
      sessionId: string;
      startedAt: string;
      classId: string;
      inputType: string;
      testNameHe: string;
    }>();
  const router = useRouter();

  const resolvedSessionId = sessionId ?? '';
  const resolvedClassId = classId ?? '';
  const resolvedInputType = (inputType ?? 'GENERAL') as TestInputType;
  const resolvedStartedAt = startedAt ?? '';
  const resolvedTestNameHe = testNameHe ?? '';

  // Distance runs use MM:SS manual entry, not live stopwatch tap
  const DISTANCE_KEYWORDS = ['800', '1000', '1500', '2000', '3000', 'מרחק'];
  const isDistanceRun =
    resolvedInputType === 'TIME' &&
    DISTANCE_KEYWORDS.some((kw) => resolvedTestNameHe.includes(kw));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
        >
          <Text style={styles.backText}>→ חזרה</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {testNameHe ?? 'מפגש מבחן'}
        </Text>
      </View>

      {resolvedInputType === 'TIME' && !isDistanceRun ? (
        <StopwatchMode
          sessionId={resolvedSessionId}
          classId={resolvedClassId}
          startedAt={resolvedStartedAt}
        />
      ) : (
        <ManualMode
          sessionId={resolvedSessionId}
          classId={resolvedClassId}
          inputType={resolvedInputType}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.foreground,
    textAlign: 'right',
    flex: 1,
    marginStart: 8,
  },
  backButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  backText: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Shared
  sessionContainer: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.muted,
    textAlign: 'right',
  },

  // Stopwatch timer
  timerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.primary,
  },
  timerText: {
    fontSize: FONT_SIZE_STOPWATCH_TIMER,
    fontWeight: '700',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  timerSubLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    textAlign: 'center',
  },

  // Stopwatch pending row — full-width tap target (STOPWATCH_ROW_HEIGHT = 72px)
  stopwatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: STOPWATCH_ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#f8fafc',
  },
  stopwatchName: {
    fontSize: FONT_SIZE_BUTTON,
    color: COLORS.foreground,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  stopwatchRowError: {
    backgroundColor: '#fef2f2',
    borderStartWidth: 4,
    borderStartColor: '#dc2626',
  },
  errorTag: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
    marginStart: 8,
  },
  tapIcon: {
    fontSize: 24,
    marginStart: 16,
  },
  rowIcon: {
    marginStart: 16,
  },

  // Stopwatch completed row
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: COMPLETED_ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#f0fdf4',
  },
  completedName: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.foreground,
    flex: 1,
    textAlign: 'right',
  },
  completedTime: {
    fontSize: 15,
    color: COLORS.muted,
    fontVariant: ['tabular-nums'],
    marginHorizontal: 12,
  },
  gradePill: {
    backgroundColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  gradePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },

  // Manual entry rows
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: MANUAL_ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  manualRowDone: {
    backgroundColor: '#f0fdf4',
  },
  manualName: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.foreground,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  manualGrade: {
    fontSize: FONT_SIZE_BODY,
    color: '#166534',
    fontWeight: '700',
    marginStart: 12,
  },

  // PASS_FAIL buttons
  passfailButtons: {
    flexDirection: 'row',
    gap: 8,
    marginStart: 12,
  },
  passfailBtn: {
    height: MIN_TOUCH_TARGET,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passBtn: {
    backgroundColor: '#16a34a',
  },
  failBtn: {
    backgroundColor: '#dc2626',
  },
  passfailBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // REPS / GENERAL numeric entry
  numericEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginStart: 12,
  },
  numericInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: MIN_TOUCH_TARGET,
    width: 90,
    fontSize: FONT_SIZE_BODY,
    color: COLORS.foreground,
    backgroundColor: '#f8fafc',
  },
  numericSaveBtn: {
    height: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 8,
  },
  numericSaveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
