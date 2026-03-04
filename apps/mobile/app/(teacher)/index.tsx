import { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useClasses } from '../../hooks/use-classes';
import type { ClassData } from '@fitgrade/types';
import { COLORS, FONT_SIZE_BODY, MIN_TOUCH_TARGET } from '../../constants/ui';

/** Hebrew labels for semester enum values */
const SEMESTER_LABELS: Record<'A' | 'B', string> = {
  A: "סמסטר א'",
  B: "סמסטר ב'",
};

/** Height of each class card row — used by getItemLayout for scroll performance. */
const CLASS_CARD_HEIGHT = 88;

function ClassCard({
  cls,
  onPress,
}: {
  cls: ClassData;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`כיתה ${cls.name}, ${cls.studentCount} תלמידים`}
    >
      <View style={styles.cardBody}>
        <Text style={styles.className}>{cls.name}</Text>
        <Text style={styles.classMeta}>
          {cls.academicYear} • {SEMESTER_LABELS[cls.semester]}
        </Text>
      </View>
      <View style={styles.studentBadge}>
        <Text style={styles.studentBadgeText}>{cls.studentCount}</Text>
        <Text style={styles.studentBadgeLabel}>תלמידים</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TeacherHomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { data: classes, isLoading, error, refetch } = useClasses();

  const handleClassPress = useCallback(
    (classId: string) => {
      router.push(`/(teacher)/classes/${classId}`);
    },
    [router],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.statusText}>טוען כיתות...</Text>
      </View>
    );
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>שגיאה בטעינת הכיתות</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            void refetch();
          }}
          accessibilityRole="button"
          accessibilityLabel="נסה לטעון שוב"
        >
          <Text style={styles.retryButtonText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>הכיתות שלי</Text>

      <FlatList
        data={classes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ClassCard
            cls={item}
            onPress={() => handleClassPress(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        getItemLayout={(_, index) => ({
          length: CLASS_CARD_HEIGHT,
          offset: CLASS_CARD_HEIGHT * index,
          index,
        })}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>אין כיתות עדיין</Text>
            <Text style={styles.emptySubtitle}>
              צור כיתה חדשה דרך לוח הבקרה באתר האינטרנט
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'right',
    color: COLORS.foreground,
    paddingStart: 20,
    paddingEnd: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  listContent: {
    paddingStart: 16,
    paddingEnd: 16,
    paddingBottom: 32,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingStart: 16,
    paddingEnd: 16,
    minHeight: Math.max(MIN_TOUCH_TARGET, CLASS_CARD_HEIGHT),
  },
  cardBody: {
    flex: 1,
    alignItems: 'flex-end',
    paddingTop: 14,
    paddingBottom: 14,
  },
  className: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'right',
    color: COLORS.foreground,
  },
  classMeta: {
    fontSize: FONT_SIZE_BODY - 2,
    textAlign: 'right',
    color: COLORS.muted,
    marginTop: 3,
  },
  studentBadge: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingStart: 12,
    paddingEnd: 12,
    paddingTop: 6,
    paddingBottom: 6,
    marginStart: 12,
    minWidth: 56,
  },
  studentBadgeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.foreground,
    textAlign: 'center',
  },
  studentBadgeLabel: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingStart: 24,
    paddingEnd: 24,
  },
  statusText: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.muted,
    textAlign: 'right',
  },
  errorText: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.grade.fail,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingStart: 24,
    paddingEnd: 24,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: FONT_SIZE_BODY,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 64,
    gap: 8,
    paddingStart: 24,
    paddingEnd: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.foreground,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONT_SIZE_BODY - 2,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
