// Placeholder — Teacher Google OAuth login screen.
// Full implementation added in auth phase.
import { View, Text, StyleSheet } from 'react-native';

export default function LoginScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>כניסה למערכת</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingStart: 24,
    paddingEnd: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'right',
    width: '100%',
    color: '#0f172a',
  },
});
