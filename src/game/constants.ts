import { ActiveWeather, CarPaintId, TrafficArchetype, TrafficDensity } from '../types/game';

export const EXPRESSWAY = {
  LANE_WIDTH: 3.75,
  LANE_COUNT: 3,
  // Left-hand traffic (左側通行):
  // Lane 0 (第1走行車線・左): -3.75
  // Lane 1 (第2走行車線・中央): 0.0
  // Lane 2 (追越車線・右): +3.75
  LANE_CENTERS: [-3.75, 0.0, 3.75] as const,
  LEFT_SHOULDER_WIDTH: 2.75,
  RIGHT_SHOULDER_WIDTH: 1.5,
  ROAD_LEFT_EDGE: -8.375,
  ROAD_RIGHT_EDGE: 7.125,
  ROAD_WIDTH: 15.5,
  MEDIAN_X: 7.85,
  MEDIAN_WIDTH: 1.45,
  ONCOMING_CENTER_X: 16.325,
  ONCOMING_LANE_CENTERS: [12.575, 16.325, 20.075] as const,
  SEGMENT_LENGTH: 5,
  VISIBLE_SEGMENTS_AHEAD: 156,
  VISIBLE_SEGMENTS_BEHIND: 24,
  TUNNEL_INTERVAL_M: 2800,
  TUNNEL_LENGTH_M: 480,
  GANTRY_INTERVAL_M: 450,
  LAMP_INTERVAL_M: 40,
};

export const PARKING_BAY_COORDS = {
  sa: { laneOffset: -40.5, ds: 0, halfW: 3.8, halfL: 7.2 },
  pa: { laneOffset: -28.2, ds: 0, halfW: 3.4, halfL: 7.2 },
} as const;

export type FacilityStyleId =
  | 'isehara-jct'
  | 'suruga-sa'
  | 'shinfuji-ic'
  | 'shinshimizu-jct'
  | 'shimizu-pa'
  | 'shizuoka-sa'
  | 'shimada-ic'
  | 'kakegawa-pa'
  | 'hamamatsu-sa'
  | 'hamamatsu-inasa-jct';

export interface RouteMilestone {
  id: string;
  sPos: number;
  type: 'jct' | 'sa' | 'pa' | 'ic';
  styleId: FacilityStyleId;
  nameJa: string;
  routeCode: string;
  branchNameJa: string;
  mainAheadJa: string;
  featureJa: string;
  restBonusTitleJa?: string;
  restBonusBodyJa?: string;
  realKmPost: number;
}

