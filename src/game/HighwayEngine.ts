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
  WeatherMode,
} from '../types/game';
import {
  CAR_PAINTS,
  CAR_PHYSICS,
  EXPRESSWAY,
  HUMOROUS_SAFETY_TIPS,
  LED_BOARD_MESSAGES,
  TRAFFIC_PRESETS,
  TRAFFIC_SPECS,
  WEATHER_CONFIG,
} from './constants';
import { HighwayAudioEngine } from './audio';
import {
  getNextMilestoneAhead,
  getOffMainlineBounds,
  HighwayWorld,
  isTunnelAt,
  roadCenterDX,
  roadCenterX,
  roadElevationDY,
  roadElevationY,
} from './highwayWorld';
import { createPlayerCar, createTrafficCar, PlayerCarRig, TrafficCarRig } from './models';
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

function createOutdoorEnvironmentScene(): THREE.Scene {
  const envScene = new THREE.Scene();

  // Procedural sky sphere for realistic sky-to-ground clearcoat lacquer reflections
  const skyGeo = new THREE.SphereGeometry(50, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 skyTop = vec3(0.16, 0.42, 0.85);
        vec3 skyHorizon = vec3(0.76, 0.88, 0.98);
        vec3 groundCol = vec3(0.11, 0.13, 0.16);
        vec3 col = y >= 0.0
          ? mix(skyHorizon, skyTop, pow(y, 0.55))
          : mix(skyHorizon * 0.45, groundCol, smoothstep(0.0, -0.35, y));
        // Sun highlight disc
        vec3 sunDir = normalize(vec3(0.35, 0.52, -0.78));
        float sunDot = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.8, 1.65, 1.35) * pow(sunDot, 28.0);
        // Overhead highway light strip highlights
        float strip = smoothstep(0.96, 0.995, abs(sin(vDir.z * 6.0))) * smoothstep(0.15, 0.55, y);
        col += vec3(0.35, 0.42, 0.52) * strip;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));
  return envScene;
}

const HighSpeedRadialShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeedNorm: { value: 0.0 },
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
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.48);
      vec2 dir = vUv - center;
      float dist = length(dir);

      // Keep central focal zone 100% sharp so signs & ahead cars remain crisp
      float edgeMask = smoothstep(0.24, 0.72, dist);
      float blurAmt = uSpeedNorm * edgeMask * 0.018;

      vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (blurAmt > 0.0005) {
        vec3 acc = col;
        for (int i = 1; i <= 6; i++) {
          float fi = float(i) / 6.0;
          vec2 sampleUv = vUv - dir * (blurAmt * fi);
          acc += texture2D(tDiffuse, clamp(sampleUv, 0.001, 0.999)).rgb;
        }
        col = acc / 7.0;

        // Subtle high-speed chromatic dispersion at far edges only
        float ca = uSpeedNorm * edgeMask * 0.0024;
        float r = texture2D(tDiffuse, clamp(vUv + dir * ca, 0.001, 0.999)).r;
        float b = texture2D(tDiffuse, clamp(vUv - dir * ca, 0.001, 0.999)).b;
        col.r = mix(col.r, r, 0.6);
        col.b = mix(col.b, b, 0.6);
      }

      // Subtle cinematic vignette (stronger only slightly at very high speed)
      float vig = smoothstep(0.95, 0.35, dist);
      col *= mix(1.0, 0.86 - uSpeedNorm * 0.08, 1.0 - vig);

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

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmremGenerator: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;
  private headSpotLeft: THREE.SpotLight | null = null;
  private headSpotRight: THREE.SpotLight | null = null;
  private spotTargetLeft: THREE.Object3D | null = null;
  private spotTargetRight: THREE.Object3D | null = null;
  private brakePointLight: THREE.PointLight | null = null;

  private textures: ProceduralTexturePack;
  private world: HighwayWorld;
  private playerCar: PlayerCarRig;
  private audio: HighwayAudioEngine;

  // Traffic pools
  private sameDirPool: TrafficVehicle[] = [];
  private oncomingPool: TrafficVehicle[] = [];
  private trafficDensity: TrafficDensity = TrafficDensity.Realistic;

  // Quality, Device & Weather State
  private qualityMode: QualityMode = QualityMode.Ultra;
  private deviceMode: DeviceMode = 'pc';
  private analogSteer: number | null = null;
  private shiftFlameTimer = 0;
  private brakeGlow = 0;
  private running = false;
  private weatherMode: WeatherMode = WeatherMode.Auto;
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
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2.5));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
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

    // Rich Outdoor Horizon-Sky-Sun PMREM Environment Map
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envScene = createOutdoorEnvironmentScene();
    this.envRenderTarget = this.pmremGenerator.fromScene(envScene, 0.03);
    this.scene.environment = this.envRenderTarget.texture;

    // 3-Point Outdoor Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x9bd2ff, 0x3b4838, 1.08);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 2.9);
    this.sunLight.castShadow = !this.isSoftwareGl;
    const shadowSize = this.isSoftwareGl ? 512 : 4096;
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

    // Procedural Textures, Scenery, Car, Traffic, Audio
    this.textures = createProceduralTexturePack(this.renderer);
    this.world = new HighwayWorld(this.scene, this.textures, this.isSoftwareGl);
    this.playerCar = createPlayerCar(this.textures, CarPaintId.ChampionshipWhite, this.isSoftwareGl);
    this.scene.add(this.playerCar.root);

    // Ultra-HD Real Dynamic SpotLight Headlights & Rear Brake Light on Player Car
    if (!this.isSoftwareGl) {
      this.headSpotLeft = new THREE.SpotLight(0xeef6ff, 0, 125, Math.PI * 0.16, 0.55, 1.35);
      this.headSpotRight = new THREE.SpotLight(0xeef6ff, 0, 125, Math.PI * 0.16, 0.55, 1.35);
      this.spotTargetLeft = new THREE.Object3D();
      this.spotTargetRight = new THREE.Object3D();
      this.spotTargetLeft.position.set(-1.1, 0.05, -48);
      this.spotTargetRight.position.set(1.1, 0.05, -48);
      this.headSpotLeft.position.set(-0.74, 0.58, -2.32);
      this.headSpotRight.position.set(0.74, 0.58, -2.32);
      this.headSpotLeft.target = this.spotTargetLeft;
      this.headSpotRight.target = this.spotTargetRight;
      this.playerCar.bodyPivot.add(this.headSpotLeft);
      this.playerCar.bodyPivot.add(this.headSpotRight);
      this.playerCar.bodyPivot.add(this.spotTargetLeft);
      this.playerCar.bodyPivot.add(this.spotTargetRight);

      this.brakePointLight = new THREE.PointLight(0xff1826, 0, 12, 1.8);
      this.brakePointLight.position.set(0, 0.72, 2.75);
      this.playerCar.bodyPivot.add(this.brakePointLight);
    }

    this.audio = new HighwayAudioEngine();

    this.initTrafficPools();
    this.resetTrafficPositions();

    // Ultra-HD Post-Processing Composer (Hardware GPU only)
    if (!this.isSoftwareGl) {
      this.initComposer(w, h);
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
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

    // High bloom threshold (1.85) ensures ONLY bright headlight/taillight bulbs glow, never car paint or asphalt!
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.25, 0.3, 1.85);
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

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
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
        laneChangeCooldown: 99,
        nearMissAwarded: false,
        patrolWarned: false,
        active: false,
      });
    }
  }

  private resetTrafficPositions(): void {
    const preset = TRAFFIC_PRESETS[this.trafficDensity];

    this.sameDirPool.forEach((v, idx) => {
      if (idx < preset.sameDirCount) {
        const spec = TRAFFIC_SPECS[v.archetype];
        const lane = spec.preferredLanes[idx % spec.preferredLanes.length];
        const cruiseKmh = THREE.MathUtils.lerp(spec.minSpeedKmh, spec.maxSpeedKmh, Math.random());
        v.active = true;
        v.currentLane = lane;
        v.targetLane = lane;
        v.laneOffset = EXPRESSWAY.LANE_CENTERS[lane];
        v.s = this.playerS + 85 + idx * (540 / preset.sameDirCount) + (Math.random() - 0.5) * 18;
        v.cruiseSpeedMs = cruiseKmh / 3.6;
        v.speedMs = v.cruiseSpeedMs;
        v.blinkerDir = 0;
        v.blinkerWaitTimer = 0;
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
        v.active = true;
        v.currentLane = lane;
        v.targetLane = lane;
        v.laneOffset = EXPRESSWAY.ONCOMING_LANE_CENTERS[lane];
        v.s = this.playerS + 100 + idx * (600 / preset.oncomingCount);
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
      this.audio.init();
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
      const maxDpr = this.deviceMode === 'mobile' ? 2.0 : 2.5;
      const targetRatio = mode === QualityMode.Ultra ? Math.min(window.devicePixelRatio, maxDpr) : Math.min(window.devicePixelRatio, 1.15);
      this.renderer.setPixelRatio(targetRatio);
      this.renderer.shadowMap.enabled = mode === QualityMode.Ultra;
      const targetShadowSize = mode === QualityMode.Ultra ? 4096 : 1024;
      if (this.sunLight.shadow.mapSize.width !== targetShadowSize) {
        this.sunLight.shadow.mapSize.set(targetShadowSize, targetShadowSize);
        this.sunLight.shadow.map?.dispose();
        this.sunLight.shadow.map = null;
      }

      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.renderer.setSize(w, h);
      if (this.composer) {
        this.composer.setPixelRatio(targetRatio);
        this.composer.setSize(w, h);
      }
    }
  }

  public resetRun(): void {
    this.playerS = 40;
    this.playerLaneOffset = 0;
    this.playerSpeedMs = 120 / 3.6;
    this.playerLatVel = 0;
    this.playerRelYaw = 0;
    this.playerSteer = 0;
    this.playerGear = 4;
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
    this.camInitialized = false;
    this.resetTrafficPositions();
    this.pushSafetyBanner({
      title: '【走行スタート】新東名 制限速度300km/h 特例区間',
      body: '他車は120km/h（大型車80〜90km/h）で走行中！左ランプからNEOPASAへ入庫、または各ICから流出するとゴールクリアになります！',
      tone: 'info',
    });
  }

  public resumeAfterIcClear(): void {
    this.playerS += 95;
    this.playerLaneOffset = -3.75;
    this.playerLatVel = 0;
    this.playerRelYaw = 0;
    this.playerSpeedMs = 120 / 3.6;
    this.camInitialized = false;
    this.running = true;
    this.pushSafetyBanner({
      title: '【本線復帰】新東名ダウンバウンド走行を再開しました',
      body: '次のNEOPASA・IC・JCT案内は上部のナビ表示でも確認できます！',
      tone: 'info',
    });
  }

  public setWeatherMode(mode: WeatherMode): void {
    this.weatherMode = mode;
    if (mode !== WeatherMode.Auto) {
      this.activeWeather = mode as unknown as ActiveWeather;
    }
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.camInitialized = false; // Crisp instant transition when switching camera mode
  }

  public setTrafficDensity(density: TrafficDensity): void {
    this.trafficDensity = density;
    this.resetTrafficPositions();
  }

  public setCarPaint(paint: CarPaintId): void {
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
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    const now = performance.now();
    const rawDt = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    if (this.running) {
      this.stepWeather(dt);
      const physInfo = this.stepPlayerPhysics(dt);
      this.stepTraffic(dt);
      this.updateCamera(dt);
      this.emitTelemetry(dt, physInfo);
    } else {
      this.stepWeather(dt);
      this.playerSpeedMs = THREE.MathUtils.damp(this.playerSpeedMs, 120 / 3.6, 2.0, dt);
      this.playerS += this.playerSpeedMs * dt;
      this.playerLaneOffset = THREE.MathUtils.damp(this.playerLaneOffset, 0, 3.0, dt);
      this.playerRelYaw = THREE.MathUtils.damp(this.playerRelYaw, 0, 4.0, dt);
      this.syncPlayerCarTransform(dt, 0);
      this.stepTraffic(dt);
      this.updateCamera(dt);
      this.audio.update({
        active: false,
        speedKmh: 0,
        rpm: 1000,
        throttle: 0,
        rainAmount: 0,
        tireSlip: 0,
        inTunnel: false,
      });
      this.emitTelemetry(dt, { slipstream: false, tireSlip: 0, absActive: false });
    }

    const wCfg = WEATHER_CONFIG[this.activeWeather];
    const fujiOpacity =
      this.activeWeather === ActiveWeather.Clear
        ? 0.94
        : this.activeWeather === ActiveWeather.Sunset
          ? 0.8
          : 0.0;

    const isUltra = this.qualityMode === QualityMode.Ultra;
    this.world.update(
      this.playerS,
      this.playerLaneOffset,
      this.playerSpeedMs,
      dt,
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

    if (this.composer && !this.isSoftwareGl && isUltra) {
      if (this.bloomPass) {
        this.bloomPass.enabled = this.curBloomStrength > 0.02;
        this.bloomPass.strength = this.curBloomStrength;
      }
      if (this.speedFxPass) {
        const speedKmh = this.playerSpeedMs * 3.6;
        const speedNorm = this.running ? THREE.MathUtils.clamp((speedKmh - 140) / 160, 0, 1) : 0;
        this.speedFxPass.uniforms.uSpeedNorm.value = speedNorm;
      }
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.scheduleNextFrame();
  }

  private stepWeather(dt: number): void {
    if (this.weatherMode === WeatherMode.Auto) {
      this.autoWeatherTimer += dt;
      if (this.autoWeatherTimer >= this.autoWeatherDuration) {
        this.autoWeatherTimer = 0;
        const nextIdx = (AUTO_WEATHER_SEQUENCE.indexOf(this.activeWeather) + 1) % AUTO_WEATHER_SEQUENCE.length;
        this.activeWeather = AUTO_WEATHER_SEQUENCE[nextIdx];
      }
    } else {
      this.activeWeather = this.weatherMode as unknown as ActiveWeather;
    }

    const cfg = WEATHER_CONFIG[this.activeWeather];
    const inTunnel = isTunnelAt(this.playerS);
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

    const px = roadCenterX(this.playerS) + this.playerLaneOffset;
    const py = roadElevationY(this.playerS);
    const pz = -this.playerS;
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
    const wCfg = WEATHER_CONFIG[this.activeWeather];
    const inTunnel = isTunnelAt(this.playerS);
    const roadFriction = inTunnel ? 1.02 : wCfg.roadFriction;

    const throttle = this.input.throttle ? 1 : 0;
    const brake = this.input.brake ? 1 : 0;
    const digitalSteer = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const steerInput = digitalSteer !== 0 ? digitalSteer : (this.analogSteer ?? 0);

    let slipstream = false;
    for (const tv of this.sameDirPool) {
      if (!tv.active) continue;
      const ds = tv.s - this.playerS;
      if (ds > 6 && ds < 55 && Math.abs(tv.laneOffset - this.playerLaneOffset) < 1.85) {
        slipstream = true;
        break;
      }
    }

    const speedMs = Math.max(0, this.playerSpeedMs);
    const wheelAngular = speedMs / CAR_PHYSICS.WHEEL_RADIUS_M;
    const ratio = CAR_PHYSICS.GEAR_RATIOS[this.playerGear - 1] * CAR_PHYSICS.FINAL_DRIVE;
    let targetRpm = (wheelAngular * ratio * 60) / (2 * Math.PI);
    targetRpm = Math.max(CAR_PHYSICS.IDLE_RPM, Math.min(CAR_PHYSICS.REDLINE_RPM, targetRpm));

    const prevGear = this.playerGear;
    if (targetRpm >= CAR_PHYSICS.SHIFT_UP_RPM && this.playerGear < 6 && throttle > 0) {
      this.playerGear++;
    } else if (targetRpm <= CAR_PHYSICS.SHIFT_DOWN_RPM && this.playerGear > 1) {
      this.playerGear--;
    }
    if (this.playerGear > prevGear && this.qualityMode === QualityMode.Ultra) {
      this.shiftFlameTimer = 0.16;
    }
    this.playerRpm = THREE.MathUtils.damp(this.playerRpm, targetRpm, 12, dt);

    const rpmNorm = (this.playerRpm - CAR_PHYSICS.IDLE_RPM) / (CAR_PHYSICS.REDLINE_RPM - CAR_PHYSICS.IDLE_RPM);
    const torqueCurve = 0.68 + 0.45 * Math.sin(Math.min(1, Math.max(0, rpmNorm)) * Math.PI * 0.88);
    const gearMultiplier = CAR_PHYSICS.GEAR_RATIOS[this.playerGear - 1] / 1.4;

    const speedKmh = speedMs * 3.6;
    let effectiveThrottle = throttle;
    if (speedKmh >= CAR_PHYSICS.MAX_SPEED_KMH - 0.5) {
      effectiveThrottle = 0;
    } else if (speedKmh > CAR_PHYSICS.MAX_SPEED_KMH - 6) {
      effectiveThrottle *= (CAR_PHYSICS.MAX_SPEED_KMH - speedKmh) / 6;
    }

    const driveForce =
      effectiveThrottle *
      CAR_PHYSICS.MAX_ENGINE_FORCE_N *
      torqueCurve *
      Math.min(2.1, gearMultiplier) *
      (slipstream ? 1.12 : 1.0);
    const dragFactor = slipstream ? 0.78 : 1.0;
    const aeroDrag = 0.5 * CAR_PHYSICS.AIR_DENSITY * CAR_PHYSICS.DRAG_COEFF_AREA * speedMs * speedMs * dragFactor;
    const rollingDrag = CAR_PHYSICS.MASS_KG * 9.81 * CAR_PHYSICS.ROLLING_RESISTANCE;
    const slopePitch = Math.atan(roadElevationDY(this.playerS));
    const slopeGravity = CAR_PHYSICS.MASS_KG * 9.81 * Math.sin(slopePitch);

    const downforce = CAR_PHYSICS.DOWNFORCE_COEFF * speedMs * speedMs;
    const normalForce = CAR_PHYSICS.MASS_KG * 9.81 + downforce;
    const maxTireForce = normalForce * roadFriction;

    const requestedBrake = brake * CAR_PHYSICS.MAX_BRAKE_FORCE_N;
    const actualBrake = Math.min(requestedBrake, maxTireForce);
    const absActive = brake > 0.5 && requestedBrake > maxTireForce * 0.92 && speedKmh > 35;

    const netLongForce = driveForce - aeroDrag - rollingDrag - slopeGravity - actualBrake;
    const accelLong = netLongForce / CAR_PHYSICS.MASS_KG;

    this.playerSpeedMs = THREE.MathUtils.clamp(
      this.playerSpeedMs + accelLong * dt,
      0,
      CAR_PHYSICS.MAX_SPEED_MS + 0.2,
    );
    this.playerS += this.playerSpeedMs * dt;
    this.distanceM += this.playerSpeedMs * dt;

    const curKmh = this.playerSpeedMs * 3.6;
    if (curKmh > this.maxSpeedKmh) this.maxSpeedKmh = curKmh;

    if (!this.hit300Triggered && curKmh >= 298.5) {
      this.hit300Triggered = true;
      this.audio.playChime('alert');
      this.pushSafetyBanner({
        title: '【祝・300km/h到達】ゲーム内最高速リミッター作動！',
        body: '時速300kmは1秒で83.3m進む世界です。現実の新東名（最高120km/h）では絶対にマネしないでください！',
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

    this.playerSteer = THREE.MathUtils.damp(this.playerSteer, steerInput, 11, dt);
    const speedFactor = THREE.MathUtils.clamp(curKmh / 100, 0.25, 3.0);
    const maxLatSpeed = 11.5 * Math.sqrt(roadFriction);
    const desiredLatVel = this.playerSteer * maxLatSpeed * (0.75 + 0.25 * Math.min(1.4, speedFactor));

    const dsStep = 2.0;
    const dx1 = roadCenterDX(this.playerS);
    const dx2 = roadCenterDX(this.playerS + dsStep);
    const curvature = (dx2 - dx1) / dsStep;
    const centrifugalPush = curvature * this.playerSpeedMs * this.playerSpeedMs * 0.48;

    const latGripLambda = 5.5 * roadFriction;
    this.playerLatVel = THREE.MathUtils.damp(this.playerLatVel, desiredLatVel - centrifugalPush * 0.25, latGripLambda, dt);
    this.playerLaneOffset += this.playerLatVel * dt;

    const offBounds = getOffMainlineBounds(this.playerS, this.playerLaneOffset);
    const { leftBound, rightBound, inSaApron, inMergeLane, inIcRamp, activeSa, activeIc, icDs } = offBounds;

    // Announce upcoming NEOPASA SA / PA / IC / JCT early and clearly
    const nextM = getNextMilestoneAhead(this.playerS);
    if (nextM.distM < 520 && nextM.milestone.id !== this.lastAnnouncedMilestoneId) {
      this.lastAnnouncedMilestoneId = nextM.milestone.id;
      const distRounded = Math.round(nextM.distM / 10) * 10;
      if (nextM.milestone.type === 'sa') {
        this.pushSafetyBanner({
          title: `【あと${distRounded}m】${nextM.milestone.nameJa}（SA入口・左へ）`,
          body: `${nextM.milestone.featureJa}。左の減速車線から入庫でき、前方の加速車線から本線へ合流できます！`,
          tone: 'info',
        });
      } else if (nextM.milestone.type === 'pa') {
        this.pushSafetyBanner({
          title: `【あと${distRounded}m】${nextM.milestone.nameJa}（PA入口・左へ）`,
          body: `${nextM.milestone.featureJa}。左車線からコンパクトなPA構内に入り休憩できます！`,
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
          title: `【JCT分岐案内】この先 ${nextM.milestone.nameJa}`,
          body: `${nextM.milestone.routeCode}（${nextM.milestone.branchNameJa}）分岐を通過します。本線はそのまま直進！`,
          tone: 'info',
        });
      }
    }

    // IC Exit 4-Lane Toll Gate Clear Check (triggers as car passes under toll canopy at ds=+45)
    if (inIcRamp && activeIc && icDs >= 42 && Math.abs(this.playerS - this.icClearTriggeredForS) > 300) {
      this.icClearTriggeredForS = this.playerS;
      this.score += 1500;
      this.audio.playChime('nearMiss');
      this.running = false;
      this.onIcExitClear?.({
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
            '構内は安全運転ありがとうございます！このまま前方右側の加速車線から本線へ合流できます。',
          tone: 'humor',
        });
      }
    } else if (this.wasInSaApron && !inSaApron && !inMergeLane && !activeSa) {
      this.wasInSaApron = false;
      this.pushSafetyBanner({
        title: '【本線合流完了】E1A 新東名 本線へ復帰',
        body: '加速車線からのスムーズな合流ありがとうございます！本線の120km/hフローに合わせて走行しましょう。',
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

    const targetRelYaw = -this.playerLatVel * 0.018;
    this.playerRelYaw = THREE.MathUtils.damp(this.playerRelYaw, targetRelYaw, 10, dt);

    const targetPitch = (accelLong / 9.81) * 0.022;
    const targetRoll = (this.playerLatVel / 10) * 0.038;
    this.playerPitch = THREE.MathUtils.damp(this.playerPitch, targetPitch, 9, dt);
    this.playerRoll = THREE.MathUtils.damp(this.playerRoll, targetRoll, 9, dt);

    this.playerCar.tailLightMaterial.emissiveIntensity =
      brake > 0.1 ? 5.2 : lightsOnIntensity(this.activeWeather, inTunnel);

    // Ultra-HD Dynamic Rear Brake PointLight, Glowing Carbon-Ceramic Brake Rotors & Exhaust Shift Flame
    const isUltra = !this.isSoftwareGl && this.qualityMode === QualityMode.Ultra;
    if (this.brakePointLight) {
      this.brakePointLight.intensity = isUltra && brake > 0.1 ? 6.5 : 0;
    }
    const targetBrakeGlow = isUltra && brake > 0.25 && curKmh > 80 ? Math.min(2.6, (curKmh - 70) / 80) : 0;
    this.brakeGlow = THREE.MathUtils.damp(this.brakeGlow, targetBrakeGlow, targetBrakeGlow > this.brakeGlow ? 5 : 2.5, dt);
    this.playerCar.brakeRotorMat.emissiveIntensity = this.brakeGlow;

    if (this.shiftFlameTimer > 0) {
      this.shiftFlameTimer = Math.max(0, this.shiftFlameTimer - dt);
      const t = this.shiftFlameTimer / 0.16;
      this.playerCar.exhaustFlameGroup.visible = isUltra;
      this.playerCar.exhaustFlameMat.opacity = t * 0.92;
      this.playerCar.exhaustFlameGroup.scale.set(1, 1, 0.7 + t * 0.8);
    } else {
      this.playerCar.exhaustFlameGroup.visible = false;
    }

    this.syncPlayerCarTransform(dt, steerInput);

    if (curKmh > 120) {
      this.score += Math.round((curKmh - 100) * dt * 0.5);
    }

    if (this.nearMissStreakTimer > 0) {
      this.nearMissStreakTimer -= dt;
      if (this.nearMissStreakTimer <= 0) this.nearMissStreak = 0;
    }

    const latSlip = Math.max(0, (Math.abs(this.playerLatVel) - 4.8 * roadFriction) / 5);
    const tireSlip = Math.min(1, latSlip + (absActive ? 0.55 : 0));

    this.audio.update({
      active: true,
      speedKmh: curKmh,
      rpm: this.playerRpm,
      throttle: effectiveThrottle,
      rainAmount: this.curRainAmount,
      tireSlip,
      inTunnel,
    });

    return { slipstream, tireSlip, absActive };
  }

  private syncPlayerCarTransform(dt: number, steerInput: number): void {
    const roadX = roadCenterX(this.playerS);
    const roadY = roadElevationY(this.playerS);
    const roadYaw = -Math.atan2(roadCenterDX(this.playerS), 1);
    const roadPitch = Math.atan(roadElevationDY(this.playerS));

    this.playerCar.root.position.set(roadX + this.playerLaneOffset, roadY, -this.playerS);
    this.playerCar.root.rotation.set(roadPitch, roadYaw + this.playerRelYaw, 0);
    this.playerCar.bodyPivot.rotation.set(this.playerPitch, 0, this.playerRoll);

    this.wheelSpinAngle -= (this.playerSpeedMs / CAR_PHYSICS.WHEEL_RADIUS_M) * dt;
    for (const w of this.playerCar.wheels) {
      w.rotation.x = this.wheelSpinAngle;
    }
    for (const pivot of this.playerCar.frontSteerPivots) {
      pivot.rotation.y = -steerInput * 0.24;
    }
  }

  private stepTraffic(dt: number): void {
    const preset = TRAFFIC_PRESETS[this.trafficDensity];
    const headlightsOn = WEATHER_CONFIG[this.activeWeather].headlightsRequired;
    const blinkPhase = Math.floor(performance.now() / 320) % 2 === 0;
    const patrolPhase = Math.floor(performance.now() / 190) % 2 === 0;
    const playerInMerge =
      this.running && getOffMainlineBounds(this.playerS, this.playerLaneOffset).inMergeLane;

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

      // Courteous yield: Lane 0 drivers politely shift to Lane 1 when player is merging from SA/PA acceleration lane
      if (
        playerInMerge &&
        tv.currentLane === 0 &&
        tv.blinkerDir === 0 &&
        tv.s - this.playerS > -18 &&
        tv.s - this.playerS < 55 &&
        this.isLaneClearForTraffic(tv, 1)
      ) {
        tv.blinkerDir = 1;
        tv.blinkerWaitTimer = 0.55;
        tv.targetLane = 1;
      }

      const safeDist = 28 + tv.speedMs * 0.9;
      if (minGap < safeDist) {
        const targetV = Math.max(16, aheadSpeed * (minGap < 17 ? 0.75 : 0.96));
        tv.isBraking = targetV < tv.speedMs - 0.6;
        tv.speedMs = THREE.MathUtils.damp(tv.speedMs, targetV, 3.2, dt);

        tv.laneChangeCooldown -= dt;
        if (tv.laneChangeCooldown <= 0 && tv.blinkerDir === 0 && tv.archetype !== TrafficArchetype.BoxTruck) {
          const candidateLane = tv.currentLane < 2 ? tv.currentLane + 1 : 1;
          if (this.isLaneClearForTraffic(tv, candidateLane)) {
            tv.blinkerDir = candidateLane > tv.currentLane ? 1 : -1;
            tv.blinkerWaitTimer = 0.95;
            tv.targetLane = candidateLane;
          }
          tv.laneChangeCooldown = 5 + Math.random() * 6;
        }
      } else {
        tv.isBraking = false;
        tv.speedMs = THREE.MathUtils.damp(tv.speedMs, tv.cruiseSpeedMs, 1.4, dt);

        if (tv.currentLane === 2 && tv.blinkerDir === 0) {
          tv.laneChangeCooldown -= dt;
          if (tv.laneChangeCooldown <= 0 && this.isLaneClearForTraffic(tv, 1)) {
            tv.blinkerDir = -1;
            tv.blinkerWaitTimer = 0.95;
            tv.targetLane = 1;
            tv.laneChangeCooldown = 6 + Math.random() * 6;
          }
        }
      }

      if (tv.blinkerDir !== 0) {
        tv.blinkerWaitTimer -= dt;
        if (tv.blinkerWaitTimer <= 0) {
          const targetX = EXPRESSWAY.LANE_CENTERS[tv.targetLane];
          tv.laneOffset = THREE.MathUtils.damp(tv.laneOffset, targetX, 3.8, dt);
          if (Math.abs(tv.laneOffset - targetX) < 0.06) {
            tv.laneOffset = targetX;
            tv.currentLane = tv.targetLane;
            tv.blinkerDir = 0;
          }
        }
      }

      tv.s += tv.speedMs * dt;

      const relS = tv.s - this.playerS;
      if (relS < -75 || relS > 680) {
        const respawnAhead = relS < -75;
        tv.s = respawnAhead
          ? this.playerS + 560 + Math.random() * 110
          : this.playerS + 140 + Math.random() * 420;
        const lane = spec.preferredLanes[Math.floor(Math.random() * spec.preferredLanes.length)];
        tv.currentLane = lane;
        tv.targetLane = lane;
        tv.laneOffset = EXPRESSWAY.LANE_CENTERS[lane];
        tv.blinkerDir = 0;
        tv.nearMissAwarded = false;
        tv.patrolWarned = false;
        tv.cruiseSpeedMs = THREE.MathUtils.lerp(spec.minSpeedKmh, spec.maxSpeedKmh, Math.random()) / 3.6;
        tv.speedMs = tv.cruiseSpeedMs;
      }

      const tx = roadCenterX(tv.s) + tv.laneOffset;
      const ty = roadElevationY(tv.s);
      const tYaw = -Math.atan2(roadCenterDX(tv.s), 1);
      const tPitch = Math.atan(roadElevationDY(tv.s));
      tv.rig.root.position.set(tx, ty, -tv.s);
      tv.rig.root.rotation.set(tPitch, tYaw, 0);

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

      if (this.running) {
        const halfLenSum = spec.length * 0.5 + 2.3;
        const halfWidthSum = spec.width * 0.5 + 0.94;
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
          if (Math.abs(dX) < halfWidthSum + 1.05 && playerKmh > 140) {
            this.nearMissCount++;
            this.nearMissStreak++;
            this.nearMissStreakTimer = 5.5;
            this.score += 350 * this.nearMissStreak;
            this.audio.playChime('nearMiss');
          } else {
            this.score += 100;
          }

          if (tv.archetype === TrafficArchetype.PatrolCar && !tv.patrolWarned && playerKmh > 165) {
            tv.patrolWarned = true;
            this.audio.playChime('alert');
            this.pushSafetyBanner({
              title: `【高速隊パトカー通過】${Math.round(playerKmh)}km/h で追越し！`,
              body: 'ここはゲーム特例300km/h区間ですが、現実の新東名の制限速度は120km/hです。現実世界では一発免停＋裁判コースなのでご注意を！',
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
      if (ov.s < this.playerS - 90) {
        ov.s = this.playerS + 600 + Math.random() * 140;
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

  private isLaneClearForTraffic(mover: TrafficVehicle, targetLane: number): boolean {
    const targetX = EXPRESSWAY.LANE_CENTERS[targetLane];
    for (const other of this.sameDirPool) {
      if (!other.active || other === mover) continue;
      if (Math.abs(other.laneOffset - targetX) < 2.1 && Math.abs(other.s - mover.s) < 38) {
        return false;
      }
    }
    if (Math.abs(this.playerLaneOffset - targetX) < 2.2 && Math.abs(this.playerS - mover.s) < 44) {
      return false;
    }
    return true;
  }

  private updateCamera(dt: number): void {
    const speedKmh = this.playerSpeedMs * 3.6;
    const speedNorm = THREE.MathUtils.clamp(speedKmh / 300, 0, 1);

    const targetFov =
      this.cameraMode === CameraMode.Chase
        ? 58 + speedNorm * 22
        : this.cameraMode === CameraMode.Hood
          ? 64 + speedNorm * 14
          : 66 + speedNorm * 16;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
    this.camera.updateProjectionMatrix();

    const roadX = roadCenterX(this.playerS);
    const roadY = roadElevationY(this.playerS);
    const roadYaw = -Math.atan2(roadCenterDX(this.playerS), 1);
    const carYaw = roadYaw + this.playerRelYaw;

    const fwdX = -Math.sin(carYaw);
    const fwdZ = -Math.cos(carYaw);
    const rightX = Math.cos(carYaw);
    const rightZ = -Math.sin(carYaw);

    const carX = roadX + this.playerLaneOffset;
    const carZ = -this.playerS;

    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.2);
    }
    const microVib =
      (speedNorm > 0.65 ? (Math.random() - 0.5) * 0.022 * (speedNorm - 0.65) : 0) +
      (this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.35 : 0);

    if (this.cameraMode === CameraMode.Chase) {
      const distBehind = 6.5 + speedNorm * 1.15;
      const height = 2.28 - speedNorm * 0.14;
      const latFollow = -this.playerLatVel * 0.08;
      this._desiredCamPos.set(
        carX - fwdX * distBehind + rightX * latFollow + microVib,
        roadY + height + microVib,
        carZ - fwdZ * distBehind + rightZ * latFollow,
      );
      this._desiredCamLook.set(carX + fwdX * 19, roadY + 1.05, carZ + fwdZ * 19);
    } else if (this.cameraMode === CameraMode.Hood) {
      // Authentic Driver's Bonnet / Hood View:
      // Mounted at the windshield cowl (z = -0.22 local, y = 1.24) angled slightly down so the
      // painted power dome, carbon NACA vents, flared front fenders, wipers & side mirrors fill the bottom frame!
      const hoodPitchBias = -this.playerPitch * 0.6;
      this._desiredCamPos.set(
        carX - fwdX * 0.22 + microVib * 0.35,
        roadY + 1.24 + microVib * 0.35,
        carZ - fwdZ * 0.22,
      );
      this._desiredCamLook.set(
        carX + fwdX * 26,
        roadY + 0.45 + hoodPitchBias * 8,
        carZ + fwdZ * 26,
      );
    } else {
      // Low Bumper Cam
      this._desiredCamPos.set(
        carX + fwdX * 2.38 + microVib * 0.4,
        roadY + 0.66 + microVib * 0.4,
        carZ + fwdZ * 2.38,
      );
      this._desiredCamLook.set(carX + fwdX * 36, roadY + 0.62, carZ + fwdZ * 36);
    }

    if (!this.camInitialized || this.cameraMode !== CameraMode.Chase) {
      // Hood & Bumper cameras stay tightly locked to the car chassis so the hood never jitters
      this.camPos.copy(this._desiredCamPos);
      this.camLook.copy(this._desiredCamLook);
      this.camInitialized = true;
    } else {
      const posFactor = 1 - Math.exp(-15 * dt);
      const lookFactor = 1 - Math.exp(-19 * dt);
      this.camPos.lerp(this._desiredCamPos, posFactor);
      this.camLook.lerp(this._desiredCamLook, lookFactor);
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

    const speedKmh = this.playerSpeedMs * 3.6;
    const nextM = getNextMilestoneAhead(this.playerS);
    const offBounds = getOffMainlineBounds(this.playerS, this.playerLaneOffset);
    const kmPost = nextM.milestone.realKmPost - nextM.distM / 1000;
    const activeFacilityKind =
      offBounds.activeSa && (offBounds.inSaApron || offBounds.inMergeLane)
        ? (offBounds.activeSa.type as 'sa' | 'pa')
        : null;
    const regionName =
      offBounds.inMergeLane && offBounds.activeSa
        ? `${offBounds.activeSa.nameJa} 加速・合流車線`
        : offBounds.inSaApron && offBounds.activeSa
          ? `${offBounds.activeSa.nameJa} 構内`
          : offBounds.inIcRamp && offBounds.activeIc
            ? `${offBounds.activeIc.nameJa} 出口ランプ`
            : nextM.distM < 220
              ? `${nextM.milestone.nameJa} 付近`
              : `次の ${nextM.milestone.nameJa} まで ${(nextM.distM / 1000).toFixed(1)}km`;

    const wCfg = WEATHER_CONFIG[this.activeWeather];
    const inTunnel = isTunnelAt(this.playerS);

    this.onTelemetry({
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
      nextMilestoneName: nextM.milestone.nameJa,
      nextMilestoneType: nextM.milestone.type,
      nextMilestoneDistM: nextM.distM,
      nextMilestoneFeature: nextM.milestone.featureJa,
      inSaApron: offBounds.inSaApron,
      activeFacilityKind,
      inMergeLane: offBounds.inMergeLane,
      inIcRamp: offBounds.inIcRamp,
      isSpeedLimited: speedKmh >= CAR_PHYSICS.MAX_SPEED_KMH - 1.5,
      isBrakingHard: this.input.brake && speedKmh > 60,
      absActive: phys.absActive,
      headlightsOn: wCfg.headlightsRequired || inTunnel,
      passingFlashActive: this.input.hornOrFlash,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.audio.dispose();
    this.world.dispose();
    this.textures.dispose();
    this.composerTarget?.dispose();
    this.composer?.dispose();
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
