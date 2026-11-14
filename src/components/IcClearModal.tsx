import React from 'react';
import { IcClearSummary } from '../types/game';
import { Award, Play, RotateCcw, ShieldAlert } from 'lucide-react';

interface IcClearModalProps {
  summary: IcClearSummary | null;
  onContinueMainline: () => void;
  onRestart: () => void;
}

export const IcClearModal: React.FC<IcClearModalProps> = ({
  summary,
  onContinueMainline,
  onRestart,
}) => {
  if (!summary) return null;
  const isJct = summary.kind === 'jct';
  const isJctBranchDone = Boolean(summary.jctBranchCompleted);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe px-safe bg-[#05080f]/82 pointer-events-auto">
      <div className="w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-[#0c121e] border border-emerald-400/45 shadow-2xl text-slate-100">
        {/* Expressway Green Goal Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 [@media(max-height:540px)]:py-2.5 bg-[#00663c] border-b border-emerald-300/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
              <Award className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="text-[11px] sm:text-xs font-bold tracking-wider text-emerald-100 uppercase">
                {isJctBranchDone
                  ? 'E1A 新東名 · 5.0km JCT連絡道 完全走破'
                  : isJct
                    ? 'E1A 新東名 · JCT 立体分岐通過'
                    : 'E1A 新東名 · ETC / 料金所通過'}
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-white mt-0.5">
                {isJctBranchDone
                  ? `${summary.icName} 連絡道 — 5.0km クリア！`
                  : isJct
                    ? `${summary.icName} 分岐 — 高架ランプクリア！`
                    : `${summary.icName} 流出 — ゴールクリア！`}
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                {isJctBranchDone
                  ? `${summary.branchName} 方面 5.0km 連絡高速道路を完走しました（JCT完全走破ボーナス +2,500pts）`
                  : isJct
                    ? `${summary.branchName} 方面連絡高架を渡り切りました（JCTクリアボーナス +1,500pts）`
                    : `${summary.branchName} 方面出口へ到着しました（ICクリアボーナス +1,500pts）`}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-4 sm:p-6 [@media(max-height:540px)]:p-3 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center tabular-nums">
            <div className="bg-[#121a29] border border-slate-700/70 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">総スコア</div>
              <div className="font-display-telemetry font-bold text-xl text-amber-400 mt-1">
                {summary.score.toLocaleString()}
              </div>
            </div>
            <div className="bg-[#121a29] border border-slate-700/70 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">走行距離</div>
              <div className="font-display-telemetry font-bold text-xl text-white mt-1">
                {summary.distanceKm.toFixed(2)} <span className="text-xs text-slate-400">km</span>
              </div>
            </div>
            <div className="bg-[#121a29] border border-slate-700/70 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">最高到達速度</div>
              <div className="font-display-telemetry font-bold text-xl text-sky-300 mt-1">
                {Math.round(summary.maxSpeedKmh)} <span className="text-xs text-slate-400">km/h</span>
              </div>
            </div>
            <div className="bg-[#121a29] border border-slate-700/70 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">追越 / ニアミス</div>
              <div className="font-display-telemetry font-bold text-xl text-emerald-300 mt-1">
                {summary.overtakeCount} <span className="text-xs text-slate-400">/ {summary.nearMissCount}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#181f2e] border border-amber-400/40 p-3.5 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm leading-relaxed text-slate-200">
              {isJct ? (
                <>
                  <span className="font-bold text-amber-300">現実のJCT分岐ガイド：</span>
                  JCTの連絡高架橋は急カーブと勾配が連続するため、現実の高速道路では{' '}
                  <strong className="text-white">指定された規制速度（40〜60km/h）</strong>
                  まで十分減速して安全に通過しましょう！
                </>
              ) : (
                <>
                  <span className="font-bold text-amber-300">現実のETC＆一般道ガイド：</span>
                  ゲーム内ではハイスピードのまま料金所を通過してゴールできますが、現実の ETC レーンは{' '}
                  <strong className="text-white">時速20km以下</strong>、高速本線は{' '}
                  <strong className="text-white">原則100km/h（指定区間のみ120km/h）</strong>、一般道は法定速度で安全運転をお願いいたします！
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onRestart}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>最初から走る</span>
            </button>
            <button
              type="button"
              onClick={onContinueMainline}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1.5 transition-colors shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>本線に戻って先へ進む</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
