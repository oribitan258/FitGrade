import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { StudentData } from '@fitgrade/types';
import { useClassStudents } from '../../../hooks/use-class-students';
import { useAttendance, useSaveAttendance } from '../../../hooks/use-attendance';
import type { AttendanceStatus } from '../../../hooks/use-attendance';
import { useTestTypes } from '../../../hooks/use-test-types';
import type { TestType } from '../../../hooks/use-test-types';
import { useCreateSession } from '../../../hooks/use-test-session';
import {
  COLORS,
  FONT_SIZE_BODY,
  FONT_SIZE_BUTTON,
  MIN_TOUCH_TARGET,
} from '../../../constants/ui';

type ActiveTab = 'attendance' | 'tests';

/** Returns today's date as YYYY-MM-DD (local time). */
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Human-readable DD/MM/YYYY format for Hebrew UI. */
function hebrewDate(iso: string): string {
  return iso.split('-').reverse().join('/');
}

// ─── Hebrew labels ────────────────────────────────────────────────────────────
const INPUT_TYPE_LABELS: Record<string, string> = {
  TIME: 'זמן',
  REPS: 'חזרות',
  PASS_FAIL: 'עובר/נכשל',
  GENERAL: 'כללי',
};

// ─── Row heights for getItemLayout ───────────────────────────────────────────
const ATTENDANCE_ROW_HEIGHT = 64;
const TEST_TYPE_ROW_HEIGHT = 64;

// ─── Attendance Tab ───────────────────────────────────────────────────────────

interface AttendanceTabProps {
  classId: string;
}

