import { View, Text, StyleSheet } from 'react-native';
import { getHebrewGradeLabel } from '@fitgrade/types';

// In production this screen will redirect to (teacher) if a JWT is stored,
// or to /login if not. Auth logic added in the auth phase.
// For now it renders a Hebrew welcome screen to verify:
//   1. RTL layout (text flows right-to-left, paddingStart on the correct side)
//   2. @fitgrade/types import resolves correctly across the monorepo
//   3. Fonts render Hebrew characters without mojibake

export default function IndexScreen(): React.JSX.Element {
  // Smoke-test the shared utility — result should be "מצטיין"
  const sampleLabel = getHebrewGradeLabel(95);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FitGrade</Text>
      <Text style={styles.subtitle}>מערכת ציונים לחינוך גופני</Text>
      <Text style={styles.hint}>ברוך הבא, המורה</Text>
      {/* RTL smoke-test: label should render "מצטיין" */}
      <Text style={styles.label}>דוגמת ציון: {sampleLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    // Use paddingStart/paddingEnd — never paddingLeft/paddingRight
    paddingStart: 24,
    paddingEnd: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    // textAlign: 'right' is correct for Hebrew in RTL mode
    textAlign: 'right',
    width: '100%',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'right',
    width: '100%',
    color: '#334155',
    marginTop: 8,
  },
  hint: {
    fontSize: 16,
    textAlign: 'right',
    width: '100%',
    color: '#64748b',
    marginTop: 24,
  },
  label: {
    fontSize: 14,
    textAlign: 'right',
    width: '100%',
    color: '#16a34a',
    marginTop: 12,
  },
});
