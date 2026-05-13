// OverlayErrorBoundary — wraps the lazy-loaded overlay router so a
// chart NaN, a Firestore decode hiccup, or a lazy-import 404 doesn't
// blank the whole app. The dashboard underneath keeps rendering;
// only the broken overlay is replaced with a graceful card.
//
// React only supports class-based error boundaries (componentDidCatch
// has no hook equivalent), so this is a small class. It also resets
// automatically when `resetKey` changes — once the user closes the
// failing overlay, opening a new one starts clean instead of staying
// stuck on the fallback.

import { Component, type ReactNode } from "react";

interface Props {
  resetKey: string;
  onDismiss: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class OverlayErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[OverlayErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="overlay paper-grain">
        <div className="app-header">
          <button
            className="avatar-btn"
            onClick={() => {
              this.setState({ error: null });
              this.props.onDismiss();
            }}
          >
            ✕
          </button>
          <div className="h-title">
            something <em>slipped</em>
          </div>
          <div className="h-meta">close to retry</div>
        </div>
        <div className="overlay-body" style={{ padding: 18 }}>
          <div
            className="card"
            style={{ borderLeft: "3px solid oklch(0.55 0.16 12)" }}
          >
            <div className="kicker">UNEXPECTED ERROR</div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 14,
                fontStyle: "italic",
                marginTop: 8,
                lineHeight: 1.5,
                color: "var(--ink-2)",
              }}
            >
              The page hit something it didn't expect and stopped rendering.
              Closing this view and reopening it usually fixes it.
            </div>
            <div
              className="margin-note"
              style={{
                marginTop: 12,
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
