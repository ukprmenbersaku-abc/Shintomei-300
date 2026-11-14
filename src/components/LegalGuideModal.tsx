import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface LegalGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalGuideModal: React.FC<LegalGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#05080f]/75 pointer-events-auto">
      <div className="w-full max-w-lg rounded-2xl bg-[#0c121e] border border-slate-700 shadow-2xl overflow-hidden text-slate-100">
        <div className="px-5 py-4 bg-[#172033] border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-base text-white">現実の高速道路における法定速度のご案内</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm leading-relaxed text-slate-300">
          <p className="text-slate-200 font-medium">
            ゲーム内の制限速度は夢の <span className="text-amber-300 font-bold tabular-nums">300 km/h</span>
            に設定されていますが、現実の新東名高速道路では道路交通法が適用されます。
          </p>

          <div className="rounded-xl bg-[#080d16] border border-slate-800 p-4 space-y-2.5 text-xs sm:text-sm">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">新東名の実際の最高速度：</span>
                御殿場JCT〜浜松いなさJCTの一部区間は <span className="tabular-nums font-bold">120 km/h</span>
                （大型トラック等は <span className="tabular-nums">80〜90 km/h</span>、通常区間は <span className="tabular-nums">100 km/h</span>）。
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">追越車線のルール：</span>
                右端の追越車線を走り続けると「通行帯違反」になります。追い越しが終わったら速やかに走行車線（左・中央）へ戻りましょう。
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">もし現実で300km/h出すと：</span>
                約200km/hオーバーとなり、一発免停どころか免許取消・刑事罰・ニュース速報コースです。300km/hはこのゲームの中だけで存分にお楽しみください！
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
            >
              安全運転を誓って戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
