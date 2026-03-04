import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, FONT_SIZE_BODY, MIN_TOUCH_TARGET } from '../../../constants/ui';

/**
 * Class detail screen — Phase 13 placeholder.
 * Full implementation (student list, attendance, test session launch)
 * will be added in the next phase.
 */
export default function ClassDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="חזרה לרשימת הכיתות"
      >
        <Text style={styles.backText}>→ חזרה</Text>
      </TouchableOpacity>

      <Text style={styles.comingSoon}>בקרוב...</Text>
      <Text style={styles.classId}>מזהה כיתה: {id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingStart: 20,
    paddingEnd: 20,
    paddingTop: 56,
  },
  backButton: {
    alignSelf: 'flex-end',
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingStart: 8,
    paddingEnd: 8,
  },
  backText: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'right',
  },
  comingSoon: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'right',
    color: COLORS.foreground,
    marginTop: 32,
  },
  classId: {
    fontSize: 13,
    textAlign: 'right',
    color: COLORS.muted,
    marginTop: 8,
    fontFamily: 'monospace',
  },
});
