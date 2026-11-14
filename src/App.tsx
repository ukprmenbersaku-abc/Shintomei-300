import { useCallback, useEffect, useRef, useState } from 'react';
import { HudOverlay } from './components/HudOverlay';
import { IcClearModal } from './components/IcClearModal';
import { LegalGuideModal } from './components/LegalGuideModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { StartModal } from './components/StartModal';
import { TitleScreen } from './components/TitleScreen';
import { HighwayEngine } from './game/HighwayEngine';
import { WEATHER_CONFIG } from './game/constants';
import { fetchRealWeather } from './game/liveWeather';
import {
  ActiveWeather,
  CameraMode,
  CarPaintId,
  DeviceMode,
  IcClearSummary,
  InputState,
  LiveWeatherInfo,
  QualityMode,
  SafetyBannerMessage,
  TelemetrySnapshot,
  TrafficDensity,
  VehicleType,
  WeatherMode,
} from './types/game';

function detectRecommendedDevice(): DeviceMode {
  if (typeof window === 'undefined') return 'pc';
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const touch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  const minEdge = Math.min(window.innerWidth, window.innerHeight);
  return (coarse && minEdge < 650) || (touch && minEdge < 560) ? 'mobile' : 'pc';
}

async function requestAppFullscreen(lockLandscape: boolean): Promise<void> {
  try {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    }
  } catch {
    // Ignore iframe / iOS Safari fullscreen restrictions; blazing HUD-free view still activates
  }
  if (lockLandscape) {
    try {
      const orientation = window.screen?.orientation as ScreenOrientation & {
        lock?: (type: 'landscape' | 'portrait') => Promise<void>;
      };
      await orientation?.lock?.('landscape');
    } catch {
      // Orientation lock requires supported fullscreen PWA/Chrome; fail silently on iOS Safari
    }
  }
}

async function releaseAppFullscreen(): Promise<void> {
  try {
    const orientation = window.screen?.orientation as ScreenOrientation & {
      unlock?: () => void;
    };
    orientation?.unlock?.();
  } catch {
    // Ignore unsupported unlock
  }
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch {
    // Ignore iframe restrictions
  }
}

