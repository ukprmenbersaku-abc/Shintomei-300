import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  ActiveWeather,
  CameraMode,
  CarPaintId,
  DeviceMode,
  IcClearSummary,
  InputState,
  QualityMode,
  SafetyBannerMessage,
  TelemetrySnapshot,
  TrafficArchetype,
  TrafficDensity,
  VehicleType,
  WeatherMode,
} from '../types/game';
import {
  CAR_PAINTS,
  EXPRESSWAY,
  HUMOROUS_SAFETY_TIPS,
  JCT_BRANCH_LENGTH_M,
  LED_BOARD_MESSAGES,
  ROUTE_START_KM_POST,
  ROUTE_TOTAL_LENGTH_M,
  RouteMilestone,
  TRAFFIC_PRESETS,
  TRAFFIC_SPECS,
  VEHICLE_SPECS,
  WEATHER_CONFIG,
} from './constants';
import { HighwayAudioEngine } from './audio';
import {
  getFacilityProfileAt,
  getJctCurveLength,
  getNextMilestoneAhead,
  getOffMainlineBounds,
  getSurfaceElevationAt,
  getSurfaceSlopeAt,
  HighwayWorld,
  isTunnelAt,
  roadCenterDX,
  roadCenterX,
  roadElevationDY,
  roadElevationY,
  sampleJctOverpassWorld,
} from './highwayWorld';
import {
  createPlayerBike,
  createPlayerCar,
  createPlayerEvCar,
  createTrafficCar,
  PlayerCarRig,
  TrafficCarRig,
} from './models';
import { createProceduralTexturePack, ProceduralTexturePack } from './textures';

interface TrafficVehicle {
  rig: TrafficCarRig;
  archetype: TrafficArchetype;
  s: number;
  laneOffset: number;
  targetLane: number;
  currentLane: number;
  speedMs: number;
  cruiseSpeedMs: number;
  isOncoming: boolean;
  isBraking: boolean;
  blinkerDir: -1 | 0 | 1;
  blinkerWaitTimer: number;
  isYieldLaneChange: boolean;
  laneChangeStartX: number;
  laneChangeProgress: number;
  laneChangeDuration: number;
  laneChangeLatVel: number;
  laneChangeCooldown: number;
  nearMissAwarded: boolean;
  patrolWarned: boolean;
  active: boolean;
}