// Authentic E1A Shin-Tomei Downbound (下り線：伊勢原JCT → 駿河湾沼津SA → 静岡SA → 浜松SA → 浜松いなさJCT) sequence
export const SHIN_TOMEI_ROUTE: RouteMilestone[] = [
  {
    id: 'isehara-jct',
    sPos: 900,
    type: 'jct',
    styleId: 'isehara-jct',
    nameJa: '伊勢原JCT',
    routeCode: 'E1',
    branchNameJa: '東名 厚木・東京',
    mainAheadJa: '新秦野・静岡・名古屋',
    featureJa: '東名接続高架ジャンクション',
    realKmPost: 13.8,
  },
  {
    id: 'neopasa-suruga',
    sPos: 2300,
    type: 'sa',
    styleId: 'suruga-sa',
    nameJa: 'NEOPASA 駿河湾沼津',
    routeCode: 'SA',
    branchNameJa: '駿河湾沼津SA 入口',
    mainAheadJa: '新富士・静岡・浜松',
    featureJa: '地中海リゾート・駿河湾展望テラス＆鐘の広場',
    restBonusTitleJa: '【NEOPASA 駿河湾沼津SA】駿河湾オーシャンテラス到着 +500pts！',
    restBonusBodyJa: '地中海風の白亜アーチと鐘の広場・駿河湾一望のオーシャンビュー！前方の加速車線から本線へ合流できます。',
    realKmPost: 56.4,
  },
  {
    id: 'shinfuji-ic',
    sPos: 3800,
    type: 'ic',
    styleId: 'shinfuji-ic',
    nameJa: '新富士IC',
    routeCode: 'IC',
    branchNameJa: '富士・富士宮（富士山麓）',
    mainAheadJa: '新清水JCT・静岡',
    featureJa: '富士・富士宮方面 4レーン料金所',
    realKmPost: 78.2,
  },
  {
    id: 'shinshimizu-jct',
    sPos: 5100,
    type: 'jct',
    styleId: 'shinshimizu-jct',
    nameJa: '新清水JCT',
    routeCode: 'E52',
    branchNameJa: '中部横断道 甲府 / 東名清水',
    mainAheadJa: '清水PA・静岡・浜松',
    featureJa: '中部横断道・清水連絡路 立体分岐',
    realKmPost: 93.0,
  },
  {
    id: 'neopasa-shimizu',
    sPos: 6400,
    type: 'pa',
    styleId: 'shimizu-pa',
    nameJa: 'NEOPASA 清水',
    routeCode: 'PA',
    branchNameJa: '清水PA 入口',
    mainAheadJa: '新静岡・藤枝・浜松',
    featureJa: '赤レンガ＆鉄骨ガレージ・バイク＆名車展示ピット',
    restBonusTitleJa: '【NEOPASA 清水PA】くるま旅ガレージピット休憩 +350pts！',
    restBonusBodyJa: '赤レンガと鉄骨のモータースポーツ風PA！展示スポーツカー＆バイク駐輪棟を横目に、加速車線から本線復帰できます。',
    realKmPost: 98.6,
  },
  {
    id: 'neopasa-shizuoka',
    sPos: 8200,
    type: 'sa',
    styleId: 'shizuoka-sa',
    nameJa: 'NEOPASA 静岡',
    routeCode: 'SA',
    branchNameJa: '静岡SA 入口',
    mainAheadJa: '島田金谷・浜松・名古屋',
    featureJa: '静岡杉ルーバー建築・茶畑テラス＆しずおかマルシェ',
    restBonusTitleJa: '【NEOPASA 静岡SA】静岡杉＆お茶マルシェ休憩 +500pts！',
    restBonusBodyJa: '静岡杉の温もりある木製ルーバーと緑豊かな茶畑テラス！前方右側の長い加速車線を使ってスムーズに本線へ合流してください。',
    realKmPost: 118.5,
  },
  {
    id: 'shimada-ic',
    sPos: 9900,
    type: 'ic',
    styleId: 'shimada-ic',
    nameJa: '島田金谷IC',
    routeCode: 'IC',
    branchNameJa: '島田・富士山静岡空港',
    mainAheadJa: '掛川PA・浜松SA',
    featureJa: '茶畑の丘・静岡空港アクセス料金所',
    realKmPost: 138.4,
  },
  {
    id: 'kakegawa-pa',
    sPos: 11400,
    type: 'pa',
    styleId: 'kakegawa-pa',
    nameJa: '掛川 PA',
    routeCode: 'PA',
    branchNameJa: '掛川PA 入口',
    mainAheadJa: '浜松SA・浜松いなさJCT',
    featureJa: '茶処・和風宿場モダン小型PA（24H休憩所）',
    restBonusTitleJa: '【掛川 PA】茶処・宿場モダンPAでひと息 +350pts！',
    restBonusBodyJa: '落ち着きある小型パーキングエリアでリフレッシュ！加速車線から周囲の120km/hフローに合わせて合流できます。',
    realKmPost: 147.2,
  },
  {
    id: 'neopasa-hamamatsu',
    sPos: 13100,
    type: 'sa',
    styleId: 'hamamatsu-sa',
    nameJa: 'NEOPASA 浜松',
    routeCode: 'SA',
    branchNameJa: '浜松SA 入口',
    mainAheadJa: '浜松いなさJCT・名古屋',
    featureJa: '音楽のまち浜松・巨大ピアノ鍵盤ファサード＆音楽ドーム',
    restBonusTitleJa: '【NEOPASA 浜松SA】ピアノ鍵盤テラス休憩 +500pts！',
    restBonusBodyJa: '楽器の街ならではの白黒ピアノ鍵盤ファサード＆ミュージックスポット！前方の加速車線から本線へ合流しましょう。',
    realKmPost: 162.8,
  },
  {
    id: 'hamamatsu-inasa-jct',
    sPos: 14700,
    type: 'jct',
    styleId: 'hamamatsu-inasa-jct',
    nameJa: '浜松いなさJCT',
    routeCode: 'E69',
    branchNameJa: '三遠南信道 / 東名三ヶ日',
    mainAheadJa: '新城・豊田東JCT・名古屋',
    featureJa: '三遠南信道・引佐連絡路 立体ジャンクション',
    realKmPost: 174.6,
  },
];

