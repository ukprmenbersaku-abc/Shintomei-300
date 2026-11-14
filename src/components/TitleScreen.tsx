import React from 'react';
import {
  Bike,
  CarFront,
  CloudSun,
  Flame,
  Gauge,
  Maximize2,
  Monitor,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { CAR_PAINTS } from '../game/constants';
import { CarPaintId, DeviceMode, LiveWeatherInfo, QualityMode, VehicleType, WeatherMode } from '../types/game';
import { PWAInstallButton } from './PWAInstallButton';

interface TitleScreenProps {
  recommendedDevice: DeviceMode;
  vehicleType: VehicleType;
  paint: CarPaintId;
  qualityMode: QualityMode;
  weatherMode: WeatherMode;
  liveWeather: LiveWeatherInfo | null;
  liveWeatherLoading: boolean;
  onSelectVehicleType: (type: VehicleType) => void;
  onSelectPaint: (paint: CarPaintId) => void;
  onSelectQuality: (mode: QualityMode) => void;
  onSelectWeather: (mode: WeatherMode) => void;
  onSyncGeoWeather: () => void;
  onStartDevice: (mode: DeviceMode, fullscreenUltra?: boolean) => void;
  onOpenGarage: (mode: DeviceMode) => void;
  onShowLegalGuide: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  recommendedDevice,
  vehicleType,
  paint,
  qualityMode,
  weatherMode,
  liveWeather,
  liveWeatherLoading,
  onSelectVehicleType,
  onSelectPaint,
  onSelectQuality,
  onSelectWeather,
  onShowLegalGuide,
  onStartDevice,
  onOpenGarage,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-start sm:justify-between [@media(max-height:540px)]:justify-start overflow-y-auto bg-gradient-to-b from-[#05080f]/82 via-[#05080f]/45 to-[#05080f]/94 px-3 py-3 sm:px-8 sm:py-6 [@media(max-height:540px)]:py-2 pt-safe pb-safe px-safe pointer-events-auto">
      {/* Top Bar */}
      <header className="w-full max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="px-2.5 py-1 rounded border-2 border-white bg-[#005934] font-display-telemetry font-bold text-sm sm:text-lg tracking-wider text-white shadow">
            E1A
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-emerald-300 tracking-wide">
              SHIN-TOMEI EXPRESSWAY
            </div>
            <div className="text-[11px] text-slate-300 hidden sm:block [@media(max-height:540px)]:hidden">
              伊勢原JCT 〜 駿河湾沼津 〜 静岡 〜 浜松いなさJCT
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => onSelectWeather(weatherMode === WeatherMode.Live ? WeatherMode.Auto : WeatherMode.Live)}
            title="現実の天気・時間帯と連動"
            className={`min-h-[38px] sm:min-h-[40px] px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              weatherMode === WeatherMode.Live
                ? 'bg-emerald-700/90 border-emerald-400 text-white'
                : 'bg-[#101827]/90 hover:bg-[#19253b] border-slate-700 text-sky-200'
            }`}
          >
            <CloudSun className="w-4 h-4 shrink-0" />
            <span>
              {weatherMode === WeatherMode.Live
                ? liveWeatherLoading
                  ? '現実天気 取得中…'
                  : liveWeather
                    ? `現実: ${liveWeather.weatherLabelJa} ${Math.round(liveWeather.temperatureC)}℃`
                    : '現実天気 ON'
                : '現実天気と連動'}
            </span>
          </button>
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={onShowLegalGuide}
            className="min-h-[38px] sm:min-h-[40px] px-3 py-1.5 sm:py-2 rounded-xl bg-[#101827]/90 hover:bg-[#19253b] border border-slate-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>法定速度案内</span>
          </button>
        </div>
      </header>

      {/* Center Hero & PC / Smartphone Selection */}
      <main className="w-full max-w-5xl mx-auto my-auto [@media(max-height:540px)]:my-2 py-3 sm:py-5 [@media(max-height:540px)]:py-1 space-y-3 sm:space-y-6 [@media(max-height:540px)]:space-y-2.5 shrink-0">
        <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 bg-[#080e1a]/78 border border-slate-700/70 rounded-2xl p-3.5 sm:p-6 [@media(max-height:540px)]:p-3 shadow-2xl">
          <div className="space-y-1 sm:space-y-1.5 min-w-0">
            <div className="text-[10px] sm:text-xs font-bold tracking-widest uppercase text-amber-400">
              SPECIAL 300 KM/H SIMULATION · REAL 100–120 KM/H TRAFFIC
            </div>
            <h1 className="text-xl sm:text-4xl [@media(max-height:540px)]:text-lg font-black tracking-tight text-white leading-tight">
              E1A 新東名 300km/h
              <span className="block sm:inline sm:ml-2 text-sky-300">ハイウェイ・シミュレーター</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed [@media(max-height:540px)]:hidden">
              実在SA・PA・IC（駿河湾沼津・清水・静岡・掛川・浜松）と天候変化の中、時速300kmの非日常を体感。周囲の一般車は現実の高速基準（原則100km/h・一部指定区間120km/h・大型90km/h）で走行しています。
            </p>
          </div>

          <div className="shrink-0 w-14 h-14 sm:w-20 sm:h-20 [@media(max-height:540px)]:w-12 [@media(max-height:540px)]:h-12 rounded-full bg-white border-[5px] sm:border-[6px] [@media(max-height:540px)]:border-[4px] border-[#d91c2b] flex flex-col items-center justify-center shadow-xl">
            <span className="font-display-telemetry font-bold text-lg sm:text-2xl [@media(max-height:540px)]:text-base leading-none text-slate-900">
              300
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-600 leading-none mt-0.5">
              特例区間
            </span>
          </div>
        </div>

        {/* Device Mode Split Cards */}
        <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4">
          {/* PC Mode Card */}
          <section
            className={`rounded-2xl border p-4 sm:p-5 [@media(max-height:540px)]:p-3 flex flex-col justify-between gap-3 sm:gap-4 [@media(max-height:540px)]:gap-2 shadow-2xl transition-colors ${
              recommendedDevice === 'pc'
                ? 'bg-[#0b1322]/92 border-sky-400/70'
                : 'bg-[#0a101c]/88 border-slate-700/80'
            }`}
          >
            <div className="space-y-2.5 [@media(max-height:540px)]:space-y-1.5">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 [@media(max-height:540px)]:w-9 [@media(max-height:540px)]:h-9 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
                    <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-1.5 flex-wrap">
                      <span>PC モード</span>
                      {recommendedDevice === 'pc' && (
                        <span className="text-[11px] font-bold text-sky-300">· 推奨</span>
                      )}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-400">キーボード操作・大画面ワイド視界</p>
                  </div>
                </div>
              </div>

              <ul className="text-xs sm:text-sm [@media(max-height:540px)]:text-[11px] text-slate-300 space-y-1 border-t border-slate-800 pt-2.5 [@media(max-height:540px)]:pt-1.5">
                <li>
                  <span className="text-slate-400">操作：</span>
                  <span className="font-display-telemetry font-bold text-white">WASD / 矢印</span>
                  <span className="text-slate-400"> · 視点 </span>
                  <span className="font-display-telemetry font-bold text-white">C</span>
                  <span className="text-slate-400"> · 全画面 </span>
                  <span className="font-display-telemetry font-bold text-white">F / U</span>
                </li>
                <li className="[@media(max-height:540px)]:hidden">
                  <span className="text-slate-400">描写：</span>
                  <span className="text-sky-200 font-medium">
                    4Kソフトシャドウ · 動的光源 · 高速エッジブラー
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => onStartDevice('pc', false)}
                className="flex-1 min-h-[42px] sm:min-h-[46px] px-3 sm:px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-lg whitespace-nowrap"
              >
                <Gauge className="w-4 h-4 shrink-0" />
                <span>PCで走る</span>
              </button>
              <button
                type="button"
                onClick={() => onStartDevice('pc', true)}
                title="全画面・超高画質 (HUD非表示) で走る"
                className="min-h-[42px] sm:min-h-[46px] px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Maximize2 className="w-4 h-4 shrink-0" />
                <span>全画面・超高画質</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenGarage('pc')}
                aria-label="PCモードのガレージ設定"
                className="min-h-[42px] sm:min-h-[46px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Settings2 className="w-4 h-4 shrink-0" />
                <span>設定</span>
              </button>
            </div>
          </section>

          {/* Smartphone Mode Card */}
          <section
            className={`rounded-2xl border p-4 sm:p-5 [@media(max-height:540px)]:p-3 flex flex-col justify-between gap-3 sm:gap-4 [@media(max-height:540px)]:gap-2 shadow-2xl transition-colors ${
              recommendedDevice === 'mobile'
                ? 'bg-[#091815]/92 border-emerald-400/70'
                : 'bg-[#0a101c]/88 border-slate-700/80'
            }`}
          >
            <div className="space-y-2.5 [@media(max-height:540px)]:space-y-1.5">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 [@media(max-height:540px)]:w-9 [@media(max-height:540px)]:h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                    <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-1.5 flex-wrap">
                      <span>スマホ モード</span>
                      {recommendedDevice === 'mobile' && (
                        <span className="text-[11px] font-bold text-emerald-300">· 推奨</span>
                      )}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-400">横画面・タッチ / ジャイロ & PWA対応</p>
                  </div>
                </div>
              </div>

              <ul className="text-xs sm:text-sm [@media(max-height:540px)]:text-[11px] text-slate-300 space-y-1 border-t border-slate-800 pt-2.5 [@media(max-height:540px)]:pt-1.5">
                <li>
                  <span className="text-slate-400">操作：</span>
                  <span className="text-white font-semibold">親指ペダル（← → / 加速・減速）</span>
                  <span className="text-slate-400"> ＋ ジャイロ</span>
                </li>
                <li className="[@media(max-height:540px)]:hidden">
                  <span className="text-slate-400">爆走：</span>
                  <span className="text-amber-200 font-medium">
                    余計な表示を消した全画面・超高画質モード搭載
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => onStartDevice('mobile', false)}
                className="flex-1 min-h-[42px] sm:min-h-[46px] px-3 sm:px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-lg whitespace-nowrap"
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>スマホで走る</span>
              </button>
              <button
                type="button"
                onClick={() => onStartDevice('mobile', true)}
                title="スマホ全画面・爆走モード (極小HUD＋超高画質) で走る"
                className="min-h-[42px] sm:min-h-[46px] px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-lg whitespace-nowrap"
              >
                <Flame className="w-4 h-4 shrink-0" />
                <span>全画面・爆走</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenGarage('mobile')}
                aria-label="スマホモードのガレージ設定"
                className="min-h-[42px] sm:min-h-[46px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Settings2 className="w-4 h-4 shrink-0" />
                <span>設定</span>
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Live Customizer Bar (Vehicle + Paint + Ultra-HD Switch) */}
      <footer className="w-full max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 bg-[#080e1a]/88 border border-slate-800 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 [@media(max-height:540px)]:py-2 shrink-0">
        {/* 3-Way Vehicle Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">マシン</span>
          <div className="grid grid-cols-3 gap-1 bg-[#05080f] p-1 rounded-xl border border-slate-800">
            {[
              { id: 'car' as VehicleType, label: 'GTスポーツ', icon: CarFront },
              { id: 'bike' as VehicleType, label: 'バイク', icon: Bike },
              { id: 'ev' as VehicleType, label: 'EV', icon: Zap },
            ].map((item) => {
              const Icon = item.icon;
              const active = vehicleType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectVehicleType(item.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <span className="text-xs font-medium text-slate-400">カラー</span>
          <div className="flex items-center gap-1.5">
            {(Object.keys(CAR_PAINTS) as CarPaintId[]).map((id) => {
              const p = CAR_PAINTS[id];
              const active = paint === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectPaint(id)}
                  title={p.nameJa}
                  aria-label={p.nameJa}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg border transition-transform ${
                    active
                      ? 'border-white scale-110 ring-2 ring-amber-400/80'
                      : 'border-slate-600 hover:scale-105'
                  }`}
                  style={{ backgroundColor: p.swatch }}
                />
              );
            })}
          </div>
          <span className="text-xs text-slate-300 hidden md:inline [@media(max-height:540px)]:hidden">
            {CAR_PAINTS[paint].nameJa}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">画質</span>
          <div className="grid grid-cols-2 gap-1 bg-[#05080f] p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => onSelectQuality(QualityMode.Ultra)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${
                qualityMode === QualityMode.Ultra
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>超高画質</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectQuality(QualityMode.Standard)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                qualityMode === QualityMode.Standard
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>標準</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

