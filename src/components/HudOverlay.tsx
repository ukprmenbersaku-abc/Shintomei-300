import React, { useState } from 'react';
import {
  ActiveWeather,
  CameraMode,
  CarPaintId,
  DeviceMode,
  InputState,
  LiveWeatherInfo,
  QualityMode,
  SafetyBannerMessage,
  TelemetrySnapshot,
  TrafficDensity,
  WeatherMode,
} from '../types/game';
import { CAR_PAINTS, WEATHER_CONFIG } from '../game/constants';
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronUp,
  CloudSun,
  Compass,
  Eye,
  EyeOff,
  Flame,
  Info,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

interface HudOverlayProps {
  telemetry: TelemetrySnapshot;
  isRunning: boolean;
  deviceMode: DeviceMode;
  gyroEnabled: boolean;
  banner: SafetyBannerMessage | null;
  weatherMode: WeatherMode;
  liveWeather: LiveWeatherInfo | null;
  liveWeatherLoading: boolean;
  cameraMode: CameraMode;
  trafficDensity: TrafficDensity;
  qualityMode: QualityMode;
  paint: CarPaintId;
  muted: boolean;
  isFullscreen: boolean;
  cinemaHudHidden: boolean;
  dockCollapsed: boolean;
  onToggleDock: () => void;
  onToggleFullscreen: () => void;
  onToggleCinemaHud: () => void;
  onToggleGyro: () => void;
  onSelectWeather: (mode: WeatherMode) => void;
  onSyncGeoWeather: () => void;
  onSelectCamera: (mode: CameraMode) => void;
  onSelectTraffic: (density: TrafficDensity) => void;
  onSelectQuality: (mode: QualityMode) => void;
  onSelectPaint: (paint: CarPaintId) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onExitJctBranch?: () => void;
  onTouchInput: (partial: Partial<InputState>) => void;
  onShowLegalGuide: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  telemetry,
  isRunning,
  deviceMode,
  gyroEnabled,
  banner,
  weatherMode,
  liveWeather,
  liveWeatherLoading,
  cameraMode,
  trafficDensity,
  qualityMode,
  paint,
  muted,
  isFullscreen,
  cinemaHudHidden,
  dockCollapsed,
  onToggleDock,
  onToggleFullscreen,
  onToggleCinemaHud,
  onToggleGyro,
  onSelectWeather,
  onSyncGeoWeather,
  onSelectCamera,
  onSelectTraffic,
  onSelectQuality,
  onSelectPaint,
  onToggleMute,
  onPause,
  onRestart,
  onExitJctBranch,
  onTouchInput,
  onShowLegalGuide,
}) => {
  const [showMobileControls, setShowMobileControls] = useState(false);

  const weatherCfg = WEATHER_CONFIG[telemetry.activeWeather];
  const speedRounded = Math.abs(Math.round(telemetry.speedKmh));
  const isEv = telemetry.vehicleType === 'ev';
  const isBike = telemetry.vehicleType === 'bike';
  const gearDisplay = telemetry.isParked
    ? 'P'
    : telemetry.gear === -1
      ? 'R'
      : telemetry.gear === 0
        ? 'P'
        : isEv
          ? 'D'
          : String(telemetry.gear);
  const gearBadgeLabel =
    gearDisplay === 'P' || gearDisplay === 'R' || gearDisplay === 'D' ? gearDisplay : `G${gearDisplay}`;
  const isReverse = telemetry.gear === -1;
  const maxRedline = isBike ? 13500 : isEv ? 16000 : 8400;
  const rpmPct = Math.min(100, Math.max(0, ((telemetry.rpm - (isEv ? 0 : 1000)) / maxRedline) * 100));
  const speedPct = Math.min(100, (Math.abs(telemetry.speedKmh) / 300) * 100);
  const gripPct = Math.round(telemetry.gripLevel * 100);

  const isMobile = deviceMode === 'mobile';
  const nextCameraMode = () => {
    const order = [CameraMode.Chase, CameraMode.Hood, CameraMode.Bumper];
    return order[(order.indexOf(cameraMode) + 1) % order.length];
  };

  // Fullscreen Blazing / HUD-Free Mode
  if (cinemaHudHidden && isRunning) {
    if (!isMobile) {
      return (
        <div className="fixed top-3 right-3 z-20 pointer-events-auto flex items-center gap-1.5 opacity-30 hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onToggleCinemaHud}
            title="HUDを再表示 (U)"
            className="px-2.5 py-1.5 rounded-lg bg-[#090f1a]/85 border border-slate-700/80 text-slate-200 text-xs font-medium flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>HUD</span>
          </button>
          <button
            type="button"
            onClick={onPause}
            title="メニュー (Esc)"
            className="p-1.5 rounded-lg bg-[#090f1a]/85 border border-slate-700/80 text-slate-200"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    // Mobile Fullscreen Blazing Mode: ultra-clean highway view + phantom corner touch controls
    const showBlazingExitHint =
      telemetry.inSaApron ||
      telemetry.inFreePlaza ||
      telemetry.inMergeLane ||
      telemetry.inIcRamp ||
      telemetry.inJctRamp ||
      telemetry.inJctBranch ||
      telemetry.isParked ||
      telemetry.inParkingBay ||
      telemetry.nextMilestoneDistM < 420;

    return (
      <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2 pt-safe pb-safe px-safe">
        {/* Blazing Top Bar: only emergency SA/IC/JCT micro-hint on left + compact speed & exit pill on right */}
        <div className="flex items-start justify-between gap-2">
          <div>
            {showBlazingExitHint && (
              <div className="rounded-full bg-[#090f1a]/72 border border-amber-400/70 px-3 py-1 text-[11px] font-bold text-amber-200 shadow-lg backdrop-blur-[2px] tabular-nums">
                {telemetry.isParked
                  ? '駐車完了 [P] · 加速/減速長押し(R)で発進'
                  : telemetry.inParkingBay
                    ? '緑枠内！停車で駐車 (+800pts)'
                    : telemetry.inJctBranch
                      ? `${telemetry.nextMilestoneName} 連絡道 · 残り ${(telemetry.jctBranchRemainingM / 1000).toFixed(2)}km`
                      : telemetry.inJctRamp
                        ? `${telemetry.nextMilestoneName} 高架ランプ走行中`
                        : telemetry.inMergeLane
                          ? `${telemetry.nextMilestoneName} 合流 ↗`
                          : telemetry.inFreePlaza || telemetry.inSaApron
                            ? `${telemetry.nextMilestoneName} 構内自由走行（緑枠[P] / 出口↑）`
                            : telemetry.inIcRamp
                              ? `${telemetry.nextMilestoneName} 出口へ`
                              : telemetry.nextMilestoneType === 'jct'
                                ? `↙ ${Math.max(10, Math.round(telemetry.nextMilestoneDistM / 10) * 10)}m ${telemetry.nextMilestoneName} 分岐`
                                : `↙ ${Math.max(10, Math.round(telemetry.nextMilestoneDistM / 10) * 10)}m ${telemetry.nextMilestoneName}`}
              </div>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#070b12]/60 border border-white/15 px-2.5 py-1 backdrop-blur-sm shadow-lg">
            <span
              className={`font-display-telemetry font-bold text-sm leading-none tabular-nums ${
                isReverse
                  ? 'text-rose-400'
                  : telemetry.isSpeedLimited
                    ? 'text-amber-400'
                    : speedRounded >= 240
                      ? 'text-sky-300'
                      : 'text-white'
              }`}
            >
              {speedRounded}
            </span>
            <span className="text-[10px] text-slate-300">km/h</span>
            <span className="text-slate-500 text-xs">·</span>
            <span
              className={`font-display-telemetry font-bold text-xs ${
                telemetry.isParked ? 'text-emerald-400' : isReverse ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              {gearBadgeLabel}
            </span>

            <button
              type="button"
              onClick={() => onSelectCamera(nextCameraMode())}
              aria-label="視点切替"
              className="ml-1 w-8 h-8 rounded-full bg-white/10 active:bg-sky-500 text-white flex items-center justify-center"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleCinemaHud}
              aria-label="爆走モード終了"
              className="h-8 px-2.5 rounded-full bg-white/10 active:bg-slate-600 text-slate-100 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>通常</span>
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="メニュー"
              className="w-8 h-8 rounded-full bg-white/10 active:bg-slate-600 text-slate-100 flex items-center justify-center"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Blazing Bottom Phantom Corner Controls */}
        <div className="flex items-end justify-between gap-2 pb-0.5">
          <div
            className={`pointer-events-auto flex items-center gap-2 touch-none select-none ${
              gyroEnabled ? 'opacity-45' : 'opacity-85'
            }`}
          >
            <button
              type="button"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                onTouchInput({ left: true });
              }}
              onPointerUp={() => onTouchInput({ left: false })}
              onPointerCancel={() => onTouchInput({ left: false })}
              aria-label="左へステア"
              className="w-15 h-14 sm:w-16 sm:h-14 portrait:w-16 portrait:h-16 rounded-2xl bg-[#070b12]/35 border border-white/25 backdrop-blur-[2px] active:bg-amber-500 active:text-slate-950 active:border-amber-300 text-white font-bold text-xl shadow-lg touch-none select-none flex items-center justify-center"
            >
              ←
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                onTouchInput({ right: true });
              }}
              onPointerUp={() => onTouchInput({ right: false })}
              onPointerCancel={() => onTouchInput({ right: false })}
              aria-label="右へステア"
              className="w-15 h-14 sm:w-16 sm:h-14 portrait:w-16 portrait:h-16 rounded-2xl bg-[#070b12]/35 border border-white/25 backdrop-blur-[2px] active:bg-amber-500 active:text-slate-950 active:border-amber-300 text-white font-bold text-xl shadow-lg touch-none select-none flex items-center justify-center"
            >
              →
            </button>
          </div>

          <div className="pointer-events-auto flex items-end gap-2 touch-none select-none opacity-85">
            <button
              type="button"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                onTouchInput({ hornOrFlash: true });
              }}
              onPointerUp={() => onTouchInput({ hornOrFlash: false })}
              onPointerCancel={() => onTouchInput({ hornOrFlash: false })}
              aria-label="パッシング"
              className="w-10 h-12 rounded-xl bg-sky-950/35 border border-sky-300/35 backdrop-blur-[2px] active:bg-sky-400 active:text-slate-950 text-sky-100 flex items-center justify-center touch-none select-none shadow-lg"
            >
              <Zap className="w-4 h-4" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                onTouchInput({ brake: true });
              }}
              onPointerUp={() => onTouchInput({ brake: false })}
              onPointerCancel={() => onTouchInput({ brake: false })}
              className="w-14 h-13 portrait:w-16 portrait:h-16 rounded-2xl bg-red-950/35 border border-red-400/45 backdrop-blur-[2px] active:bg-red-500 active:text-white text-red-100 text-[11px] font-extrabold touch-none select-none shadow-lg flex items-center justify-center"
            >
              {isReverse || speedRounded <= 2 ? '減速/R' : '減速'}
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                onTouchInput({ throttle: true });
              }}
              onPointerUp={() => onTouchInput({ throttle: false })}
              onPointerCancel={() => onTouchInput({ throttle: false })}
              className="w-18 h-16 portrait:w-20 portrait:h-22 rounded-2xl bg-emerald-950/40 border border-emerald-400/55 backdrop-blur-[2px] active:bg-emerald-400 active:text-slate-950 text-emerald-50 text-sm font-extrabold touch-none select-none shadow-lg flex items-center justify-center"
            >
              加速
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2 sm:p-5 [@media(max-height:540px)]:p-1.5 pt-safe pb-safe px-safe">
      {/* TOP STACK: Top Bar Row + In-Flow Banner Below (zero overlap!) */}
      <div className="flex flex-col gap-1.5 sm:gap-2">
        {/* TOP BAR ROW */}
        <div className="flex items-start justify-between gap-1.5 sm:gap-4">
          {/* Top-Left: Shin-Tomei Route Sign + Approaching SA/IC Turnoff Guidance */}
          <div className="flex flex-col gap-1.5 sm:gap-2 min-w-0 flex-1 sm:flex-initial">
            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-3 bg-[#090f1a]/90 border border-slate-700/80 rounded-xl px-2 py-1 sm:px-3.5 sm:py-2.5 [@media(max-height:540px)]:px-2 [@media(max-height:540px)]:py-1 shadow-lg w-fit max-w-full">
              <div className="w-8 h-8 sm:w-11 sm:h-11 [@media(max-height:540px)]:w-8 [@media(max-height:540px)]:h-8 rounded-full bg-white border-[2.5px] sm:border-[3.5px] border-[#d91c2b] flex flex-col items-center justify-center shrink-0">
                <span className="font-display-telemetry font-bold text-[11px] sm:text-sm [@media(max-height:540px)]:text-[11px] leading-none text-slate-900">
                  300
                </span>
                <span className="text-[7px] font-bold text-slate-600 leading-none hidden sm:block [@media(max-height:540px)]:hidden">
                  km/h
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-emerald-300 font-semibold">
                  <span className="px-1 sm:px-1.5 py-0.5 rounded bg-[#006b3f] text-white font-display-telemetry text-[9px] sm:text-[11px] border border-emerald-300/40 shrink-0">
                    E1A
                  </span>
                  <span className="truncate max-w-[118px] sm:max-w-[230px] md:max-w-none">
                    {telemetry.currentRegionName}
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-[9px] sm:text-xs text-slate-300 mt-0.5 sm:mt-1 tabular-nums truncate">
                  <span className="truncate">
                    {weatherMode === WeatherMode.Live && liveWeather
                      ? `現実:${liveWeather.weatherLabelJa} ${Math.round(liveWeather.temperatureC)}℃`
                      : weatherCfg.shortJa}
                  </span>
                  <span aria-hidden="true" className="text-slate-500">·</span>
                  <span>KP {telemetry.kilometerPost.toFixed(1)}</span>
                  {telemetry.inTunnel && (
                    <>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <span className="text-amber-300 font-medium">トンネル</span>
                    </>
                  )}
                </div>
              </div>
            </div>

          {/* High-Visibility Approaching SA / PA / IC / JCT / Parking Navigation Card */}
          {isRunning &&
            (telemetry.inSaApron ||
              telemetry.inFreePlaza ||
              telemetry.inMergeLane ||
              telemetry.inIcRamp ||
              telemetry.inJctRamp ||
              telemetry.inJctBranch ||
              telemetry.isParked ||
              telemetry.inParkingBay ||
              telemetry.nextMilestoneDistM < 650) && (
              <div
                className={`pointer-events-auto rounded-xl px-3 py-2 [@media(max-height:540px)]:px-2.5 [@media(max-height:540px)]:py-1 border-2 shadow-xl max-w-xs [@media(max-height:540px)]:max-w-[260px] tabular-nums ${
                  telemetry.isParked || telemetry.inParkingBay
                    ? 'bg-[#05291c]/95 border-emerald-400 text-white'
                    : telemetry.inMergeLane
                      ? 'bg-[#211805]/95 border-amber-400 text-white'
                      : telemetry.inJctBranch || telemetry.inJctRamp || telemetry.nextMilestoneType === 'jct'
                        ? 'bg-[#072636]/95 border-cyan-400 text-white'
                        : telemetry.inIcRamp || telemetry.nextMilestoneType === 'ic'
                          ? 'bg-[#062e1e]/95 border-amber-400 text-white'
                          : telemetry.activeFacilityKind === 'pa' || telemetry.nextMilestoneType === 'pa'
                            ? 'bg-[#06292e]/95 border-teal-400 text-white'
                            : 'bg-[#08243d]/95 border-sky-400 text-white'
                }`}
              >
                <div className="text-[10px] sm:text-[11px] font-bold tracking-wide text-amber-300">
                  {telemetry.isParked
                    ? '駐車完了 [P]（アクセルで前進 · 減速長押しでバックR）'
                    : telemetry.inParkingBay
                      ? '空き駐車枠 [P] 内！（減速して停車すると駐車完了 +800pts）'
                      : telemetry.inJctBranch
                        ? `JCT連絡道 5.0km 走行中（終点まで あと ${(telemetry.jctBranchRemainingM / 1000).toFixed(2)}km）`
                        : telemetry.inMergeLane
                          ? '加速車線走行中（十分に加速して右の本線へ合流 ↗）'
                          : telemetry.inFreePlaza
                            ? `${telemetry.activeFacilityKind === 'pa' ? 'PA' : 'SA'} 構内自由走行（前後左右＆Rで駐車 / 出口↑へ）`
                            : telemetry.inSaApron
                              ? `${telemetry.activeFacilityKind === 'pa' ? 'PA' : 'SA'} 構内（緑枠[P]で駐車 / 前方出口ゲートへ）`
                              : telemetry.inJctRamp
                                ? 'JCT高架分岐ランプ走行中（直進で5.0km連絡道へ！）'
                                : telemetry.inIcRamp
                                  ? 'IC 出口ランプ進入中（4レーン料金所通過でゴール！）'
                                  : telemetry.nextMilestoneType === 'jct'
                                    ? `↙ あと ${Math.max(10, Math.round(telemetry.nextMilestoneDistM / 10) * 10)}m で JCT分岐（5km走行可）`
                                    : telemetry.nextMilestoneType === 'ic'
                                      ? `↙ あと ${Math.max(10, Math.round(telemetry.nextMilestoneDistM / 10) * 10)}m で IC出口（ゴール可）`
                                      : telemetry.nextMilestoneType === 'pa'
                                        ? `↙ あと ${Math.max(10, Math.round(telemetry.nextMilestoneDistM / 10) * 10)}m で PA入口`
                                        : `↙ あと ${Math.max(10, Math.round(telemetry.nextMilestoneDistM / 10) * 10)}m で SA入口`}
                </div>
                <div className="text-xs sm:text-sm font-bold mt-0.5 flex items-center justify-between gap-2">
                  <span>{telemetry.nextMilestoneName}</span>
                  {telemetry.isParked ? (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-400 text-slate-950 text-[10px] font-extrabold shrink-0">
                      駐車中 P
                    </span>
                  ) : telemetry.inJctBranch && onExitJctBranch ? (
                    <button
                      type="button"
                      onClick={onExitJctBranch}
                      className="px-2 py-0.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[10px] font-extrabold shrink-0 whitespace-nowrap"
                    >
                      本線に戻る
                    </button>
                  ) : telemetry.inMergeLane ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold shrink-0">
                      合流注意 ↗
                    </span>
                  ) : telemetry.inJctRamp ? (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-400 text-slate-950 text-[10px] font-extrabold shrink-0">
                      高架分岐
                    </span>
                  ) : !telemetry.inSaApron && !telemetry.inFreePlaza && !telemetry.inIcRamp ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold shrink-0">
                      左車線へ
                    </span>
                  ) : null}
                </div>
                {telemetry.inJctBranch && (
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-150"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((5000 - telemetry.jctBranchRemainingM) / 5000) * 100))}%`,
                      }}
                    />
                  </div>
                )}
                {telemetry.nextMilestoneFeature && (
                  <div className="text-[11px] text-slate-200/90 mt-1 leading-snug [@media(max-height:540px)]:hidden">
                    {telemetry.nextMilestoneFeature}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Top-Right: Telemetry Score + Actions */}
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-3 bg-[#090f1a]/90 border border-slate-700/80 rounded-xl px-1.5 py-1 sm:px-3.5 sm:py-2.5 [@media(max-height:540px)]:py-1 shadow-lg shrink-0">
            <div className="text-right tabular-nums hidden lg:block">
              <div className="text-xs text-slate-400">
                走行 {telemetry.distanceKm.toFixed(2)} km
                <span className="mx-1.5 text-slate-600">·</span>
                追越 {telemetry.overtakeCount}台
              </div>
              <div className="font-display-telemetry font-bold text-base text-white">
                {telemetry.score.toLocaleString()} <span className="text-xs font-normal text-slate-400">pts</span>
                {telemetry.nearMissStreak > 1 && (
                  <span className="ml-2 text-xs text-amber-400">×{telemetry.nearMissStreak} ニアミス</span>
                )}
              </div>
            </div>

            <div className="hidden lg:block h-7 w-px bg-slate-700/80" />

            <div className="flex items-center gap-1 sm:gap-1.5">
              {!isMobile && (
                <button
                  type="button"
                  onClick={onShowLegalGuide}
                  title="現実の法定速度ガイド"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium transition-colors whitespace-nowrap"
                >
                  法定速度案内
                </button>
              )}
              {isMobile && (
                <>
                  <button
                    type="button"
                    onClick={onToggleCinemaHud}
                    title="全画面・爆走モード"
                    aria-label="全画面・爆走モード"
                    className="min-w-[34px] min-h-[34px] sm:min-w-[38px] sm:min-h-[38px] px-1.5 sm:px-2 py-1 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 active:brightness-110 text-white text-[11px] sm:text-xs font-extrabold flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    <Flame className="w-3.5 h-3.5 shrink-0" />
                    <span>爆走</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectCamera(nextCameraMode())}
                    title="視点切替"
                    aria-label="視点切替"
                    className="min-w-[34px] min-h-[34px] sm:min-w-[38px] sm:min-h-[38px] p-1 sm:p-1.5 rounded-lg bg-slate-800 active:bg-sky-600 text-slate-100 flex items-center justify-center transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleGyro}
                    title="傾きハンドル (ジャイロ)"
                    aria-label="傾きハンドル切替"
                    className={`min-w-[34px] min-h-[34px] sm:min-w-[38px] sm:min-h-[38px] px-1.5 sm:px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors whitespace-nowrap ${
                      gyroEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <Compass className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">傾き</span>
                  </button>
                </>
              )}
              {!isMobile && (
                <>
                  <button
                    type="button"
                    onClick={onToggleCinemaHud}
                    title="HUDを消して鑑賞モード (U)"
                    aria-label="HUDを消して鑑賞モード"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleFullscreen}
                    title={isFullscreen ? '全画面解除 (F)' : '全画面表示 (F)'}
                    aria-label={isFullscreen ? '全画面解除' : '全画面表示'}
                    className="p-2 rounded-lg bg-sky-700/80 hover:bg-sky-600 text-white transition-colors"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onToggleMute}
                title={muted ? '音声オン' : 'ミュート'}
                aria-label={muted ? '音声オン' : 'ミュート'}
                className="min-w-[34px] min-h-[34px] sm:min-w-[40px] sm:min-h-[40px] p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              {!isMobile && (
                <button
                  type="button"
                  onClick={onRestart}
                  title="リスタート"
                  aria-label="リスタート"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onPause}
                title="メニュー / 設定"
                aria-label="メニュー / 設定"
                className="min-w-[34px] min-h-[34px] sm:min-w-[40px] sm:min-h-[40px] p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* In-Flow Top-Center Road Guidance & Legal-Speed Notice (never overlaps top bar!) */}
        {isRunning && banner && (
          <div
            className={`mx-auto w-[min(94vw,430px)] [@media(max-height:540px)]:w-[min(82vw,420px)] flex items-start gap-2 rounded-xl px-3 py-1.5 [@media(max-height:540px)]:px-2.5 [@media(max-height:540px)]:py-1 border shadow-xl pointer-events-none ${
              banner.tone === 'warning'
                ? 'bg-[#2a0f12]/92 border-red-400/90 text-red-50'
                : banner.tone === 'humor'
                  ? 'bg-[#241a08]/92 border-amber-400/90 text-amber-50'
                  : 'bg-[#072133]/92 border-emerald-400/90 text-slate-50'
            }`}
          >
            {banner.tone === 'humor' || banner.tone === 'warning' ? (
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300 shrink-0 mt-0.5" />
            )}
            <div className="leading-snug min-w-0">
              <div className="font-bold text-[11px] sm:text-xs tracking-tight truncate">{banner.title}</div>
              <div className="text-[10px] sm:text-[11px] text-slate-200 mt-0.5 line-clamp-2 [@media(max-height:540px)]:line-clamp-1">
                {banner.body}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM AREA */}
      {isMobile ? (
        <div className="relative flex items-end justify-between gap-2 pb-0.5">
          {/* Mobile Bottom-Left: Ergonomic Steering Pads */}
          <div className="pointer-events-auto flex flex-col gap-1.5">
            {isRunning && (
              <div className="flex items-center gap-2 touch-none select-none">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    onTouchInput({ left: true });
                  }}
                  onPointerUp={() => onTouchInput({ left: false })}
                  onPointerCancel={() => onTouchInput({ left: false })}
                  aria-label="左へステア"
                  className="w-16 h-16 landscape:w-16 landscape:h-13 rounded-2xl bg-[#0b1322]/85 border-2 border-slate-600/80 active:border-amber-400 active:bg-amber-500 active:text-slate-950 text-white font-bold text-2xl shadow-xl touch-none select-none flex items-center justify-center"
                >
                  ←
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    onTouchInput({ right: true });
                  }}
                  onPointerUp={() => onTouchInput({ right: false })}
                  onPointerCancel={() => onTouchInput({ right: false })}
                  aria-label="右へステア"
                  className="w-16 h-16 landscape:w-16 landscape:h-13 rounded-2xl bg-[#0b1322]/85 border-2 border-slate-600/80 active:border-amber-400 active:bg-amber-500 active:text-slate-950 text-white font-bold text-2xl shadow-xl touch-none select-none flex items-center justify-center"
                >
                  →
                </button>
              </div>
            )}
            <div className="text-[10px] text-slate-300 bg-[#090f1a]/82 border border-slate-800 rounded-lg px-2 py-0.5 w-fit tabular-nums landscape:hidden">
              {gyroEnabled ? '傾きステア ON · 走行 ' : '走行 '}
              {telemetry.distanceKm.toFixed(1)} km · {telemetry.score.toLocaleString()} pts
            </div>
          </div>

          {/* Mobile Landscape Bottom-Center: Sleek Single-Line Speedometer Bar (never stacks over pedals!) */}
          <div className="hidden landscape:flex items-baseline gap-3 bg-[#090f1a]/84 border border-slate-700/80 rounded-xl px-3.5 py-1.5 shadow-xl tabular-nums mb-0.5">
            <div className="flex items-baseline gap-1">
              <span
                className={`font-display-telemetry font-bold text-2xl leading-none ${
                  isReverse
                    ? 'text-rose-400'
                    : telemetry.isSpeedLimited
                      ? 'text-amber-400'
                      : speedRounded >= 240
                        ? 'text-sky-300'
                        : 'text-white'
                }`}
              >
                {speedRounded}
              </span>
              <span className="text-[10px] text-slate-400">km/h</span>
            </div>
            <div
              className={`font-display-telemetry font-bold text-sm ${
                telemetry.isParked ? 'text-emerald-400' : isReverse ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              {gearBadgeLabel}
            </div>
            <div className="text-[10px] text-slate-300 border-l border-slate-700 pl-2.5">
              {telemetry.distanceKm.toFixed(1)}km · {telemetry.score.toLocaleString()}pts
            </div>
          </div>

          {/* Mobile Bottom-Right: Portrait Speedometer + Flash + Brake/Throttle Pedals */}
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="landscape:hidden bg-[#090f1a]/88 border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-xl flex items-baseline gap-3">
              <div className="flex items-baseline gap-1">
                <span
                  className={`font-display-telemetry font-bold text-3xl leading-none tabular-nums ${
                    isReverse
                      ? 'text-rose-400'
                      : telemetry.isSpeedLimited
                        ? 'text-amber-400'
                        : speedRounded >= 240
                          ? 'text-sky-300'
                          : 'text-white'
                  }`}
                >
                  {speedRounded}
                </span>
                <span className="text-[10px] text-slate-400">km/h</span>
              </div>
              <div className="text-right leading-none">
                <span className="text-[9px] text-slate-400 mr-1">GEAR</span>
                <span
                  className={`font-display-telemetry font-bold text-lg ${
                    telemetry.isParked ? 'text-emerald-400' : isReverse ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {gearDisplay}
                </span>
              </div>
            </div>

            {isRunning && (
              <div className="flex items-end gap-2 touch-none select-none">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    onTouchInput({ hornOrFlash: true });
                  }}
                  onPointerUp={() => onTouchInput({ hornOrFlash: false })}
                  onPointerCancel={() => onTouchInput({ hornOrFlash: false })}
                  aria-label="パッシング"
                  className="w-11 h-14 landscape:w-11 landscape:h-12 rounded-xl bg-sky-950/85 border border-sky-400/50 active:bg-sky-400 active:text-slate-950 text-sky-200 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold touch-none select-none shadow-lg"
                >
                  <Zap className="w-4 h-4" />
                  <span>合図</span>
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    onTouchInput({ brake: true });
                  }}
                  onPointerUp={() => onTouchInput({ brake: false })}
                  onPointerCancel={() => onTouchInput({ brake: false })}
                  className="w-16 h-16 landscape:w-16 landscape:h-13 rounded-2xl bg-red-950/85 border-2 border-red-400/70 active:bg-red-500 active:text-white text-red-100 text-[11px] font-extrabold touch-none select-none shadow-xl flex items-center justify-center"
                >
                  {isReverse || speedRounded <= 2 ? '減速/R' : '減速'}
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    onTouchInput({ throttle: true });
                  }}
                  onPointerUp={() => onTouchInput({ throttle: false })}
                  onPointerCancel={() => onTouchInput({ throttle: false })}
                  className="w-20 h-24 landscape:w-20 landscape:h-15 rounded-2xl bg-emerald-900/88 border-2 border-emerald-400/80 active:bg-emerald-400 active:text-slate-950 text-emerald-50 text-sm font-extrabold touch-none select-none shadow-xl flex items-center justify-center"
                >
                  加速
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative flex items-end justify-between gap-4">
          {/* Bottom-Left: Touch Controls Toggle & Legal Reminder Micro-Line */}
          <div className="pointer-events-auto flex flex-col gap-2">
            {showMobileControls && isRunning && (
              <div className="flex items-center gap-2 bg-[#090f1a]/90 border border-slate-700/80 rounded-xl p-2 touch-none">
                <button
                  type="button"
                  onPointerDown={() => onTouchInput({ left: true })}
                  onPointerUp={() => onTouchInput({ left: false })}
                  onPointerLeave={() => onTouchInput({ left: false })}
                  className="w-12 h-12 rounded-lg bg-slate-800 active:bg-amber-500 active:text-slate-950 font-bold text-lg"
                >
                  ←
                </button>
                <button
                  type="button"
                  onPointerDown={() => onTouchInput({ right: true })}
                  onPointerUp={() => onTouchInput({ right: false })}
                  onPointerLeave={() => onTouchInput({ right: false })}
                  className="w-12 h-12 rounded-lg bg-slate-800 active:bg-amber-500 active:text-slate-950 font-bold text-lg"
                >
                  →
                </button>
                <button
                  type="button"
                  onPointerDown={() => onTouchInput({ brake: true })}
                  onPointerUp={() => onTouchInput({ brake: false })}
                  onPointerLeave={() => onTouchInput({ brake: false })}
                  className="px-3 h-12 rounded-lg bg-red-900/70 active:bg-red-500 text-xs font-bold"
                >
                  減速
                </button>
                <button
                  type="button"
                  onPointerDown={() => onTouchInput({ throttle: true })}
                  onPointerUp={() => onTouchInput({ throttle: false })}
                  onPointerLeave={() => onTouchInput({ throttle: false })}
                  className="px-4 h-12 rounded-lg bg-emerald-700/80 active:bg-emerald-500 text-xs font-bold"
                >
                  加速
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-slate-300 bg-[#090f1a]/82 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <span>現実では法定速度（原則100km/h・指定区間120km/h）遵守</span>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => setShowMobileControls((v) => !v)}
                className="text-sky-300 hover:text-sky-200 underline"
              >
                {showMobileControls ? '画面ボタン隠す' : '画面操作ボタン'}
              </button>
            </div>
          </div>

          {/* Bottom-Center: Collapsible Unified Control Dock */}
          <div className="pointer-events-auto fixed bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[94vw]">
            <button
              type="button"
              onClick={onToggleDock}
              className="px-3 py-1 rounded-t-lg bg-[#0c1322]/92 border border-b-0 border-slate-700/80 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{dockCollapsed ? 'コントロールを開く (H)' : 'コントロールを隠す (H)'}</span>
            </button>

            {!dockCollapsed && (
              <div className="bg-[#090f1a]/92 border border-slate-700/80 rounded-xl px-3.5 py-2.5 shadow-2xl flex flex-wrap items-center justify-center gap-2.5">
                {/* Quality Mode */}
                <div className="flex items-center gap-1 bg-[#05080f] p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => onSelectQuality(QualityMode.Ultra)}
                    className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap ${
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
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      qualityMode === QualityMode.Standard
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    標準
                  </button>
                </div>

                {/* Weather Preset */}
                <div className="flex items-center gap-1 bg-[#05080f] p-1 rounded-lg border border-slate-800">
                  {[
                    { mode: WeatherMode.Auto, label: '自動' },
                    { mode: WeatherMode.Live, label: '現実' },
                    { mode: WeatherMode.Clear, label: '晴' },
                    { mode: WeatherMode.Sunset, label: '夕' },
                    { mode: WeatherMode.Night, label: '夜' },
                    { mode: WeatherMode.Rain, label: '雨' },
                    { mode: WeatherMode.Fog, label: '霧' },
                  ].map((item) => (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => onSelectWeather(item.mode)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                        weatherMode === item.mode
                          ? item.mode === WeatherMode.Live
                            ? 'bg-sky-600 text-white'
                            : 'bg-emerald-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {item.mode === WeatherMode.Live && <CloudSun className="w-3 h-3 shrink-0" />}
                      <span>{item.label}</span>
                    </button>
                  ))}
                  {weatherMode === WeatherMode.Live && (
                    <button
                      type="button"
                      onClick={onSyncGeoWeather}
                      disabled={liveWeatherLoading}
                      title="現在地の天気に合わせる"
                      className="px-1.5 py-1 rounded bg-sky-800/90 hover:bg-sky-700 disabled:opacity-50 text-sky-100 text-[11px] font-medium flex items-center gap-0.5 transition-colors whitespace-nowrap"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>現在地</span>
                    </button>
                  )}
                </div>

                {/* Camera Mode */}
                <div className="flex items-center gap-1 bg-[#05080f] p-1 rounded-lg border border-slate-800">
                  <Camera className="w-3.5 h-3.5 text-slate-400 mx-1" />
                  {[
                    { mode: CameraMode.Chase, label: '後方' },
                    { mode: CameraMode.Hood, label: 'ボンネット' },
                    { mode: CameraMode.Bumper, label: 'バンパー' },
                  ].map((item) => (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => onSelectCamera(item.mode)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                        cameraMode === item.mode
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Traffic Density */}
                <div className="flex items-center gap-1 bg-[#05080f] p-1 rounded-lg border border-slate-800">
                  {[
                    { d: TrafficDensity.Light, label: '少' },
                    { d: TrafficDensity.Realistic, label: '現実' },
                    { d: TrafficDensity.Heavy, label: '混' },
                  ].map((item) => (
                    <button
                      key={item.d}
                      type="button"
                      onClick={() => onSelectTraffic(item.d)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                        trafficDensity === item.d
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      交通:{item.label}
                    </button>
                  ))}
                </div>

                {/* Car Paint Swatches */}
                <div className="flex items-center gap-1.5 pl-1">
                  {(Object.keys(CAR_PAINTS) as CarPaintId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectPaint(id)}
                      title={CAR_PAINTS[id].nameJa}
                      aria-label={CAR_PAINTS[id].nameJa}
                      className={`w-5 h-5 rounded-full border transition-transform ${
                        paint === id ? 'border-white scale-115 ring-2 ring-amber-400/70' : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: CAR_PAINTS[id].swatch }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom-Right: GT Digital-Analog Speedometer Cluster */}
          <div className="pointer-events-auto bg-[#090f1a]/90 border border-slate-700/80 rounded-2xl px-4 py-3 shadow-2xl min-w-[205px]">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`font-display-telemetry font-bold text-4xl sm:text-5xl leading-none tabular-nums ${
                    isReverse
                      ? 'text-rose-400'
                      : telemetry.isSpeedLimited
                        ? 'text-amber-400'
                        : speedRounded >= 240
                          ? 'text-sky-300'
                          : 'text-white'
                  }`}
                >
                  {speedRounded}
                </span>
                <span className="text-xs font-medium text-slate-400">km/h</span>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-slate-400">GEAR</div>
                <div
                  className={`font-display-telemetry font-bold text-2xl leading-none ${
                    telemetry.isParked ? 'text-emerald-400' : isReverse ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {gearDisplay}
                </div>
              </div>
            </div>

            <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  isReverse ? 'bg-rose-400' : telemetry.isSpeedLimited ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ width: `${speedPct}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
              <span>{isEv ? `MOTOR ${Math.round(telemetry.rpm)}` : `RPM ${Math.round(telemetry.rpm)}`}</span>
              <span>
                {isEv ? 'EV' : isBike ? 'BIKE' : 'GT'} · 最高 {Math.round(telemetry.maxSpeedKmh)} km/h
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded bg-slate-800 overflow-hidden flex">
              <div
                className={`h-full transition-all duration-75 ${
                  isEv
                    ? 'bg-cyan-400'
                    : rpmPct > 86
                      ? 'bg-red-500'
                      : rpmPct > 65
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                }`}
                style={{ width: `${rpmPct}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums">
              <span className={gripPct < 80 ? 'text-amber-300 font-medium' : 'text-slate-300'}>
                路面グリップ {gripPct}%
              </span>
              <div className="flex items-center gap-2 font-bold">
                {telemetry.isParked && <span className="text-emerald-400">PARKED</span>}
                {isReverse && <span className="text-rose-400">REVERSE</span>}
                {telemetry.slipstreamActive && <span className="text-cyan-300">SLIPSTREAM</span>}
                {telemetry.absActive && <span className="text-red-400">ABS</span>}
                {telemetry.isSpeedLimited && <span className="text-amber-400">300 LIMIT</span>}
                {!telemetry.isParked &&
                  !isReverse &&
                  !telemetry.slipstreamActive &&
                  !telemetry.absActive &&
                  !telemetry.isSpeedLimited && (
                    <span className="text-slate-500 font-normal">
                      {telemetry.activeWeather === ActiveWeather.Rain ? 'ウェット注意' : 'ドライ安定'}
                    </span>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