export const ROUTE_LOOP_LENGTH_M = 15900;

export const CAR_PHYSICS = {
  MAX_SPEED_KMH: 300,
  MAX_SPEED_MS: 300 / 3.6,
  MASS_KG: 1480,
  WHEELBASE_M: 2.72,
  DRAG_COEFF_AREA: 0.61,
  AIR_DENSITY: 1.225,
  ROLLING_RESISTANCE: 0.015,
  DOWNFORCE_COEFF: 1.4,
  MAX_ENGINE_FORCE_N: 11200,
  MAX_BRAKE_FORCE_N: 22000,
  GEAR_RATIOS: [3.42, 2.28, 1.64, 1.25, 0.99, 0.81] as const,
  FINAL_DRIVE: 3.55,
  WHEEL_RADIUS_M: 0.34,
  IDLE_RPM: 1050,
  REDLINE_RPM: 8400,
  SHIFT_UP_RPM: 7950,
  SHIFT_DOWN_RPM: 4100,
};

export const WEATHER_CONFIG: Record<
  ActiveWeather,
  {
    labelJa: string;
    shortJa: string;
    skyColor: number;
    skyZenithColor: number;
    skyHorizonColor: number;
    fogColor: number;
    fogDensity: number;
    sunColor: number;
    sunIntensity: number;
    sunElevation: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    asphaltRoughness: number;
    asphaltEnvIntensity: number;
    roadFriction: number;
    lampIntensity: number;
    headlightsRequired: boolean;
    rainIntensity: number;
    bloomStrength: number;
    exposure: number;
    starIntensity: number;
  }
