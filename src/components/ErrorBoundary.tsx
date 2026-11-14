import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || '不明なエラーが発生しました',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b12] text-slate-100 p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#0e1624] border border-slate-700/80 p-6 text-center space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-white">
              画面の描画中にエラーが発生しました
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              WebGL2非対応のブラウザ、またはグラフィック設定の影響で起動できませんでした。Chrome・Safari・Edgeの最新版でお試しください。
            </p>
            {this.state.message && (
              <p className="text-xs text-slate-400 bg-[#070b12] rounded-lg px-3 py-2 break-words">
                {this.state.message}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
