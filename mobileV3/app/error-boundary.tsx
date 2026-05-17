// ─── Error Boundary — Sprint 5 ───────────────────────────────────────────────
// Catches any JS crash anywhere in the app and shows a friendly recovery screen
// instead of a blank white screen.
import React from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  Platform, Clipboard,
} from "react-native";
import { LIGHT_C, DARK_C } from "../src/theme";

interface State {
  hasError:   boolean;
  error:      Error | null;
  errorInfo:  React.ErrorInfo | null;
  showDetail: boolean;
}

interface Props {
  children: React.ReactNode;
  onReset?: () => void;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetail: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // Log to console in dev
    if (__DEV__) {
      console.error("[ErrorBoundary]", error.message, errorInfo.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetail: false });
    this.props.onReset?.();
  };

  handleCopy = () => {
    const detail = `Error: ${this.state.error?.message}

Stack:
${this.state.errorInfo?.componentStack}`;
    Clipboard.setString(detail);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const C = LIGHT_C;
    const serif = { fontFamily: "Cairo-Bold" };
    const isRTL = false; // Safe default — i18n context may have crashed

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1, alignItems: "center", justifyContent: "center",
            padding: 32,
          }}
        >
          {/* Icon */}
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: C.red + "12",
            borderWidth: 2, borderColor: C.red + "30",
            alignItems: "center", justifyContent: "center",
            marginBottom: 24,
          }}>
            <Text style={{ fontSize: 48 }}>⚠️</Text>
          </View>

          {/* Title */}
          <Text style={{ ...serif, color: C.text, fontSize: 28, fontWeight: "700",
                         textAlign: "center", marginBottom: 10 }}>
            Something went wrong
          </Text>
          <Text style={{ color: C.muted, fontSize: 15, textAlign: "center",
                         lineHeight: 22, marginBottom: 32 }}>
            The app ran into an unexpected error.{" "}
            Don't worry — your data is safe.
          </Text>

          {/* Error message */}
          {this.state.error && (
            <View style={{
              backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
              borderRadius: 12, padding: 14, marginBottom: 24, width: "100%",
            }}>
              <Text style={{ color: C.red, fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
                {this.state.error.message}
              </Text>
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity
            onPress={this.handleReset}
            style={{
              backgroundColor: C.gold, borderRadius: 14,
              paddingVertical: 14, paddingHorizontal: 36,
              width: "100%", alignItems: "center", marginBottom: 12,
              shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: "#000", fontWeight: "700", fontSize: 15 }}>
              🔄 Try Again
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => this.setState(s => ({ showDetail: !s.showDetail }))}
            style={{ paddingVertical: 10, marginBottom: 8 }}
          >
            <Text style={{ color: C.muted, fontSize: 13 }}>
              {this.state.showDetail ? "Hide details ▲" : "Show technical details ▼"}
            </Text>
          </TouchableOpacity>

          {/* Stack trace */}
          {this.state.showDetail && this.state.errorInfo && (
            <View style={{
              backgroundColor: C.card2, borderRadius: 10, padding: 12,
              width: "100%", marginBottom: 12,
            }}>
              <ScrollView horizontal showsHorizontalScrollIndicator style={{ maxHeight: 160 }}>
                <Text style={{
                  color: C.muted, fontSize: 10,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  lineHeight: 16,
                }}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </ScrollView>
              <TouchableOpacity onPress={this.handleCopy} style={{ marginTop: 8, alignItems: "center" }}>
                <Text style={{ color: C.gold, fontSize: 12, fontWeight: "600" }}>📋 Copy to Clipboard</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }
}

// ── Convenience wrapper for functional components ────────────────────────────
export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  onReset?: () => void
): React.FC<T> {
  return (props: T) => (
    <ErrorBoundary onReset={onReset}>
      <Component {...props} />
    </ErrorBoundary>
  );
}
