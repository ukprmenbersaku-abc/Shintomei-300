import React, { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border font-semibold transition-colors whitespace-nowrap min-h-[40px] ${
          isInstallable
            ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50 text-white shadow-lg'
            : 'bg-[#10192b]/90 hover:bg-[#17233b] border-slate-600/80 text-slate-100'
        } ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-xs sm:text-sm'} ${className}`}
      >
        {isInstallable ? (
          <Download className="w-4 h-4 shrink-0" />
        ) : (
          <Smartphone className="w-4 h-4 shrink-0 text-emerald-400" />
        )}
        <span>
          {isInstallable
            ? 'アプリとしてインストール'
            : isIOS
              ? 'iOS ホーム画面に追加'
              : isAndroid
                ? 'Android PWA インストール'
                : 'PWA アプリ対応'}
        </span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#04070e]/85 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="PWA インストール案内"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0d1422] border border-slate-700 shadow-2xl overflow-hidden text-slate-100">
            <div className="px-5 py-4 bg-[#005934] border-b border-emerald-400/25 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-white shrink-0" />
                <h3 className="font-bold text-base text-white">
                  スマホ / PC アプリとしてインストール (PWA)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="閉じる"
                className="p-1.5 rounded-lg bg-black/25 hover:bg-black/40 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm text-slate-300">
              {isIOS ? (
                <div className="space-y-3">
                  <p className="text-slate-200 font-medium">
                    iOS (Safari) で全画面アプリとして追加する手順：
                  </p>
                  <div className="rounded-xl bg-[#131c2e] border border-slate-700/80 p-3.5 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <span className="flex items-center gap-1.5">
                        Safari 下部の <Share className="w-4 h-4 text-sky-400 inline" /> 「共有」をタップ
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <span className="flex items-center gap-1.5">
                        <PlusSquare className="w-4 h-4 text-emerald-400 inline" /> 「ホーム画面に追加」を選択
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <span>ホーム画面の「新東名300」アイコンから全画面起動！</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl bg-[#131c2e] border border-slate-700/80 p-3.5 space-y-2">
                    <div className="font-bold text-emerald-300">Android (Chrome) の場合</div>
                    <p>
                      アドレスバー右側の「︙」メニュー → <strong>「アプリをインストール」</strong> または
                      <strong>「ホーム画面に追加」</strong> を選択すると全画面アプリ化されます。
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#131c2e] border border-slate-700/80 p-3.5 space-y-2">
                    <div className="font-bold text-sky-300">iPhone / iPad (Safari) の場合</div>
                    <p>
                      Safari 下部の <strong>「共有 (↑)」</strong> → <strong>「ホーム画面に追加」</strong>{' '}
                      からブラウザ枠なしの全画面で遊べます。
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#131c2e] border border-slate-700/80 p-3.5 space-y-2">
                    <div className="font-bold text-amber-300">PC (Chrome / Edge) の場合</div>
                    <p>
                      URLバー右端のインストールアイコン、またはメニューから「E1A 新東名 300km/h をインストール」を選択できます。
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