function AttendanceTab({ classId }: AttendanceTabProps): React.JSX.Element {
  const today = todayISO();
  const { data: students, isLoading: studentsLoading } = useClassStudents(classId);
  const { data: records, isLoading: recordsLoading } = useAttendance(classId, today);
  const saveAttendance = useSaveAttendance(classId);

  // studentId → status map; defaults every student to PRESENT
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});

  useEffect(() => {
    if (!students) return;
    const initial: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      initial[s.id] = 'PRESENT';
    });
    // overlay with any existing records for today
    records?.forEach((r) => {
      initial[r.studentId] = r.status;
    });
    setStatusMap(initial);
  }, [students, records]);

  const toggle = useCallback((studentId: string): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStatusMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'PRESENT' ? 'ABSENT' : 'PRESENT',
    }));
  }, []);

  const handleSave = useCallback((): void => {
    if (!students) return;
    const attendanceRecords = students.map((s) => ({
      studentId: s.id,
      status: statusMap[s.id] ?? 'PRESENT',
    }));
    saveAttendance.mutate(
      { date: today, records: attendanceRecords },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('נשמר', 'הנוכחות נשמרה בהצלחה');
        },
        onError: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('שגיאה', 'שמירת הנוכחות נכשלה. נסה שוב.');
        },
      },
    );
  }, [students, statusMap, today, saveAttendance]);

  if (studentsLoading || recordsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!students || students.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>אין תלמידים בכיתה זו</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionLabel}>נוכחות לתאריך {hebrewDate(today)}</Text>
      <FlatList<StudentData>
        data={students}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: ATTENDANCE_ROW_HEIGHT,
          offset: ATTENDANCE_ROW_HEIGHT * index,
          index,
        })}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isPresent = (statusMap[item.id] ?? 'PRESENT') === 'PRESENT';
          return (
            <TouchableOpacity
              style={[styles.attendanceRow, isPresent ? styles.presentRow : styles.absentRow]}
              onPress={() => toggle(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${item.firstName} ${item.lastName} — ${isPresent ? 'נוכח' : 'נעדר'}, לחץ לשינוי`}
            >
              {/* In RTL row: name appears on the RIGHT, badge on the LEFT */}
              <View style={styles.studentNameBlock}>
                <Text style={[styles.attendanceName, !isPresent && styles.absentText]}>
                  {item.firstName} {item.lastName}
                </Text>
                {item.nationalId !== null && item.nationalId !== undefined && (
                  <Text style={styles.studentIdText}>
                    ת.ז ****{item.nationalId.slice(-4)}
                  </Text>
                )}
              </View>
              <View style={[styles.statusPill, isPresent ? styles.presentPill : styles.absentPill]}>
                <Text style={styles.statusPillText}>{isPresent ? 'נוכח' : 'נעדר'}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <View style={styles.saveRow}>
        <TouchableOpacity
          style={[styles.saveButton, saveAttendance.isPending && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saveAttendance.isPending}
          accessibilityRole="button"
          accessibilityLabel="שמור נוכחות"
        >
          {saveAttendance.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>שמור נוכחות</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Fitness Tests Tab ────────────────────────────────────────────────────────

interface TestsTabProps {
  classId: string;
}

function TestsTab({ classId }: TestsTabProps): React.JSX.Element {
  const router = useRouter();
  const { data: testTypes, isLoading, error } = useTestTypes();
  const [selectedType, setSelectedType] = useState<TestType | null>(null);
  const createSession = useCreateSession(classId);

  const handleSelectType = useCallback((type: TestType): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType((prev) => (prev?.id === type.id ? null : type));
  }, []);

  const handleStartSession = useCallback((): void => {
    if (!selectedType) return;
    const isStopwatch = selectedType.inputType === 'TIME';
    createSession.mutate(
      {
        testTypeId: selectedType.id,
        conductedAt: new Date().toISOString(),
        isStopwatch,
      },
      {
        onSuccess: (session) => {
          router.push({
            pathname: '/(teacher)/session/[sessionId]',
            params: {
              sessionId: session.id,
              startedAt: session.startedAt ?? '',
              classId,
              inputType: selectedType.inputType,
              testNameHe: selectedType.nameHe,
            },
          });
        },
        onError: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('שגיאה', 'יצירת המפגש נכשלה. נסה שוב.');
        },
      },
    );
  }, [selectedType, createSession, classId, router]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>שגיאה בטעינת סוגי המבחנים</Text>
      </View>
    );
  }

  if (!testTypes || testTypes.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>אין מבחני כושר במערכת</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionLabel}>בחר סוג מבחן:</Text>
      <FlatList<TestType>
        data={testTypes}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: TEST_TYPE_ROW_HEIGHT,
          offset: TEST_TYPE_ROW_HEIGHT * index,
          index,
        })}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = selectedType?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.testTypeRow, isSelected && styles.testTypeRowSelected]}
              onPress={() => handleSelectType(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.nameHe} — ${INPUT_TYPE_LABELS[item.inputType] ?? item.inputType}`}
            >
              {/* RTL row: name on RIGHT, type label on LEFT */}
              <Text style={[styles.testTypeName, isSelected && styles.testTypeNameSelected]}>
                {item.nameHe}
              </Text>
              <Text style={styles.testTypeTag}>
                {INPUT_TYPE_LABELS[item.inputType] ?? item.inputType}
                {item.unit != null ? ` · ${item.unit}` : ''}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
      {selectedType !== null && (
        <View style={styles.saveRow}>
          <TouchableOpacity
            style={[styles.saveButton, createSession.isPending && styles.saveButtonDisabled]}
            onPress={handleStartSession}
            disabled={createSession.isPending}
            accessibilityRole="button"
            accessibilityLabel={`התחל מפגש — ${selectedType.nameHe}`}
          >
            {createSession.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>
                {selectedType.inputType === 'TIME' ? '⏱ התחל מפגש עם שעון' : '✎ התחל מפגש'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ClassDetailScreen(): React.JSX.Element {
  const { id: classId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('attendance');

  const resolvedClassId = classId ?? '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="חזרה לרשימת הכיתות"
        >
          <Text style={styles.backText}>→ חזרה</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>פרטי כיתה</Text>
      </View>

      {/* Segmented tab bar — RTL: נוכחות on right, מבחני כושר on left */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'attendance' && styles.tabButtonActive]}
          onPress={() => setActiveTab('attendance')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'attendance' }}
        >
          <Text style={[styles.tabLabel, activeTab === 'attendance' && styles.tabLabelActive]}>
            נוכחות
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'tests' && styles.tabButtonActive]}
          onPress={() => setActiveTab('tests')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'tests' }}
        >
          <Text style={[styles.tabLabel, activeTab === 'tests' && styles.tabLabelActive]}>
            מבחני כושר
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      {activeTab === 'attendance' ? (
        <AttendanceTab classId={resolvedClassId} />
      ) : (
        <TestsTab classId={resolvedClassId} />
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

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.muted,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Shared tab content
  tabContent: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.muted,
    textAlign: 'right',
  },
  sectionLabel: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  listContent: {
    paddingBottom: 120,
  },

  // Attendance rows
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: ATTENDANCE_ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  presentRow: {
    backgroundColor: '#f0fdf4',
  },
  absentRow: {
    backgroundColor: '#fef2f2',
  },
  studentNameBlock: {
    flex: 1,
  },
  attendanceName: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.foreground,
    fontWeight: '500',
    textAlign: 'right',
  },
  studentIdText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  absentText: {
    color: '#991b1b',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginStart: 12,
  },
  presentPill: {
    backgroundColor: '#bbf7d0',
  },
  absentPill: {
    backgroundColor: '#fecaca',
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.foreground,
  },

  // Test type rows
  testTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: TEST_TYPE_ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  testTypeRowSelected: {
    backgroundColor: '#f0f9ff',
    borderStartWidth: 4,
    borderStartColor: COLORS.primary,
  },
  testTypeName: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.foreground,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  testTypeNameSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  testTypeTag: {
    fontSize: 13,
    color: COLORS.muted,
    marginStart: 10,
  },

  // Save / action button
  saveRow: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    height: MIN_TOUCH_TARGET,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: FONT_SIZE_BUTTON,
    color: '#ffffff',
    fontWeight: '700',
  },
});
