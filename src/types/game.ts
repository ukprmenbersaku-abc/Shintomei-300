export enum WeatherMode {
  Auto = 'auto',
  Clear = 'clear',
  Sunset = 'sunset',
  Night = 'night',
  Rain = 'rain',
  Fog = 'fog',
}

export enum ActiveWeather {
  Clear = 'clear',
  Sunset = 'sunset',
  Night = 'night',
  Rain = 'rain',
  Fog = 'fog',
}

export enum CameraMode {
  Chase = 'chase',
  Hood = 'hood',
  Bumper = 'bumper',
}

export enum TrafficDensity {
  Light = 'light',
  Realistic = 'realistic',
  Heavy = 'heavy',
}

export enum QualityMode {
  Ultra = 'ultra',
  Standard = 'standard',
}

export type DeviceMode = 'pc' | 'mobile';

export enum CarPaintId {
  ChampionshipWhite = 'white',
  BaysideBlue = 'blue',
  ShizuokaRed = 'red',
  Gunmetal = 'gunmetal',
  PearlYellow = 'yellow',
}

export enum TrafficArchetype {
  KeiWagon = 'kei',
  Sedan = 'sedan',
  SportsCoupe = 'coupe',
  BoxTruck = 'truck',
  PatrolCar = 'patrol',
}

export interface TelemetrySnapshot {
  speedKmh: number;
  rpm: number;
  gear: number; // 0 = N, -1 = R, 1..6 = forward
  throttle: number; // 0..1
  brake: number; // 0..1
  steerAngle: number; // -1..1
  gripLevel: number; // 0..1
  slipstreamActive: boolean;
  inTunnel: boolean;
  activeWeather: ActiveWeather;
  weatherProgress: number; // 0..1 if auto
  distanceKm: number;
  maxSpeedKmh: number;
  overtakeCount: number;
  nearMissCount: number;
  nearMissStreak: number;
  score: number;
  kilometerPost: number;
  currentRegionName: string;
  nextMilestoneName: string;
  nextMilestoneType: 'jct' | 'sa' | 'pa' | 'ic';
  nextMilestoneDistM: number;
  nextMilestoneFeature?: string;
  inSaApron: boolean;
  activeFacilityKind: 'sa' | 'pa' | null;
  inMergeLane: boolean;
  inIcRamp: boolean;
  inJctRamp: boolean;
  inParkingBay: boolean;
  isParked: boolean;
  isSpeedLimited: boolean;
  isBrakingHard: boolean;
  absActive: boolean;
  headlightsOn: boolean;
  passingFlashActive: boolean;
}

export interface IcClearSummary {
  kind?: 'ic' | 'jct';
  icName: string;
  branchName: string;
  distanceKm: number;
  maxSpeedKmh: number;
  overtakeCount: number;
  nearMissCount: number;
  score: number;
}

export interface SafetyBannerMessage {
  id: number;
  title: string;
  body: string;
  tone: 'info' | 'warning' | 'humor';
}

export interface InputState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  hornOrFlash: boolean;
  handbrake: boolean;
}
