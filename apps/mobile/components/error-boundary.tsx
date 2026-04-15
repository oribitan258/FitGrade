/**
 * React class ErrorBoundary — catches render-time errors in teacher screens
 * and displays a Hebrew recovery screen with a "נסה שוב" (try again) button.
 *
 * Per mobile.md: "Wrap every screen in an <ErrorBoundary> component that shows
 * a friendly Hebrew error screen with a 'נסה שוב' (retry) button."
 *
 * Must be a class component — React requires class-based ErrorBoundaries.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE_BODY, FONT_SIZE_BUTTON, MIN_TOUCH_TARGET } from '../constants/ui';

// ─── Fallback UI ──────────────────────────────────────────────────────────────

interface ErrorFallbackProps {
  onReset: () => void;
}

function ErrorFallback({ onReset }: ErrorFallbackProps): React.JSX.Element {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text
          style={styles.icon}
          accessibilityRole="image"
          accessibilityLabel="אייקון שגיאה"
        >
          ⚠️
        </Text>
        <Text style={styles.title}>אירעה שגיאה בלתי צפויה</Text>
        <Text style={styles.body}>
          משהו השתבש. ניתן לנסות שוב או לצאת ולהיכנס מחדש לאפליקציה.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel="נסה שוב"
        >
          <Text style={styles.buttonText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── ErrorBoundary class ──────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo): void {
    // Intentionally no-op in production — error details must not be logged to
    // avoid leaking sensitive state. The fallback UI below surfaces the issue
    // to the user in Hebrew.
  }

  private readonly handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Semi-opaque dark overlay — sits behind the card, dims screen content
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  // Frosted-glass–style card: near-opaque white, deep shadow, subtle border
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '100%',
    // iOS depth shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    // Android elevation
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },

  icon: {
    fontSize: 52,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.foreground,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: FONT_SIZE_BODY,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  button: {
    backgroundColor: COLORS.primary,
    height: MIN_TOUCH_TARGET,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    fontSize: FONT_SIZE_BUTTON,
    fontWeight: '700',
    color: '#ffffff',
  },
});
