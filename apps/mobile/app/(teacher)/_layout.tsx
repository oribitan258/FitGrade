// Placeholder — Teacher tab navigator layout.
// Tabs (Classes / Active Session) and auth guard added in teacher UI phase.
import { Stack } from 'expo-router';

export default function TeacherLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
