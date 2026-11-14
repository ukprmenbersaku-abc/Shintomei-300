import React from 'react';
import {
  CarPaintId,
  DeviceMode,
  LiveWeatherInfo,
  QualityMode,
  TrafficDensity,
  VehicleType,
  WeatherMode,
} from '../types/game';
import { CAR_PAINTS, TRAFFIC_PRESETS, WEATHER_CONFIG } from '../game/constants';
import {
  AlertTriangle,
  Bike,
  CarFront,
  CloudSun,
  Flame,
  Gauge,
  Home,
  MapPin,
  Maximize2,
  Monitor,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface StartModalProps {
  isOpen: boolean;
  hasStartedOnce: boolean;
  deviceMode: DeviceMode;
  vehicleType: VehicleType;
  inJctBranch?: boolean;
  paint: CarPaintId;
  weatherMode: WeatherMode;
  liveWeather: LiveWeatherInfo | null;
  liveWeatherLoading: boolean;
  trafficDensity: TrafficDensity;
  qualityMode: QualityMode;
  onChangeDeviceMode: (mode: DeviceMode) => void;
  onSelectVehicleType: (type: VehicleType) => void;
  onSelectPaint: (paint: CarPaintId) => void;
  onSelectWeather: (mode: WeatherMode) => void;
  onSyncGeoWeather: () => void;
  onSelectTraffic: (density: TrafficDensity) => void;
  onSelectQuality: (mode: QualityMode) => void;
  onStartOrResume: () => void;
  onStartFullscreenUltra: () => void;
  onRestart: () => void;
  onReturnToTitle: () => void;
  onExitJctBranch?: () => void;
}

export const StartModal: React.FC<StartModalProps> = ({
  isOpen,
  hasStartedOnce,
  deviceMode,
  vehicleType,
  inJctBranch,
  paint,
  weatherMode,
  liveWeather,
  liveWeatherLoading,
  trafficDensity,
  qualityMode,
  onChangeDeviceMode,
  onSelectVehicleType,
  onSelectPaint,
  onSelectWeather,
  onSyncGeoWeather,
  onSelectTraffic,
  onSelectQuality,
  onStartOrResume,
  onStartFullscreenUltra,
  onRestart,
  onReturnToTitle,
  onExitJctBranch,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe bg-[#05080f]/80 pointer-events-auto">
      <div className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-[#0c121e]/95 border border-slate-700/80 shadow-2xl text-slate-100">
        {/* Authentic E1A Expressway Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 [@media(max-height:540px)]:px-4 [@media(max-height:540px)]:py-2.5 bg-[#005934] border-b border-emerald-400/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 rounded border-2 border-white bg-[#004427] font-display-telemetry font-bold text-base sm:text-lg tracking-wider text-white shrink-0">
              E1A
            </div>
            <div>
              <h1 className="text-base sm:text-xl [@media(max-height:540px)]:text-sm font-bold tracking-tight text-white">
                新東名 300km/h ハイウェイ・シミュレーター
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-100/90 mt-0.5 [@media(max-height:540px)]:hidden">
                操作モード・画質・天候・マシンカラー設定
              </p>
            </div>
          </div>

          <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 [@media(max-height:540px)]:w-10 [@media(max-height:540px)]:h-10 rounded-full bg-white border-[4px] sm:border-[5px] border-[#d91c2b] flex flex-col items-center justify-center shadow-md">
            <span className="font-display-telemetry font-bold text-base sm:text-lg [@media(max-height:540px)]:text-sm leading-none text-slate-900">
              300
            </span>
            <span className="text-[8px] font-bold text-slate-600 leading-none mt-0.5 [@media(max-height:540px)]:hidden">特例</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 [@media(max-height:540px)]:p-3 space-y-4 [@media(max-height:540px)]:space-y-2.5">
          {/* Device Mode Switcher + PWA Install */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#090d15] border border-slate-800 rounded-xl p-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChangeDeviceMode('pc')}
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  deviceMode === 'pc'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>PC モード</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeDeviceMode('mobile')}
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  deviceMode === 'mobile'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>スマホ モード</span>
              </button>
            </div>

            <PWAInstallButton compact />
          </div>

          {/* Humorous Legal Speed Notice */}
          <div className="rounded-xl bg-[#161c29] border border-amber-400/35 p-3 sm:p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-slate-200 space-y-1">
              <div className="font-bold text-amber-300">
                現実の高速道路では法定速度（原則100km/h・指定区間のみ120km/h）を守ってください
              </div>
              <p className="text-slate-300">
                本ゲームは特別認可により<strong className="text-white">制限速度 300km/h</strong>
                ですが、周囲の一般乗用車は現実の高速基準と同じ<strong className="text-white tabular-nums">100〜120km/h前後</strong>
                （大型貨物90km/h）で走行しています。
              </p>
            </div>
          </div>

          {/* Vehicle Class Selector */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-400">車両クラス選択（いつでも切替可）</div>
            <div className="grid grid-cols-3 gap-2 bg-[#090d15] p-1.5 rounded-xl border border-slate-800">
              {[
                { id: 'car' as VehicleType, label: 'GT スポーツカー', desc: '6速MT · 爽快V6サウンド', icon: CarFront },
                { id: 'bike' as VehicleType, label: 'スポーツバイク', desc: 'バンク角 · 高回転14,000RPM', icon: Bike },
                { id: 'ev' as VehicleType, label: 'EV ハイパーカー', desc: '1速直結 · 爆発的モーター加速', icon: Zap },
              ].map((item) => {
                const Icon = item.icon;
                const active = vehicleType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectVehicleType(item.id)}
                    className={`px-2.5 py-2 rounded-lg text-left transition-colors border ${
                      active
                        ? 'bg-amber-500/18 border-amber-400 text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 hidden sm:block [@media(max-height:540px)]:hidden">
                      {item.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Setup Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-400">マシンカラー</div>
              <div className="flex items-center gap-2">
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
                      className={`w-8 h-8 rounded-lg border transition-transform ${
                        active
                          ? 'border-white scale-110 ring-2 ring-amber-400/70'
                          : 'border-slate-600 hover:scale-105'
                      }`}
                      style={{ backgroundColor: p.swatch }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-400">グラフィック画質</div>
              <div className="grid grid-cols-2 gap-1 bg-[#090d15] p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => onSelectQuality(QualityMode.Ultra)}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                    qualityMode === QualityMode.Ultra
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>超高画質</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectQuality(QualityMode.Standard)}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                    qualityMode === QualityMode.Standard
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  標準
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-400">交通量</div>
              <div className="grid grid-cols-3 gap-1 bg-[#090d15] p-1 rounded-lg border border-slate-800">
                {(Object.keys(TRAFFIC_PRESETS) as TrafficDensity[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onSelectTraffic(d)}
                    className={`px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      trafficDensity === d
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d === TrafficDensity.Light ? '少なめ' : d === TrafficDensity.Realistic ? '現実的' : '混雑'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-400">天候・時間帯プリセット</div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 bg-[#090d15] p-1 rounded-lg border border-slate-800">
              {[
                { mode: WeatherMode.Auto, label: '自動変化' },
                { mode: WeatherMode.Live, label: '現実連動' },
                { mode: WeatherMode.Clear, label: '晴天' },
                { mode: WeatherMode.Sunset, label: '夕暮れ' },
                { mode: WeatherMode.Night, label: '夜間' },
                { mode: WeatherMode.Rain, label: '雨天' },
                { mode: WeatherMode.Fog, label: '濃霧' },
              ].map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => onSelectWeather(item.mode)}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center gap-1 ${
                    weatherMode === item.mode
                      ? item.mode === WeatherMode.Live
                        ? 'bg-sky-600 text-white'
                        : 'bg-emerald-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.mode === WeatherMode.Live && <CloudSun className="w-3.5 h-3.5 shrink-0" />}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {weatherMode === WeatherMode.Live && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#0d1829] border border-sky-500/35 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 text-slate-200 min-w-0">
                  <CloudSun className="w-4 h-4 text-sky-300 shrink-0" />
                  <span className="truncate">
                    {liveWeatherLoading
                      ? '実際の天気データを取得しています…'
                      : liveWeather
                        ? `${liveWeather.locationLabel}：${liveWeather.weatherLabelJa} ${Math.round(liveWeather.temperatureC)}℃ → ${WEATHER_CONFIG[liveWeather.mappedWeather].shortJa}`
                        : '現実の天気データを取得中…'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={onSyncGeoWeather}
                    disabled={liveWeatherLoading}
                    className="px-2.5 py-1 rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>現在地に合わせる</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectWeather(WeatherMode.Live)}
                    disabled={liveWeatherLoading}
                    title="天気を再取得"
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${liveWeatherLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls Summary */}
          {deviceMode === 'pc' ? (
            <div className="border-t border-slate-800 pt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300">
              <div className="bg-[#111724] rounded-lg px-3 py-2 border border-slate-800">
                <div className="text-slate-400">アクセル / ブレーキ</div>
                <div className="font-display-telemetry font-bold text-white mt-0.5">W・S / ↑・↓</div>
              </div>
              <div className="bg-[#111724] rounded-lg px-3 py-2 border border-slate-800">
                <div className="text-slate-400">ステアリング</div>
                <div className="font-display-telemetry font-bold text-white mt-0.5">A・D / ←・→</div>
              </div>
              <div className="bg-[#111724] rounded-lg px-3 py-2 border border-slate-800">
                <div className="text-slate-400">視点 / パッシング</div>
                <div className="font-display-telemetry font-bold text-white mt-0.5">C / Space</div>
              </div>
              <div className="bg-[#111724] rounded-lg px-3 py-2 border border-slate-800">
                <div className="text-slate-400">全画面 / HUD非表示</div>
                <div className="font-display-telemetry font-bold text-white mt-0.5">F / U</div>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-800 pt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300">
              <div className="bg-[#111724] rounded-lg px-3 py-2 border border-slate-800">
                <div className="text-slate-400">ハンドル操作</div>
                <div className="font-bold text-white mt-0.5">左下 ← → / ジャイロ</div>
              </div>
              <div className="bg-[#111724] rounded-lg px-3 py-2 border border-slate-800">
                <div className="text-slate-400">アクセル / ブレーキ</div>
                <div className="font-bold text-white mt-0.5">右下 加速・減速ペダル</div>
              </div>
              <div className="bg-[#111724] rounded-lg px-3 py-2 border border-slate-800">
                <div className="text-slate-400">視点・パッシング</div>
                <div className="font-bold text-white mt-0.5">画面上部・右ボタン</div>
              </div>
              <div className="bg-[#111724] rounded-lg px-3 py-2 border border-slate-800">
                <div className="text-slate-400">アプリ化 (PWA)</div>
                <div className="font-bold text-emerald-300 mt-0.5">ホーム画面追加で全画面</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <button
              type="button"
              onClick={onReturnToTitle}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Home className="w-4 h-4" />
              <span>タイトルへ</span>
            </button>

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {inJctBranch && onExitJctBranch && (
                <button
                  type="button"
                  onClick={onExitJctBranch}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <span>E1A 本線へ戻る</span>
                </button>
              )}
              {hasStartedOnce && (
                <button
                  type="button"
                  onClick={onRestart}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>最初から</span>
                </button>
              )}
              {deviceMode === 'pc' ? (
                <button
                  type="button"
                  onClick={onStartFullscreenUltra}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>全画面・超高画質で走る</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartFullscreenUltra}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-colors shadow-lg whitespace-nowrap"
                >
                  <Flame className="w-4 h-4" />
                  <span>全画面・爆走モード</span>
                </button>
              )}
              <button
                type="button"
                onClick={onStartOrResume}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors shadow-lg whitespace-nowrap"
              >
                {hasStartedOnce ? <Play className="w-4 h-4 fill-current" /> : <Gauge className="w-4 h-4" />}
                <span>{hasStartedOnce ? '再開' : '走行開始'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>左側通行・右が追越車線・リアルボンネット視点対応</span>
          </div>
        </div>
      </div>
    </div>
  );
};