const INITIAL_TELEMETRY: TelemetrySnapshot = {
  vehicleType: 'car',
  speedKmh: 120,
  rpm: 4100,
  gear: 4,
  throttle: 0,
  brake: 0,
  steerAngle: 0,
  gripLevel: 1.05,
  slipstreamActive: false,
  inTunnel: false,
  activeWeather: ActiveWeather.Clear,
  weatherProgress: 0,
  distanceKm: 0,
  maxSpeedKmh: 120,
  overtakeCount: 0,
  nearMissCount: 0,
  nearMissStreak: 0,
  score: 0,
  kilometerPost: 12.9,
  currentRegionName: '次の 伊勢原JCT まで 0.9km',
  isSpeedLimited: false,
  isBrakingHard: false,
  absActive: false,
  headlightsOn: false,
  passingFlashActive: false,
  nextMilestoneName: '伊勢原JCT',
  nextMilestoneType: 'jct',
  nextMilestoneDistM: 860,
  nextMilestoneFeature: '東名接続高架ジャンクション',
  inSaApron: false,
  inFreePlaza: false,
  activeFacilityKind: null,
  inMergeLane: false,
  inIcRamp: false,
  inJctRamp: false,
  inJctBranch: false,
  jctBranchRemainingM: 0,
  inParkingBay: false,
  isParked: false,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HighwayEngine | null>(null);

  const [recommendedDevice] = useState<DeviceMode>(detectRecommendedDevice);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>(recommendedDevice);
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [showTitle, setShowTitle] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasStartedOnce, setHasStartedOnce] = useState(false);
  const [showLegalGuide, setShowLegalGuide] = useState(false);
  const [icClearSummary, setIcClearSummary] = useState<IcClearSummary | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [webglUnsupported, setWebglUnsupported] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);

  const [weatherMode, setWeatherMode] = useState<WeatherMode>(WeatherMode.Auto);
  const [liveWeather, setLiveWeather] = useState<LiveWeatherInfo | null>(null);
  const [liveWeatherLoading, setLiveWeatherLoading] = useState(false);
  const [livePreferGeo, setLivePreferGeo] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(CameraMode.Chase);
  const [trafficDensity, setTrafficDensity] = useState<TrafficDensity>(TrafficDensity.Realistic);
  const [qualityMode, setQualityMode] = useState<QualityMode>(QualityMode.Ultra);
  const [paint, setPaint] = useState<CarPaintId>(CarPaintId.ChampionshipWhite);
  const [muted, setMuted] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cinemaHudHidden, setCinemaHudHidden] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(INITIAL_TELEMETRY);
  const [banner, setBanner] = useState<SafetyBannerMessage | null>({
    id: 0,
    title: '【新東名 300km/h 特例区間】',
    body: '他車は現実の高速基準（乗用車100〜120km/h・大型貨物90km/h）で走行中。現実では法定速度を守りましょう！',
    tone: 'info',
  });

  const bannerTimeoutRef = useRef<number | null>(null);

  const pushBanner = useCallback((msg: SafetyBannerMessage) => {
    setBanner(msg);
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = window.setTimeout(() => {
      setBanner((cur) => (cur?.id === msg.id ? null : cur));
    }, 7000);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const probeCanvas = document.createElement('canvas');
    const gl2 = probeCanvas.getContext('webgl2');
    if (!gl2) {
      setWebglUnsupported(true);
      return;
    }

    let engine: HighwayEngine;
    try {
      engine = new HighwayEngine(container, {
        onTelemetry: (snap) => setTelemetry(snap),
        onSafetyBanner: pushBanner,
        onIcExitClear: (summary) => setIcClearSummary(summary),
        onContextLost: () => setContextLost(true),
      });
    } catch {
      setWebglUnsupported(true);
      return;
    }

    engine.setDeviceMode(recommendedDevice);
    engine.setAttractMode(true);
    engineRef.current = engine;

    return () => {
      if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, [pushBanner, recommendedDevice]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await requestAppFullscreen(deviceMode === 'mobile');
    } else {
      await releaseAppFullscreen();
    }
  }, [deviceMode]);

  const clearInputs = useCallback(() => {
    engineRef.current?.setAnalogSteer(null);
    engineRef.current?.setInput({
      throttle: false,
      brake: false,
      left: false,
      right: false,
      hornOrFlash: false,
    });
  }, []);

  const handleChangeDeviceMode = useCallback(
    (mode: DeviceMode) => {
      setDeviceMode(mode);
      if (mode === 'pc') {
        setGyroEnabled(false);
      }
      engineRef.current?.setAnalogSteer(null);
      engineRef.current?.setDeviceMode(mode);
    },
    [],
  );

  const handleStartFromTitle = useCallback(
    async (mode: DeviceMode, fullscreenUltra = false) => {
      handleChangeDeviceMode(mode);
      engineRef.current?.unlockAudio();
      if (fullscreenUltra) {
        setQualityMode(QualityMode.Ultra);
        engineRef.current?.setQualityMode(QualityMode.Ultra);
        setCinemaHudHidden(true);
        await requestAppFullscreen(mode === 'mobile');
      } else {
        setCinemaHudHidden(false);
      }
      setShowTitle(false);
      setIsModalOpen(false);
      setHasStartedOnce(true);
      engineRef.current?.setAttractMode(false);
      engineRef.current?.setRunning(true);
    },
    [handleChangeDeviceMode],
  );

  const handleOpenGarageFromTitle = useCallback(
    (mode: DeviceMode) => {
      handleChangeDeviceMode(mode);
      setShowTitle(false);
      setIsModalOpen(true);
      engineRef.current?.setAttractMode(true);
      engineRef.current?.setRunning(false);
    },
    [handleChangeDeviceMode],
  );

  const handleReturnToTitle = useCallback(() => {
    engineRef.current?.setRunning(false);
    engineRef.current?.resetRun();
    engineRef.current?.setAttractMode(true);
    clearInputs();
    setHasStartedOnce(false);
    setIcClearSummary(null);
    setIsModalOpen(false);
    setCinemaHudHidden(false);
    void releaseAppFullscreen();
    setShowTitle(true);
  }, [clearInputs]);

  const handleStartOrResume = useCallback(() => {
    engineRef.current?.unlockAudio();
    setIsModalOpen(false);
    setHasStartedOnce(true);
    engineRef.current?.setAttractMode(false);
    engineRef.current?.setRunning(true);
  }, []);

  const handleStartFullscreenUltra = useCallback(async () => {
    engineRef.current?.unlockAudio();
    setQualityMode(QualityMode.Ultra);
    engineRef.current?.setQualityMode(QualityMode.Ultra);
    setCinemaHudHidden(true);
    setIsModalOpen(false);
    setHasStartedOnce(true);
    engineRef.current?.setAttractMode(false);
    engineRef.current?.setRunning(true);
    await requestAppFullscreen(deviceMode === 'mobile');
  }, [deviceMode]);

  const handleToggleCinemaHud = useCallback(async () => {
    if (!cinemaHudHidden) {
      setQualityMode(QualityMode.Ultra);
      engineRef.current?.setQualityMode(QualityMode.Ultra);
      setCinemaHudHidden(true);
      await requestAppFullscreen(deviceMode === 'mobile');
    } else {
      setCinemaHudHidden(false);
      if (deviceMode === 'mobile') {
        await releaseAppFullscreen();
      }
    }
  }, [cinemaHudHidden, deviceMode]);

  const handlePause = useCallback(() => {
    clearInputs();
    setIsModalOpen(true);
    engineRef.current?.setRunning(false);
  }, [clearInputs]);

  const handleRestart = useCallback(() => {
    engineRef.current?.unlockAudio();
    clearInputs();
    engineRef.current?.resetRun();
    engineRef.current?.setAttractMode(false);
    setIcClearSummary(null);
    setIsModalOpen(false);
    setHasStartedOnce(true);
    engineRef.current?.setRunning(true);
  }, [clearInputs]);

  const handleContinueAfterIcClear = useCallback(() => {
    setIcClearSummary(null);
    engineRef.current?.resumeAfterIcClear();
  }, []);

  const handleExitJctBranch = useCallback(() => {
    engineRef.current?.exitJctBranchToMainline();
    setIsModalOpen(false);
    engineRef.current?.setRunning(true);
  }, []);

  const handleSelectVehicleType = useCallback((vt: VehicleType) => {
    setVehicleType(vt);
    engineRef.current?.setVehicleType(vt);
  }, []);

  const syncLiveWeather = useCallback(
    async (preferGeo: boolean, announce: boolean) => {
      setLiveWeatherLoading(true);
      try {
        const info = await fetchRealWeather(preferGeo);
        setLiveWeather(info);
        setLivePreferGeo(info.source === 'geolocation');
        engineRef.current?.setLiveWeatherTarget(info.mappedWeather);
        if (announce) {
          const mappedLabel = WEATHER_CONFIG[info.mappedWeather].shortJa;
          pushBanner({
            id: Date.now(),
            title: `【現実天気連動】${info.locationLabel}：${info.weatherLabelJa} (${Math.round(info.temperatureC)}℃)`,
            body: `現在の実際の天気・時間帯に合わせて「${mappedLabel}」モードを反映しました。`,
            tone: 'info',
          });
        }
      } finally {
        setLiveWeatherLoading(false);
      }
    },
    [pushBanner],
  );

  useEffect(() => {
    if (weatherMode !== WeatherMode.Live) return;
    const timer = window.setInterval(() => {
      void syncLiveWeather(livePreferGeo, false);
    }, 300_000);
    return () => window.clearInterval(timer);
  }, [weatherMode, livePreferGeo, syncLiveWeather]);

  const handleSelectWeather = useCallback(
    (mode: WeatherMode) => {
      setWeatherMode(mode);
      engineRef.current?.setWeatherMode(mode);
      if (mode === WeatherMode.Live) {
        void syncLiveWeather(livePreferGeo, true);
      }
    },
    [livePreferGeo, syncLiveWeather],
  );

  const handleSyncGeoWeather = useCallback(() => {
    setWeatherMode(WeatherMode.Live);
    engineRef.current?.setWeatherMode(WeatherMode.Live);
    void syncLiveWeather(true, true);
  }, [syncLiveWeather]);

  const handleSelectCamera = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
    engineRef.current?.setCameraMode(mode);
  }, []);

  const handleSelectTraffic = useCallback((density: TrafficDensity) => {
    setTrafficDensity(density);
    engineRef.current?.setTrafficDensity(density);
  }, []);

  const handleSelectQuality = useCallback((mode: QualityMode) => {
    setQualityMode(mode);
    engineRef.current?.setQualityMode(mode);
  }, []);

  const handleSelectPaint = useCallback((p: CarPaintId) => {
    setPaint(p);
    engineRef.current?.setCarPaint(p);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleGyro = useCallback(async () => {
    if (gyroEnabled) {
      setGyroEnabled(false);
      engineRef.current?.setAnalogSteer(null);
      return;
    }

    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      pushBanner({
        id: Date.now(),
        title: 'ジャイロセンサー未対応',
        body: 'この端末またはブラウザでは傾きハンドルを利用できません。画面の ← → ボタンで操作できます。',
        tone: 'warning',
      });
      return;
    }

    const orientationEvt = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof orientationEvt.requestPermission === 'function') {
      try {
        const res = await orientationEvt.requestPermission();
        if (res !== 'granted') {
          pushBanner({
            id: Date.now(),
            title: 'モーションセンサーが許可されませんでした',
            body: 'iOSの設定またはページ再読み込みからモーションと画面の向きのアクセスを許可してください。',
            tone: 'warning',
          });
          return;
        }
      } catch {
        pushBanner({
          id: Date.now(),
          title: 'ジャイロセンサーの許可に失敗しました',
          body: '画面左下の ← → タッチボタンでそのまま運転できます。',
          tone: 'warning',
        });
        return;
      }
    }

    setGyroEnabled(true);
    pushBanner({
      id: Date.now(),
      title: '傾きハンドル (ジャイロ) ON',
      body: '端末を左右に傾けてステアリングできます（微振動カット付き）。',
      tone: 'info',
    });
  }, [gyroEnabled, pushBanner]);

  useEffect(() => {
    const active =
      gyroEnabled &&
      deviceMode === 'mobile' &&
      !showTitle &&
      !isModalOpen &&
      !showLegalGuide &&
      !icClearSummary;

    if (!active) {
      engineRef.current?.setAnalogSteer(null);
      return;
    }

    const onOrientation = (e: DeviceOrientationEvent) => {
      const angle = window.screen?.orientation?.angle ?? 0;
      let tiltDeg = 0;
      if (angle === 90) {
        tiltDeg = e.beta ?? 0;
      } else if (angle === -90 || angle === 270) {
        tiltDeg = -(e.beta ?? 0);
      } else if (angle === 180) {
        tiltDeg = -(e.gamma ?? 0);
      } else {
        tiltDeg = e.gamma ?? 0;
      }

      const norm = Math.max(-1, Math.min(1, tiltDeg / 28));
      const deadzone = 0.08;
      let steer = 0;
      if (Math.abs(norm) > deadzone) {
        steer = ((Math.abs(norm) - deadzone) / (1 - deadzone)) * Math.sign(norm);
      }
      engineRef.current?.setAnalogSteer(steer);
    };

    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      engineRef.current?.setAnalogSteer(null);
    };
  }, [gyroEnabled, deviceMode, showTitle, isModalOpen, showLegalGuide, icClearSummary]);

  const handleTouchInput = useCallback((partial: Partial<InputState>) => {
    engineRef.current?.setInput(partial);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat && (e.code === 'KeyC' || e.code === 'KeyH' || e.code === 'KeyF' || e.code === 'KeyU' || e.code === 'Escape')) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          engineRef.current?.setInput({ throttle: true });
          break;
        case 'KeyS':
        case 'ArrowDown':
          engineRef.current?.setInput({ brake: true });
          break;
        case 'KeyA':
        case 'ArrowLeft':
          engineRef.current?.setInput({ left: true });
          break;
        case 'KeyD':
        case 'ArrowRight':
          engineRef.current?.setInput({ right: true });
          break;
        case 'Space':
          e.preventDefault();
          engineRef.current?.setInput({ hornOrFlash: true });
          break;
        case 'KeyC':
          setCameraMode((prev) => {
            const order = [CameraMode.Chase, CameraMode.Hood, CameraMode.Bumper];
            const next = order[(order.indexOf(prev) + 1) % order.length];
            engineRef.current?.setCameraMode(next);
            return next;
          });
          break;
        case 'KeyH':
          setDockCollapsed((prev) => !prev);
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'KeyU':
          setCinemaHudHidden((prev) => !prev);
          break;
        case 'Escape':
          if (icClearSummary) {
            setIcClearSummary(null);
            engineRef.current?.resumeAfterIcClear();
          } else if (showLegalGuide) {
            setShowLegalGuide(false);
          } else if (cinemaHudHidden) {
            setCinemaHudHidden(false);
          } else if (!showTitle && hasStartedOnce) {
            setIsModalOpen((prev) => {
              const next = !prev;
              engineRef.current?.setRunning(!next);
              return next;
            });
          }
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          engineRef.current?.setInput({ throttle: false });
          break;
        case 'KeyS':
        case 'ArrowDown':
          engineRef.current?.setInput({ brake: false });
          break;
        case 'KeyA':
        case 'ArrowLeft':
          engineRef.current?.setInput({ left: false });
          break;
        case 'KeyD':
        case 'ArrowRight':
          engineRef.current?.setInput({ right: false });
          break;
        case 'Space':
          engineRef.current?.setInput({ hornOrFlash: false });
          break;
      }
    };

    const onBlur = () => {
      clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [hasStartedOnce, showTitle, showLegalGuide, icClearSummary, cinemaHudHidden, toggleFullscreen, clearInputs]);

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-[#070b12]">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <OfflineIndicator />

      {(webglUnsupported || contextLost) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b12] text-slate-200 p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#0e1624] border border-slate-700/80 p-6 text-center space-y-3 shadow-2xl">
            <h2 className="text-lg font-bold text-white">
              {webglUnsupported
                ? 'WebGL2非対応のブラウザです'
                : 'WebGL描画コンテキストが中断されました'}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {webglUnsupported
                ? 'この3DハイウェイシミュレーターはWebGL2が必要です。Chrome / Safari / Edge 最新版、またはハードウェアアクセラレーションが有効な環境でご利用ください。'
                : 'ページを再読み込みすると新東名3Dハイウェイが再開されます。'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
            >
              再読み込み
            </button>
          </div>
        </div>
      )}

      {showTitle && !showLegalGuide && (
        <TitleScreen
          recommendedDevice={recommendedDevice}
          vehicleType={vehicleType}
          paint={paint}
          qualityMode={qualityMode}
          weatherMode={weatherMode}
          liveWeather={liveWeather}
          liveWeatherLoading={liveWeatherLoading}
          onSelectVehicleType={handleSelectVehicleType}
          onSelectPaint={handleSelectPaint}
          onSelectQuality={handleSelectQuality}
          onSelectWeather={handleSelectWeather}
          onSyncGeoWeather={handleSyncGeoWeather}
          onStartDevice={handleStartFromTitle}
          onOpenGarage={handleOpenGarageFromTitle}
          onShowLegalGuide={() => setShowLegalGuide(true)}
        />
      )}

      {!showTitle && (
        <HudOverlay
          telemetry={telemetry}
          isRunning={!isModalOpen && !showLegalGuide && !icClearSummary}
          deviceMode={deviceMode}
          gyroEnabled={gyroEnabled}
          banner={banner}
          weatherMode={weatherMode}
          liveWeather={liveWeather}
          liveWeatherLoading={liveWeatherLoading}
          cameraMode={cameraMode}
          trafficDensity={trafficDensity}
          qualityMode={qualityMode}
          paint={paint}
          muted={muted}
          isFullscreen={isFullscreen}
          cinemaHudHidden={cinemaHudHidden}
          dockCollapsed={dockCollapsed}
          onToggleDock={() => setDockCollapsed((v) => !v)}
          onToggleFullscreen={toggleFullscreen}
          onToggleCinemaHud={handleToggleCinemaHud}
          onToggleGyro={handleToggleGyro}
          onSelectWeather={handleSelectWeather}
          onSyncGeoWeather={handleSyncGeoWeather}
          onSelectCamera={handleSelectCamera}
          onSelectTraffic={handleSelectTraffic}
          onSelectQuality={handleSelectQuality}
          onSelectPaint={handleSelectPaint}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRestart={handleRestart}
          onExitJctBranch={handleExitJctBranch}
          onTouchInput={handleTouchInput}
          onShowLegalGuide={() => {
            engineRef.current?.setRunning(false);
            setShowLegalGuide(true);
          }}
        />
      )}

      <StartModal
        isOpen={!showTitle && isModalOpen && !showLegalGuide && !icClearSummary}
        hasStartedOnce={hasStartedOnce}
        deviceMode={deviceMode}
        vehicleType={vehicleType}
        inJctBranch={telemetry.inJctBranch}
        paint={paint}
        weatherMode={weatherMode}
        liveWeather={liveWeather}
        liveWeatherLoading={liveWeatherLoading}
        trafficDensity={trafficDensity}
        qualityMode={qualityMode}
        onChangeDeviceMode={handleChangeDeviceMode}
        onSelectVehicleType={handleSelectVehicleType}
        onSelectPaint={handleSelectPaint}
        onSelectWeather={handleSelectWeather}
        onSyncGeoWeather={handleSyncGeoWeather}
        onSelectTraffic={handleSelectTraffic}
        onSelectQuality={handleSelectQuality}
        onStartOrResume={handleStartOrResume}
        onStartFullscreenUltra={handleStartFullscreenUltra}
        onRestart={handleRestart}
        onReturnToTitle={handleReturnToTitle}
        onExitJctBranch={handleExitJctBranch}
      />

      <IcClearModal
        summary={icClearSummary}
        onContinueMainline={handleContinueAfterIcClear}
        onRestart={handleRestart}
      />

      <LegalGuideModal
        isOpen={showLegalGuide}
        onClose={() => {
          setShowLegalGuide(false);
          if (!showTitle && !isModalOpen && !icClearSummary) {
            engineRef.current?.setRunning(true);
          }
        }}
      />
    </div>
  );
}