> = {
  [ActiveWeather.Clear]: {
    labelJa: '晴天・富士晴れ',
    shortJa: '晴天',
    skyColor: 0x7cb9e8,
    skyZenithColor: 0x1e5aa8,
    skyHorizonColor: 0xb6dcf7,
    fogColor: 0xaed4ef,
    fogDensity: 0.001,
    sunColor: 0xfff3de,
    sunIntensity: 2.55,
    sunElevation: 0.58,
    hemiSky: 0x9bd2ff,
    hemiGround: 0x3b4838,
    hemiIntensity: 0.92,
    asphaltRoughness: 0.9,
    asphaltEnvIntensity: 0.14, // Natural matte-porous asphalt, zero fake glow
    roadFriction: 1.05,
    lampIntensity: 0.0,
    headlightsRequired: false,
    rainIntensity: 0.0,
    bloomStrength: 0.0, // No bloom washout in daylight!
    exposure: 0.96,
    starIntensity: 0.0,
  },
  [ActiveWeather.Sunset]: {
    labelJa: '夕暮れ・駿河サンセット',
    shortJa: '夕暮れ',
    skyColor: 0xc86b4c,
    skyZenithColor: 0x262958,
    skyHorizonColor: 0xf48444,
    fogColor: 0xd97d54,
    fogDensity: 0.0014,
    sunColor: 0xff8c42,
    sunIntensity: 2.1,
    sunElevation: 0.14,
    hemiSky: 0xffa776,
    hemiGround: 0x2c2432,
    hemiIntensity: 0.78,
    asphaltRoughness: 0.84,
    asphaltEnvIntensity: 0.2,
    roadFriction: 0.98,
    lampIntensity: 0.75,
    headlightsRequired: true,
    rainIntensity: 0.0,
    bloomStrength: 0.18,
    exposure: 0.96,
    starIntensity: 0.18,
  },
  [ActiveWeather.Night]: {
    labelJa: '夜間・深夜の新東名',
    shortJa: '夜間',
    skyColor: 0x060b18,
    skyZenithColor: 0x02050d,
    skyHorizonColor: 0x101c36,
    fogColor: 0x0b1326,
    fogDensity: 0.0019,
    sunColor: 0x8ea9d9,
    sunIntensity: 0.45,
    sunElevation: 0.38,
    hemiSky: 0x1d3054,
    hemiGround: 0x0c1018,
    hemiIntensity: 0.48,
    asphaltRoughness: 0.78,
    asphaltEnvIntensity: 0.24,
    roadFriction: 0.96,
    lampIntensity: 1.05,
    headlightsRequired: true,
    rainIntensity: 0.0,
    bloomStrength: 0.32,
    exposure: 1.05,
    starIntensity: 1.0,
  },
  [ActiveWeather.Rain]: {
    labelJa: '雨天・ウェット路面',
    shortJa: '雨天',
    skyColor: 0x455364,
    skyZenithColor: 0x283240,
    skyHorizonColor: 0x5c6b7c,
    fogColor: 0x4e5d6e,
    fogDensity: 0.003,
    sunColor: 0xc9d7e6,
    sunIntensity: 1.0,
    sunElevation: 0.45,
    hemiSky: 0x6b7d91,
    hemiGround: 0x1f252c,
    hemiIntensity: 0.78,
    asphaltRoughness: 0.36, // Realistic wet asphalt sheen without glowing mirror
    asphaltEnvIntensity: 0.52,
    roadFriction: 0.72,
    lampIntensity: 0.95,
    headlightsRequired: true,
    rainIntensity: 1.0,
    bloomStrength: 0.24,
    exposure: 0.95,
    starIntensity: 0.0,
  },
  [ActiveWeather.Fog]: {
    labelJa: '濃霧・御殿場霧区間',
    shortJa: '濃霧',
    skyColor: 0x8e99a3,
    skyZenithColor: 0x6e7a86,
    skyHorizonColor: 0xa4afb8,
    fogColor: 0x9aa5af,
    fogDensity: 0.0112,
    sunColor: 0xdde5ed,
    sunIntensity: 1.1,
    sunElevation: 0.45,
    hemiSky: 0xaab4be,
    hemiGround: 0x3a4046,
    hemiIntensity: 0.85,
    asphaltRoughness: 0.7,
    asphaltEnvIntensity: 0.25,
    roadFriction: 0.85,
    lampIntensity: 0.9,
    headlightsRequired: true,
    rainIntensity: 0.15,
    bloomStrength: 0.2,
    exposure: 0.94,
    starIntensity: 0.0,
  },
};

export const CAR_PAINTS: Record<
  CarPaintId,
  { nameJa: string; hex: number; swatch: string; metalness: number; roughness: number }
> = {
  [CarPaintId.ChampionshipWhite]: {
    nameJa: 'チャンピオンシップホワイト',
    hex: 0xdcdfda, // Realistic natural pearl white (won't clip/glow under sunlight)
    swatch: '#f4f5f0',
    metalness: 0.22,
    roughness: 0.24,
  },
  [CarPaintId.BaysideBlue]: {
    nameJa: 'ベイサイドブルー',
    hex: 0x1152ba,
    swatch: '#1158c7',
    metalness: 0.72,
    roughness: 0.24,
  },
  [CarPaintId.ShizuokaRed]: {
    nameJa: '駿河クリムゾン',
    hex: 0xba1c28,
    swatch: '#c91e2b',
    metalness: 0.58,
    roughness: 0.24,
  },
  [CarPaintId.Gunmetal]: {
    nameJa: 'ガンメタリック',
    hex: 0x3b424d,
    swatch: '#3b424d',
    metalness: 0.82,
    roughness: 0.24,
  },
  [CarPaintId.PearlYellow]: {
    nameJa: 'パールイエロー',
    hex: 0xd6a615,
    swatch: '#e6b417',
    metalness: 0.48,
    roughness: 0.24,
  },
};

export const TRAFFIC_PRESETS: Record<
  TrafficDensity,
  { labelJa: string; sameDirCount: number; oncomingCount: number }
