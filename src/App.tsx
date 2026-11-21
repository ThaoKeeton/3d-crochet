import { Component, type ReactNode } from 'react';
import { AppProvider } from '@/state/store';
import { Shell } from '@/ui/Shell';

export function App() {
  return (
    <AppProvider>
      <Boundary>
        <Shell />
      </Boundary>
    </AppProvider>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="gl-fallback">
          <h1>画面没有打开</h1>
          <p>刷新一次。如果这台设备不支持三维，图解和用线估算仍可以在刷新后使用。</p>
        </div>
      );
    }
    return this.props.children;
  }
}