const AUTO_WEATHER_SEQUENCE: ActiveWeather[] = [
  ActiveWeather.Clear,
  ActiveWeather.Sunset,
  ActiveWeather.Night,
  ActiveWeather.Rain,
  ActiveWeather.Fog,
];

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createDynamicEnvironmentRig(): {
  envScene: THREE.Scene;
  envMat: THREE.ShaderMaterial;
  envGeo: THREE.SphereGeometry;
} {
  const envScene = new THREE.Scene();

  // Procedural sky-to-tunnel-to-wet-asphalt sphere for real-time clearcoat lacquer reflections
  const envGeo = new THREE.SphereGeometry(50, 28, 18);
  const envMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uZenithColor: { value: new THREE.Color(0x1e5aa8) },
      uHorizonColor: { value: new THREE.Color(0xb6dcf7) },
      uSunColor: { value: new THREE.Color(0xfff3de) },
      uSunDir: { value: new THREE.Vector3(0.22, 0.58, -0.88).normalize() },
      uLampIntensity: { value: 0.0 },
      uTunnelBlend: { value: 0.0 },
      uRainAmount: { value: 0.0 },
      uScrollPhase: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uLampIntensity;
      uniform float uTunnelBlend;
      uniform float uRainAmount;
      uniform float uScrollPhase;
      varying vec3 vDir;

      void main() {
        vec3 dir = normalize(vDir);
        float y = dir.y;
        vec3 groundCol = mix(vec3(0.08, 0.1, 0.13), vec3(0.16, 0.2, 0.26), uRainAmount * 0.65);

        vec3 outdoorCol = y >= 0.0
          ? mix(uHorizonColor, uZenithColor, pow(y, 0.54))
          : mix(uHorizonColor * (0.42 + uRainAmount * 0.22), groundCol, smoothstep(0.0, -0.35, y));

        // Sun highlight disc & sky scatter
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        outdoorCol += uSunColor * (pow(sunDot, 26.0) * 1.45 + pow(sunDot, 6.0) * 0.25) * (1.0 - uRainAmount * 0.65);

        // Rolling overhead highway streetlamp reflection streaks at Sunset/Night/Rain
        if (uLampIntensity > 0.02 && y > 0.04) {
          float lampWave = sin(dir.z * 8.5 + uScrollPhase * 6.28318);
          float lampStreak = smoothstep(0.88, 0.99, lampWave) * smoothstep(0.08, 0.45, y) * smoothstep(0.88, 0.35, y);
          float centerMask = smoothstep(0.75, 0.05, abs(dir.x));
          outdoorCol += vec3(1.0, 0.84, 0.58) * lampStreak * centerMask * uLampIntensity * 2.1;
        }

        // Wet-road taillight/headlight reflection shimmer in lower hemisphere
        if (uRainAmount > 0.1 && y < 0.0) {
          float wetGlow = smoothstep(-0.32, -0.02, y);
          outdoorCol += mix(uHorizonColor, vec3(0.95, 0.35, 0.25), 0.25) * wetGlow * uRainAmount * 0.45;
        }

        // Warm sodium-lit tunnel ceiling light strips & concrete arch wall reflection
        vec3 tunnelCol = vec3(0.06, 0.055, 0.05);
        float tunnelStripZ = smoothstep(0.45, 0.95, sin(dir.z * 11.0 + uScrollPhase * 9.0));
        float tunnelStripX = smoothstep(0.28, 0.08, abs(abs(dir.x) - 0.26));
        float tunnelCeiling = smoothstep(0.22, 0.65, y);
        tunnelCol += vec3(1.65, 1.05, 0.42) * tunnelStripZ * tunnelStripX * tunnelCeiling;
        if (y < 0.0) {
          tunnelCol += vec3(0.26, 0.18, 0.1) * smoothstep(-0.4, 0.0, y);
        }

        vec3 col = mix(outdoorCol, tunnelCol, clamp(uTunnelBlend, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(envGeo, envMat));
  return { envScene, envMat, envGeo };
}

const HighSpeedRadialShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeedNorm: { value: 0.0 },
    uUltraFx: { value: 1.0 },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSpeedNorm;
    uniform float uUltraFx;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.48);
      vec2 dir = vUv - center;
      float dist = length(dir);

      // Keep wide central focal zone 100% sharp so signs & ahead cars stay crisp at 300km/h
      float edgeMask = smoothstep(0.32, 0.78, dist);
      float blurAmt = uSpeedNorm * edgeMask * (uUltraFx > 0.5 ? 0.0155 : 0.011);

      vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (blurAmt > 0.0004) {
        vec3 acc = col;
        for (int i = 1; i <= 8; i++) {
          float fi = float(i) / 8.0;
          vec2 sampleUv = vUv - dir * (blurAmt * fi);
          acc += texture2D(tDiffuse, clamp(sampleUv, 0.001, 0.999)).rgb;
        }
        col = acc / 9.0;

        // Subtle high-speed chromatic dispersion at outer periphery
        float ca = uSpeedNorm * edgeMask * (uUltraFx > 0.5 ? 0.003 : 0.0022);
        float r = texture2D(tDiffuse, clamp(vUv + dir * ca, 0.001, 0.999)).r;
        float b = texture2D(tDiffuse, clamp(vUv - dir * ca, 0.001, 0.999)).b;
        col.r = mix(col.r, r, 0.65);
        col.b = mix(col.b, b, 0.65);
      }

      if (uUltraFx > 0.5) {
        // Subtle horizontal anamorphic flare bleed from bright headlights / taillights / sun glints
        vec3 glint = vec3(0.0);
        for (int s = -2; s <= 2; s++) {
          if (s == 0) continue;
          vec2 gUv = clamp(vUv + vec2(float(s) * 0.0075, 0.0), 0.001, 0.999);
          vec3 sc = texture2D(tDiffuse, gUv).rgb;
          float lum = dot(sc, vec3(0.2126, 0.7152, 0.0722));
          glint += max(sc - vec3(0.92), vec3(0.0)) * smoothstep(0.92, 1.35, lum);
        }
        col += glint * 0.11;

        // Crisp cinematic micro-contrast & subtle vibrance boost
        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        vec3 satCol = mix(vec3(luma), col, 1.07);
        col = mix(col, satCol, 0.85);
      }

      // Subtle cinematic vignette (slightly stronger at extreme 300km/h speed)
      float vig = smoothstep(0.96, 0.36, dist);
      col *= mix(1.0, 0.85 - uSpeedNorm * 0.09, 1.0 - vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class HighwayEngine {
  private container: HTMLElement;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private speedFxPass: ShaderPass | null = null;
  private composerTarget: THREE.WebGLRenderTarget | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeFollowupTimer = 0;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmremGenerator: THREE.PMREMGenerator;
  private dynamicEnvScene: THREE.Scene;
  private dynamicEnvMat: THREE.ShaderMaterial;
  private dynamicEnvGeo: THREE.SphereGeometry;
  private envRenderTarget: THREE.WebGLRenderTarget;
  private envRebuildTimer = 0;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;
  private headSpotLeft: THREE.SpotLight | null = null;
  private headSpotRight: THREE.SpotLight | null = null;
  private spotTargetLeft: THREE.Object3D | null = null;
  private spotTargetRight: THREE.Object3D | null = null;
  private brakePointLight: THREE.PointLight | null = null;
  private exhaustFlashLight: THREE.PointLight | null = null;

  private textures: ProceduralTexturePack;
  private world: HighwayWorld;
  private playerRigs: Record<VehicleType, PlayerCarRig>;
  private playerCar: PlayerCarRig;
  private vehicleType: VehicleType = 'car';
  private currentPaint: CarPaintId = CarPaintId.ChampionshipWhite;
  private audio: HighwayAudioEngine;

  // Traffic pools
  private sameDirPool: TrafficVehicle[] = [];
  private oncomingPool: TrafficVehicle[] = [];
  private trafficDensity: TrafficDensity = TrafficDensity.Realistic;

  // Quality, Device & Weather State
  private qualityMode: QualityMode = QualityMode.Standard;
  private deviceMode: DeviceMode = 'pc';
  private analogSteer: number | null = null;
  private shiftFlameTimer = 0;
  private shiftCutTimer = 0;
  private brakeGlow = 0;
  private running = false;
  private attractMode = true;
  private attractS = 40;
  private weatherMode: WeatherMode = WeatherMode.Auto;
  private liveTargetWeather: ActiveWeather = ActiveWeather.Clear;
  private activeWeather: ActiveWeather = ActiveWeather.Clear;
  private autoWeatherTimer = 0;
  private readonly autoWeatherDuration = 75;

  // Interpolated weather state
  private curSkyColor = new THREE.Color(WEATHER_CONFIG[ActiveWeather.Clear].skyColor);
  private curSkyZenith = new THREE.Color(WEATHER_CONFIG[ActiveWeather.Clear].skyZenithColor);
  private curSkyHorizon = new THREE.Color(WEATHER_CONFIG[ActiveWeather.Clear].skyHorizonColor);
  private curFogColor = new THREE.Color(WEATHER_CONFIG[ActiveWeather.Clear].fogColor);
  private curSunColor = new THREE.Color(WEATHER_CONFIG[ActiveWeather.Clear].sunColor);
  private curHemiSky = new THREE.Color(WEATHER_CONFIG[ActiveWeather.Clear].hemiSky);
  private curHemiGround = new THREE.Color(WEATHER_CONFIG[ActiveWeather.Clear].hemiGround);
  private curFogDensity = WEATHER_CONFIG[ActiveWeather.Clear].fogDensity;
  private curSunIntensity = WEATHER_CONFIG[ActiveWeather.Clear].sunIntensity;
  private curSunElevation = WEATHER_CONFIG[ActiveWeather.Clear].sunElevation;
  private curHemiIntensity = WEATHER_CONFIG[ActiveWeather.Clear].hemiIntensity;
  private curAsphaltRoughness = WEATHER_CONFIG[ActiveWeather.Clear].asphaltRoughness;
  private curAsphaltEnv = WEATHER_CONFIG[ActiveWeather.Clear].asphaltEnvIntensity;
  private curLampIntensity = WEATHER_CONFIG[ActiveWeather.Clear].lampIntensity;
  private curRainAmount = WEATHER_CONFIG[ActiveWeather.Clear].rainIntensity;
  private curBloomStrength = WEATHER_CONFIG[ActiveWeather.Clear].bloomStrength;
  private curExposure = WEATHER_CONFIG[ActiveWeather.Clear].exposure;
  private curStarIntensity = WEATHER_CONFIG[ActiveWeather.Clear].starIntensity;
  private curTunnelBlend = 0;

  // Player Physics State
  private playerS = 40;
  private playerLaneOffset = 0;
  private playerSpeedMs = 120 / 3.6; // Start cruising right at Shin-Tomei's 120 km/h!
  private playerLatVel = 0;
  private playerRelYaw = 0;
  private playerSteer = 0;
  private playerGear = 4;
  private playerRpm = 4100;
  private playerPitch = 0;
  private playerRoll = 0;
  private wheelSpinAngle = 0;
  private wiperPhase = 0;
  private isReversing = false;
  private reverseHoldTimer = 0;
  private isParked = false;
  private inFreePlaza = false;
  private plazaHeading = 0;
  private saParkAwardedId = '';
  private jctState: {
    milestone: RouteMilestone;
    phase: 'viaduct' | 'highway';
    worldS: number;
    t: number;
    lateralOffset: number;
  } | null = null;
  private jctClearTriggeredForS = -9999;

  // Stats
  private distanceM = 0;
  private maxSpeedKmh = 120;
  private overtakeCount = 0;
  private nearMissCount = 0;
  private nearMissStreak = 0;
  private nearMissStreakTimer = 0;
  private score = 0;
  private hit300Triggered = false;
  private cameraShake = 0;
  private lastAnnouncedMilestoneId = '';
  private saRestAwardedId = '';
  private wasInSaApron = false;
  private icClearTriggeredForS = -9999;

  // Camera
  private cameraMode: CameraMode = CameraMode.Chase;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camLagX = 0;
  private camLagY = 0;
  private camLagZ = 0;
  private camLongOffset = 0;
  private camInitialized = false;

  // Inputs & Callbacks
  private input: InputState = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    hornOrFlash: false,
    handbrake: false,
  };
  private onTelemetry: (snap: TelemetrySnapshot) => void;
  private onSafetyBanner: (msg: SafetyBannerMessage) => void;
  private onIcExitClear?: (summary: IcClearSummary) => void;
  private onContextLost?: () => void;

  // Loop
  private frameId = 0;
  private disposed = false;
  private lastTimeMs = 0;
  private telemetryEmitAcc = 0;
  private tipTimer = 18;
  private tipIndex = 0;
  private bannerSeq = 1;
  private hornCooldown = 0;
  private laneSplitCooldown = 0;

  // Zero-GC scratch objects
  private readonly _targetSky = new THREE.Color();
  private readonly _targetZenith = new THREE.Color();
  private readonly _targetHorizon = new THREE.Color();
  private readonly _targetFog = new THREE.Color();
  private readonly _targetSun = new THREE.Color();
  private readonly _targetHemiSky = new THREE.Color();
  private readonly _targetHemiGround = new THREE.Color();
  private readonly _desiredCamPos = new THREE.Vector3();
  private readonly _desiredCamLook = new THREE.Vector3();

  constructor(
    container: HTMLElement,
    callbacks: {
      onTelemetry: (snap: TelemetrySnapshot) => void;
      onSafetyBanner: (msg: SafetyBannerMessage) => void;
      onIcExitClear?: (summary: IcClearSummary) => void;
      onContextLost?: () => void;
    },
  ) {
    this.container = container;
    this.onTelemetry = callbacks.onTelemetry;
    this.onSafetyBanner = callbacks.onSafetyBanner;
    this.onIcExitClear = callbacks.onIcExitClear;
    this.onContextLost = callbacks.onContextLost;

    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = this.curSkyColor.clone();
    this.fog = new THREE.FogExp2(this.curFogColor.getHex(), this.curFogDensity);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(64, w / h, 0.15, 1400);

    // Dynamic Real-Time Horizon-Sky-Tunnel PMREM Environment Map
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envRig = createDynamicEnvironmentRig();
    this.dynamicEnvScene = envRig.envScene;
    this.dynamicEnvMat = envRig.envMat;
    this.dynamicEnvGeo = envRig.envGeo;
    this.envRenderTarget = this.pmremGenerator.fromScene(this.dynamicEnvScene, 0.025);
    this.scene.environment = this.envRenderTarget.texture;

    // 3-Point Outdoor Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x9bd2ff, 0x3b4838, 1.08);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 2.9);
    this.sunLight.castShadow = false;
    const shadowSize = this.isSoftwareGl ? 512 : 1024;
    this.sunLight.shadow.mapSize.width = shadowSize;
    this.sunLight.shadow.mapSize.height = shadowSize;
    this.sunLight.shadow.radius = 2.4;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 170;
    const d = 46;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.018;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Procedural Textures, Scenery, Car/Bike/EV Rigs, Traffic, Audio
    this.textures = createProceduralTexturePack(this.renderer);
    this.world = new HighwayWorld(this.scene, this.textures, this.isSoftwareGl);
    this.playerRigs = {
      car: createPlayerCar(this.textures, CarPaintId.ChampionshipWhite, this.isSoftwareGl),
      bike: createPlayerBike(this.textures, CarPaintId.ChampionshipWhite, this.isSoftwareGl),
      ev: createPlayerEvCar(this.textures, CarPaintId.ChampionshipWhite, this.isSoftwareGl),
    };
    (['car', 'bike', 'ev'] as VehicleType[]).forEach((vt) => {
      const rig = this.playerRigs[vt];
      rig.root.rotation.order = 'YXZ';
      rig.root.visible = vt === this.vehicleType;
      this.scene.add(rig.root);
    });
    this.playerCar = this.playerRigs[this.vehicleType];

    // Ultra-HD Real Dynamic SpotLight Headlights & Rear Brake Light on Player Rig
    if (!this.isSoftwareGl) {
      this.headSpotLeft = new THREE.SpotLight(0xeef6ff, 0, 125, Math.PI * 0.16, 0.55, 1.35);
      this.headSpotRight = new THREE.SpotLight(0xeef6ff, 0, 125, Math.PI * 0.16, 0.55, 1.35);
      this.spotTargetLeft = new THREE.Object3D();
      this.spotTargetRight = new THREE.Object3D();
      this.spotTargetLeft.position.set(-1.1, 0.05, -48);
      this.spotTargetRight.position.set(1.1, 0.05, -48);
      this.headSpotLeft.target = this.spotTargetLeft;
      this.headSpotRight.target = this.spotTargetRight;

      this.brakePointLight = new THREE.PointLight(0xff1826, 0, 12, 1.8);
      this.exhaustFlashLight = new THREE.PointLight(0xff6b1a, 0, 9, 1.8);
      this.attachLightsToActiveRig();
    }

    this.audio = new HighwayAudioEngine();

    this.initTrafficPools();
    this.resetTrafficPositions();

    // Defer Ultra-HD EffectComposer & 4x MSAA HalfFloat target until QualityMode.Ultra is enabled so startup stays fast & light.

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleOrientationChange);
    window.visualViewport?.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }
    this.lastTimeMs = performance.now();
    this.scheduleNextFrame();
  }

  private initComposer(w: number, h: number): void {
    const pixelRatio = this.renderer.getPixelRatio();
    this.composerTarget = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(w * pixelRatio)),
      Math.max(1, Math.floor(h * pixelRatio)),
      {
        type: THREE.HalfFloatType,
        samples: 4,
      },
    );
    this.composer = new EffectComposer(this.renderer, this.composerTarget);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Calibrated bloom threshold (1.42) makes sun glints, chrome, headlights, taillights, and LEDs pop crisply
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.25, 0.36, 1.42);
    this.bloomPass.enabled = false;
    this.composer.addPass(this.bloomPass);

    // Dynamic High-Speed Radial Motion Blur & Vignette Pass
    this.speedFxPass = new ShaderPass(HighSpeedRadialShader);
    this.composer.addPass(this.speedFxPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.onContextLost?.();
  };

  private handleOrientationChange = () => {
    this.handleResize();
    requestAnimationFrame(() => this.handleResize());
    window.clearTimeout(this.resizeFollowupTimer);
    this.resizeFollowupTimer = window.setTimeout(() => this.handleResize(), 180);
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  };

  private initTrafficPools(): void {
    const archetypesPool: TrafficArchetype[] = [
      TrafficArchetype.Sedan,
      TrafficArchetype.KeiWagon,
      TrafficArchetype.BoxTruck,
      TrafficArchetype.Sedan,
      TrafficArchetype.SportsCoupe,
      TrafficArchetype.Sedan,
      TrafficArchetype.BoxTruck,
      TrafficArchetype.KeiWagon,
      TrafficArchetype.PatrolCar,
    ];

    const maxSame = TRAFFIC_PRESETS[TrafficDensity.Heavy].sameDirCount;
    for (let i = 0; i < maxSame; i++) {
      const arch = archetypesPool[i % archetypesPool.length];
      const colors = TRAFFIC_SPECS[arch].colors;
      const color = colors[i % colors.length];
      const rig = createTrafficCar(arch, color, this.textures);
      rig.root.visible = false;
      this.scene.add(rig.root);

      this.sameDirPool.push({
        rig,
        archetype: arch,
        s: 0,
        laneOffset: 0,
        targetLane: 1,
        currentLane: 1,
        speedMs: 33,
        cruiseSpeedMs: 33,
        isOncoming: false,
        isBraking: false,
        blinkerDir: 0,
        blinkerWaitTimer: 0,
        isYieldLaneChange: false,
        laneChangeStartX: 0,
        laneChangeProgress: 0,
        laneChangeDuration: 2.9,
        laneChangeLatVel: 0,
        laneChangeCooldown: 2 + Math.random() * 6,
        nearMissAwarded: false,
        patrolWarned: false,
        active: false,
      });
    }

    const maxOnc = TRAFFIC_PRESETS[TrafficDensity.Heavy].oncomingCount;
    for (let i = 0; i < maxOnc; i++) {
      const arch = archetypesPool[i % (archetypesPool.length - 1)];
      const colors = TRAFFIC_SPECS[arch].colors;
      const color = colors[i % colors.length];
      const rig = createTrafficCar(arch, color, this.textures);
      rig.root.visible = false;
      this.scene.add(rig.root);

      this.oncomingPool.push({
        rig,
        archetype: arch,
        s: 0,
        laneOffset: EXPRESSWAY.ONCOMING_LANE_CENTERS[i % 3],
        targetLane: i % 3,
        currentLane: i % 3,
        speedMs: 32,
        cruiseSpeedMs: 32,
        isOncoming: true,
        isBraking: false,
        blinkerDir: 0,
        blinkerWaitTimer: 0,
        isYieldLaneChange: false,
        laneChangeStartX: EXPRESSWAY.ONCOMING_LANE_CENTERS[i % 3],
        laneChangeProgress: 0,
        laneChangeDuration: 2.9,
        laneChangeLatVel: 0,
        laneChangeCooldown: 99,
        nearMissAwarded: false,
        patrolWarned: false,
        active: false,
      });
    }
  }

  private resetTrafficPositions(baseS = this.playerS): void {
    const preset = TRAFFIC_PRESETS[this.trafficDensity];

    this.sameDirPool.forEach((v, idx) => {
      if (idx < preset.sameDirCount) {
        const spec = TRAFFIC_SPECS[v.archetype];
        const lane = spec.preferredLanes[idx % spec.preferredLanes.length];
        const cruiseKmh = THREE.MathUtils.lerp(spec.minSpeedKmh, spec.maxSpeedKmh, Math.random());
        let candidateS = baseS + 85 + idx * (560 / preset.sameDirCount) + (Math.random() - 0.5) * 14;
        for (let attempt = 0; attempt < 8; attempt++) {
          const conflict = this.sameDirPool.some(
            (other, j) =>
              j < idx &&
              other.active &&
              other.currentLane === lane &&
              Math.abs(other.s - candidateS) < 52,
          );
          if (!conflict) break;
          candidateS += 56;
        }
        v.active = true;
        v.currentLane = lane;
        v.targetLane = lane;
        v.laneOffset = EXPRESSWAY.LANE_CENTERS[lane];
        v.s = candidateS;
        v.cruiseSpeedMs = cruiseKmh / 3.6;
        v.speedMs = v.cruiseSpeedMs;
        v.blinkerDir = 0;
        v.blinkerWaitTimer = 0;
        v.isYieldLaneChange = false;
        v.laneChangeStartX = v.laneOffset;
        v.laneChangeProgress = 0;
        v.laneChangeDuration = 2.9;
        v.laneChangeLatVel = 0;
        v.nearMissAwarded = false;
        v.patrolWarned = false;
        v.rig.root.visible = true;
      } else {
        v.active = false;
        v.rig.root.visible = false;
      }
    });

    this.oncomingPool.forEach((v, idx) => {
      if (idx < preset.oncomingCount) {
        const lane = idx % 3;
        let candidateS = baseS + 100 + idx * (620 / preset.oncomingCount);
        for (let attempt = 0; attempt < 8; attempt++) {
          const conflict = this.oncomingPool.some(
            (other, j) =>
              j < idx &&
              other.active &&
              other.currentLane === lane &&
              Math.abs(other.s - candidateS) < 55,
          );
          if (!conflict) break;
          candidateS += 58;
        }
        v.active = true;
        v.currentLane = lane;
        v.targetLane = lane;
        v.laneOffset = EXPRESSWAY.ONCOMING_LANE_CENTERS[lane];
        v.s = candidateS;
        v.cruiseSpeedMs = (lane === 0 ? 86 : 112 + Math.random() * 10) / 3.6;
        v.speedMs = v.cruiseSpeedMs;
        v.rig.root.visible = true;
      } else {
        v.active = false;
        v.rig.root.visible = false;
      }
    });
  }

  // Public Control API
  public setRunning(running: boolean): void {
    this.running = running;
    if (running) {
      if (this.attractMode) {
        this.attractMode = false;
        this.camInitialized = false;
        this.resetTrafficPositions(this.playerS);
        this.syncPlayerCarTransform(0, 0);
      }
      this.audio.init();
    }
  }

  public setAttractMode(enabled: boolean): void {
    if (this.attractMode === enabled) return;
    this.attractMode = enabled;
    this.camInitialized = false;
    if (enabled) {
      this.attractS = 40;
      this.resetTrafficPositions(this.attractS);
    } else {
      this.resetTrafficPositions(this.playerS);
      this.syncPlayerCarTransform(0, 0);
    }
  }

  public unlockAudio(): void {
    this.audio.init();
  }

  public setDeviceMode(mode: DeviceMode): void {
    this.deviceMode = mode;
    if (mode === 'pc') this.analogSteer = null;
    this.setQualityMode(this.qualityMode);
  }

  public setAnalogSteer(steer: number | null): void {
    this.analogSteer = steer === null ? null : THREE.MathUtils.clamp(steer, -1, 1);
  }

  public setQualityMode(mode: QualityMode): void {
    this.qualityMode = mode;
    if (!this.isSoftwareGl) {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      const maxDpr = this.deviceMode === 'mobile' ? 2.0 : 2.5;
      const targetRatio =
        mode === QualityMode.Ultra
          ? Math.min(window.devicePixelRatio, maxDpr)
          : Math.min(window.devicePixelRatio, 1.0);
      this.renderer.setPixelRatio(targetRatio);

      const prevShadows = this.renderer.shadowMap.enabled;
      const nextShadows = mode === QualityMode.Ultra;
      this.renderer.shadowMap.enabled = nextShadows;
      this.sunLight.castShadow = nextShadows;
      const targetShadowSize = mode === QualityMode.Ultra ? 4096 : 1024;
      if (this.sunLight.shadow.mapSize.width !== targetShadowSize) {
        this.sunLight.shadow.mapSize.set(targetShadowSize, targetShadowSize);
        this.sunLight.shadow.map?.dispose();
        this.sunLight.shadow.map = null;
      }

      if (mode === QualityMode.Ultra) {
        if (!this.composer) {
          this.initComposer(w, h);
        }
        this.envRebuildTimer = 999;
      }

      if (prevShadows !== nextShadows) {
        if (nextShadows) {
          this.renderer.shadowMap.needsUpdate = true;
        }
        this.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (mat) mat.needsUpdate = true;
          }
        });
      }

      this.renderer.setSize(w, h);
      if (this.composer) {
        this.composer.setPixelRatio(targetRatio);
        this.composer.setSize(w, h);
      }
      if (this.bloomPass) {
        this.bloomPass.resolution.set(w, h);
      }
    }
  }

  private attachLightsToActiveRig(): void {
    if (!this.headSpotLeft || !this.headSpotRight || !this.spotTargetLeft || !this.spotTargetRight || !this.brakePointLight) {
      return;
    }
    const isBike = this.vehicleType === 'bike';
    const xOff = isBike ? 0.12 : 0.74;
    const yOff = isBike ? 0.78 : 0.58;
    const zOff = isBike ? -0.95 : -2.32;
    this.headSpotLeft.position.set(-xOff, yOff, zOff);
    this.headSpotRight.position.set(xOff, yOff, zOff);
    this.brakePointLight.position.set(0, isBike ? 0.85 : 0.72, isBike ? 1.15 : 2.75);

    this.playerCar.bodyPivot.add(this.headSpotLeft);
    this.playerCar.bodyPivot.add(this.headSpotRight);
    this.playerCar.bodyPivot.add(this.spotTargetLeft);
    this.playerCar.bodyPivot.add(this.spotTargetRight);
    this.playerCar.bodyPivot.add(this.brakePointLight);
    if (this.exhaustFlashLight) {
      this.exhaustFlashLight.position.set(isBike ? 0.2 : 0.5, isBike ? 0.45 : 0.32, isBike ? 1.05 : 2.55);
      this.playerCar.bodyPivot.add(this.exhaustFlashLight);
    }
  }

  public setVehicleType(type: VehicleType): void {
    if (this.vehicleType === type) return;
    this.playerCar.root.visible = false;
    this.vehicleType = type;
    this.playerCar = this.playerRigs[type];
    this.playerCar.root.visible = true;
    this.attachLightsToActiveRig();
    this.setCarPaint(this.currentPaint);
    const spec = VEHICLE_SPECS[type];
    if (spec.IS_DIRECT_DRIVE && this.playerGear > 1) {
      this.playerGear = 1;
    } else if (!spec.IS_DIRECT_DRIVE && this.playerGear > spec.GEAR_RATIOS.length) {
      this.playerGear = spec.GEAR_RATIOS.length;
    }
    this.camInitialized = false;
  }

  public resetRun(): void {
    this.world.setJctBranch(null);
    this.playerS = 40;
    this.playerLaneOffset = 0;
    this.playerSpeedMs = 120 / 3.6;
    this.playerLatVel = 0;
    this.playerRelYaw = 0;
    this.playerSteer = 0;
    this.shiftCutTimer = 0;
    this.playerGear = VEHICLE_SPECS[this.vehicleType].IS_DIRECT_DRIVE ? 1 : 4;
    this.isReversing = false;
    this.reverseHoldTimer = 0;
    this.isParked = false;
    this.inFreePlaza = false;
    this.plazaHeading = 0;
    this.saParkAwardedId = '';
    this.jctState = null;
    this.jctClearTriggeredForS = -9999;
    this.distanceM = 0;
    this.maxSpeedKmh = 120;
    this.overtakeCount = 0;
    this.nearMissCount = 0;
    this.nearMissStreak = 0;
    this.score = 0;
    this.hit300Triggered = false;
    this.lastAnnouncedMilestoneId = '';
    this.saRestAwardedId = '';
    this.wasInSaApron = false;
    this.icClearTriggeredForS = -9999;
    this.attractS = 40;
    this.camInitialized = false;
    this.resetTrafficPositions(this.attractMode ? this.attractS : this.playerS);
    this.pushSafetyBanner({
      title: '【走行スタート】新東名 制限速度300km/h 特例区間',
      body: '他車は現実基準（乗用車100〜120km/h・大型貨物90km/h）で走行中！SA/PA構内自由走行・5km JCT連絡道・各IC出口クリアに挑戦できます！',
      tone: 'info',
    });
  }

  public exitJctBranchToMainline(): void {
    if (!this.jctState) return;
    this.world.setJctBranch(null);
    this.playerS = this.jctState.worldS + 135;
    this.jctState = null;
    this.playerLaneOffset = -3.75;
    this.playerLatVel = 0;
    this.playerRelYaw = 0;
    this.shiftCutTimer = 0;
    this.inFreePlaza = false;
    this.plazaHeading = 0;
    this.playerSpeedMs = Math.max(25, Math.min(this.playerSpeedMs, 140 / 3.6));
    this.playerGear = VEHICLE_SPECS[this.vehicleType].IS_DIRECT_DRIVE ? 1 : 4;
    this.camInitialized = false;
    this.resetTrafficPositions();
    this.pushSafetyBanner({
      title: '【E1A 本線復帰】新東名本線に戻りました',
      body: '引き続き300km/h特例区間と実在SA/PA・IC・JCTのドライブをお楽しみください！',
      tone: 'info',
    });
  }

  public resumeAfterIcClear(): void {
    this.world.setJctBranch(null);
    if (this.jctState) {
      this.playerS = this.jctState.worldS + 135;
      this.jctState = null;
    } else {
      this.playerS += 95;
    }
    this.playerLaneOffset = -3.75;
    this.playerLatVel = 0;
    this.playerRelYaw = 0;
    this.shiftCutTimer = 0;
    this.inFreePlaza = false;
    this.plazaHeading = 0;
    this.playerSpeedMs = 120 / 3.6;
    this.playerGear = VEHICLE_SPECS[this.vehicleType].IS_DIRECT_DRIVE ? 1 : 4;
    this.isReversing = false;
    this.reverseHoldTimer = 0;
    this.isParked = false;
    this.camInitialized = false;
    this.resetTrafficPositions();
    this.running = true;
    this.pushSafetyBanner({
      title: '【本線復帰】新東名ダウンバウンド走行を再開しました',
      body: '次のNEOPASA・IC・JCT案内は上部のナビ表示でも確認できます！',
      tone: 'info',
    });
  }

  public setWeatherMode(mode: WeatherMode): void {
    this.weatherMode = mode;
    if (mode === WeatherMode.Live) {
      this.activeWeather = this.liveTargetWeather;
    } else if (mode !== WeatherMode.Auto) {
      this.activeWeather = mode as unknown as ActiveWeather;
    }
    this.envRebuildTimer = 999; // Force prompt environment reflection refresh
  }

  public setLiveWeatherTarget(weather: ActiveWeather): void {
    this.liveTargetWeather = weather;
    if (this.weatherMode === WeatherMode.Live) {
      this.activeWeather = weather;
      this.envRebuildTimer = 999;
    }
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.camInitialized = false; // Crisp instant transition when switching camera mode
  }

  public setTrafficDensity(density: TrafficDensity): void {
    this.trafficDensity = density;
    this.resetTrafficPositions(this.attractMode && !this.running ? this.attractS : this.playerS);
  }

  public setCarPaint(paint: CarPaintId): void {
    this.currentPaint = paint;
    const spec = CAR_PAINTS[paint];
    this.playerCar.paintMaterial.color.setHex(spec.hex);
    this.playerCar.paintMaterial.metalness = spec.metalness;
    this.playerCar.paintMaterial.roughness = spec.roughness;
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public setInput(partial: Partial<InputState>): void {
    Object.assign(this.input, partial);
  }

  private pushSafetyBanner(msg: Omit<SafetyBannerMessage, 'id'>): void {
    this.onSafetyBanner({
      id: this.bannerSeq++,
      ...msg,
    });
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.tick();
      });
    } else {
      this.frameId = requestAnimationFrame(() => {
        if (!this.disposed) this.tick();
      });
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 4);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 16);
      }
    };
    this.frameId = window.setTimeout(poll, 4);
  }

  private tick(): void {
    const now = performance.now();
    const rawDt = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    const frameDt = Math.min(0.16, Math.max(0.001, rawDt));

    let worldCenterS = this.jctState?.phase === 'viaduct' ? this.jctState.worldS : this.playerS;
    let worldSpeedMs = this.playerSpeedMs;

    if (this.running) {
      this.stepWeather(frameDt, true, this.playerS);
      const subSteps = Math.min(7, Math.max(1, Math.ceil(frameDt / 0.025)));
      const subDt = frameDt / subSteps;
      let physInfo = { slipstream: false, tireSlip: 0, absActive: false };
      for (let step = 0; step < subSteps; step++) {
        if (!this.running) break;
        physInfo = this.stepPlayerPhysics(subDt);
        this.stepTraffic(subDt, this.playerS, true);
      }
      this.updateCamera(frameDt);
      this.emitTelemetry(frameDt, physInfo);
      worldCenterS = this.jctState?.phase === 'viaduct' ? this.jctState.worldS : this.playerS;
      worldSpeedMs = this.playerSpeedMs;
    } else if (this.attractMode) {
      const attractSpeedMs = 120 / 3.6;
      this.attractS += attractSpeedMs * frameDt;
      if (this.attractS > ROUTE_TOTAL_LENGTH_M - 450) {
        this.attractS = 40;
        this.resetTrafficPositions(this.attractS);
      }
      this.stepWeather(frameDt, true, this.attractS);
      this.syncAttractCarTransform(frameDt, attractSpeedMs);
      this.stepTraffic(frameDt, this.attractS, false);
      this.updateCamera(frameDt, this.attractS);
      this.audio.update({
        active: false,
        vehicleType: this.vehicleType,
        speedKmh: 0,
        rpm: 1000,
        throttle: 0,
        rainAmount: 0,
        tireSlip: 0,
        inTunnel: false,
      });
      this.emitTelemetry(frameDt, { slipstream: false, tireSlip: 0, absActive: false });
      worldCenterS = this.attractS;
      worldSpeedMs = attractSpeedMs;
    } else {
      // Paused mid-run: freeze player position, speed, distance, score, and all traffic completely!
      this.stepWeather(frameDt, false, this.playerS);
      this.syncPlayerCarTransform(0, 0);
      this.updateCamera(frameDt);
      this.audio.update({
        active: false,
        vehicleType: this.vehicleType,
        speedKmh: 0,
        rpm: 1000,
        throttle: 0,
        rainAmount: 0,
        tireSlip: 0,
        inTunnel: false,
      });
      this.emitTelemetry(frameDt, { slipstream: false, tireSlip: 0, absActive: false });
      worldCenterS = this.jctState?.phase === 'viaduct' ? this.jctState.worldS : this.playerS;
      worldSpeedMs = 0;
    }

    const wCfg = WEATHER_CONFIG[this.activeWeather];
    const baseFuji =
      this.activeWeather === ActiveWeather.Clear
        ? 0.94
        : this.activeWeather === ActiveWeather.Sunset
          ? 0.8
          : 0.0;
    const fujiOpacity = baseFuji * (1 - this.curTunnelBlend * 0.9);

    const isUltra = this.qualityMode === QualityMode.Ultra;
    this.world.update(
      worldCenterS,
      this.attractMode && !this.running ? 0 : this.playerLaneOffset,
      worldSpeedMs,
      !this.running && !this.attractMode ? 0 : frameDt,
      isUltra,
      {
        rainAmount: this.curRainAmount,
        lampIntensity: this.curLampIntensity,
        asphaltRoughness: this.curAsphaltRoughness,
        asphaltEnvIntensity: this.curAsphaltEnv,
        fujiOpacity,
        fogColorHex: wCfg.fogColor,
        skyZenith: this.curSkyZenith,
        skyHorizon: this.curSkyHorizon,
        sunColor: this.curSunColor,
        sunElevation: this.curSunElevation,
        starIntensity: this.curStarIntensity,
        tunnelBlend: this.curTunnelBlend,
      },
      LED_BOARD_MESSAGES,
    );

    // Ultra-HD Dynamic Real-Time PMREM Environment Reflection Re-bake
    if (isUltra && !this.isSoftwareGl) {
      this.envRebuildTimer += frameDt;
      if (this.envRebuildTimer >= 0.28) {
        this.envRebuildTimer = 0;
        this.dynamicEnvMat.uniforms.uZenithColor.value.copy(this.curSkyZenith);
        this.dynamicEnvMat.uniforms.uHorizonColor.value.copy(this.curSkyHorizon);
        this.dynamicEnvMat.uniforms.uSunColor.value.copy(this.curSunColor);
        this.dynamicEnvMat.uniforms.uSunDir.value.set(0.22, this.curSunElevation, -0.88).normalize();
        this.dynamicEnvMat.uniforms.uLampIntensity.value = this.curLampIntensity;
        this.dynamicEnvMat.uniforms.uTunnelBlend.value = this.curTunnelBlend;
        this.dynamicEnvMat.uniforms.uRainAmount.value = this.curRainAmount;
        this.dynamicEnvMat.uniforms.uScrollPhase.value = (worldCenterS / 40) % 1;

        const nextEnv = this.pmremGenerator.fromScene(this.dynamicEnvScene, 0.025);
        this.scene.environment = nextEnv.texture;
        this.envRenderTarget.dispose();
        this.envRenderTarget = nextEnv;
      }
    }

    if (this.composer && !this.isSoftwareGl && isUltra) {
      if (this.bloomPass) {
        const ultraBloom = Math.max(0.11, this.curBloomStrength);
        this.bloomPass.enabled = ultraBloom > 0.02;
        this.bloomPass.strength = ultraBloom;
      }
      if (this.speedFxPass) {
        const speedKmh = Math.abs(this.playerSpeedMs) * 3.6;
        const speedNorm = this.running ? THREE.MathUtils.clamp((speedKmh - 140) / 160, 0, 1) : 0;
        this.speedFxPass.uniforms.uSpeedNorm.value = speedNorm;
        this.speedFxPass.uniforms.uUltraFx.value = 1.0;
        this.speedFxPass.uniforms.uTime.value = now * 0.001;
      }
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.scheduleNextFrame();
  }

  private stepWeather(dt: number, advanceAutoTimer = true, refS = this.playerS): void {
    if (this.weatherMode === WeatherMode.Auto) {
      if (advanceAutoTimer) {
        this.autoWeatherTimer += dt;
        if (this.autoWeatherTimer >= this.autoWeatherDuration) {
          this.autoWeatherTimer = 0;
          const nextIdx = (AUTO_WEATHER_SEQUENCE.indexOf(this.activeWeather) + 1) % AUTO_WEATHER_SEQUENCE.length;
          this.activeWeather = AUTO_WEATHER_SEQUENCE[nextIdx];
        }
      }
    } else if (this.weatherMode === WeatherMode.Live) {
      this.activeWeather = this.liveTargetWeather;
    } else {
      this.activeWeather = this.weatherMode as unknown as ActiveWeather;
    }

    const cfg = WEATHER_CONFIG[this.activeWeather];
    const inTunnel = isTunnelAt(refS);
    this.curTunnelBlend = THREE.MathUtils.damp(this.curTunnelBlend, inTunnel ? 1 : 0, 5.5, dt);

    // Gradual, natural weather & time-of-day transition (never sudden/jarring)
    const k = this.weatherMode === WeatherMode.Auto ? 0.14 : 0.35;
    this._targetSky.setHex(cfg.skyColor);
    this._targetZenith.setHex(cfg.skyZenithColor);
    this._targetHorizon.setHex(cfg.skyHorizonColor);
    this._targetFog.setHex(cfg.fogColor);
    this._targetSun.setHex(cfg.sunColor);
    this._targetHemiSky.setHex(cfg.hemiSky);
    this._targetHemiGround.setHex(cfg.hemiGround);

    const alpha = 1 - Math.exp(-k * dt);
    this.curSkyColor.lerp(this._targetSky, alpha);
    this.curSkyZenith.lerp(this._targetZenith, alpha);
    this.curSkyHorizon.lerp(this._targetHorizon, alpha);
    this.curFogColor.lerp(this._targetFog, alpha);
    this.curSunColor.lerp(this._targetSun, alpha);
    this.curHemiSky.lerp(this._targetHemiSky, alpha);
    this.curHemiGround.lerp(this._targetHemiGround, alpha);

    this.curFogDensity = THREE.MathUtils.damp(this.curFogDensity, cfg.fogDensity, k, dt);
    this.curSunIntensity = THREE.MathUtils.damp(this.curSunIntensity, cfg.sunIntensity, k, dt);
    this.curSunElevation = THREE.MathUtils.damp(this.curSunElevation, cfg.sunElevation, k, dt);
    this.curHemiIntensity = THREE.MathUtils.damp(this.curHemiIntensity, cfg.hemiIntensity, k, dt);
    this.curAsphaltRoughness = THREE.MathUtils.damp(this.curAsphaltRoughness, cfg.asphaltRoughness, k, dt);
    this.curAsphaltEnv = THREE.MathUtils.damp(this.curAsphaltEnv, cfg.asphaltEnvIntensity, k, dt);
    this.curLampIntensity = THREE.MathUtils.damp(this.curLampIntensity, cfg.lampIntensity, k, dt);
    this.curRainAmount = THREE.MathUtils.damp(this.curRainAmount, cfg.rainIntensity, k, dt);
    this.curBloomStrength = THREE.MathUtils.damp(this.curBloomStrength, cfg.bloomStrength, k, dt);
    this.curExposure = THREE.MathUtils.damp(this.curExposure, cfg.exposure, k, dt);
    this.curStarIntensity = THREE.MathUtils.damp(this.curStarIntensity, cfg.starIntensity, k, dt);

    const tunnelDarken = 1 - this.curTunnelBlend * 0.72;
    (this.scene.background as THREE.Color).copy(this.curSkyColor).multiplyScalar(1 - this.curTunnelBlend * 0.85);
    this.fog.color.copy(this.curFogColor).multiplyScalar(1 - this.curTunnelBlend * 0.68);
    this.fog.density = Math.max(this.curFogDensity, this.curTunnelBlend * 0.0045);

    this.sunLight.color.copy(this.curSunColor);
    this.sunLight.intensity = this.curSunIntensity * tunnelDarken;
    this.hemiLight.color.copy(this.curHemiSky);
    this.hemiLight.groundColor.copy(this.curHemiGround);
    this.hemiLight.intensity = this.curHemiIntensity * (1 - this.curTunnelBlend * 0.35);
    this.renderer.toneMappingExposure = this.curExposure;

    const sunRefS = this.attractMode && !this.running ? this.attractS : this.playerS;
    const sunRefLane = this.attractMode && !this.running ? 0 : this.playerLaneOffset;
    const px = roadCenterX(sunRefS) + sunRefLane;
    const py = getSurfaceElevationAt(sunRefS, sunRefLane);
    const pz = -sunRefS;
    this.sunLight.position.set(px + 28, py + 44, pz - 18);
    this.sunLight.target.position.set(px, py, pz - 10);
    this.sunLight.target.updateMatrixWorld();

    if (this.hornCooldown > 0) this.hornCooldown -= dt;
    if (this.input.hornOrFlash && this.hornCooldown <= 0 && this.running) {
      this.hornCooldown = 0.35;
      this.audio.playPassingHorn();
    }

    const lightsOn = cfg.headlightsRequired || inTunnel || this.input.hornOrFlash;
    const beamOpacity = this.input.hornOrFlash
      ? 0.24
      : lightsOn
        ? this.activeWeather === ActiveWeather.Night || inTunnel
          ? 0.14
          : 0.06
        : 0;
    (this.playerCar.headLightBeamLeft.material as THREE.MeshBasicMaterial).opacity = beamOpacity;
    this.playerCar.headLightEmissiveMat.emissiveIntensity = this.input.hornOrFlash ? 4.2 : lightsOn ? 2.6 : 0.6;

    const isUltra = !this.isSoftwareGl && this.qualityMode === QualityMode.Ultra;
    if (this.headSpotLeft && this.headSpotRight) {
      const spotIntensity = isUltra
        ? this.input.hornOrFlash
          ? 95
          : lightsOn
            ? this.activeWeather === ActiveWeather.Night || inTunnel
              ? 52
              : 24
            : 0
        : 0;
      this.headSpotLeft.intensity = spotIntensity;
      this.headSpotRight.intensity = spotIntensity;
    }

    // Animated windshield wipers when raining outside tunnel
    if (this.curRainAmount > 0.12 && !inTunnel) {
      this.wiperPhase += dt * 4.8;
      const sweep = (Math.sin(this.wiperPhase) * 0.5 + 0.5) * 1.15;
      this.playerCar.wiperLeft.rotation.z = sweep;
      this.playerCar.wiperRight.rotation.z = sweep * 0.92;
    } else {
      this.playerCar.wiperLeft.rotation.z = THREE.MathUtils.damp(this.playerCar.wiperLeft.rotation.z, 0, 8, dt);
      this.playerCar.wiperRight.rotation.z = THREE.MathUtils.damp(this.playerCar.wiperRight.rotation.z, 0, 8, dt);
    }
  }

  private stepPlayerPhysics(dt: number): { slipstream: boolean; tireSlip: number; absActive: boolean } {
    const spec = VEHICLE_SPECS[this.vehicleType];
    const wCfg = WEATHER_CONFIG[this.activeWeather];
    const inViaduct = this.jctState?.phase === 'viaduct';
    const inJctHighway = this.jctState?.phase === 'highway';
    const inTunnel = !inViaduct && isTunnelAt(this.playerS);
    const roadFriction = inTunnel ? 1.02 : wCfg.roadFriction;

    const throttle = this.input.throttle ? 1 : 0;
    const brake = this.input.brake ? 1 : 0;
    const digitalSteer = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const steerInput = digitalSteer !== 0 ? digitalSteer : (this.analogSteer ?? 0);

    let slipstream = false;
    if (!inViaduct && !this.inFreePlaza && this.playerSpeedMs > 5) {
      for (const tv of this.sameDirPool) {
        if (!tv.active) continue;
        const ds = tv.s - this.playerS;
        if (ds > 6 && ds < 55 && Math.abs(tv.laneOffset - this.playerLaneOffset) < 1.85) {
          slipstream = true;
          break;
        }
      }
    }

    const preOffBounds = !this.jctState ? getOffMainlineBounds(this.playerS, this.playerLaneOffset) : null;

    // SA/PA Designated Bay Parking Check (works in any 360° orientation!)
    if (
      preOffBounds &&
      preOffBounds.inParkingBay &&
      preOffBounds.activeSa &&
      !this.isParked &&
      !this.isReversing &&
      throttle === 0 &&
      Math.abs(this.playerSpeedMs) < 1.15
    ) {
      this.isParked = true;
      this.playerSpeedMs = 0;
      this.playerLatVel = 0;
      this.playerGear = 0;
      this.reverseHoldTimer = 0;
      if (this.saParkAwardedId !== preOffBounds.activeSa.id) {
        this.saParkAwardedId = preOffBounds.activeSa.id;
        this.score += 800;
        this.audio.playChime('park');
        this.pushSafetyBanner({
          title: `【${preOffBounds.activeSa.nameJa} 駐車完了！ +800pts】`,
          body: '緑の空き枠 [P] に駐車しました！構内は前後左右＆ハンドル旋回で自由に切り返しできます。',
          tone: 'humor',
        });
      }
    }

    // Release Parking on throttle or sustained reverse hold
    if (this.isParked) {
      if (throttle > 0) {
        this.isParked = false;
        this.isReversing = false;
        this.playerGear = 1;
        this.reverseHoldTimer = 0;
      } else if (brake > 0) {
        this.reverseHoldTimer += dt;
        if (this.reverseHoldTimer >= 0.2) {
          this.isParked = false;
          this.isReversing = true;
          this.playerGear = -1;
          this.reverseHoldTimer = 0;
        }
      } else {
        this.reverseHoldTimer = 0;
      }
    } else if (!this.isReversing) {
      if (this.playerSpeedMs <= 0.25 && brake > 0 && throttle === 0) {
        this.playerSpeedMs = 0;
        this.reverseHoldTimer += dt;
        if (this.reverseHoldTimer >= 0.26) {
          this.isReversing = true;
          this.playerGear = -1;
          this.reverseHoldTimer = 0;
        }
      } else {
        this.reverseHoldTimer = 0;
      }
    }

    let accelLong = 0;
    let absActive = false;
    let effectiveThrottle = 0;
    let brakeAudioAmt = 0;
    let brakeTailActive = false;

    if (this.isParked) {
      this.playerSpeedMs = 0;
      this.playerLatVel = 0;
      this.playerGear = 0;
      this.playerRpm = THREE.MathUtils.damp(this.playerRpm, spec.IDLE_RPM, 10, dt);
      brakeTailActive = true;
    } else if (this.isReversing) {
      this.playerGear = -1;
      const MAX_REV_MS = (this.vehicleType === 'bike' ? 18 : 40) / 3.6;
      const absRevMs = Math.abs(Math.min(0, this.playerSpeedMs));
      const slopePitch = inViaduct
        ? sampleJctOverpassWorld(this.jctState!.worldS, this.jctState!.t, this.jctState!.lateralOffset).pitch
        : Math.atan(getSurfaceSlopeAt(this.playerS, this.playerLaneOffset));
      const slopeGravity = spec.MASS_KG * 9.81 * Math.sin(slopePitch);
      const rollingDrag = spec.MASS_KG * 9.81 * spec.ROLLING_RESISTANCE;

      const revLimiter = Math.max(0, 1 - Math.pow(absRevMs / MAX_REV_MS, 2.2));
      const revDriveForce = brake * (-spec.MASS_KG * 4.5) * revLimiter;
      const forwardBrakeForce = throttle * (spec.MAX_BRAKE_FORCE_N * 0.85);
      const coastResistance = this.playerSpeedMs < -0.05 ? rollingDrag * 2.4 : 0;

      const netLongForce = revDriveForce + forwardBrakeForce + coastResistance - slopeGravity;
      accelLong = netLongForce / spec.MASS_KG;
      this.playerSpeedMs = THREE.MathUtils.clamp(this.playerSpeedMs + accelLong * dt, -MAX_REV_MS, 0.05);

      if (throttle > 0 && this.playerSpeedMs >= -0.3) {
        this.isReversing = false;
        this.playerGear = 1;
        this.playerSpeedMs = Math.max(0, this.playerSpeedMs);
      }

      const revTargetRpm =
        spec.IDLE_RPM + (Math.abs(this.playerSpeedMs) / MAX_REV_MS) * 3900 + brake * 550;
      this.playerRpm = THREE.MathUtils.damp(this.playerRpm, revTargetRpm, 12, dt);
      effectiveThrottle = brake * 0.55;
      brakeAudioAmt = throttle;
      brakeTailActive = throttle > 0.1 || brake > 0.1;
    } else {
      if (this.playerGear < 1) this.playerGear = 1;
      const speedMs = Math.max(0, this.playerSpeedMs);
      const speedKmh = speedMs * 3.6;
      const isBike = this.vehicleType === 'bike';

      let driveForce = 0;
      let regenOrEngineBrakeForce = 0;

      effectiveThrottle = throttle;
      if (speedKmh >= spec.MAX_SPEED_KMH - 0.5) {
        effectiveThrottle = 0;
      } else if (speedKmh > spec.MAX_SPEED_KMH - 6) {
        effectiveThrottle *= (spec.MAX_SPEED_KMH - speedKmh) / 6;
      }

      if (spec.IS_DIRECT_DRIVE) {
        // EV Hypercar: 1-speed direct drive with instant peak torque off the line (0-120 km/h),
        // zero gearshift interruption, constant-power tapering at high speeds, and strong regen braking.
        this.playerGear = 1;
        this.shiftCutTimer = 0;
        const targetRpm = THREE.MathUtils.clamp(
          spec.IDLE_RPM + (speedMs / spec.MAX_SPEED_MS) * (spec.REDLINE_RPM - spec.IDLE_RPM),
          spec.IDLE_RPM,
          spec.REDLINE_RPM,
        );
        this.playerRpm = THREE.MathUtils.damp(this.playerRpm, targetRpm, 18, dt);

        const evPowerW = 205000; // ~278 PS sustained electric power above base speed (20 m/s = 72 km/h)
        const baseForce = speedMs > 20 ? Math.min(spec.MAX_ENGINE_FORCE_N, evPowerW / speedMs) : spec.MAX_ENGINE_FORCE_N;
        driveForce = effectiveThrottle * baseForce * (slipstream ? 1.1 : 1.0);

        if (throttle === 0 && brake === 0 && speedMs > 1.0) {
          regenOrEngineBrakeForce = spec.MASS_KG * (0.55 + 0.4 * Math.min(1, speedMs / 30));
        }
      } else {
        // ICE Sports Car / Superbike: multi-gear transmission, distinct RPM torque band, brief shift-cut on car upshifts
        const wheelAngular = speedMs / spec.WHEEL_RADIUS_M;
        const ratio = spec.GEAR_RATIOS[this.playerGear - 1] * spec.FINAL_DRIVE;
        let targetRpm = (wheelAngular * ratio * 60) / (2 * Math.PI);
        targetRpm = Math.max(spec.IDLE_RPM, Math.min(spec.REDLINE_RPM, targetRpm));

        const prevGear = this.playerGear;
        if (targetRpm >= spec.SHIFT_UP_RPM && this.playerGear < spec.GEAR_RATIOS.length && throttle > 0) {
          this.playerGear++;
        } else if (targetRpm <= spec.SHIFT_DOWN_RPM && this.playerGear > 1) {
          this.playerGear--;
        }
        if (this.playerGear > prevGear) {
          if (!isBike) {
            this.shiftCutTimer = 0.085;
          }
          if (this.qualityMode === QualityMode.Ultra) {
            this.shiftFlameTimer = 0.16;
          }
        }
        if (this.shiftCutTimer > 0) {
          this.shiftCutTimer = Math.max(0, this.shiftCutTimer - dt);
          effectiveThrottle *= 0.18;
        }
        this.playerRpm = THREE.MathUtils.damp(this.playerRpm, targetRpm, 12, dt);

        const rpmNorm = THREE.MathUtils.clamp(
          (this.playerRpm - spec.IDLE_RPM) / Math.max(1, spec.REDLINE_RPM - spec.IDLE_RPM),
          0,
          1,
        );
        const torqueCurve = isBike
          ? 0.68 + 0.45 * Math.sin(rpmNorm * Math.PI * 0.88)
          : 0.58 + 0.54 * Math.pow(Math.sin(rpmNorm * Math.PI * 0.85), 0.85);
        const gearMultiplier = isBike
          ? Math.min(2.15, spec.GEAR_RATIOS[this.playerGear - 1] / 1.4)
          : Math.min(2.35, spec.GEAR_RATIOS[this.playerGear - 1] / 1.12);

        driveForce =
          effectiveThrottle *
          spec.MAX_ENGINE_FORCE_N *
          torqueCurve *
          gearMultiplier *
          (slipstream ? 1.12 : 1.0);

        if (throttle === 0 && brake === 0 && speedMs > 1.0) {
          regenOrEngineBrakeForce = spec.MASS_KG * (0.14 + 0.24 * rpmNorm);
        }
      }

      const dragFactor = slipstream ? 0.78 : 1.0;
      const aeroDrag = 0.5 * spec.AIR_DENSITY * spec.DRAG_COEFF_AREA * speedMs * speedMs * dragFactor;
      const rollingDrag = spec.MASS_KG * 9.81 * spec.ROLLING_RESISTANCE;
      const slopePitch = inViaduct
        ? sampleJctOverpassWorld(this.jctState!.worldS, this.jctState!.t, this.jctState!.lateralOffset).pitch
        : Math.atan(getSurfaceSlopeAt(this.playerS, this.playerLaneOffset));
      const slopeGravity = spec.MASS_KG * 9.81 * Math.sin(slopePitch);

      const downforce = spec.DOWNFORCE_COEFF * speedMs * speedMs;
      const normalForce = spec.MASS_KG * 9.81 + downforce;
      const maxTireForce = normalForce * roadFriction;

      const requestedBrake = brake * spec.MAX_BRAKE_FORCE_N;
      const actualBrake = Math.min(requestedBrake, maxTireForce);
      absActive = brake > 0.5 && requestedBrake > maxTireForce * 0.92 && speedKmh > 35;

      const netLongForce =
        driveForce - aeroDrag - rollingDrag - slopeGravity - actualBrake - regenOrEngineBrakeForce;
      accelLong = netLongForce / spec.MASS_KG;

      this.playerSpeedMs = THREE.MathUtils.clamp(
        this.playerSpeedMs + accelLong * dt,
        0,
        spec.MAX_SPEED_MS + 0.2,
      );

      brakeAudioAmt = brake;
      brakeTailActive = brake > 0.1 || (spec.IS_DIRECT_DRIVE && regenOrEngineBrakeForce > spec.MASS_KG * 0.75);
    }

    const absSpeedMs = Math.abs(this.playerSpeedMs);
    const curKmh = this.playerSpeedMs * 3.6;
    const curAbsKmh = absSpeedMs * 3.6;
    if (curKmh > this.maxSpeedKmh) this.maxSpeedKmh = curKmh;

    this.distanceM += absSpeedMs * dt;

    if (!this.hit300Triggered && curKmh >= 298.5) {
      this.hit300Triggered = true;
      this.audio.playChime('alert');
      this.pushSafetyBanner({
        title: '【祝・300km/h到達】ゲーム内最高速リミッター作動！',
        body: '時速300kmは1秒で83.3m進む世界です。現実の高速道路（原則100km/h・指定区間のみ120km/h）では絶対にマネしないでください！',
        tone: 'humor',
      });
    }

    this.tipTimer -= dt;
    if (this.tipTimer <= 0) {
      this.tipTimer = 24;
      const tip = HUMOROUS_SAFETY_TIPS[this.tipIndex % HUMOROUS_SAFETY_TIPS.length];
      this.tipIndex++;
      this.pushSafetyBanner(tip);
    }

    // Precision asymmetric steering ramp: micro-taps on bike yield tiny surgical adjustments,
    // while cars have weighted rack damping + progressive steering response & friction-circle grip coupling.
    const isBike = this.vehicleType === 'bike';
    const isReleasingOrCounter =
      Math.abs(steerInput) < 0.05 ||
      (Math.sign(steerInput) !== Math.sign(this.playerSteer) && Math.abs(this.playerSteer) > 0.05) ||
      Math.abs(steerInput) < Math.abs(this.playerSteer);
    const steerLambda = isBike
      ? isReleasingOrCounter
        ? 14.5
        : 4.6
      : isReleasingOrCounter
        ? 10.5
        : 5.4;
    this.playerSteer = THREE.MathUtils.damp(this.playerSteer, steerInput, steerLambda, dt);
    const steerAbs = Math.abs(this.playerSteer);
    const shapedSteer = isBike
      ? Math.sign(this.playerSteer) * Math.pow(steerAbs, 1.55)
      : Math.sign(this.playerSteer) * Math.pow(steerAbs, 1.25);

    const steerRollAuthority = THREE.MathUtils.clamp(absSpeedMs / 8.5, 0, 1);
    const combinedGrip = isBike ? 1.0 : Math.sqrt(Math.max(0.28, 1 - 0.52 * brake * brake));

    // Check SA/PA Plaza Free-Roam entry
    if (!this.jctState && !this.inFreePlaza) {
      const prof = getFacilityProfileAt(this.playerS);
      if (prof.isPlaza && this.playerLaneOffset < prof.islandLeftX - 0.6) {
        this.inFreePlaza = true;
        this.plazaHeading = THREE.MathUtils.clamp(this.playerRelYaw, -0.55, 0.55);
        this.playerLatVel = 0;
      }
    }

    if (inViaduct && this.jctState) {
      // Phase 1: Curved Elevated JCT Overpass Viaduct -> seamlessly enters Phase 2 (5,000m JCT Highway)
      const highSpeedStab = isBike
        ? THREE.MathUtils.lerp(1.0, 0.72, THREE.MathUtils.clamp((curAbsKmh - 100) / 200, 0, 1))
        : THREE.MathUtils.lerp(1.0, 0.56, THREE.MathUtils.clamp((curAbsKmh - 60) / 240, 0, 1));
      const maxLatSpeed =
        (isBike ? 10.2 : 6.8) * spec.STEER_AUTHORITY * Math.sqrt(roadFriction) * highSpeedStab * combinedGrip;
      const desiredLatVel = shapedSteer * steerRollAuthority * maxLatSpeed;
      const latGripLambda =
        absSpeedMs < 0.25
          ? isBike
            ? 20
            : 18
          : isBike
            ? (Math.abs(desiredLatVel) < 0.2 ? 11.5 : 7.5) * roadFriction
            : 4.6 * roadFriction * combinedGrip;
      this.playerLatVel = THREE.MathUtils.damp(this.playerLatVel, desiredLatVel, latGripLambda, dt);
      if (absSpeedMs < 0.08 && Math.abs(this.playerLatVel) < 0.05) this.playerLatVel = 0;

      const jctLen = getJctCurveLength();
      this.jctState.t += (this.playerSpeedMs * dt) / jctLen;
      this.jctState.lateralOffset += this.playerLatVel * dt;

      const viaductHalfBound = 3.6 - spec.HALF_WIDTH_M;
      if (this.jctState.lateralOffset < -viaductHalfBound) {
        this.jctState.lateralOffset = -viaductHalfBound;
        if (this.playerLatVel < -1.5) {
          this.audio.playImpact(0.35);
          this.cameraShake = 0.25;
        }
        this.playerLatVel = Math.max(0, -this.playerLatVel * 0.35);
        this.playerSpeedMs *= 0.985;
      } else if (this.jctState.lateralOffset > viaductHalfBound) {
        this.jctState.lateralOffset = viaductHalfBound;
        if (this.playerLatVel > 1.5) {
          this.audio.playImpact(0.35);
          this.cameraShake = 0.25;
        }
        this.playerLatVel = Math.min(0, -this.playerLatVel * 0.35);
        this.playerSpeedMs *= 0.985;
      }

      if (this.jctState.t < 0) {
        this.playerS = this.jctState.worldS - 106;
        this.playerLaneOffset = THREE.MathUtils.clamp(-20.2 + this.jctState.lateralOffset, -24.5, -17.0);
        this.jctState = null;
      } else if (this.jctState.t >= 1.0) {
        const m = this.jctState.milestone;
        this.jctState.phase = 'highway';
        this.world.setJctBranch(m);
        this.playerS = 50;
        this.playerLaneOffset = THREE.MathUtils.clamp(this.jctState.lateralOffset, -4.5, 4.5);
        this.playerRelYaw = 0;
        this.playerLatVel = 0;
        this.inFreePlaza = false;
        this.camInitialized = false;
        this.score += 500;
        this.audio.playChime('nearMiss');
        this.resetTrafficPositions();
        this.pushSafetyBanner({
          title: `【${m.nameJa} 連絡道進入！ +500pts】`,
          body: `${m.branchNameJa} 方面へ接続する 5.0km JCT連絡自動車道へ進入しました！終点ゲートまで 5km 走れます。`,
          tone: 'info',
        });
      }
    } else if (this.inFreePlaza) {
      // True 2D Ackermann Planar Steering inside SA / PA Parking Plazas (forward + reverse + 360° turning!)
      const steerAngleRad = -shapedSteer * (isBike ? 0.5 : 0.62);
      const effectiveWheelbase = isBike ? Math.max(2.15, spec.WHEELBASE_M) : spec.WHEELBASE_M;
      const yawRate = steerAngleRad * (this.playerSpeedMs / effectiveWheelbase) * 1.15;
      this.plazaHeading += yawRate * dt;
      // Keep heading normalized to [-PI, PI]
      if (this.plazaHeading > Math.PI) this.plazaHeading -= Math.PI * 2;
      if (this.plazaHeading < -Math.PI) this.plazaHeading += Math.PI * 2;

      const dS = Math.cos(this.plazaHeading) * this.playerSpeedMs * dt;
      const dLane = -Math.sin(this.plazaHeading) * this.playerSpeedMs * dt;
      this.playerS += dS;
      this.playerLaneOffset += dLane;
      this.playerLatVel = 0;

      const prof = getFacilityProfileAt(this.playerS);
      if (prof.milestone && (prof.milestone.type === 'sa' || prof.milestone.type === 'pa')) {
        const isSa = prof.milestone.type === 'sa';
        const leftCurb = prof.outerX + spec.HALF_WIDTH_M + 0.45;
        const rightCurb = prof.islandLeftX - spec.HALF_WIDTH_M - 0.55;

        if (this.playerLaneOffset < leftCurb) {
          this.playerLaneOffset = leftCurb;
          if (absSpeedMs > 2.5) {
            this.audio.playImpact(0.25);
            this.cameraShake = 0.16;
            this.playerSpeedMs *= 0.72;
          }
        } else if (this.playerLaneOffset > rightCurb) {
          this.playerLaneOffset = rightCurb;
          if (absSpeedMs > 2.5) {
            this.audio.playImpact(0.25);
            this.cameraShake = 0.16;
            this.playerSpeedMs *= 0.72;
          }
        }

        const entryMinS = this.playerS - prof.ds - (isSa ? 78 : 58);
        if (prof.ds < -(isSa ? 78 : 58) && dS < 0) {
          this.playerS = entryMinS;
          if (absSpeedMs > 2.5) {
            this.audio.playImpact(0.22);
            this.playerSpeedMs *= 0.6;
          }
        } else if (prof.ds > (isSa ? 76 : 56) && dS > 0) {
          // Exiting plaza forward onto the dedicated exit S-curve & acceleration lane
          this.inFreePlaza = false;
          this.playerRelYaw = THREE.MathUtils.clamp(this.plazaHeading, -0.55, 0.55);
          this.playerLatVel = -Math.sin(this.playerRelYaw) * this.playerSpeedMs;
          this.plazaHeading = 0;
        }
      } else {
        this.inFreePlaza = false;
        this.playerRelYaw = THREE.MathUtils.clamp(this.plazaHeading, -0.55, 0.55);
        this.plazaHeading = 0;
      }
    } else {
      // Standard Mainline / Deceleration / Merge / IC Ramp / JCT 5km Branch Highway Kinematics
      const highSpeedStab = isBike
        ? THREE.MathUtils.lerp(1.0, 0.72, THREE.MathUtils.clamp((curAbsKmh - 100) / 200, 0, 1))
        : THREE.MathUtils.lerp(1.0, 0.56, THREE.MathUtils.clamp((curAbsKmh - 60) / 240, 0, 1));
      const maxLatSpeed =
        (isBike ? 10.2 : 6.8) * spec.STEER_AUTHORITY * Math.sqrt(roadFriction) * highSpeedStab * combinedGrip;
      const desiredLatVel = shapedSteer * steerRollAuthority * maxLatSpeed;

      const dsStep = 2.0;
      const dx1 = roadCenterDX(this.playerS);
      const dx2 = roadCenterDX(this.playerS + dsStep);
      const curvature = (dx2 - dx1) / dsStep;
      const centrifugalPush = curvature * this.playerSpeedMs * absSpeedMs * (isBike ? 0.34 : 0.52);

      const latGripLambda =
        absSpeedMs < 0.25
          ? isBike
            ? 20
            : 18
          : isBike
            ? (Math.abs(desiredLatVel) < 0.2 ? 11.5 : 7.5) * roadFriction
            : 4.6 * roadFriction * combinedGrip;
      this.playerLatVel = THREE.MathUtils.damp(
        this.playerLatVel,
        desiredLatVel - centrifugalPush * 0.25,
        latGripLambda,
        dt,
      );
      if (absSpeedMs < 0.08 && Math.abs(this.playerLatVel) < 0.05) {
        this.playerLatVel = 0;
      }

      this.playerS = Math.max(5, this.playerS + this.playerSpeedMs * dt);
      this.playerLaneOffset += this.playerLatVel * dt;

      if (inJctHighway && this.jctState) {
        // Phase 2: 5,000m Drivable JCT Branch Expressway
        const leftBound = -8.375 + spec.HALF_WIDTH_M + 0.35;
        const rightBound = 7.325 - spec.HALF_WIDTH_M - 0.35;

        if (this.playerLaneOffset < leftBound) {
          this.playerLaneOffset = leftBound;
          if (this.playerLatVel < -1.5) {
            this.audio.playImpact(0.35);
            this.cameraShake = 0.25;
          }
          this.playerLatVel = Math.max(0, -this.playerLatVel * 0.35);
          this.playerSpeedMs *= 0.985;
        } else if (this.playerLaneOffset > rightBound) {
          this.playerLaneOffset = rightBound;
          if (this.playerLatVel > 1.5) {
            this.audio.playImpact(0.35);
            this.cameraShake = 0.25;
          }
          this.playerLatVel = Math.min(0, -this.playerLatVel * 0.35);
          this.playerSpeedMs *= 0.985;
        }

        if (
          this.playerS >= JCT_BRANCH_LENGTH_M &&
          Math.abs(this.jctState.worldS - this.jctClearTriggeredForS) > 300
        ) {
          this.jctClearTriggeredForS = this.jctState.worldS;
          const m = this.jctState.milestone;
          this.score += 2500;
          this.audio.playChime('nearMiss');
          this.running = false;
          this.onIcExitClear?.({
            kind: 'jct',
            icName: m.nameJa,
            branchName: m.branchNameJa,
            distanceKm: this.distanceM / 1000,
            maxSpeedKmh: this.maxSpeedKmh,
            overtakeCount: this.overtakeCount,
            nearMissCount: this.nearMissCount,
            score: this.score,
            jctBranchCompleted: true,
          });
        }
      } else {
        const offBounds = getOffMainlineBounds(this.playerS, this.playerLaneOffset);
        const {
          leftBound: rawLeftBound,
          rightBound: rawRightBound,
          inSaApron,
          inMergeLane,
          inIcRamp,
          inJctRamp,
          activeSa,
          activeIc,
          activeJct,
          icDs,
          jctDs,
        } = offBounds;

        const widthMarginDelta = spec.HALF_WIDTH_M - 0.94;
        const leftBound = rawLeftBound + widthMarginDelta;
        const rightBound = rawRightBound - widthMarginDelta;

        // Announce upcoming NEOPASA SA / PA / IC / JCT early and clearly
        const nextM = getNextMilestoneAhead(this.playerS);
        if (nextM.distM < 520 && nextM.milestone.id !== this.lastAnnouncedMilestoneId) {
          this.lastAnnouncedMilestoneId = nextM.milestone.id;
          const distRounded = Math.round(nextM.distM / 10) * 10;
          if (nextM.milestone.type === 'sa') {
            this.pushSafetyBanner({
              title: `【あと${distRounded}m】${nextM.milestone.nameJa}（SA入口・左へ）`,
              body: `${nextM.milestone.featureJa}。構内は自由走行で駐車枠 [P] に停められます！`,
              tone: 'info',
            });
          } else if (nextM.milestone.type === 'pa') {
            this.pushSafetyBanner({
              title: `【あと${distRounded}m】${nextM.milestone.nameJa}（PA入口・左へ）`,
              body: `${nextM.milestone.featureJa}。構内は前後左右＆バックで自由に駐車できます！`,
              tone: 'info',
            });
          } else if (nextM.milestone.type === 'ic') {
            this.pushSafetyBanner({
              title: `【IC出口・ゴール可能】あと${distRounded}m：${nextM.milestone.nameJa}`,
              body: `左ランプ（4レーン ETC/一般料金所）を通過すると ${nextM.milestone.nameJa} ゴールクリア！本線直進もOK`,
              tone: 'humor',
            });
          } else if (nextM.milestone.type === 'jct') {
            this.pushSafetyBanner({
              title: `【JCT分岐・5km走行可】あと${distRounded}m：${nextM.milestone.nameJa}`,
              body: `左ランプへ進入すると ${nextM.milestone.routeCode}（${nextM.milestone.branchNameJa}）高架＆5km連絡道を走れます！`,
              tone: 'info',
            });
          }
        }

        // Seamless entry onto curved elevated JCT viaduct deck (Phase 1)
        if (inJctRamp && activeJct && jctDs >= -105) {
          const jctWorldS = this.playerS - jctDs;
          this.jctState = {
            milestone: activeJct,
            phase: 'viaduct',
            worldS: jctWorldS,
            t: Math.max(0, (jctDs + 105) / getJctCurveLength()),
            lateralOffset: THREE.MathUtils.clamp(this.playerLaneOffset + 20.2, -3.0, 3.0),
          };
          this.pushSafetyBanner({
            title: `【JCT高架ランプ進入】${activeJct.nameJa}`,
            body: `${activeJct.branchNameJa} 方面高架を通過後、5.0km のJCT連絡自動車道へ合流します！`,
            tone: 'info',
          });
        }

        // IC Exit 4-Lane Toll Gate Clear Check
        if (inIcRamp && activeIc && icDs >= 42 && Math.abs(this.playerS - this.icClearTriggeredForS) > 300) {
          this.icClearTriggeredForS = this.playerS;
          this.score += 1500;
          this.audio.playChime('nearMiss');
          this.running = false;
          this.onIcExitClear?.({
            kind: 'ic',
            icName: activeIc.nameJa,
            branchName: activeIc.branchNameJa,
            distanceKm: this.distanceM / 1000,
            maxSpeedKmh: this.maxSpeedKmh,
            overtakeCount: this.overtakeCount,
            nearMissCount: this.nearMissCount,
            score: this.score,
          });
        }

        // SA / PA pit-stop / rest bonus & natural merge feedback
        if (inSaApron && activeSa) {
          this.wasInSaApron = true;
          if (this.saRestAwardedId !== activeSa.id && curKmh < 115) {
            this.saRestAwardedId = activeSa.id;
            const bonusPts = activeSa.type === 'pa' ? 350 : 500;
            this.score += bonusPts;
            this.audio.playChime('nearMiss');
            this.pushSafetyBanner({
              title: activeSa.restBonusTitleJa ?? `【${activeSa.nameJa} 入庫】休憩ボーナス +${bonusPts}pts！`,
              body:
                activeSa.restBonusBodyJa ??
                '構内では通常車のように前後左右＆バックで自由に移動・駐車(+800pts)できます！',
              tone: 'humor',
            });
          }
        } else if (this.wasInSaApron && !inSaApron && !inMergeLane && !activeSa) {
          this.wasInSaApron = false;
          this.pushSafetyBanner({
            title: '【本線合流完了】E1A 新東名 本線へ復帰',
            body: '加速車線からのスムーズな合流ありがとうございます！本線のリアルな交通フローに合わせて走行しましょう。',
            tone: 'info',
          });
        }

        if (this.playerLaneOffset < leftBound) {
          this.playerLaneOffset = leftBound;
          if (this.playerLatVel < -1.5) {
            this.audio.playImpact(0.35);
            this.cameraShake = 0.25;
          }
          this.playerLatVel = Math.max(0, -this.playerLatVel * 0.35);
          this.playerSpeedMs *= 0.985;
        } else if (this.playerLaneOffset > rightBound) {
          this.playerLaneOffset = rightBound;
          if (this.playerLatVel > 1.5) {
            this.audio.playImpact(0.35);
            this.cameraShake = 0.25;
          }
          this.playerLatVel = Math.min(0, -this.playerLatVel * 0.35);
          this.playerSpeedMs *= 0.985;
        }

        if (this.playerS >= ROUTE_TOTAL_LENGTH_M && Math.abs(this.playerS - this.icClearTriggeredForS) > 300) {
          this.icClearTriggeredForS = this.playerS;
          this.playerS = ROUTE_TOTAL_LENGTH_M;
          this.playerSpeedMs = 0;
          this.playerLatVel = 0;
          this.score += 5000;
          this.audio.playChime('nearMiss');
          this.running = false;
          this.onIcExitClear?.({
            kind: 'jct',
            icName: '浜松いなさJCT（新東名 全線走破）',
            branchName: '伊勢原JCT〜浜松いなさJCT 実距離212km完走',
            distanceKm: this.distanceM / 1000,
            maxSpeedKmh: this.maxSpeedKmh,
            overtakeCount: this.overtakeCount,
            nearMissCount: this.nearMissCount,
            score: this.score,
            routeCompleted: true,
          });
        }
      }
    }

    if (this.inFreePlaza) {
      this.playerRelYaw = this.plazaHeading;
    } else {
      const yawReverseSign = this.playerSpeedMs >= -0.05 ? 1 : -1;
      const targetRelYaw = isBike
        ? -this.playerLatVel * 0.018 * yawReverseSign
        : Math.atan2(-this.playerLatVel, Math.max(8.5, absSpeedMs)) * 0.88 * yawReverseSign;
      this.playerRelYaw = THREE.MathUtils.damp(this.playerRelYaw, targetRelYaw, 10, dt);
    }

    const targetPitch = (accelLong / 9.81) * (isBike ? 0.036 : 0.022);
    const targetRoll = isBike
      ? -(this.inFreePlaza
          ? THREE.MathUtils.clamp(shapedSteer * (this.playerSpeedMs / 6), -1, 1)
          : THREE.MathUtils.clamp(
              shapedSteer * steerRollAuthority * 0.68 + (this.playerLatVel / 7.2) * 0.32,
              -1,
              1,
            )) * spec.MAX_ROLL_RAD
      : (this.playerLatVel / 6.5) * spec.MAX_ROLL_RAD;
    this.playerPitch = THREE.MathUtils.damp(this.playerPitch, targetPitch, 9, dt);
    this.playerRoll = THREE.MathUtils.damp(this.playerRoll, targetRoll, isBike ? 7.5 : 9, dt);

    this.playerCar.tailLightMaterial.emissiveIntensity =
      brakeTailActive ? 5.2 : lightsOnIntensity(this.activeWeather, inTunnel);

    // Ultra-HD Dynamic Rear Brake PointLight, Glowing Carbon-Ceramic Brake Rotors & Exhaust Shift Flame
    const isUltra = !this.isSoftwareGl && this.qualityMode === QualityMode.Ultra;
    if (this.brakePointLight) {
      this.brakePointLight.intensity = isUltra && brakeTailActive ? 6.5 : 0;
    }
    const targetBrakeGlow =
      isUltra && brakeAudioAmt > 0.25 && curAbsKmh > 80 ? Math.min(2.6, (curAbsKmh - 70) / 80) : 0;
    this.brakeGlow = THREE.MathUtils.damp(
      this.brakeGlow,
      targetBrakeGlow,
      targetBrakeGlow > this.brakeGlow ? 5 : 2.5,
      dt,
    );
    this.playerCar.brakeRotorMat.emissiveIntensity = this.brakeGlow;

    if (this.shiftFlameTimer > 0 && !spec.IS_DIRECT_DRIVE) {
      this.shiftFlameTimer = Math.max(0, this.shiftFlameTimer - dt);
      const t = this.shiftFlameTimer / 0.16;
      this.playerCar.exhaustFlameGroup.visible = isUltra;
      this.playerCar.exhaustFlameMat.opacity = t * 0.92;
      this.playerCar.exhaustFlameGroup.scale.set(1, 1, 0.7 + t * 0.8);
      if (this.exhaustFlashLight) {
        this.exhaustFlashLight.intensity = isUltra ? t * 14.0 : 0;
      }
    } else {
      this.playerCar.exhaustFlameGroup.visible = false;
      if (this.exhaustFlashLight) {
        this.exhaustFlashLight.intensity = 0;
      }
    }

    this.syncPlayerCarTransform(dt, steerInput);

    if (curKmh > 120) {
      this.score += Math.round((curKmh - 100) * dt * 0.5);
    }

    if (this.nearMissStreakTimer > 0) {
      this.nearMissStreakTimer -= dt;
      if (this.nearMissStreakTimer <= 0) this.nearMissStreak = 0;
    }

    const latSlip = this.inFreePlaza
      ? 0
      : Math.max(0, (Math.abs(this.playerLatVel) - 4.8 * roadFriction) / 5);
    const tireSlip = Math.min(1, latSlip + (absActive ? 0.55 : 0));

    this.audio.update({
      active: true,
      vehicleType: this.vehicleType,
      speedKmh: curKmh,
      rpm: this.playerRpm,
      throttle: effectiveThrottle,
      brake: brakeAudioAmt,
      isReversing: this.isReversing,
      rainAmount: this.curRainAmount,
      tireSlip,
      inTunnel,
    });

    return { slipstream, tireSlip, absActive };
  }

  private syncPlayerCarTransform(dt: number, steerInput: number): void {
    const spec = VEHICLE_SPECS[this.vehicleType];
    if (this.jctState?.phase === 'viaduct') {
      const pose = sampleJctOverpassWorld(
        this.jctState.worldS,
        this.jctState.t,
        this.jctState.lateralOffset,
      );
      this.playerCar.root.position.set(pose.x, pose.y, pose.z);
      this.playerCar.root.rotation.set(pose.pitch, pose.yaw + this.playerRelYaw, 0);
    } else {
      const roadX = roadCenterX(this.playerS);
      const roadY = getSurfaceElevationAt(this.playerS, this.playerLaneOffset);
      const roadYaw = -Math.atan2(roadCenterDX(this.playerS), 1);
      const roadPitch = this.inFreePlaza
        ? Math.atan(getSurfaceSlopeAt(this.playerS, this.playerLaneOffset)) * Math.cos(this.plazaHeading)
        : Math.atan(getSurfaceSlopeAt(this.playerS, this.playerLaneOffset));

      this.playerCar.root.position.set(roadX + this.playerLaneOffset, roadY, -this.playerS);
      this.playerCar.root.rotation.set(roadPitch, roadYaw + this.playerRelYaw, 0);
    }
    this.playerCar.bodyPivot.rotation.set(this.playerPitch, 0, this.playerRoll);

    this.wheelSpinAngle -= (this.playerSpeedMs / spec.WHEEL_RADIUS_M) * dt;
    for (const w of this.playerCar.wheels) {
      w.rotation.x = this.wheelSpinAngle;
    }
    for (const pivot of this.playerCar.frontSteerPivots) {
      pivot.rotation.y = -steerInput * (this.inFreePlaza ? 0.52 : 0.24);
    }
  }

  private syncAttractCarTransform(dt: number, attractSpeedMs: number): void {
    const spec = VEHICLE_SPECS[this.vehicleType];
    const roadX = roadCenterX(this.attractS);
    const roadY = getSurfaceElevationAt(this.attractS, 0);
    const roadYaw = -Math.atan2(roadCenterDX(this.attractS), 1);
    const roadPitch = Math.atan(getSurfaceSlopeAt(this.attractS, 0));

    this.playerCar.root.position.set(roadX, roadY, -this.attractS);
    this.playerCar.root.rotation.set(roadPitch, roadYaw, 0);
    this.playerCar.bodyPivot.rotation.set(0, 0, 0);
    this.playerCar.exhaustFlameGroup.visible = false;
    this.playerCar.tailLightMaterial.emissiveIntensity = lightsOnIntensity(
      this.activeWeather,
      isTunnelAt(this.attractS),
    );
    if (this.brakePointLight) this.brakePointLight.intensity = 0;
    if (this.exhaustFlashLight) this.exhaustFlashLight.intensity = 0;

    this.wheelSpinAngle -= (attractSpeedMs / spec.WHEEL_RADIUS_M) * dt;
    for (const w of this.playerCar.wheels) {
      w.rotation.x = this.wheelSpinAngle;
    }
    for (const pivot of this.playerCar.frontSteerPivots) {
      pivot.rotation.y = 0;
    }
  }

  private stepTraffic(dt: number, refS = this.playerS, enablePlayerInteraction = this.running): void {
    const preset = TRAFFIC_PRESETS[this.trafficDensity];
    const headlightsOn = WEATHER_CONFIG[this.activeWeather].headlightsRequired;
    const blinkPhase = Math.floor(performance.now() / 320) % 2 === 0;
    const patrolPhase = Math.floor(performance.now() / 190) % 2 === 0;
    const playerSpec = VEHICLE_SPECS[this.vehicleType];
    const inViaduct = this.jctState?.phase === 'viaduct';
    const playerInMerge =
      enablePlayerInteraction &&
      !this.jctState &&
      getOffMainlineBounds(refS, this.playerLaneOffset).inMergeLane;

    if (this.laneSplitCooldown > 0) this.laneSplitCooldown -= dt;

    for (let i = 0; i < this.sameDirPool.length; i++) {
      const tv = this.sameDirPool[i];
      if (!tv.active) continue;

      const spec = TRAFFIC_SPECS[tv.archetype];
      let minGap = 999;
      let aheadSpeed = tv.cruiseSpeedMs;
      for (let j = 0; j < this.sameDirPool.length; j++) {
        if (i === j) continue;
        const other = this.sameDirPool[j];
        if (!other.active) continue;
        const ds = other.s - tv.s;
        if (ds > 0 && ds < minGap && Math.abs(other.laneOffset - tv.laneOffset) < 2.2) {
          minGap = ds;
          aheadSpeed = other.speedMs;
        }
      }

      // Courteous yield: Lane 0 drivers politely signal and glide smoothly to Lane 1 when player merges
      if (
        playerInMerge &&
        tv.currentLane === 0 &&
        tv.blinkerDir === 0 &&
        tv.s - this.playerS > 4 &&
        tv.s - this.playerS < 68 &&
        this.isLaneClearForTraffic(tv, 1, true)
      ) {
        tv.blinkerDir = 1;
        tv.blinkerWaitTimer = 0.85;
        tv.isYieldLaneChange = true;
        tv.targetLane = 1;
        tv.laneChangeStartX = tv.laneOffset;
        tv.laneChangeProgress = 0;
        tv.laneChangeDuration = 2.3;
        tv.laneChangeLatVel = 0;
      }

      const safeDist = 30 + tv.speedMs * 0.95;
      if (minGap < safeDist) {
        const targetV = Math.max(16, aheadSpeed * (minGap < 18 ? 0.78 : 0.96));
        tv.isBraking = targetV < tv.speedMs - 0.6;
        tv.speedMs = THREE.MathUtils.damp(tv.speedMs, targetV, 2.8, dt);

        tv.laneChangeCooldown -= dt;
        if (tv.laneChangeCooldown <= 0 && tv.blinkerDir === 0 && tv.archetype !== TrafficArchetype.BoxTruck) {
          const candidateLane = tv.currentLane < 2 ? tv.currentLane + 1 : 1;
          if (this.isLaneClearForTraffic(tv, candidateLane)) {
            tv.blinkerDir = candidateLane > tv.currentLane ? 1 : -1;
            tv.blinkerWaitTimer = 1.65; // ~3+ distinct blinker flashes before crossing the lane line
            tv.isYieldLaneChange = false;
            tv.targetLane = candidateLane;
            tv.laneChangeStartX = tv.laneOffset;
            tv.laneChangeProgress = 0;
            tv.laneChangeDuration = tv.archetype === TrafficArchetype.SportsCoupe ? 2.45 : 3.05;
            tv.laneChangeLatVel = 0;
          }
          tv.laneChangeCooldown = 6 + Math.random() * 7;
        }
      } else {
        tv.isBraking = false;
        tv.speedMs = THREE.MathUtils.damp(tv.speedMs, tv.cruiseSpeedMs, 1.4, dt);

        if (tv.currentLane === 2 && tv.blinkerDir === 0) {
          tv.laneChangeCooldown -= dt;
          if (tv.laneChangeCooldown <= 0 && this.isLaneClearForTraffic(tv, 1)) {
            tv.blinkerDir = -1;
            tv.blinkerWaitTimer = 1.8;
            tv.isYieldLaneChange = false;
            tv.targetLane = 1;
            tv.laneChangeStartX = tv.laneOffset;
            tv.laneChangeProgress = 0;
            tv.laneChangeDuration = 3.15;
            tv.laneChangeLatVel = 0;
            tv.laneChangeCooldown = 7 + Math.random() * 7;
          }
        }
      }

      if (tv.blinkerDir !== 0) {
        if (tv.blinkerWaitTimer > 0) {
          tv.blinkerWaitTimer -= dt;
          tv.laneChangeLatVel = 0;
          // Abort smoothly before moving if the target lane became occupied by player/traffic
          if (!this.isLaneClearForTraffic(tv, tv.targetLane, tv.isYieldLaneChange)) {
            tv.blinkerDir = 0;
            tv.blinkerWaitTimer = 0;
            tv.targetLane = tv.currentLane;
            tv.laneChangeCooldown = 3.5;
          }
        } else {
          const targetX = EXPRESSWAY.LANE_CENTERS[tv.targetLane];
          tv.laneChangeProgress = Math.min(1, tv.laneChangeProgress + dt / tv.laneChangeDuration);
          const p = tv.laneChangeProgress;
          const smooth = p * p * (3 - 2 * p);
          tv.laneOffset = THREE.MathUtils.lerp(tv.laneChangeStartX, targetX, smooth);
          tv.laneChangeLatVel =
            ((targetX - tv.laneChangeStartX) * (6 * p * (1 - p))) / tv.laneChangeDuration;
          if (p >= 1) {
            tv.laneOffset = targetX;
            tv.currentLane = tv.targetLane;
            tv.blinkerDir = 0;
            tv.laneChangeProgress = 0;
            tv.laneChangeLatVel = 0;
          }
        }
      } else {
        tv.laneChangeLatVel = 0;
      }

      tv.s += tv.speedMs * dt;

      const relS = tv.s - refS;
      if (relS < -85 || relS > 760) {
        const respawnBehind = relS > 760 && refS > 125;
        let lane = spec.preferredLanes[Math.floor(Math.random() * spec.preferredLanes.length)];
        let candidateS = respawnBehind
          ? refS - 65 - Math.random() * 25
          : refS + 600 + Math.random() * 140;

        for (let attempt = 0; attempt < 8; attempt++) {
          const checkLane =
            spec.preferredLanes[(spec.preferredLanes.indexOf(lane) + attempt) % spec.preferredLanes.length];
          const conflict = this.sameDirPool.some((other) => {
            if (!other.active || other === tv) return false;
            const sameLane =
              other.currentLane === checkLane ||
              (other.blinkerDir !== 0 && other.targetLane === checkLane);
            return sameLane && Math.abs(other.s - candidateS) < 52;
          });
          if (!conflict) {
            lane = checkLane;
            break;
          }
          if (attempt % spec.preferredLanes.length === spec.preferredLanes.length - 1) {
            candidateS += respawnBehind ? -54 : 58;
          }
        }

        tv.s = candidateS;
        tv.currentLane = lane;
        tv.targetLane = lane;
        tv.laneOffset = EXPRESSWAY.LANE_CENTERS[lane];
        tv.blinkerDir = 0;
        tv.blinkerWaitTimer = 0;
        tv.isYieldLaneChange = false;
        tv.laneChangeStartX = tv.laneOffset;
        tv.laneChangeProgress = 0;
        tv.laneChangeLatVel = 0;
        tv.nearMissAwarded = false;
        tv.patrolWarned = false;
        tv.cruiseSpeedMs = THREE.MathUtils.lerp(spec.minSpeedKmh, spec.maxSpeedKmh, Math.random()) / 3.6;
        tv.speedMs = tv.cruiseSpeedMs;
      }

      const tx = roadCenterX(tv.s) + tv.laneOffset;
      const ty = roadElevationY(tv.s);
      const tYaw = -Math.atan2(roadCenterDX(tv.s), 1);
      const laneChangeYaw = tv.speedMs > 1 ? Math.atan2(-tv.laneChangeLatVel, tv.speedMs) * 0.9 : 0;
      const tPitch = Math.atan(roadElevationDY(tv.s));
      tv.rig.root.position.set(tx, ty, -tv.s);
      tv.rig.root.rotation.set(tPitch, tYaw + laneChangeYaw, 0);

      for (const w of tv.rig.wheels) {
        w.rotation.x -= (tv.speedMs / 0.34) * dt;
      }

      const inTun = isTunnelAt(tv.s);
      tv.rig.tailLightMat.emissiveIntensity = tv.isBraking ? 4.2 : headlightsOn || inTun ? 1.5 : 0.35;
      tv.rig.headLightMat.emissiveIntensity = headlightsOn || inTun ? 2.4 : 0.25;
      tv.rig.leftBlinkerMat.emissiveIntensity = tv.blinkerDir === -1 && blinkPhase ? 3.8 : 0.0;
      tv.rig.rightBlinkerMat.emissiveIntensity = tv.blinkerDir === 1 && blinkPhase ? 3.8 : 0.0;

      if (tv.rig.patrolLightLeftMat && tv.rig.patrolLightRightMat) {
        tv.rig.patrolLightLeftMat.emissiveIntensity = patrolPhase ? 3.5 : 0.2;
        tv.rig.patrolLightRightMat.emissiveIntensity = patrolPhase ? 0.2 : 3.5;
      }
      if (tv.rig.patrolFrontFlashMat) {
        tv.rig.patrolFrontFlashMat.emissiveIntensity = patrolPhase ? 2.8 : 0.3;
      }

      if (enablePlayerInteraction && !inViaduct && !this.inFreePlaza) {
        const halfLenSum = spec.length * 0.5 + playerSpec.HALF_LENGTH_M;
        const halfWidthSum = spec.width * 0.5 + playerSpec.HALF_WIDTH_M;
        const dS = tv.s - this.playerS;
        const dX = tv.laneOffset - this.playerLaneOffset;

        if (Math.abs(dS) < halfLenSum && Math.abs(dX) < halfWidthSum) {
          const relVel = Math.max(8, this.playerSpeedMs - tv.speedMs);
          this.audio.playImpact(Math.min(1, relVel / 45));
          this.cameraShake = 0.65;
          this.nearMissStreak = 0;

          if (dS > 0) {
            this.playerSpeedMs = Math.max(tv.speedMs * 0.85, this.playerSpeedMs - relVel * 0.55);
            this.playerS = tv.s - halfLenSum - 0.3;
          } else {
            this.playerSpeedMs *= 0.85;
          }
          const pushDir = dX >= 0 ? -1 : 1;
          this.playerLatVel = pushDir * 4.5;
          this.playerLaneOffset += pushDir * 0.45;
          tv.speedMs = Math.min(38, tv.speedMs + 4);
        } else if (!tv.nearMissAwarded && dS < -halfLenSum && dS > -halfLenSum - 6) {
          tv.nearMissAwarded = true;
          this.overtakeCount++;

          const playerKmh = this.playerSpeedMs * 3.6;
          const minPassKmh = this.vehicleType === 'bike' ? 120 : 140;
          if (Math.abs(dX) < halfWidthSum + 1.05 && playerKmh > minPassKmh) {
            this.nearMissCount++;
            this.nearMissStreak++;
            this.nearMissStreakTimer = 5.5;

            // Detect bike lane-splitting right between cars on both sides!
            let isBetweenCars = false;
            if (this.vehicleType === 'bike') {
              const sideSign = Math.sign(dX) || 1;
              for (let k = 0; k < this.sameDirPool.length; k++) {
                if (k === i) continue;
                const opp = this.sameDirPool[k];
                if (!opp.active) continue;
                const oppDx = opp.laneOffset - this.playerLaneOffset;
                const oppDs = opp.s - this.playerS;
                if (
                  Math.sign(oppDx) === -sideSign &&
                  Math.abs(oppDx) < 2.8 &&
                  Math.abs(oppDs) < 11
                ) {
                  isBetweenCars = true;
                  break;
                }
              }
            }

            if (isBetweenCars) {
              this.score += 550 * this.nearMissStreak;
              this.audio.playChime('nearMiss');
              if (this.laneSplitCooldown <= 0) {
                this.laneSplitCooldown = 5.0;
                this.pushSafetyBanner({
                  title: `【車間すり抜け！ ×${this.nearMissStreak} (+${550 * this.nearMissStreak}pts)】`,
                  body: 'バイクのスリムな車幅と緻密ステアで車列の間を見事に抜けました！',
                  tone: 'humor',
                });
              }
            } else {
              this.score += 350 * this.nearMissStreak;
              this.audio.playChime('nearMiss');
            }
          } else {
            this.score += 100;
          }

          if (tv.archetype === TrafficArchetype.PatrolCar && !tv.patrolWarned && playerKmh > 165) {
            tv.patrolWarned = true;
            this.audio.playChime('alert');
            this.pushSafetyBanner({
              title: `【高速隊パトカー通過】${Math.round(playerKmh)}km/h で追越し！`,
              body: 'ここはゲーム特例300km/h区間ですが、現実の新東名は原則100km/h（御殿場〜浜松いなさ指定区間のみ120km/h）です。一発免停＋裁判コースにご注意を！',
              tone: 'warning',
            });
          }
        }
      }
    }

    for (let i = 0; i < Math.min(preset.oncomingCount, this.oncomingPool.length); i++) {
      const ov = this.oncomingPool[i];
      if (!ov.active) continue;
      ov.s -= ov.speedMs * dt;
      if (ov.s < refS - 95 || ov.s > refS + 820) {
        let candidateS = refS + 640 + Math.random() * 140;
        for (let attempt = 0; attempt < 6; attempt++) {
          const conflict = this.oncomingPool.some(
            (other) => other.active && other !== ov && other.currentLane === ov.currentLane && Math.abs(other.s - candidateS) < 55,
          );
          if (!conflict) break;
          candidateS += 60;
        }
        ov.s = candidateS;
      }
      const ox = roadCenterX(ov.s) + ov.laneOffset;
      const oy = roadElevationY(ov.s);
      const oYaw = -Math.atan2(roadCenterDX(ov.s), 1) + Math.PI;
      const oPitch = -Math.atan(roadElevationDY(ov.s));
      ov.rig.root.position.set(ox, oy, -ov.s);
      ov.rig.root.rotation.set(oPitch, oYaw, 0);

      const inTun = isTunnelAt(ov.s);
      ov.rig.headLightMat.emissiveIntensity = headlightsOn || inTun ? 3.5 : 0.4;
      ov.rig.tailLightMat.emissiveIntensity = headlightsOn || inTun ? 1.4 : 0.3;
    }
  }

  private isLaneClearForTraffic(
    mover: TrafficVehicle,
    targetLane: number,
    allowMergeYield = false,
  ): boolean {
    const targetX = EXPRESSWAY.LANE_CENTERS[targetLane];
    for (const other of this.sameDirPool) {
      if (!other.active || other === mover) continue;
      const occupiesTarget =
        Math.abs(other.laneOffset - targetX) < 2.2 ||
        (other.blinkerDir !== 0 && other.targetLane === targetLane);
      if (occupiesTarget && Math.abs(other.s - mover.s) < 46) {
        return false;
      }
    }
    if (!allowMergeYield && Math.abs(this.playerLaneOffset - targetX) < 2.85) {
      const distAhead = mover.s - this.playerS;
      if (Math.abs(distAhead) < 55) {
        return false;
      }
      // Do not pull into the path of a fast-approaching player (< 4.0s time-to-collision)
      if (distAhead > 0) {
        const closingVel = this.playerSpeedMs - mover.speedMs;
        if (closingVel > 2 && distAhead / closingVel < 4.0) {
          return false;
        }
      }
    }
    return true;
  }

  private updateCamera(dt: number, attractS?: number): void {
    const isAttract = attractS !== undefined;
    const spec = VEHICLE_SPECS[this.vehicleType];
    const isBike = this.vehicleType === 'bike';
    const speedKmh = isAttract ? 120 : Math.abs(this.playerSpeedMs) * 3.6;
    const speedNorm = THREE.MathUtils.clamp(speedKmh / 300, 0, 1);
    const aspect = this.camera.aspect || 16 / 9;
    const isPortrait = aspect < 0.9;
    const isMobileLandscape = this.deviceMode === 'mobile' && aspect > 1.55;
    const fovAspectOffset = isPortrait ? 8 : isMobileLandscape ? -4 : 0;

    const targetFov =
      (this.cameraMode === CameraMode.Chase
        ? 58 + speedNorm * 11
        : this.cameraMode === CameraMode.Hood
          ? 64 + speedNorm * 12
          : 66 + speedNorm * 14) + fovAspectOffset;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
    this.camera.updateProjectionMatrix();

    let carX = 0;
    let roadY = 0;
    let carZ = 0;
    let carYaw = 0;
    let carPitch = 0;

    if (isAttract) {
      const roadX = roadCenterX(attractS);
      roadY = getSurfaceElevationAt(attractS, 0);
      carYaw = -Math.atan2(roadCenterDX(attractS), 1);
      carPitch = Math.atan(getSurfaceSlopeAt(attractS, 0));
      carX = roadX;
      carZ = -attractS;
    } else if (this.jctState?.phase === 'viaduct') {
      const pose = sampleJctOverpassWorld(
        this.jctState.worldS,
        this.jctState.t,
        this.jctState.lateralOffset,
      );
      carX = pose.x;
      roadY = pose.y;
      carZ = pose.z;
      carYaw = pose.yaw + this.playerRelYaw;
      carPitch = pose.pitch;
    } else {
      const roadX = roadCenterX(this.playerS);
      roadY = getSurfaceElevationAt(this.playerS, this.playerLaneOffset);
      const roadYaw = -Math.atan2(roadCenterDX(this.playerS), 1);
      carYaw = roadYaw + this.playerRelYaw;
      carPitch = Math.atan(getSurfaceSlopeAt(this.playerS, this.playerLaneOffset));
      carX = roadX + this.playerLaneOffset;
      carZ = -this.playerS;
    }

    const fwdX = -Math.sin(carYaw);
    const fwdZ = -Math.cos(carYaw);
    const rightX = Math.cos(carYaw);
    const rightZ = -Math.sin(carYaw);

    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.2);
    }
    const microVib =
      (speedNorm > 0.65 ? (Math.random() - 0.5) * 0.018 * (speedNorm - 0.65) : 0) +
      (this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.35 : 0);

    if (this.cameraMode === CameraMode.Chase) {
      const targetPunch = isAttract
        ? 0
        : this.input.throttle
          ? 0.35 * (1 - speedNorm * 0.35)
          : this.input.brake
            ? -0.25
            : 0;
      this.camLongOffset = THREE.MathUtils.damp(this.camLongOffset, targetPunch, 7, dt);

      if (!this.camInitialized) {
        this.camLagX = carX;
        this.camLagY = roadY;
        this.camLagZ = carZ;
      } else {
        this.camLagX = THREE.MathUtils.damp(this.camLagX, carX, this.inFreePlaza ? 10 : 15, dt);
        this.camLagY = THREE.MathUtils.damp(this.camLagY, roadY, 12, dt);
        this.camLagZ = THREE.MathUtils.damp(this.camLagZ, carZ, this.inFreePlaza ? 10 : 30, dt);
      }

      const baseBehind = isBike ? (isMobileLandscape ? 4.4 : 4.7) : isMobileLandscape ? 5.55 : 5.85;
      const distBehind = baseBehind + speedNorm * 0.4 + this.camLongOffset;
      const height = (isBike ? 1.82 : isMobileLandscape ? 2.06 : 2.18) + speedNorm * 0.06;
      const latFollow = isAttract || this.inFreePlaza ? 0 : -this.playerLatVel * 0.05;
      const anchorZ = !isAttract && this.inFreePlaza ? this.camLagZ : carZ;
      this._desiredCamPos.set(
        this.camLagX - fwdX * distBehind + rightX * latFollow + microVib,
        this.camLagY + height + microVib,
        anchorZ - fwdZ * distBehind + rightZ * latFollow,
      );
      this._desiredCamLook.set(
        THREE.MathUtils.lerp(this.camLagX, carX, 0.7) + fwdX * 22,
        this.camLagY + (isBike ? 0.96 : 1.08) + Math.sin(carPitch) * 22,
        THREE.MathUtils.lerp(anchorZ, carZ, 0.7) + fwdZ * 22,
      );
      this.camPos.copy(this._desiredCamPos);
      this.camLook.copy(this._desiredCamLook);
      this.camInitialized = true;
    } else if (this.cameraMode === CameraMode.Hood) {
      const hoodPitchBias = -this.playerPitch * 0.6;
      const hoodBack = isBike ? -0.15 : -0.22;
      const hoodHeight = isBike ? 1.32 : 1.24;
      this._desiredCamPos.set(
        carX + fwdX * hoodBack + microVib * 0.35,
        roadY + hoodHeight + microVib * 0.35,
        carZ + fwdZ * hoodBack,
      );
      this._desiredCamLook.set(
        carX + fwdX * 26,
        roadY + (isBike ? 0.65 : 0.45) + Math.sin(carPitch) * 26 + hoodPitchBias * 8,
        carZ + fwdZ * 26,
      );
      this.camPos.copy(this._desiredCamPos);
      this.camLook.copy(this._desiredCamLook);
      this.camInitialized = true;
    } else {
      const bumperFwd = spec.HALF_LENGTH_M + 0.08;
      this._desiredCamPos.set(
        carX + fwdX * bumperFwd + microVib * 0.4,
        roadY + (isBike ? 0.72 : 0.66) + microVib * 0.4,
        carZ + fwdZ * bumperFwd,
      );
      this._desiredCamLook.set(
        carX + fwdX * 36,
        roadY + (isBike ? 0.68 : 0.62) + Math.sin(carPitch) * 36,
        carZ + fwdZ * 36,
      );
      this.camPos.copy(this._desiredCamPos);
      this.camLook.copy(this._desiredCamLook);
      this.camInitialized = true;
    }

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private emitTelemetry(
    dt: number,
    phys: { slipstream: boolean; tireSlip: number; absActive: boolean },
  ): void {
    this.telemetryEmitAcc += dt;
    if (this.telemetryEmitAcc < 0.045) return;
    this.telemetryEmitAcc = 0;

    const spec = VEHICLE_SPECS[this.vehicleType];
    const speedKmh = this.playerSpeedMs * 3.6;
    const inViaduct = this.jctState?.phase === 'viaduct';
    const inJctBranch = this.jctState?.phase === 'highway';
    const nextM = getNextMilestoneAhead(this.playerS);
    const offBounds = this.jctState
      ? {
          inSaApron: false,
          inMergeLane: false,
          inIcRamp: false,
          inJctRamp: Boolean(inViaduct),
          inParkingBay: false,
          activeSa: null,
          activeIc: null,
          activeJct: this.jctState.milestone,
        }
      : getOffMainlineBounds(this.playerS, this.playerLaneOffset);

    const jctBranchRemainingM = inJctBranch
      ? Math.max(0, Math.round(JCT_BRANCH_LENGTH_M - this.playerS))
      : inViaduct
        ? Math.max(0, Math.round((1 - this.jctState!.t) * getJctCurveLength() + JCT_BRANCH_LENGTH_M))
        : 0;

    const kmPost = inJctBranch
      ? this.playerS / 1000
      : ROUTE_START_KM_POST + this.playerS / 1000;
    const activeFacilityKind =
      offBounds.activeSa && (offBounds.inSaApron || offBounds.inMergeLane)
        ? (offBounds.activeSa.type as 'sa' | 'pa')
        : null;
    const regionName = inJctBranch
      ? `${this.jctState!.milestone.nameJa} 連絡道（残り ${(jctBranchRemainingM / 1000).toFixed(2)}km）`
      : inViaduct
        ? `${this.jctState!.milestone.nameJa}（${this.jctState!.milestone.branchNameJa} 高架橋）`
        : this.isParked && offBounds.activeSa
          ? `${offBounds.activeSa.nameJa} 駐車中 [P]`
          : this.inFreePlaza && offBounds.activeSa
            ? `${offBounds.activeSa.nameJa} 構内自由走行`
            : offBounds.inMergeLane && offBounds.activeSa
              ? `${offBounds.activeSa.nameJa} 加速・合流車線`
              : offBounds.inSaApron && offBounds.activeSa
                ? `${offBounds.activeSa.nameJa} 構内`
                : offBounds.inIcRamp && offBounds.activeIc
                  ? `${offBounds.activeIc.nameJa} 出口ランプ`
                  : offBounds.inJctRamp && offBounds.activeJct
                    ? `${offBounds.activeJct.nameJa} 分岐ランプ`
                    : nextM.distM < 220
                      ? `${nextM.milestone.nameJa} 付近`
                      : `次の ${nextM.milestone.nameJa} まで ${(nextM.distM / 1000).toFixed(1)}km`;

    const wCfg = WEATHER_CONFIG[this.activeWeather];
    const inTunnel = !inViaduct && isTunnelAt(this.playerS);

    this.onTelemetry({
      vehicleType: this.vehicleType,
      speedKmh,
      rpm: this.playerRpm,
      gear: this.playerGear,
      throttle: this.input.throttle ? 1 : 0,
      brake: this.input.brake ? 1 : 0,
      steerAngle: this.playerSteer,
      gripLevel: inTunnel ? 1.0 : wCfg.roadFriction,
      slipstreamActive: phys.slipstream,
      inTunnel,
      activeWeather: this.activeWeather,
      weatherProgress: this.autoWeatherTimer / this.autoWeatherDuration,
      distanceKm: this.distanceM / 1000,
      maxSpeedKmh: this.maxSpeedKmh,
      overtakeCount: this.overtakeCount,
      nearMissCount: this.nearMissCount,
      nearMissStreak: this.nearMissStreak,
      score: this.score,
      kilometerPost: kmPost,
      currentRegionName: regionName,
      nextMilestoneName: this.jctState ? this.jctState.milestone.nameJa : nextM.milestone.nameJa,
      nextMilestoneType: this.jctState ? 'jct' : nextM.milestone.type,
      nextMilestoneDistM: inJctBranch
        ? jctBranchRemainingM
        : inViaduct
          ? Math.max(0, Math.round((1 - this.jctState!.t) * getJctCurveLength()))
          : nextM.distM,
      nextMilestoneFeature: this.jctState
        ? this.jctState.milestone.branchNameJa
        : nextM.milestone.featureJa,
      inSaApron: offBounds.inSaApron,
      inFreePlaza: this.inFreePlaza,
      activeFacilityKind,
      inMergeLane: offBounds.inMergeLane,
      inIcRamp: offBounds.inIcRamp,
      inJctRamp: Boolean(inViaduct) || offBounds.inJctRamp,
      inJctBranch,
      jctBranchRemainingM,
      inParkingBay: offBounds.inParkingBay,
      isParked: this.isParked,
      isSpeedLimited: speedKmh >= spec.MAX_SPEED_KMH - 1.5,
      isBrakingHard: this.input.brake && Math.abs(speedKmh) > 60,
      absActive: phys.absActive,
      headlightsOn: wCfg.headlightsRequired || inTunnel,
      passingFlashActive: this.input.hornOrFlash,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.clearTimeout(this.resizeFollowupTimer);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleOrientationChange);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.audio.dispose();
    this.world.dispose();
    this.textures.dispose();
    this.composerTarget?.dispose();
    this.composer?.dispose();
    this.dynamicEnvGeo.dispose();
    this.dynamicEnvMat.dispose();
    this.envRenderTarget.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

function lightsOnIntensity(weather: ActiveWeather, inTunnel: boolean): number {
  if (inTunnel || WEATHER_CONFIG[weather].headlightsRequired) return 1.85;
  return 0.6;
}