> = {
  [TrafficDensity.Light]: { labelJa: '深夜・空いている', sameDirCount: 16, oncomingCount: 10 },
  [TrafficDensity.Realistic]: { labelJa: '現実的（新東名標準）', sameDirCount: 26, oncomingCount: 16 },
  [TrafficDensity.Heavy]: { labelJa: '連休・交通集中', sameDirCount: 38, oncomingCount: 22 },
};

export const TRAFFIC_SPECS: Record<
  TrafficArchetype,
  {
    width: number;
    length: number;
    height: number;
    minSpeedKmh: number;
    maxSpeedKmh: number;
    preferredLanes: number[];
    colors: number[];
  }
> = {
  [TrafficArchetype.KeiWagon]: {
    width: 1.62,
    length: 3.45,
    height: 1.68,
    minSpeedKmh: 98,
    maxSpeedKmh: 112,
    preferredLanes: [0, 1],
    colors: [0xd5dade, 0xbec7cf, 0x8ea7b6, 0xc7b29e, 0x45515e],
  },
  [TrafficArchetype.Sedan]: {
    width: 1.86,
    length: 4.78,
    height: 1.44,
    minSpeedKmh: 114,
    maxSpeedKmh: 122,
    preferredLanes: [0, 1, 2],
    colors: [0x1c222b, 0xd8dce2, 0x737c87, 0x263b54, 0x5c2329],
  },
  [TrafficArchetype.SportsCoupe]: {
    width: 1.92,
    length: 4.58,
    height: 1.32,
    minSpeedKmh: 118,
    maxSpeedKmh: 126,
    preferredLanes: [1, 2],
    colors: [0xb21c26, 0xdadfe5, 0x1d4f91, 0x2a2f36, 0xc98e14],
  },
  [TrafficArchetype.BoxTruck]: {
    width: 2.38,
    length: 8.8,
    height: 3.38,
    minSpeedKmh: 80,
    maxSpeedKmh: 90,
    preferredLanes: [0],
    colors: [0xcad3dc, 0xaab8c4, 0x2f5d8c, 0x3b6e52],
  },
  [TrafficArchetype.PatrolCar]: {
    width: 1.86,
    length: 4.86,
    height: 1.48,
    minSpeedKmh: 118,
    maxSpeedKmh: 120,
    preferredLanes: [1, 2],
    colors: [0xe6eaef],
  },
};

export const LED_BOARD_MESSAGES: string[] = [
  'この先 最高速度 300km/h（ゲーム内特例）',
  '※現実の新東名は最高120km/h（大型車80〜90km/h）です',
  '左車線から NEOPASA 駿河湾沼津・静岡・浜松 へ入出庫できます',
  '追越車線の走り続けは禁止です（300km/hでも走行車線へ）',
  '雨天・濃霧時は路面摩擦低下！車間距離を十分に',
];

export const HUMOROUS_SAFETY_TIPS: { title: string; body: string; tone: 'info' | 'warning' | 'humor' }[] = [
  {
    title: '【公式風おしらせ】現実では法定速度（新東名120km/h）を守ってください',
    body: 'このゲームの最高速度は300km/hですが、現実の新東名高速道路の法定最高速度は120km/h（大型車80〜90km/h）です。実車では安全運転をお願いします！',
    tone: 'humor',
  },
  {
    title: '【NEOPASA ご案内】左のランプからSAへ入れます',
    body: '新東名の各NEOPASA（駿河湾沼津・清水・静岡・浜松）へ左側から進入して減速すると休憩ボーナスが獲得でき、そのまま加速車線から本線に合流できます！',
    tone: 'info',
  },
  {
    title: '【高速隊パトロール中】他車は120km/h基準で走行中',
    body: '一般の乗用車は新東名リアル基準の約115〜122km/h、大型トラックは80〜90km/hで走行しています。現実で300km/h出すと一発で免停＋裁判コースです。',
    tone: 'warning',
  },
  {
    title: '【雨天時の制動距離に注意】',
    body: 'ウェット路面ではタイヤのグリップが約30%低下します。300km/hからのフルブレーキングは余裕をもって手前から！',
    tone: 'warning',
  },
];
