// Placeholder — Teacher home screen (class list).
// Full implementation added in teacher UI phase.
import { View, Text, StyleSheet } from 'react-native';

export default function TeacherHomeScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>הכיתות שלי</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingStart: 16,
    paddingEnd: 16,
    paddingTop: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'right',
    color: '#0f172a',
  },
});
