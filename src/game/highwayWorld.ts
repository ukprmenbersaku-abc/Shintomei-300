import * as THREE from 'three';
import {
  EXPRESSWAY,
  FacilityStyleId,
  PARKING_BAY_COORDS,
  ROUTE_LOOP_LENGTH_M,
  RouteMilestone,
  SHIN_TOMEI_ROUTE,
} from './constants';
import {
  createGantryStructure,
  createGoreNoseAssembly,
  createHamamatsuSaComplex,
  createIcExitComplex,
  createJctOverpass,
  createJctRampCurve,
  createKakegawaPaComplex,
  createShimizuPaComplex,
  createShizuokaSaComplex,
  createStreetLamp,
  createSurugaSaComplex,
} from './models';
import {
  ProceduralTexturePack,
  updateGantrySignForMilestone,
  updateLedBoardCanvas,
} from './textures';

export function roadCenterX(s: number): number {
  return (
    46 * Math.sin(s * 0.00165) +
    28 * Math.cos(s * 0.00072) +
    13 * Math.sin(s * 0.0039) -
    28
  );
}

export function roadCenterDX(s: number): number {
  return (
    46 * 0.00165 * Math.cos(s * 0.00165) -
    28 * 0.00072 * Math.sin(s * 0.00072) +
    13 * 0.0039 * Math.cos(s * 0.0039)
  );
}

export function roadElevationY(s: number): number {
  return 11 * Math.sin(s * 0.0013) + 4.5 * Math.cos(s * 0.0029) - 4.5;
}

export function roadElevationDY(s: number): number {
  return 11 * 0.0013 * Math.cos(s * 0.0013) - 4.5 * 0.0029 * Math.sin(s * 0.0029);
}

export function wrapRouteS(s: number): number {
  return ((s % ROUTE_LOOP_LENGTH_M) + ROUTE_LOOP_LENGTH_M) % ROUTE_LOOP_LENGTH_M;
}

export function signedLoopDelta(s: number, targetLoopS: number): number {
  const loopS = wrapRouteS(s);
  let d = loopS - targetLoopS;
  if (d > ROUTE_LOOP_LENGTH_M * 0.5) d -= ROUTE_LOOP_LENGTH_M;
  if (d < -ROUTE_LOOP_LENGTH_M * 0.5) d += ROUTE_LOOP_LENGTH_M;
  return d; // negative = approaching target, positive = past target
}

export function getMilestoneNear(
  s: number,
  halfSpan: number,
  typeFilter?: 'sa' | 'pa' | 'jct' | 'ic',
): { milestone: RouteMilestone; ds: number; worldS: number } | null {
  for (const m of SHIN_TOMEI_ROUTE) {
    if (typeFilter && m.type !== typeFilter) continue;
    const ds = signedLoopDelta(s, m.sPos);
    if (Math.abs(ds) <= halfSpan) {
      return { milestone: m, ds, worldS: s - ds };
    }
  }
  return null;
}

export function getNextMilestoneAhead(s: number): { milestone: RouteMilestone; distM: number } {
  const loopS = wrapRouteS(s);
  let best = SHIN_TOMEI_ROUTE[0];
  let bestDist = ROUTE_LOOP_LENGTH_M + best.sPos - loopS;
  for (const m of SHIN_TOMEI_ROUTE) {
    const dist = m.sPos >= loopS ? m.sPos - loopS : ROUTE_LOOP_LENGTH_M - loopS + m.sPos;
    if (dist < bestDist) {
      bestDist = dist;
      best = m;
    }
  }
  return { milestone: best, distM: bestDist };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export interface FacilityProfile {
  milestone: RouteMilestone | null;
  ds: number;
  hasRamp: boolean;
  outerX: number;
  innerX: number;
  facilityY: number;
  hasGuide: boolean;
  hasIsland: boolean;
  islandLeftX: number;
  islandRightX: number;
  goreLeftX: number;
  goreRightX: number;
  isPlaza: boolean;
  isMergeLane: boolean;
}

const EMPTY_PROFILE: FacilityProfile = {
  milestone: null,
  ds: 0,
  hasRamp: false,
  outerX: EXPRESSWAY.ROAD_LEFT_EDGE,
  innerX: EXPRESSWAY.ROAD_LEFT_EDGE,
  facilityY: 0,
  hasGuide: false,
  hasIsland: false,
  islandLeftX: EXPRESSWAY.ROAD_LEFT_EDGE,
  islandRightX: EXPRESSWAY.ROAD_LEFT_EDGE,
  goreLeftX: 0,
  goreRightX: 0,
  isPlaza: false,
  isMergeLane: false,
};

export function getFacilityProfileAt(s: number): FacilityProfile {
  const hit = getMilestoneNear(s, 400);
  if (!hit) return EMPTY_PROFILE;
  const { milestone: m, ds, worldS } = hit;
  const EDGE = EXPRESSWAY.ROAD_LEFT_EDGE; // -8.375
  const LANE0_LEFT = -5.625;
  const mainY = roadElevationY(s);
  const plateauBaseY = roadElevationY(worldS);

  if (m.type === 'sa') {
    if (ds < -340 || ds > 380) return EMPTY_PROFILE;

    let outerX = EDGE;
    let innerX = LANE0_LEFT;
    let hasGuide = false;
    let hasIsland = false;
    let islandLeftX = EDGE;
    let goreLeftX = 0;
    let goreRightX = 0;
    let isPlaza = false;
    let isMergeLane = false;

    if (ds < -245) {
      // Smooth entry taper into parallel deceleration lane
      outerX = THREE.MathUtils.lerp(EDGE, -12.4, smoothstep(-340, -245, ds));
      innerX = THREE.MathUtils.lerp(EDGE, LANE0_LEFT, smoothstep(-340, -322, ds));
      hasGuide = ds >= -332;
    } else if (ds < -205) {
      // Straight parallel deceleration lane
      outerX = -12.4;
      innerX = LANE0_LEFT;
      hasGuide = true;
    } else if (ds < -165) {
      // Single continuous curve peeling off across the diverge gore
      outerX = THREE.MathUtils.lerp(-12.4, -46.0, smoothstep(-205, -80, ds));
      innerX = THREE.MathUtils.lerp(LANE0_LEFT, EDGE, smoothstep(-208, -190, ds));
      hasGuide = ds < -198;
      const gt = smoothstep(-205, -165, ds);
      goreRightX = EDGE;
      goreLeftX = EDGE - gt * 2.5;
      innerX = Math.min(innerX, goreLeftX);
    } else if (ds < -80) {
      // Same uninterrupted S-curve into SA plaza (no tangent kink at -165!)
      outerX = THREE.MathUtils.lerp(-12.4, -46.0, smoothstep(-205, -80, ds));
      innerX = THREE.MathUtils.lerp(-10.875, -17.5, smoothstep(-165, -80, ds));
      hasIsland = true;
      islandLeftX = innerX;
    } else if (ds <= 80) {
      // Level SA parking plaza
      outerX = -46.0;
      innerX = -17.5;
      hasIsland = true;
      islandLeftX = innerX;
      isPlaza = true;
    } else if (ds <= 185) {
      // Single uninterrupted exit S-curve back toward merge gore & parallel accel lane
      outerX = THREE.MathUtils.lerp(-46.0, -12.4, smoothstep(80, 215, ds));
      innerX = THREE.MathUtils.lerp(-17.5, -10.875, smoothstep(80, 185, ds));
      hasIsland = true;
      islandLeftX = innerX;
    } else if (ds <= 215) {
      // Merge gore wedge narrowing flush to mainline shoulder, outerX finishes same smooth curve
      outerX = THREE.MathUtils.lerp(-46.0, -12.4, smoothstep(80, 215, ds));
      const gt = 1 - smoothstep(185, 220, ds);
      goreRightX = EDGE;
      goreLeftX = EDGE - gt * 2.5;
      innerX = THREE.MathUtils.lerp(goreLeftX, LANE0_LEFT, smoothstep(200, 220, ds));
      hasGuide = ds >= 210;
      isMergeLane = true;
    } else if (ds <= 300) {
      // Straight parallel acceleration lane for confident 120km/h merging
      outerX = -12.4;
      innerX = LANE0_LEFT;
      if (ds <= 220) {
        const gt = 1 - smoothstep(185, 220, ds);
        goreRightX = EDGE;
        goreLeftX = EDGE - gt * 2.5;
        innerX = THREE.MathUtils.lerp(goreLeftX, LANE0_LEFT, smoothstep(200, 220, ds));
      }
      hasGuide = true;
      isMergeLane = true;
    } else {
      // Clean acceleration lane merge taper back into mainline
      outerX = THREE.MathUtils.lerp(-12.4, EDGE, smoothstep(300, 380, ds));
      innerX = THREE.MathUtils.lerp(LANE0_LEFT, EDGE, smoothstep(358, 380, ds));
      hasGuide = ds <= 372;
      isMergeLane = true;
    }

    // Climb/descend ONLY inside the separated island span so diverge/merge gores sit flush at mainY!
    const rampBlend = Math.min(smoothstep(-158, -76, ds), 1 - smoothstep(76, 178, ds));
    const facilityY = THREE.MathUtils.lerp(mainY, plateauBaseY + 2.2, rampBlend);

    return {
      milestone: m,
      ds,
      hasRamp: true,
      outerX,
      innerX,
      facilityY,
      hasGuide,
      hasIsland,
      islandLeftX,
      islandRightX: EDGE,
      goreLeftX,
      goreRightX,
      isPlaza,
      isMergeLane,
    };
  }

  if (m.type === 'pa') {
    if (ds < -270 || ds > 300) return EMPTY_PROFILE;

    let outerX = EDGE;
    let innerX = LANE0_LEFT;
    let hasGuide = false;
    let hasIsland = false;
    let islandLeftX = EDGE;
    let goreLeftX = 0;
    let goreRightX = 0;
    let isPlaza = false;
    let isMergeLane = false;

    if (ds < -195) {
      outerX = THREE.MathUtils.lerp(EDGE, -12.2, smoothstep(-270, -195, ds));
      innerX = THREE.MathUtils.lerp(EDGE, LANE0_LEFT, smoothstep(-270, -252, ds));
      hasGuide = ds >= -262;
    } else if (ds < -165) {
      outerX = -12.2;
      innerX = LANE0_LEFT;
      hasGuide = true;
    } else if (ds < -135) {
      outerX = THREE.MathUtils.lerp(-12.2, -33.0, smoothstep(-165, -60, ds));
      innerX = THREE.MathUtils.lerp(LANE0_LEFT, EDGE, smoothstep(-168, -152, ds));
      hasGuide = ds < -160;
      const gt = smoothstep(-168, -135, ds);
      goreRightX = EDGE;
      goreLeftX = EDGE - gt * 2.2;
      innerX = Math.min(innerX, goreLeftX);
    } else if (ds < -60) {
      outerX = THREE.MathUtils.lerp(-12.2, -33.0, smoothstep(-165, -60, ds));
      innerX = THREE.MathUtils.lerp(-10.575, -14.5, smoothstep(-135, -60, ds));
      hasIsland = true;
      islandLeftX = innerX;
    } else if (ds <= 60) {
      outerX = -33.0;
      innerX = -14.5;
      hasIsland = true;
      islandLeftX = innerX;
      isPlaza = true;
    } else if (ds <= 145) {
      outerX = THREE.MathUtils.lerp(-33.0, -12.2, smoothstep(60, 175, ds));
      innerX = THREE.MathUtils.lerp(-14.5, -10.575, smoothstep(60, 145, ds));
      hasIsland = true;
      islandLeftX = innerX;
    } else if (ds <= 178) {
      outerX = THREE.MathUtils.lerp(-33.0, -12.2, smoothstep(60, 175, ds));
      const gt = 1 - smoothstep(145, 178, ds);
      goreRightX = EDGE;
      goreLeftX = EDGE - gt * 2.2;
      innerX = THREE.MathUtils.lerp(goreLeftX, LANE0_LEFT, smoothstep(160, 178, ds));
      hasGuide = ds >= 170;
      isMergeLane = true;
    } else if (ds <= 240) {
      outerX = -12.2;
      innerX = LANE0_LEFT;
      hasGuide = true;
      isMergeLane = true;
    } else {
      outerX = THREE.MathUtils.lerp(-12.2, EDGE, smoothstep(240, 300, ds));
      innerX = THREE.MathUtils.lerp(LANE0_LEFT, EDGE, smoothstep(280, 300, ds));
      hasGuide = ds <= 292;
      isMergeLane = true;
    }

    const rampBlend = Math.min(smoothstep(-130, -56, ds), 1 - smoothstep(56, 138, ds));
    const facilityY = THREE.MathUtils.lerp(mainY, plateauBaseY + 1.2, rampBlend);

    return {
      milestone: m,
      ds,
      hasRamp: true,
      outerX,
      innerX,
      facilityY,
      hasGuide,
      hasIsland,
      islandLeftX,
      islandRightX: EDGE,
      goreLeftX,
      goreRightX,
      isPlaza,
      isMergeLane,
    };
  }

  if (m.type === 'ic') {
    if (ds < -320 || ds > 230) return EMPTY_PROFILE;

    let outerX = EDGE;
    let innerX = LANE0_LEFT;
    let hasGuide = false;
    let hasIsland = false;
    let islandLeftX = EDGE;
    let goreLeftX = 0;
    let goreRightX = 0;

    if (ds < -230) {
      outerX = THREE.MathUtils.lerp(EDGE, -12.8, smoothstep(-320, -230, ds));
      innerX = THREE.MathUtils.lerp(EDGE, LANE0_LEFT, smoothstep(-320, -302, ds));
      hasGuide = ds >= -312;
    } else if (ds < -165) {
      outerX = THREE.MathUtils.lerp(-12.8, -46.5, smoothstep(-230, 15, ds) * 0.16);
      innerX = THREE.MathUtils.lerp(LANE0_LEFT, EDGE, smoothstep(-205, -182, ds));
      hasGuide = ds < -195;
      if (ds >= -200) {
        const gt = smoothstep(-200, -165, ds);
        goreRightX = EDGE;
        goreLeftX = EDGE - gt * 2.5;
        innerX = Math.min(innerX, goreLeftX);
      }
    } else if (ds <= 15) {
      const t = smoothstep(-165, 15, ds);
      outerX = THREE.MathUtils.lerp(-17.8, -46.5, t);
      innerX = THREE.MathUtils.lerp(-10.875, -24.5, t);
      hasIsland = true;
      islandLeftX = innerX;
    } else if (ds <= 75) {
      outerX = -46.5;
      innerX = -24.5;
      hasIsland = true;
      islandLeftX = innerX;
    } else {
      const t = smoothstep(75, 230, ds);
      outerX = THREE.MathUtils.lerp(-46.5, -68.0, t);
      innerX = THREE.MathUtils.lerp(-24.5, -50.0, t);
      hasIsland = ds < 130;
      islandLeftX = innerX;
    }

    return {
      milestone: m,
      ds,
      hasRamp: true,
      outerX,
      innerX,
      facilityY: mainY,
      hasGuide,
      hasIsland,
      islandLeftX,
      islandRightX: EDGE,
      goreLeftX,
      goreRightX,
      isPlaza: false,
      isMergeLane: false,
    };
  }

  // JCT: left deceleration lane peeling smoothly into elevated JCT viaduct at ds = -150..-80
  if (ds < -300 || ds > -80) return EMPTY_PROFILE;
  let outerX = EDGE;
  let innerX = LANE0_LEFT;
  let hasGuide = false;
  let hasIsland = false;
  let islandLeftX = EDGE;
  let goreLeftX = 0;
  let goreRightX = 0;

  if (ds < -210) {
    outerX = THREE.MathUtils.lerp(EDGE, -12.6, smoothstep(-300, -210, ds));
    innerX = THREE.MathUtils.lerp(EDGE, LANE0_LEFT, smoothstep(-300, -282, ds));
    hasGuide = ds >= -292;
  } else if (ds < -150) {
    outerX = THREE.MathUtils.lerp(-12.6, -16.5, smoothstep(-210, -150, ds));
    innerX = THREE.MathUtils.lerp(LANE0_LEFT, EDGE, smoothstep(-185, -165, ds));
    hasGuide = ds < -175;
    if (ds >= -182) {
      const gt = smoothstep(-182, -150, ds);
      goreRightX = EDGE;
      goreLeftX = EDGE - gt * 2.2;
      innerX = Math.min(innerX, goreLeftX);
    }
  } else {
    const t = smoothstep(-150, -80, ds);
    outerX = THREE.MathUtils.lerp(-16.5, -26.2, t);
    innerX = THREE.MathUtils.lerp(-10.575, -17.8, t);
    hasIsland = true;
    islandLeftX = innerX;
  }

  return {
    milestone: m,
    ds,
    hasRamp: true,
    outerX,
    innerX,
    facilityY: mainY,
    hasGuide,
    hasIsland,
    islandLeftX,
    islandRightX: EDGE,
    goreLeftX,
    goreRightX,
    isPlaza: false,
    isMergeLane: false,
  };
}

const SHARED_JCT_CURVE = createJctRampCurve();
const SHARED_JCT_LENGTH = SHARED_JCT_CURVE.getLength();
const _jctEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _jctPos = new THREE.Vector3();
const _jctTan = new THREE.Vector3();
const _jctRight = new THREE.Vector3();
const _jctUp = new THREE.Vector3(0, 1, 0);

export function getJctCurveLength(): number {
  return SHARED_JCT_LENGTH;
}

export function sampleJctOverpassWorld(
  milestoneWorldS: number,
  t: number,
  lateralOffset: number,
): {
  x: number;
  y: number;
  z: number;
  fwdX: number;
  fwdY: number;
  fwdZ: number;
  yaw: number;
  pitch: number;
} {
  const clampedT = THREE.MathUtils.clamp(t, 0, 1);
  const localPt = SHARED_JCT_CURVE.getPointAt(clampedT);
  const localTan = SHARED_JCT_CURVE.getTangentAt(clampedT).normalize();
  _jctRight.crossVectors(localTan, _jctUp).normalize();

  _jctPos.copy(localPt).addScaledVector(_jctRight, lateralOffset);
  _jctTan.copy(localTan);

  const mYaw = -Math.atan2(roadCenterDX(milestoneWorldS), 1);
  const mPitch = Math.atan(roadElevationDY(milestoneWorldS));
  _jctEuler.set(mPitch, mYaw, 0, 'XYZ');

  _jctPos.applyEuler(_jctEuler);
  _jctTan.applyEuler(_jctEuler).normalize();

  const mx = roadCenterX(milestoneWorldS);
  const my = roadElevationY(milestoneWorldS);
  const mz = -milestoneWorldS;

  return {
    x: mx + _jctPos.x,
    y: my + _jctPos.y,
    z: mz + _jctPos.z,
    fwdX: _jctTan.x,
    fwdY: _jctTan.y,
    fwdZ: _jctTan.z,
    yaw: Math.atan2(-_jctTan.x, -_jctTan.z),
    pitch: Math.asin(THREE.MathUtils.clamp(_jctTan.y, -0.95, 0.95)),
  };
}

export function getSurfaceElevationAt(s: number, laneOffset: number): number {
  const mainY = roadElevationY(s);
  const prof = getFacilityProfileAt(s);
  if (
    !prof.hasRamp ||
    !prof.milestone ||
    (prof.milestone.type !== 'sa' && prof.milestone.type !== 'pa')
  ) {
    return mainY;
  }

  if (prof.hasIsland) {
    const splitMid = (prof.islandLeftX + prof.islandRightX) * 0.5;
    return laneOffset < splitMid ? prof.facilityY : mainY;
  }

  const latBlend = smoothstep(-6.6, -10.2, laneOffset);
  return THREE.MathUtils.lerp(mainY, prof.facilityY, latBlend);
}

export function getSurfaceSlopeAt(s: number, laneOffset: number): number {
  return (getSurfaceElevationAt(s + 1.0, laneOffset) - getSurfaceElevationAt(s - 1.0, laneOffset)) * 0.5;
}

export function getOffMainlineBounds(
  s: number,
  laneOffset: number,
): {
  leftBound: number;
  rightBound: number;
  inSaApron: boolean;
  inMergeLane: boolean;
  inIcRamp: boolean;
  inJctRamp: boolean;
  inParkingBay: boolean;
  activeSa: RouteMilestone | null;
  activeIc: RouteMilestone | null;
  activeJct: RouteMilestone | null;
  icDs: number;
  jctDs: number;
} {
  const prof = getFacilityProfileAt(s);
  const MAIN_LEFT = -7.2;
  const MAIN_RIGHT = 6.15;

  if (!prof.hasRamp || !prof.milestone) {
    return {
      leftBound: MAIN_LEFT,
      rightBound: MAIN_RIGHT,
      inSaApron: false,
      inMergeLane: false,
      inIcRamp: false,
      inJctRamp: false,
      inParkingBay: false,
      activeSa: null,
      activeIc: null,
      activeJct: null,
      icDs: 0,
      jctDs: 0,
    };
  }

  const m = prof.milestone;
  const ds = prof.ds;
  const rampLeftBound = prof.outerX + 1.25;

  if (m.type === 'jct') {
    if (prof.hasIsland) {
      const splitMid = (prof.islandLeftX + prof.islandRightX) * 0.5;
      if (laneOffset < splitMid) {
        return {
          leftBound: rampLeftBound,
          rightBound: prof.islandLeftX - 1.15,
          inSaApron: false,
          inMergeLane: false,
          inIcRamp: false,
          inJctRamp: true,
          inParkingBay: false,
          activeSa: null,
          activeIc: null,
          activeJct: m,
          icDs: 0,
          jctDs: ds,
        };
      }
      return {
        leftBound: MAIN_LEFT,
        rightBound: MAIN_RIGHT,
        inSaApron: false,
        inMergeLane: false,
        inIcRamp: false,
        inJctRamp: false,
        inParkingBay: false,
        activeSa: null,
        activeIc: null,
        activeJct: m,
        icDs: 0,
        jctDs: ds,
      };
    }

    return {
      leftBound: Math.min(MAIN_LEFT, rampLeftBound),
      rightBound: MAIN_RIGHT,
      inSaApron: false,
      inMergeLane: false,
      inIcRamp: false,
      inJctRamp: laneOffset < -6.3,
      inParkingBay: false,
      activeSa: null,
      activeIc: null,
      activeJct: m,
      icDs: 0,
      jctDs: ds,
    };
  }

  if (m.type === 'sa' || m.type === 'pa') {
    const bay = PARKING_BAY_COORDS[m.type];
    const inParkingBay =
      prof.isPlaza &&
      Math.abs(ds - bay.ds) <= bay.halfL &&
      Math.abs(laneOffset - bay.laneOffset) <= bay.halfW;

    if (prof.hasIsland) {
      const splitMid = (prof.islandLeftX + prof.islandRightX) * 0.5;
      if (laneOffset < splitMid) {
        return {
          leftBound: rampLeftBound,
          rightBound: prof.islandLeftX - 1.15,
          inSaApron: true,
          inMergeLane: false,
          inIcRamp: false,
          inJctRamp: false,
          inParkingBay,
          activeSa: m,
          activeIc: null,
          activeJct: null,
          icDs: 0,
          jctDs: 0,
        };
      }
      return {
        leftBound: MAIN_LEFT,
        rightBound: MAIN_RIGHT,
        inSaApron: false,
        inMergeLane: false,
        inIcRamp: false,
        inJctRamp: false,
        inParkingBay: false,
        activeSa: m,
        activeIc: null,
        activeJct: null,
        icDs: 0,
        jctDs: 0,
      };
    }

    const inMerge = prof.isMergeLane && laneOffset < -5.8;
    const inDecel = !prof.isMergeLane && laneOffset < -6.2;
    return {
      leftBound: Math.min(MAIN_LEFT, rampLeftBound),
      rightBound: MAIN_RIGHT,
      inSaApron: inDecel,
      inMergeLane: inMerge,
      inIcRamp: false,
      inJctRamp: false,
      inParkingBay: false,
      activeSa: m,
      activeIc: null,
      activeJct: null,
      icDs: 0,
      jctDs: 0,
    };
  }

  // IC Off-Ramp & Toll Plaza
  if (prof.hasIsland || ds > 15) {
    const splitMid = prof.hasIsland ? (prof.islandLeftX + prof.islandRightX) * 0.5 : -16.0;
    if (laneOffset < splitMid) {
      return {
        leftBound: rampLeftBound,
        rightBound: prof.innerX - 1.2,
        inSaApron: false,
        inMergeLane: false,
        inIcRamp: true,
        inJctRamp: false,
        inParkingBay: false,
        activeSa: null,
        activeIc: m,
        activeJct: null,
        icDs: ds,
        jctDs: 0,
      };
    }
    return {
      leftBound: MAIN_LEFT,
      rightBound: MAIN_RIGHT,
      inSaApron: false,
      inMergeLane: false,
      inIcRamp: false,
      inJctRamp: false,
      inParkingBay: false,
      activeSa: null,
      activeIc: m,
      activeJct: null,
      icDs: ds,
      jctDs: 0,
    };
  }

  return {
    leftBound: Math.min(MAIN_LEFT, rampLeftBound),
    rightBound: MAIN_RIGHT,
    inSaApron: false,
    inMergeLane: false,
    inIcRamp: laneOffset < -6.8,
    inJctRamp: false,
    inParkingBay: false,
    activeSa: null,
    activeIc: m,
    activeJct: null,
    icDs: ds,
    jctDs: 0,
  };
}

export function isTunnelAt(s: number): boolean {
  if (s < 650) return false;
  // Never spawn tunnels over JCT, IC, PA, or SA approaches
  if (getMilestoneNear(s, 420)) return false;
  const mod = ((s % EXPRESSWAY.TUNNEL_INTERVAL_M) + EXPRESSWAY.TUNNEL_INTERVAL_M) % EXPRESSWAY.TUNNEL_INTERVAL_M;
  return mod >= 1300 && mod < 1300 + EXPRESSWAY.TUNNEL_LENGTH_M;
}

function isSoundBarrierAt(s: number): boolean {
  if (isTunnelAt(s) || getMilestoneNear(s, 390)) return false;
  const mod = ((s % 1600) + 1600) % 1600;
  return mod >= 200 && mod < 640;
}

const TOTAL_SEGMENTS = EXPRESSWAY.VISIBLE_SEGMENTS_BEHIND + EXPRESSWAY.VISIBLE_SEGMENTS_AHEAD;
const ROW_COUNT = TOTAL_SEGMENTS + 1;

function createRibbonGeometry(crossSectionCount: number): THREE.BufferGeometry {
  const vertCount = ROW_COUNT * crossSectionCount;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  for (let r = 0; r < TOTAL_SEGMENTS; r++) {
    for (let c = 0; c < crossSectionCount - 1; c++) {
      const a = r * crossSectionCount + c;
      const b = a + 1;
      const d = (r + 1) * crossSectionCount + c;
      const e = d + 1;
      indices.push(a, b, d);
      indices.push(b, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export class HighwayWorld {
  private scene: THREE.Scene;
  private textures: ProceduralTexturePack;

  // Procedural Atmospheric Sky Dome
  private skyMesh: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;

  // Main & Facility ribbons
  private roadGeo: THREE.BufferGeometry;
  private oncomingRoadGeo: THREE.BufferGeometry;
  private rampRoadGeo: THREE.BufferGeometry;
  private plazaOverlayGeo: THREE.BufferGeometry;
  private rampGuideGeo: THREE.BufferGeometry;
  private goreGeo: THREE.BufferGeometry;
  private islandGeo: THREE.BufferGeometry;
  private islandGuardrailGeo: THREE.BufferGeometry;
  private medianGeo: THREE.BufferGeometry;
  private terrainLeftGeo: THREE.BufferGeometry;
  private terrainRightGeo: THREE.BufferGeometry;
  private guardrailLeftGeo: THREE.BufferGeometry;
  private guardrailRightGeo: THREE.BufferGeometry;

  private roadMaterial: THREE.MeshStandardMaterial;
  private terrainMaterial: THREE.MeshStandardMaterial;

  // Tunnel arch pool
  private tunnelPool: THREE.Group[] = [];
  private tunnelLightMat: THREE.MeshStandardMaterial;

  // Bespoke Milestone Complexes (each SA, PA, IC, JCT has its own real-world architecture)
  private facilityMap = new Map<FacilityStyleId, THREE.Group>();
  private divergeGorePool: THREE.Group[] = [];
  private mergeGorePool: THREE.Group[] = [];

  // Gantries & Streetlamps
  private gantries: { group: THREE.Group; sPos: number; lastBucket: number; lastMilestoneId: string }[] = [];
  private lamps: { group: THREE.Group; bulbMat: THREE.MeshStandardMaterial }[] = [];

  // Instanced Rich Scenery Props
  private treeTrunkMesh: THREE.InstancedMesh;
  private treeLowerCrownMesh: THREE.InstancedMesh;
  private treeUpperCrownMesh: THREE.InstancedMesh;
  private catsEyeMesh: THREE.InstancedMesh;
  private glarePaddleMesh: THREE.InstancedMesh;
  private delineatorMesh: THREE.InstancedMesh;
  private emergencyBoxMesh: THREE.InstancedMesh;
  private soundBarrierMesh: THREE.InstancedMesh;
  private viaductPierMesh: THREE.InstancedMesh;
  private pylonMesh: THREE.InstancedMesh;

  // Mt. Fuji & Grounded Panorama Backdrop
  private groundFloorMesh: THREE.Mesh;
  private groundFloorMat: THREE.MeshStandardMaterial;
  private mountainRingMesh: THREE.Mesh;
  private mountainRingMat: THREE.MeshStandardMaterial;
  private fujiMesh: THREE.Mesh;
  private fujiMaterial: THREE.MeshBasicMaterial;

  // Rain system & Tire Wake Spray (Ultra-HD)
  private rainLines: THREE.LineSegments;
  private rainMat: THREE.LineBasicMaterial;
  private rainPositions: Float32Array;
  private readonly rainCount = 1100;

  private isSoftwareGl: boolean;
  private tunnelLights: THREE.PointLight[] = [];
  private sprayPoints: THREE.Points;
  private sprayMat: THREE.PointsMaterial;
  private sprayPositions: Float32Array;
  private sprayAges: Float32Array;
  private readonly sprayCount = 140;

  private lastBaseSeg = Number.NaN;
  private ledMessageTimer = 0;
  private ledMessageIdx = 0;
  private elapsedTime = 0;

  private readonly _dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, textures: ProceduralTexturePack, isSoftwareGl: boolean) {
    this.scene = scene;
    this.textures = textures;
    this.isSoftwareGl = isSoftwareGl;

    // 0. Atmospheric Sky Dome (horizon seamlessly fades to grounded terrain mist below horizon)
    const skyGeo = new THREE.SphereGeometry(1250, 32, 22);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenithColor: { value: new THREE.Color(0x1e5aa8) },
        uHorizonColor: { value: new THREE.Color(0xb6dcf7) },
        uGroundColor: { value: new THREE.Color(0x283a30) },
        uSunColor: { value: new THREE.Color(0xfff4e0) },
        uSunDir: { value: new THREE.Vector3(0.25, 0.45, -0.85).normalize() },
        uStarIntensity: { value: 0.0 },
        uCloudOpacity: { value: 0.35 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uGroundColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uStarIntensity;
        uniform float uCloudOpacity;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uZenithColor, pow(h, 0.58));

          if (dir.y < 0.0) {
            col = mix(uHorizonColor, uGroundColor, smoothstep(0.0, -0.14, dir.y));
          }

          float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sunAmt, 14.0) * 0.28 * smoothstep(-0.04, 0.05, dir.y);
          col += uSunColor * smoothstep(0.9986, 0.9997, sunAmt) * 1.15 * smoothstep(-0.02, 0.02, dir.y);

          if (dir.y > 0.03 && uCloudOpacity > 0.01) {
            vec2 cloudUv = dir.xz / (dir.y + 0.16) * 1.3 + vec2(uTime * 0.008, uTime * 0.003);
            float n = noise(cloudUv * 2.2) * 0.6 + noise(cloudUv * 5.0) * 0.4;
            float cloudMask = smoothstep(0.52, 0.85, n) * smoothstep(0.03, 0.25, dir.y);
            vec3 cloudCol = mix(uHorizonColor * 1.1, vec3(0.95), 0.32);
            col = mix(col, cloudCol, cloudMask * uCloudOpacity);
          }

          if (uStarIntensity > 0.01 && dir.y > 0.05) {
            vec2 starUv = floor(dir.xz / (dir.y + 0.35) * 140.0);
            float s = hash(starUv);
            if (s > 0.992) {
              float twinkle = 0.6 + 0.4 * sin(uTime * 2.5 + s * 100.0);
              col += vec3(0.9, 0.95, 1.0) * uStarIntensity * twinkle * smoothstep(0.05, 0.35, dir.y);
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.skyMesh.frustumCulled = false;
    scene.add(this.skyMesh);

    // 1. Road Surface Materials (Natural matte-porous asphalt + micro-aggregate normal map)
    this.roadMaterial = new THREE.MeshStandardMaterial({
      map: textures.roadAlbedo,
      roughnessMap: textures.roadRoughness,
      normalMap: textures.roadNormalTexture,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.9,
      metalness: 0.06,
      envMapIntensity: 0.14,
    });

    this.roadGeo = createRibbonGeometry(2);
    const roadMesh = new THREE.Mesh(this.roadGeo, this.roadMaterial);
    roadMesh.receiveShadow = !isSoftwareGl;
    roadMesh.frustumCulled = false;
    scene.add(roadMesh);

    this.oncomingRoadGeo = createRibbonGeometry(2);
    const oncomingMesh = new THREE.Mesh(this.oncomingRoadGeo, this.roadMaterial);
    oncomingMesh.receiveShadow = !isSoftwareGl;
    oncomingMesh.frustumCulled = false;
    scene.add(oncomingMesh);

    // 1b. Dynamic Curved Ramp, Decel/Accel Lane, Plaza Overlay, Gore Chevron & Grassy Divider Island Ribbons
    const rampMat = new THREE.MeshStandardMaterial({
      map: textures.rampAsphaltTexture,
      roughnessMap: textures.roadRoughness,
      normalMap: textures.roadNormalTexture,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.9,
      metalness: 0.06,
      envMapIntensity: 0.14,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.rampRoadGeo = createRibbonGeometry(2);
    const rampMesh = new THREE.Mesh(this.rampRoadGeo, rampMat);
    rampMesh.receiveShadow = !isSoftwareGl;
    rampMesh.frustumCulled = false;
    scene.add(rampMesh);

    const plazaMat = new THREE.MeshStandardMaterial({
      map: textures.saParkingTexture,
      roughness: 0.88,
      metalness: 0.05,
      envMapIntensity: 0.14,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.plazaOverlayGeo = createRibbonGeometry(2);
    const plazaMesh = new THREE.Mesh(this.plazaOverlayGeo, plazaMat);
    plazaMesh.receiveShadow = !isSoftwareGl;
    plazaMesh.frustumCulled = false;
    scene.add(plazaMesh);

    const guideMat = new THREE.MeshStandardMaterial({
      map: textures.rampGuideTexture,
      transparent: true,
      roughness: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.rampGuideGeo = createRibbonGeometry(2);
    const guideMesh = new THREE.Mesh(this.rampGuideGeo, guideMat);
    guideMesh.frustumCulled = false;
    scene.add(guideMesh);

    const goreMat = new THREE.MeshStandardMaterial({
      map: textures.goreChevronTexture,
      roughness: 0.82,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.goreGeo = createRibbonGeometry(2);
    const goreMesh = new THREE.Mesh(this.goreGeo, goreMat);
    goreMesh.frustumCulled = false;
    scene.add(goreMesh);

    const islandMat = new THREE.MeshStandardMaterial({
      map: textures.islandGrassTexture,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.12,
    });
    this.islandGeo = createRibbonGeometry(4);
    const islandMesh = new THREE.Mesh(this.islandGeo, islandMat);
    islandMesh.receiveShadow = !isSoftwareGl;
    islandMesh.frustumCulled = false;
    scene.add(islandMesh);

    // 2. Concrete Median Barrier
    this.medianGeo = createRibbonGeometry(4);
    const medianMat = new THREE.MeshStandardMaterial({
      map: textures.medianTexture,
      roughness: 0.85,
      metalness: 0.04,
      envMapIntensity: 0.15,
    });
    const medianMesh = new THREE.Mesh(this.medianGeo, medianMat);
    medianMesh.receiveShadow = !isSoftwareGl;
    medianMesh.frustumCulled = false;
    scene.add(medianMesh);

    // 3. Guardrails (Mainline left/right + Island separator guardrail)
    const guardrailMat = new THREE.MeshStandardMaterial({
      color: 0xb8c0ca,
      roughness: 0.42,
      metalness: 0.72,
      envMapIntensity: 0.35,
      side: THREE.DoubleSide,
    });
    this.guardrailLeftGeo = createRibbonGeometry(2);
    const grLeft = new THREE.Mesh(this.guardrailLeftGeo, guardrailMat);
    grLeft.frustumCulled = false;
    scene.add(grLeft);

    this.guardrailRightGeo = createRibbonGeometry(2);
    const grRight = new THREE.Mesh(this.guardrailRightGeo, guardrailMat);
    grRight.frustumCulled = false;
    scene.add(grRight);

    this.islandGuardrailGeo = createRibbonGeometry(2);
    const grIsland = new THREE.Mesh(this.islandGuardrailGeo, guardrailMat);
    grIsland.frustumCulled = false;
    scene.add(grIsland);

    // 4. Shizuoka Tea-Field Hillsides & Grounded Mountain Terrain (5 columns anchoring outer skirt to -30m valley floor)
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      map: textures.teaTerrainTexture,
      color: 0xcbe3c6,
      roughness: 0.95,
      metalness: 0.0,
      envMapIntensity: 0.1,
    });
    this.terrainLeftGeo = createRibbonGeometry(5);
    const terLeft = new THREE.Mesh(this.terrainLeftGeo, this.terrainMaterial);
    terLeft.receiveShadow = !isSoftwareGl;
    terLeft.frustumCulled = false;
    scene.add(terLeft);

    this.terrainRightGeo = createRibbonGeometry(5);
    const terRight = new THREE.Mesh(this.terrainRightGeo, this.terrainMaterial);
    terRight.receiveShadow = !isSoftwareGl;
    terRight.frustumCulled = false;
    scene.add(terRight);

    // 5. Tunnel Arches Pool (20m segments)
    this.tunnelLightMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xffb347,
      emissiveIntensity: 2.3,
      roughness: 0.2,
    });
    const tunnelWallMat = new THREE.MeshStandardMaterial({
      map: textures.tunnelWallTexture,
      roughness: 0.68,
      metalness: 0.06,
      side: THREE.BackSide,
    });
    const tunnelArchGeo = new THREE.CylinderGeometry(
      11.2,
      11.2,
      20.6,
      18,
      1,
      true,
      0,
      Math.PI,
    );
    tunnelArchGeo.rotateZ(Math.PI / 2);
    tunnelArchGeo.rotateY(Math.PI / 2);

    // Open-Arch Concrete Tunnel Portal (坑口) — hollowed semicircular bore so cars drive cleanly inside!
    const portalShape = new THREE.Shape();
    portalShape.moveTo(-14.5, -1.0);
    portalShape.lineTo(-14.5, 13.8);
    portalShape.lineTo(13.3, 13.8);
    portalShape.lineTo(13.3, -1.0);
    portalShape.lineTo(10.55, -1.0);
    portalShape.lineTo(10.55, 0.2);
    portalShape.absarc(-0.6, 0.2, 11.15, 0, Math.PI, false);
    portalShape.lineTo(-11.75, -1.0);
    portalShape.closePath();

    const tunnelPortalGeo = new THREE.ExtrudeGeometry(portalShape, {
      depth: 1.2,
      bevelEnabled: false,
      curveSegments: 24,
    });
    tunnelPortalGeo.translate(0, 0, -0.6);

    const portalMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.88 });
    const tunnelSignMat = new THREE.MeshStandardMaterial({
      map: textures.tunnelNameTexture,
      emissive: 0xffffff,
      emissiveMap: textures.tunnelNameTexture,
      emissiveIntensity: 0.35,
      roughness: 0.45,
    });
    const tunnelSignGeo = new THREE.PlaneGeometry(8.2, 1.54);

    for (let i = 0; i < 42; i++) {
      const tGroup = new THREE.Group();
      const arch = new THREE.Mesh(tunnelArchGeo, tunnelWallMat);
      arch.position.set(-0.6, 0.2, 0);
      tGroup.add(arch);

      const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 6.5), this.tunnelLightMat);
      lightStrip.position.set(-3.2, 8.6, 0);
      tGroup.add(lightStrip);

      const lightStrip2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 6.5), this.tunnelLightMat);
      lightStrip2.position.set(2.0, 8.6, 0);
      tGroup.add(lightStrip2);

      const portalGroup = new THREE.Group();
      portalGroup.position.set(0, 0, 10);
      const portalWall = new THREE.Mesh(tunnelPortalGeo, portalMat);
      portalGroup.add(portalWall);
      const portalSign = new THREE.Mesh(tunnelSignGeo, tunnelSignMat);
      portalSign.position.set(-0.6, 12.5, 0.65);
      portalGroup.add(portalSign);

      portalGroup.visible = false;
      tGroup.add(portalGroup);
      tGroup.userData.portal = portalGroup;

      tGroup.visible = false;
      scene.add(tGroup);
      this.tunnelPool.push(tGroup);
    }

    // 6. Bespoke SA, PA, IC & JCT 3D Landmark Complexes + Gore Nose Assemblies
    const buildFacility = (styleId: FacilityStyleId): THREE.Group => {
      switch (styleId) {
        case 'suruga-sa':
          return createSurugaSaComplex(textures);
        case 'shimizu-pa':
          return createShimizuPaComplex(textures);
        case 'shizuoka-sa':
          return createShizuokaSaComplex(textures);
        case 'kakegawa-pa':
          return createKakegawaPaComplex(textures);
        case 'hamamatsu-sa':
          return createHamamatsuSaComplex(textures);
        case 'shinfuji-ic':
        case 'shimada-ic':
          return createIcExitComplex(textures);
        default:
          return createJctOverpass(textures);
      }
    };

    for (const m of SHIN_TOMEI_ROUTE) {
      const grp = buildFacility(m.styleId);
      grp.visible = false;
      scene.add(grp);
      this.facilityMap.set(m.styleId, grp);
    }

    for (let i = 0; i < 3; i++) {
      const dg = createGoreNoseAssembly(textures, 'diverge');
      dg.visible = false;
      scene.add(dg);
      this.divergeGorePool.push(dg);

      const mg = createGoreNoseAssembly(textures, 'merge');
      mg.visible = false;
      scene.add(mg);
      this.mergeGorePool.push(mg);
    }

    // 7. Overhead Gantries
    for (let i = 0; i < 3; i++) {
      const gantry = createGantryStructure(textures, i, i % 2 === 0);
      scene.add(gantry);
      this.gantries.push({
        group: gantry,
        sPos: 260 + i * EXPRESSWAY.GANTRY_INTERVAL_M,
        lastBucket: -1,
        lastMilestoneId: '',
      });
    }

    // 8. Expressway Streetlamps
    for (let i = 0; i < 26; i++) {
      const lamp = createStreetLamp();
      scene.add(lamp.group);
      this.lamps.push(lamp);
    }

    // 9. Multi-part Instanced Japanese Cedar/Cypress Trees
    const treeCount = 260;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 3.2, 6);
    trunkGeo.translate(0, 1.6, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3626, roughness: 0.95 });
    this.treeTrunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    this.treeTrunkMesh.frustumCulled = false;
    scene.add(this.treeTrunkMesh);

    const lowerCrownGeo = new THREE.ConeGeometry(2.5, 6.8, 7);
    lowerCrownGeo.translate(0, 5.8, 0);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, envMapIntensity: 0.1 });
    this.treeLowerCrownMesh = new THREE.InstancedMesh(lowerCrownGeo, crownMat, treeCount);
    this.treeLowerCrownMesh.frustumCulled = false;
    scene.add(this.treeLowerCrownMesh);

    const upperCrownGeo = new THREE.ConeGeometry(1.75, 5.4, 7);
    upperCrownGeo.translate(0, 8.8, 0);
    this.treeUpperCrownMesh = new THREE.InstancedMesh(upperCrownGeo, crownMat, treeCount);
    this.treeUpperCrownMesh.frustumCulled = false;
    scene.add(this.treeUpperCrownMesh);

    const baseTreeColor = new THREE.Color();
    for (let i = 0; i < treeCount; i++) {
      baseTreeColor.setHSL(0.32 + (Math.random() - 0.5) * 0.05, 0.38 + Math.random() * 0.14, 0.17 + Math.random() * 0.09);
      this.treeLowerCrownMesh.setColorAt(i, baseTreeColor);
      baseTreeColor.offsetHSL(0, 0, 0.03);
      this.treeUpperCrownMesh.setColorAt(i, baseTreeColor);
    }
    if (this.treeLowerCrownMesh.instanceColor) this.treeLowerCrownMesh.instanceColor.needsUpdate = true;
    if (this.treeUpperCrownMesh.instanceColor) this.treeUpperCrownMesh.instanceColor.needsUpdate = true;

    // 10. Cat's Eyes (道路鋲)
    const catsEyeGeo = new THREE.BoxGeometry(0.18, 0.045, 0.24);
    const catsEyeMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      emissive: 0xca8a04,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    this.catsEyeMesh = new THREE.InstancedMesh(catsEyeGeo, catsEyeMat, TOTAL_SEGMENTS * 2);
    this.catsEyeMesh.frustumCulled = false;
    scene.add(this.catsEyeMesh);

    // 11. Anti-glare Median Paddles (遮光板)
    const paddleGeo = new THREE.BoxGeometry(0.06, 0.72, 0.26);
    const paddleMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.75 });
    this.glarePaddleMesh = new THREE.InstancedMesh(paddleGeo, paddleMat, TOTAL_SEGMENTS * 3);
    this.glarePaddleMesh.frustumCulled = false;
    scene.add(this.glarePaddleMesh);

    // 12. Reflective Shoulder Guide Posts (デリネーター)
    const delGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.05, 6);
    delGeo.translate(0, 0.525, 0);
    const delMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0xea580c,
      emissiveIntensity: 0.35,
      roughness: 0.35,
    });
    this.delineatorMesh = new THREE.InstancedMesh(delGeo, delMat, TOTAL_SEGMENTS * 2);
    this.delineatorMesh.frustumCulled = false;
    scene.add(this.delineatorMesh);

    // 13. Orange Highway Emergency Telephones (非常電話)
    const emergGeo = new THREE.BoxGeometry(0.5, 1.45, 0.5);
    emergGeo.translate(0, 0.725, 0);
    const emergMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.2,
      roughness: 0.45,
    });
    this.emergencyBoxMesh = new THREE.InstancedMesh(emergGeo, emergMat, 12);
    this.emergencyBoxMesh.frustumCulled = false;
    scene.add(this.emergencyBoxMesh);

    // 14. Acoustic Sound Barriers (20m panels)
    const sbGeo = new THREE.BoxGeometry(0.18, 3.6, 20);
    sbGeo.translate(0, 1.8, 0);
    const sbMat = new THREE.MeshStandardMaterial({
      map: textures.soundBarrierTexture,
      transparent: true,
      opacity: 0.92,
      roughness: 0.4,
      metalness: 0.15,
    });
    this.soundBarrierMesh = new THREE.InstancedMesh(sbGeo, sbMat, TOTAL_SEGMENTS * 2);
    this.soundBarrierMesh.frustumCulled = false;
    scene.add(this.soundBarrierMesh);

    // 15. Concrete Viaduct Bridge Piers
    const pierGeo = new THREE.BoxGeometry(2.4, 24, 3.2);
    pierGeo.translate(0, -12, 0);
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x7a828c, roughness: 0.9 });
    this.viaductPierMesh = new THREE.InstancedMesh(pierGeo, pierMat, 24);
    this.viaductPierMesh.frustumCulled = false;
    scene.add(this.viaductPierMesh);

    // 16. Distant Transmission Pylon Towers
    const pylonGeo = new THREE.CylinderGeometry(0.8, 3.2, 34, 4, 1, true);
    pylonGeo.translate(0, 17, 0);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      wireframe: true,
      roughness: 0.6,
    });
    this.pylonMesh = new THREE.InstancedMesh(pylonGeo, pylonMat, 14);
    this.pylonMesh.frustumCulled = false;
    scene.add(this.pylonMesh);

    // 17. Grounded World Valley Floor + 360° Layered Distant Mountain Range + Grounded Mt. Fuji
    this.groundFloorMat = new THREE.MeshStandardMaterial({
      color: 0x243828,
      roughness: 0.98,
      metalness: 0.0,
      envMapIntensity: 0.04,
    });
    this.groundFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600), this.groundFloorMat);
    this.groundFloorMesh.rotation.x = -Math.PI / 2;
    this.groundFloorMesh.position.set(0, -26, 0);
    this.groundFloorMesh.frustumCulled = false;
    scene.add(this.groundFloorMesh);

    const ringGeo = new THREE.CylinderGeometry(1020, 1080, 220, 108, 6, true);
    const rPos = ringGeo.attributes.position as THREE.BufferAttribute;
    const rCol = new Float32Array(rPos.count * 3);
    const cBase = new THREE.Color(0x1f3124);
    const cMid = new THREE.Color(0x2c4338);
    const cPeak = new THREE.Color(0x4c6278);
    const cTmp = new THREE.Color();
    for (let i = 0; i < rPos.count; i++) {
      const vx = rPos.getX(i);
      const vy = rPos.getY(i);
      const vz = rPos.getZ(i);
      const ang = Math.atan2(vz, vx);
      const hNorm = (vy + 110) / 220; // 0 = bottom (-110), 1 = top (+110)
      const ridgeH =
        68 +
        38 * Math.sin(ang * 5.0 + 0.4) +
        24 * Math.cos(ang * 11.0 - 0.8) +
        14 * Math.sin(ang * 23.0 + 1.3);
      // Anchor bottom well below groundFloor (-26m), raise upper rows smoothly into peaks
      const sculptedY = -65 + hNorm * (52 + ridgeH);
      rPos.setY(i, sculptedY);

      if (hNorm < 0.45) {
        cTmp.copy(cBase).lerp(cMid, hNorm / 0.45);
      } else {
        cTmp.copy(cMid).lerp(cPeak, (hNorm - 0.45) / 0.55);
      }
      rCol[i * 3] = cTmp.r;
      rCol[i * 3 + 1] = cTmp.g;
      rCol[i * 3 + 2] = cTmp.b;
    }
    ringGeo.setAttribute('color', new THREE.BufferAttribute(rCol, 3));
    ringGeo.computeVertexNormals();
    this.mountainRingMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.0,
      side: THREE.BackSide,
      envMapIntensity: 0.06,
    });
    this.mountainRingMesh = new THREE.Mesh(ringGeo, this.mountainRingMat);
    this.mountainRingMesh.frustumCulled = false;
    scene.add(this.mountainRingMesh);

    const fujiGeo = new THREE.PlaneGeometry(940, 290);
    this.fujiMaterial = new THREE.MeshBasicMaterial({
      map: textures.fujiBackdrop,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      fog: false,
    });
    this.fujiMesh = new THREE.Mesh(fujiGeo, this.fujiMaterial);
    this.fujiMesh.frustumCulled = false;
    scene.add(this.fujiMesh);

    // 18. Falling Rain Streaks
    this.rainPositions = new Float32Array(this.rainCount * 6);
    for (let i = 0; i < this.rainCount; i++) {
      const rx = (Math.random() - 0.5) * 44;
      const ry = Math.random() * 22;
      const rz = (Math.random() - 0.5) * 65;
      const idx = i * 6;
      this.rainPositions[idx] = rx;
      this.rainPositions[idx + 1] = ry;
      this.rainPositions[idx + 2] = rz;
      this.rainPositions[idx + 3] = rx;
      this.rainPositions[idx + 4] = ry - 1.3;
      this.rainPositions[idx + 5] = rz + 0.35;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    scene.add(this.rainLines);

    // 19. Ultra-HD Pooled Tunnel Overhead PointLights (creates rolling clearcoat highlights inside tunnels!)
    for (let i = 0; i < 3; i++) {
      const tLight = new THREE.PointLight(0xffb454, 0, 32, 1.65);
      scene.add(tLight);
      this.tunnelLights.push(tLight);
    }

    // 20. Ultra-HD Rear Tire Rain Spray Wake Particles
    this.sprayPositions = new Float32Array(this.sprayCount * 3);
    this.sprayAges = new Float32Array(this.sprayCount);
    for (let i = 0; i < this.sprayCount; i++) {
      this.sprayAges[i] = Math.random();
    }
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(this.sprayPositions, 3));
    this.sprayMat = new THREE.PointsMaterial({
      color: 0xdbeafe,
      size: 0.34,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.sprayPoints = new THREE.Points(sprayGeo, this.sprayMat);
    this.sprayPoints.frustumCulled = false;
    this.sprayPoints.visible = false;
    scene.add(this.sprayPoints);
  }

  public update(
    playerS: number,
    playerLaneOffset: number,
    playerSpeedMs: number,
    dt: number,
    isUltra: boolean,
    weatherParams: {
      rainAmount: number;
      lampIntensity: number;
      asphaltRoughness: number;
      asphaltEnvIntensity: number;
      fujiOpacity: number;
      fogColorHex: number;
      skyZenith: THREE.Color;
      skyHorizon: THREE.Color;
      sunColor: THREE.Color;
      sunElevation: number;
      starIntensity: number;
      tunnelBlend: number;
    },
    ledMessages: string[],
  ): void {
    this.elapsedTime += dt;
    const baseSeg = Math.floor(playerS / EXPRESSWAY.SEGMENT_LENGTH);

    if (baseSeg !== this.lastBaseSeg) {
      this.lastBaseSeg = baseSeg;
      this.rebuildWorldRibbons(baseSeg);
    }

    // Dynamically update gantry directional green signs as player approaches each JCT / NEOPASA / IC!
    for (let i = 0; i < this.gantries.length; i++) {
      const g = this.gantries[i];
      if (g.sPos > playerS - 10) {
        const nextM = getNextMilestoneAhead(g.sPos);
        const bucket = Math.max(0, Math.round(nextM.distM / 50));
        if (g.lastMilestoneId !== nextM.milestone.id || g.lastBucket !== bucket) {
          g.lastMilestoneId = nextM.milestone.id;
          g.lastBucket = bucket;
          updateGantrySignForMilestone(
            this.textures.gantryCanvases[i % this.textures.gantryCanvases.length],
            this.textures.gantrySigns[i % this.textures.gantrySigns.length],
            nextM.milestone,
            nextM.distM,
          );
        }
      }
    }

    // Update sky dome shader uniforms
    const curX = roadCenterX(playerS);
    const curY = roadElevationY(playerS);
    this.skyMesh.position.set(curX, curY, -playerS);
    this.skyMat.uniforms.uZenithColor.value.copy(weatherParams.skyZenith).multiplyScalar(1 - weatherParams.tunnelBlend * 0.85);
    this.skyMat.uniforms.uHorizonColor.value.copy(weatherParams.skyHorizon).multiplyScalar(1 - weatherParams.tunnelBlend * 0.85);
    this.skyMat.uniforms.uGroundColor.value
      .setHex(weatherParams.fogColorHex)
      .multiplyScalar(0.32 * (1 - weatherParams.tunnelBlend * 0.8));
    this.skyMat.uniforms.uSunColor.value.copy(weatherParams.sunColor);
    this.skyMat.uniforms.uSunDir.value.set(0.22, weatherParams.sunElevation, -0.88).normalize();
    this.skyMat.uniforms.uStarIntensity.value = weatherParams.starIntensity * (1 - weatherParams.tunnelBlend);
    this.skyMat.uniforms.uCloudOpacity.value = Math.max(0.12, 0.4 - weatherParams.starIntensity * 0.25);
    this.skyMat.uniforms.uTime.value = this.elapsedTime;

    this.groundFloorMesh.position.set(curX, -26, -playerS);
    this.mountainRingMesh.position.set(curX, -8, -playerS);

    this.roadMaterial.roughness = weatherParams.asphaltRoughness;
    this.roadMaterial.envMapIntensity = weatherParams.asphaltEnvIntensity;

    for (const lamp of this.lamps) {
      lamp.bulbMat.emissiveIntensity = weatherParams.lampIntensity * 3.0;
    }

    this.ledMessageTimer += dt;
    if (this.ledMessageTimer > 6.5 && ledMessages.length > 0) {
      this.ledMessageTimer = 0;
      this.ledMessageIdx = (this.ledMessageIdx + 1) % ledMessages.length;
      updateLedBoardCanvas(this.textures.ledCanvas, this.textures.ledTexture, ledMessages[this.ledMessageIdx]);
    }

    const horizonS = playerS + 980;
    // Anchor Mt. Fuji firmly below the -26m valley floor (bottom edge = 82 - 145 = -63m) so it never floats
    this.fujiMesh.position.set(
      curX - 95,
      82,
      -horizonS,
    );
    this.fujiMaterial.opacity = weatherParams.fujiOpacity;
    this.fujiMesh.visible = weatherParams.fujiOpacity > 0.02;

    if (weatherParams.rainAmount > 0.02 && !isTunnelAt(playerS)) {
      this.rainLines.visible = true;
      this.rainMat.opacity = Math.min(0.58, weatherParams.rainAmount * 0.52);
      this.rainLines.position.set(roadCenterX(playerS), roadElevationY(playerS), -playerS);

      const posAttr = this.rainLines.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const fallSpeed = 30 * dt;
      const streakZ = 0.28 + playerSpeedMs * 0.028;
      for (let i = 0; i < this.rainCount; i++) {
        const idx = i * 6;
        arr[idx + 1] -= fallSpeed;
        arr[idx + 2] += playerSpeedMs * dt * 0.45;
        if (arr[idx + 1] < -1) arr[idx + 1] = 19 + Math.random() * 4;
        if (arr[idx + 2] > 20) arr[idx + 2] = -45 + Math.random() * 10;
        arr[idx + 3] = arr[idx];
        arr[idx + 4] = arr[idx + 1] - 1.35;
        arr[idx + 5] = arr[idx + 2] + streakZ;
      }
      posAttr.needsUpdate = true;
    } else {
      this.rainLines.visible = false;
    }

    // Ultra-HD Dynamic Tunnel Overhead PointLights
    const useUltraFx = isUltra && !this.isSoftwareGl;
    const inTunnel = isTunnelAt(playerS);
    if (useUltraFx && (inTunnel || weatherParams.tunnelBlend > 0.08)) {
      const baseTunnelS = Math.floor(playerS / 20) * 20;
      for (let i = 0; i < this.tunnelLights.length; i++) {
        const ls = baseTunnelS + (i - 0.5) * 20;
        const tl = this.tunnelLights[i];
        if (isTunnelAt(ls)) {
          tl.position.set(roadCenterX(ls) - 0.6, roadElevationY(ls) + 8.1, -ls);
          tl.intensity = 34 * Math.max(0.2, weatherParams.tunnelBlend);
        } else {
          tl.intensity = 0;
        }
      }
    } else {
      for (const tl of this.tunnelLights) tl.intensity = 0;
    }

    // Ultra-HD Rear Tire Rain Spray Wake Particles
    if (useUltraFx && weatherParams.rainAmount > 0.22 && !inTunnel && playerSpeedMs > 12) {
      this.sprayPoints.visible = true;
      this.sprayMat.opacity = Math.min(0.4, weatherParams.rainAmount * Math.min(1, playerSpeedMs / 55) * 0.42);
      const carX = roadCenterX(playerS) + playerLaneOffset;
      const carY = getSurfaceElevationAt(playerS, playerLaneOffset);
      const carZ = -playerS;
      const posAttr = this.sprayPoints.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const speedRatio = Math.min(1.5, playerSpeedMs / 60);

      for (let i = 0; i < this.sprayCount; i++) {
        this.sprayAges[i] += dt * (2.6 + (i % 5) * 0.35);
        const side = i % 2 === 0 ? -0.96 : 0.96;
        if (this.sprayAges[i] >= 1) {
          this.sprayAges[i] = 0;
          arr[i * 3] = carX + side + (Math.random() - 0.5) * 0.32;
          arr[i * 3 + 1] = carY + 0.14 + Math.random() * 0.15;
          arr[i * 3 + 2] = carZ + 1.55 + Math.random() * 0.4;
        } else {
          const age = this.sprayAges[i];
          arr[i * 3] += (side > 0 ? 0.6 : -0.6) * dt * (1 + age);
          arr[i * 3 + 1] += (1.15 - age * 1.4) * dt * speedRatio;
          arr[i * 3 + 2] += (9 + playerSpeedMs * 0.28) * dt;
        }
      }
      posAttr.needsUpdate = true;
    } else {
      this.sprayPoints.visible = false;
    }
  }

  private rebuildWorldRibbons(baseSeg: number): void {
    const startSeg = baseSeg - EXPRESSWAY.VISIBLE_SEGMENTS_BEHIND;
    const minS = startSeg * EXPRESSWAY.SEGMENT_LENGTH;
    const maxS = (startSeg + TOTAL_SEGMENTS) * EXPRESSWAY.SEGMENT_LENGTH;

    const roadPos = this.roadGeo.attributes.position as THREE.BufferAttribute;
    const roadNorm = this.roadGeo.attributes.normal as THREE.BufferAttribute;
    const roadUv = this.roadGeo.attributes.uv as THREE.BufferAttribute;

    const oncPos = this.oncomingRoadGeo.attributes.position as THREE.BufferAttribute;
    const oncNorm = this.oncomingRoadGeo.attributes.normal as THREE.BufferAttribute;
    const oncUv = this.oncomingRoadGeo.attributes.uv as THREE.BufferAttribute;

    const rampPos = this.rampRoadGeo.attributes.position as THREE.BufferAttribute;
    const rampNorm = this.rampRoadGeo.attributes.normal as THREE.BufferAttribute;
    const rampUv = this.rampRoadGeo.attributes.uv as THREE.BufferAttribute;

    const plazaPos = this.plazaOverlayGeo.attributes.position as THREE.BufferAttribute;
    const plazaNorm = this.plazaOverlayGeo.attributes.normal as THREE.BufferAttribute;
    const plazaUv = this.plazaOverlayGeo.attributes.uv as THREE.BufferAttribute;

    const guidePos = this.rampGuideGeo.attributes.position as THREE.BufferAttribute;
    const guideNorm = this.rampGuideGeo.attributes.normal as THREE.BufferAttribute;
    const guideUv = this.rampGuideGeo.attributes.uv as THREE.BufferAttribute;

    const gorePos = this.goreGeo.attributes.position as THREE.BufferAttribute;
    const goreNorm = this.goreGeo.attributes.normal as THREE.BufferAttribute;
    const goreUv = this.goreGeo.attributes.uv as THREE.BufferAttribute;

    const islandPos = this.islandGeo.attributes.position as THREE.BufferAttribute;
    const islandNorm = this.islandGeo.attributes.normal as THREE.BufferAttribute;
    const islandUv = this.islandGeo.attributes.uv as THREE.BufferAttribute;

    const grIslandPos = this.islandGuardrailGeo.attributes.position as THREE.BufferAttribute;
    const grIslandNorm = this.islandGuardrailGeo.attributes.normal as THREE.BufferAttribute;
    const grIslandUv = this.islandGuardrailGeo.attributes.uv as THREE.BufferAttribute;

    const medPos = this.medianGeo.attributes.position as THREE.BufferAttribute;
    const medNorm = this.medianGeo.attributes.normal as THREE.BufferAttribute;
    const medUv = this.medianGeo.attributes.uv as THREE.BufferAttribute;

    const grLPos = this.guardrailLeftGeo.attributes.position as THREE.BufferAttribute;
    const grLNorm = this.guardrailLeftGeo.attributes.normal as THREE.BufferAttribute;
    const grLUv = this.guardrailLeftGeo.attributes.uv as THREE.BufferAttribute;

    const grRPos = this.guardrailRightGeo.attributes.position as THREE.BufferAttribute;
    const grRNorm = this.guardrailRightGeo.attributes.normal as THREE.BufferAttribute;
    const grRUv = this.guardrailRightGeo.attributes.uv as THREE.BufferAttribute;

    const terLPos = this.terrainLeftGeo.attributes.position as THREE.BufferAttribute;
    const terLNorm = this.terrainLeftGeo.attributes.normal as THREE.BufferAttribute;
    const terLUv = this.terrainLeftGeo.attributes.uv as THREE.BufferAttribute;

    const terRPos = this.terrainRightGeo.attributes.position as THREE.BufferAttribute;
    const terRNorm = this.terrainRightGeo.attributes.normal as THREE.BufferAttribute;
    const terRUv = this.terrainRightGeo.attributes.uv as THREE.BufferAttribute;

    let tunnelPoolIdx = 0;
    let treeIdx = 0;
    let catsIdx = 0;
    let paddleIdx = 0;
    let delIdx = 0;
    let emergIdx = 0;
    let sbIdx = 0;
    let pierIdx = 0;
    let pylonIdx = 0;

    for (const t of this.tunnelPool) t.visible = false;

    // Place bespoke SA, PA, IC, and JCT landmark complexes & gore nose assemblies along visible range
    let divGoreIdx = 0;
    let mrgGoreIdx = 0;
    for (const grp of this.facilityMap.values()) grp.visible = false;
    for (const dg of this.divergeGorePool) dg.visible = false;
    for (const mg of this.mergeGorePool) mg.visible = false;

    const placeGore = (pool: THREE.Group[], idx: number, gs: number, goreOffsetX: number): number => {
      if (idx >= pool.length || gs < minS - 60 || gs > maxS + 60) return idx;
      const dx = roadCenterDX(gs);
      const lenXZ = Math.hypot(dx, 1);
      const rX = 1 / lenXZ;
      const rZ = dx / lenXZ;
      const gYaw = -Math.atan2(dx, 1);
      const gPitch = Math.atan(roadElevationDY(gs));
      const grp = pool[idx++];
      grp.visible = true;
      grp.position.set(roadCenterX(gs) + rX * goreOffsetX, roadElevationY(gs), -gs + rZ * goreOffsetX);
      grp.rotation.set(gPitch, gYaw, 0);
      return idx;
    };

    const baseLoopStart = Math.floor(minS / ROUTE_LOOP_LENGTH_M) * ROUTE_LOOP_LENGTH_M;
    for (let lapOff = 0; lapOff <= ROUTE_LOOP_LENGTH_M; lapOff += ROUTE_LOOP_LENGTH_M) {
      for (const m of SHIN_TOMEI_ROUTE) {
        const ms = baseLoopStart + lapOff + m.sPos;
        if (ms < minS - 420 || ms > maxS + 420) continue;

        const mx = roadCenterX(ms);
        const my = roadElevationY(ms);
        const mYaw = -Math.atan2(roadCenterDX(ms), 1);
        const mPitch = Math.atan(roadElevationDY(ms));

        const facilityGrp = this.facilityMap.get(m.styleId);
        if (facilityGrp) {
          facilityGrp.visible = true;
          if (m.type === 'sa' || m.type === 'pa') {
            const lift = m.type === 'sa' ? 2.2 : 1.2;
            facilityGrp.position.set(mx, my + lift, -ms);
            facilityGrp.rotation.set(0, mYaw, 0);
          } else {
            facilityGrp.position.set(mx, my, -ms);
            facilityGrp.rotation.set(mPitch, mYaw, 0);
          }
        }

        const divergeDs = m.type === 'sa' || m.type === 'ic' ? -165 : m.type === 'pa' ? -135 : -150;
        const goreWidthX = m.type === 'sa' || m.type === 'ic' ? -9.625 : -9.475;
        divGoreIdx = placeGore(this.divergeGorePool, divGoreIdx, ms + divergeDs, goreWidthX);

        if (m.type === 'sa') {
          mrgGoreIdx = placeGore(this.mergeGorePool, mrgGoreIdx, ms + 185, -9.55);
        } else if (m.type === 'pa') {
          mrgGoreIdx = placeGore(this.mergeGorePool, mrgGoreIdx, ms + 145, -9.45);
        }
      }
    }

    const EDGE = EXPRESSWAY.ROAD_LEFT_EDGE; // -8.375

    for (let r = 0; r < ROW_COUNT; r++) {
      const segIndex = startSeg + r;
      const s = segIndex * EXPRESSWAY.SEGMENT_LENGTH;
      const cx = roadCenterX(s);
      const cy = roadElevationY(s);
      const z = -s;

      const dx = roadCenterDX(s);
      const lenXZ = Math.hypot(dx, 1);
      const rightX = 1 / lenXZ;
      const rightZ = dx / lenXZ;

      const vCoord = segIndex * 0.25;
      const prof = getFacilityProfileAt(s);

      // Main & Oncoming Carriageways
      const rIdx = r * 2;
      roadPos.setXYZ(rIdx, cx + rightX * EDGE, cy, z + rightZ * EDGE);
      roadPos.setXYZ(rIdx + 1, cx + rightX * EXPRESSWAY.ROAD_RIGHT_EDGE, cy, z + rightZ * EXPRESSWAY.ROAD_RIGHT_EDGE);
      roadNorm.setXYZ(rIdx, 0, 1, 0);
      roadNorm.setXYZ(rIdx + 1, 0, 1, 0);
      roadUv.setXY(rIdx, 0, vCoord);
      roadUv.setXY(rIdx + 1, 1, vCoord);

      oncPos.setXYZ(rIdx, cx + rightX * 8.575, cy, z + rightZ * 8.575);
      oncPos.setXYZ(rIdx + 1, cx + rightX * 24.075, cy, z + rightZ * 24.075);
      oncNorm.setXYZ(rIdx, 0, 1, 0);
      oncNorm.setXYZ(rIdx + 1, 0, 1, 0);
      oncUv.setXY(rIdx, 1, -vCoord);
      oncUv.setXY(rIdx + 1, 0, -vCoord);

      const rampY = prof.hasRamp ? prof.facilityY : cy;

      // Dynamic Curved Ramp / Decel / Accel Asphalt Ribbon (smoothly covers solid shoulder line during guide zones)
      if (prof.hasRamp) {
        const rampOuterX = prof.outerX;
        const rampInnerX = prof.innerX;
        rampPos.setXYZ(rIdx, cx + rightX * rampOuterX, rampY + 0.015, z + rightZ * rampOuterX);
        rampPos.setXYZ(rIdx + 1, cx + rightX * rampInnerX, rampY + 0.015, z + rightZ * rampInnerX);
      } else {
        rampPos.setXYZ(rIdx, cx + rightX * EDGE, cy + 0.015, z + rightZ * EDGE);
        rampPos.setXYZ(rIdx + 1, cx + rightX * EDGE, cy + 0.015, z + rightZ * EDGE);
      }
      rampNorm.setXYZ(rIdx, 0, 1, 0);
      rampNorm.setXYZ(rIdx + 1, 0, 1, 0);
      rampUv.setXY(rIdx, 0, vCoord * 0.5);
      rampUv.setXY(rIdx + 1, 1, vCoord * 0.5);

      // SA / PA Parking Bay Markings Overlay (level on SA terrace)
      const plazaHalfSpan = prof.milestone?.type === 'pa' ? 50 : 70;
      if (prof.isPlaza && Math.abs(prof.ds) <= plazaHalfSpan) {
        plazaPos.setXYZ(rIdx, cx + rightX * prof.outerX, rampY + 0.024, z + rightZ * prof.outerX);
        plazaPos.setXYZ(rIdx + 1, cx + rightX * prof.innerX, rampY + 0.024, z + rightZ * prof.innerX);
      } else {
        const midX = prof.hasRamp ? (prof.outerX + prof.innerX) * 0.5 : EDGE;
        plazaPos.setXYZ(rIdx, cx + rightX * midX, rampY + 0.024, z + rightZ * midX);
        plazaPos.setXYZ(rIdx + 1, cx + rightX * midX, rampY + 0.024, z + rightZ * midX);
      }
      plazaNorm.setXYZ(rIdx, 0, 1, 0);
      plazaNorm.setXYZ(rIdx + 1, 0, 1, 0);
      plazaUv.setXY(rIdx, 0, vCoord * 0.16);
      plazaUv.setXY(rIdx + 1, 1, vCoord * 0.16);

      // Diverge / Merge Lane Dashed Guide Line & Pavement Arrows
      if (prof.hasGuide) {
        const gLeft = Math.min(-7.8, prof.outerX + 0.35);
        const gRight = -5.52;
        guidePos.setXYZ(rIdx, cx + rightX * gLeft, cy + 0.03, z + rightZ * gLeft);
        guidePos.setXYZ(rIdx + 1, cx + rightX * gRight, cy + 0.03, z + rightZ * gRight);
      } else {
        guidePos.setXYZ(rIdx, cx + rightX * -5.625, cy + 0.03, z + rightZ * -5.625);
        guidePos.setXYZ(rIdx + 1, cx + rightX * -5.625, cy + 0.03, z + rightZ * -5.625);
      }
      guideNorm.setXYZ(rIdx, 0, 1, 0);
      guideNorm.setXYZ(rIdx + 1, 0, 1, 0);
      guideUv.setXY(rIdx, 0, vCoord * 0.6);
      guideUv.setXY(rIdx + 1, 1, vCoord * 0.6);

      // Gore Chevron Zebra Wedge (導流帯ゼブラゾーン)
      if (prof.goreRightX > prof.goreLeftX + 0.05) {
        gorePos.setXYZ(rIdx, cx + rightX * prof.goreLeftX, cy + 0.034, z + rightZ * prof.goreLeftX);
        gorePos.setXYZ(rIdx + 1, cx + rightX * prof.goreRightX, cy + 0.034, z + rightZ * prof.goreRightX);
      } else {
        gorePos.setXYZ(rIdx, cx + rightX * EDGE, cy + 0.034, z + rightZ * EDGE);
        gorePos.setXYZ(rIdx + 1, cx + rightX * EDGE, cy + 0.034, z + rightZ * EDGE);
      }
      goreNorm.setXYZ(rIdx, 0, 1, 0);
      goreNorm.setXYZ(rIdx + 1, 0, 1, 0);
      goreUv.setXY(rIdx, 0, vCoord * 0.7);
      goreUv.setXY(rIdx + 1, 1, vCoord * 0.7);

      // Grassy Landscaped Embankment separating mainline & SA/PA/IC/JCT ramp
      const mIdx = r * 4;
      if (prof.hasIsland) {
        const curbIn = Math.min(0.28, (prof.islandRightX - prof.islandLeftX) * 0.14);
        islandPos.setXYZ(mIdx, cx + rightX * prof.islandLeftX, rampY, z + rightZ * prof.islandLeftX);
        islandPos.setXYZ(
          mIdx + 1,
          cx + rightX * (prof.islandLeftX + curbIn),
          rampY + 0.24,
          z + rightZ * (prof.islandLeftX + curbIn),
        );
        islandPos.setXYZ(
          mIdx + 2,
          cx + rightX * (prof.islandRightX - curbIn),
          cy + 0.28,
          z + rightZ * (prof.islandRightX - curbIn),
        );
        islandPos.setXYZ(mIdx + 3, cx + rightX * prof.islandRightX, cy, z + rightZ * prof.islandRightX);
      } else {
        islandPos.setXYZ(mIdx, cx + rightX * EDGE, cy, z + rightZ * EDGE);
        islandPos.setXYZ(mIdx + 1, cx + rightX * EDGE, cy, z + rightZ * EDGE);
        islandPos.setXYZ(mIdx + 2, cx + rightX * EDGE, cy, z + rightZ * EDGE);
        islandPos.setXYZ(mIdx + 3, cx + rightX * EDGE, cy, z + rightZ * EDGE);
      }
      islandNorm.setXYZ(mIdx, -0.5, 0.85, 0);
      islandNorm.setXYZ(mIdx + 1, 0, 1, 0);
      islandNorm.setXYZ(mIdx + 2, 0, 1, 0);
      islandNorm.setXYZ(mIdx + 3, 0.5, 0.85, 0);
      islandUv.setXY(mIdx, 0, vCoord * 0.5);
      islandUv.setXY(mIdx + 1, 0.1, vCoord * 0.5);
      islandUv.setXY(mIdx + 2, 0.9, vCoord * 0.5);
      islandUv.setXY(mIdx + 3, 1, vCoord * 0.5);

      // Divider Island Guardrail along mainline left shoulder
      const igX = EDGE - 0.22;
      if (prof.hasIsland) {
        grIslandPos.setXYZ(rIdx, cx + rightX * igX, cy + 0.25, z + rightZ * igX);
        grIslandPos.setXYZ(rIdx + 1, cx + rightX * igX, cy + 0.9, z + rightZ * igX);
      } else {
        grIslandPos.setXYZ(rIdx, cx + rightX * igX, cy + 0.25, z + rightZ * igX);
        grIslandPos.setXYZ(rIdx + 1, cx + rightX * igX, cy + 0.25, z + rightZ * igX);
      }
      grIslandNorm.setXYZ(rIdx, 1, 0, 0);
      grIslandNorm.setXYZ(rIdx + 1, 1, 0, 0);
      grIslandUv.setXY(rIdx, vCoord, 0);
      grIslandUv.setXY(rIdx + 1, vCoord, 1);

      // Concrete Median
      medPos.setXYZ(mIdx, cx + rightX * 7.125, cy, z + rightZ * 7.125);
      medPos.setXYZ(mIdx + 1, cx + rightX * 7.375, cy + 1.05, z + rightZ * 7.375);
      medPos.setXYZ(mIdx + 2, cx + rightX * 8.325, cy + 1.05, z + rightZ * 8.325);
      medPos.setXYZ(mIdx + 3, cx + rightX * 8.575, cy, z + rightZ * 8.575);
      medNorm.setXYZ(mIdx, -1, 0.3, 0);
      medNorm.setXYZ(mIdx + 1, -0.4, 1, 0);
      medNorm.setXYZ(mIdx + 2, 0.4, 1, 0);
      medNorm.setXYZ(mIdx + 3, 1, 0.3, 0);
      medUv.setXY(mIdx, vCoord, 0);
      medUv.setXY(mIdx + 1, vCoord, 0.8);
      medUv.setXY(mIdx + 2, vCoord, 0.8);
      medUv.setXY(mIdx + 3, vCoord, 0);

      // Left & Right Guardrails (smoothly hugs curved decel, ramp, plaza curb, and accel lane!)
      const grLeftX = prof.hasRamp ? prof.outerX - 0.28 : -8.55;
      const grBot = prof.isPlaza ? 0.1 : 0.25;
      const grTop = prof.isPlaza ? 0.44 : 0.92;
      grLPos.setXYZ(rIdx, cx + rightX * grLeftX, rampY + grBot, z + rightZ * grLeftX);
      grLPos.setXYZ(rIdx + 1, cx + rightX * grLeftX, rampY + grTop, z + rightZ * grLeftX);
      grLNorm.setXYZ(rIdx, 1, 0, 0);
      grLNorm.setXYZ(rIdx + 1, 1, 0, 0);
      grLUv.setXY(rIdx, vCoord, 0);
      grLUv.setXY(rIdx + 1, vCoord, 1);

      grRPos.setXYZ(rIdx, cx + rightX * 24.25, cy + 0.25, z + rightZ * 24.25);
      grRPos.setXYZ(rIdx + 1, cx + rightX * 24.25, cy + 0.92, z + rightZ * 24.25);
      grRNorm.setXYZ(rIdx, -1, 0, 0);
      grRNorm.setXYZ(rIdx + 1, -1, 0, 0);
      grRUv.setXY(rIdx, vCoord, 0);
      grRUv.setXY(rIdx + 1, vCoord, 1);

      // Shizuoka Tea-Field Hillsides & Grounded Outer Mountain Skirts (smooth continuous blends — zero wavy snaps!)
      const tIdx = r * 5;
      const rampTerrainW = prof.hasRamp ? smoothstep(-9.0, -14.0, prof.outerX) : 0;
      const surugaW =
        prof.milestone?.styleId === 'suruga-sa'
          ? Math.min(smoothstep(-215, -165, prof.ds), 1 - smoothstep(165, 215, prof.ds))
          : 0;
      const viaductWL = smoothstep(0.6, 2.2, cy) * (1 - rampTerrainW);
      const viaductWR = smoothstep(0.6, 2.2, cy);

      const hillL = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(8.5 + 6.5 * Math.sin(s * 0.011), -10, viaductWL),
        1.5,
        rampTerrainW,
      );
      const hillR = THREE.MathUtils.lerp(8.0 + 5.5 * Math.cos(s * 0.009), -10, viaductWR);
      const farPeakL = THREE.MathUtils.lerp(20 + 14 * Math.sin(s * 0.0045), -32, surugaW);
      const farPeakR = 19 + 14 * Math.cos(s * 0.0038);

      const terLeftEdge = prof.hasRamp ? Math.min(-8.6, prof.outerX - 0.5) : -8.6;
      const terLeftEdgeY = THREE.MathUtils.lerp(rampY - 0.08, cy - 16, viaductWL);
      const terLeftMid = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(-30, Math.min(-42, prof.outerX - 18), rampTerrainW),
        -69.5,
        surugaW,
      );
      const terLeftMidY = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(cy + hillL * 0.65, rampY - 0.05, rampTerrainW),
        rampY - 0.18,
        surugaW,
      );
      const terLeftOuterY = THREE.MathUtils.lerp(cy + hillL * 1.15, -32, surugaW);

      terLPos.setXYZ(tIdx, cx + rightX * terLeftEdge, terLeftEdgeY, z + rightZ * terLeftEdge);
      terLPos.setXYZ(tIdx + 1, cx + rightX * terLeftMid, terLeftMidY, z + rightZ * terLeftMid);
      terLPos.setXYZ(tIdx + 2, cx + rightX * -94, terLeftOuterY, z + rightZ * -94);
      terLPos.setXYZ(tIdx + 3, cx + rightX * -215, THREE.MathUtils.lerp(Math.max(-18, cy + farPeakL), -33, surugaW), z + rightZ * -215);
      terLPos.setXYZ(tIdx + 4, cx + rightX * -450, -32, z + rightZ * -450);
      terLNorm.setXYZ(tIdx, 0, 1, 0);
      terLNorm.setXYZ(tIdx + 1, 0.35, 0.92, 0);
      terLNorm.setXYZ(tIdx + 2, 0.3, 0.95, 0);
      terLNorm.setXYZ(tIdx + 3, 0.2, 0.97, 0);
      terLNorm.setXYZ(tIdx + 4, 0.15, 0.98, 0);
      terLUv.setXY(tIdx, 0, vCoord * 0.3);
      terLUv.setXY(tIdx + 1, 0.25, vCoord * 0.3);
      terLUv.setXY(tIdx + 2, 0.5, vCoord * 0.3);
      terLUv.setXY(tIdx + 3, 0.75, vCoord * 0.3);
      terLUv.setXY(tIdx + 4, 1, vCoord * 0.3);

      terRPos.setXYZ(tIdx, cx + rightX * 24.3, THREE.MathUtils.lerp(cy - 0.1, cy - 16, viaductWR), z + rightZ * 24.3);
      terRPos.setXYZ(tIdx + 1, cx + rightX * 45, cy + hillR * 0.6, z + rightZ * 45);
      terRPos.setXYZ(tIdx + 2, cx + rightX * 96, cy + hillR * 1.1, z + rightZ * 96);
      terRPos.setXYZ(tIdx + 3, cx + rightX * 220, Math.max(-18, cy + farPeakR), z + rightZ * 220);
      terRPos.setXYZ(tIdx + 4, cx + rightX * 460, -32, z + rightZ * 460);
      terRNorm.setXYZ(tIdx, 0, 1, 0);
      terRNorm.setXYZ(tIdx + 1, -0.35, 0.92, 0);
      terRNorm.setXYZ(tIdx + 2, -0.3, 0.95, 0);
      terRNorm.setXYZ(tIdx + 3, -0.2, 0.97, 0);
      terRNorm.setXYZ(tIdx + 4, -0.15, 0.98, 0);
      terRUv.setXY(tIdx, 0, vCoord * 0.3);
      terRUv.setXY(tIdx + 1, 0.25, vCoord * 0.3);
      terRUv.setXY(tIdx + 2, 0.5, vCoord * 0.3);
      terRUv.setXY(tIdx + 3, 0.75, vCoord * 0.3);
      terRUv.setXY(tIdx + 4, 1, vCoord * 0.3);

      // Segment-level props (5m ribbon step -> 10m/20m/40m props aligned via segIndex modulo)
      if (r < TOTAL_SEGMENTS) {
        const midS = s + EXPRESSWAY.SEGMENT_LENGTH * 0.5;
        const midX = roadCenterX(midS);
        const midY = roadElevationY(midS);
        const yaw = -Math.atan2(roadCenterDX(midS), 1);
        const inTunnel = isTunnelAt(midS);
        const midProf = getFacilityProfileAt(midS);
        const midInRamp = midProf.hasRamp && midProf.outerX < -9.2;

        // Cat's eyes (every 10m = even segIndex)
        if (segIndex % 2 === 0) {
          for (const divX of [-1.875, 1.875]) {
            if (catsIdx < this.catsEyeMesh.count) {
              this._dummy.position.set(cx + rightX * divX, cy + 0.02, z + rightZ * divX);
              this._dummy.rotation.set(0, yaw, 0);
              this._dummy.scale.set(1, 1, 1);
              this._dummy.updateMatrix();
              this.catsEyeMesh.setMatrixAt(catsIdx++, this._dummy.matrix);
            }
          }
        }

        // Reflective shoulder delineator posts (every 10m, hugs curved ramps & SA terrace on left!)
        if (segIndex % 2 === 0) {
          if (!prof.isPlaza && delIdx < this.delineatorMesh.count) {
            const delLeftX = prof.hasRamp ? prof.outerX - 0.18 : -8.5;
            this._dummy.position.set(cx + rightX * delLeftX, rampY, z + rightZ * delLeftX);
            this._dummy.rotation.set(0, yaw, 0);
            this._dummy.scale.set(1, 1, 1);
            this._dummy.updateMatrix();
            this.delineatorMesh.setMatrixAt(delIdx++, this._dummy.matrix);
          }
          if (delIdx < this.delineatorMesh.count) {
            this._dummy.position.set(cx + rightX * 24.2, cy, z + rightZ * 24.2);
            this._dummy.rotation.set(0, yaw, 0);
            this._dummy.scale.set(1, 1, 1);
            this._dummy.updateMatrix();
            this.delineatorMesh.setMatrixAt(delIdx++, this._dummy.matrix);
          }
        }

        // Median anti-glare paddles (every 2.5m)
        for (let p = 0; p < 2; p++) {
          if (paddleIdx < this.glarePaddleMesh.count) {
            const ps = s + p * 2.5;
            this._dummy.position.set(roadCenterX(ps) + EXPRESSWAY.MEDIAN_X, roadElevationY(ps) + 1.35, -ps);
            this._dummy.rotation.set(0, -Math.atan2(roadCenterDX(ps), 1), 0);
            this._dummy.scale.set(1, 1, 1);
            this._dummy.updateMatrix();
            this.glarePaddleMesh.setMatrixAt(paddleIdx++, this._dummy.matrix);
          }
        }

        // 20m-aligned props (Sound Barriers & Tunnel Arches: every 4 * 5m = 20m)
        if (segIndex % 4 === 0) {
          const midS20 = s + 10;
          const midX20 = roadCenterX(midS20);
          const midY20 = roadElevationY(midS20);
          const yaw20 = -Math.atan2(roadCenterDX(midS20), 1);
          const pitch20 = Math.atan(roadElevationDY(midS20));

          if (isSoundBarrierAt(midS20) && sbIdx + 2 <= this.soundBarrierMesh.count) {
            this._dummy.position.set(midX20 - 8.75, midY20, -midS20);
            this._dummy.rotation.set(pitch20, yaw20, 0);
            this._dummy.scale.set(1, 1, 1);
            this._dummy.updateMatrix();
            this.soundBarrierMesh.setMatrixAt(sbIdx++, this._dummy.matrix);

            this._dummy.position.set(midX20 + 24.45, midY20, -midS20);
            this._dummy.updateMatrix();
            this.soundBarrierMesh.setMatrixAt(sbIdx++, this._dummy.matrix);
          }

          if (isTunnelAt(midS20) && tunnelPoolIdx < this.tunnelPool.length) {
            const tGroup = this.tunnelPool[tunnelPoolIdx++];
            tGroup.visible = true;
            tGroup.position.set(midX20, midY20, -midS20);
            tGroup.rotation.set(pitch20, yaw20, 0);
            const prevInTunnel = isTunnelAt(midS20 - 20);
            const portal = tGroup.userData.portal as THREE.Group;
            portal.visible = !prevInTunnel;
          }
        }

        // Viaduct bridge piers (every 40m = 8 * 5m)
        if (midY > 1.2 && !midInRamp && segIndex % 8 === 0 && pierIdx < this.viaductPierMesh.count) {
          this._dummy.position.set(midX + 7.85, midY - 0.5, -midS);
          this._dummy.rotation.set(0, yaw, 0);
          this._dummy.scale.set(1, 1, 1);
          this._dummy.updateMatrix();
          this.viaductPierMesh.setMatrixAt(pierIdx++, this._dummy.matrix);
        }

        // Emergency Telephones (every 160m = 32 * 5m)
        if (!inTunnel && !midInRamp && segIndex % 32 === 0 && emergIdx < this.emergencyBoxMesh.count) {
          this._dummy.position.set(midX - 8.3, midY, -midS);
          this._dummy.rotation.set(0, yaw, 0);
          this._dummy.scale.set(1, 1, 1);
          this._dummy.updateMatrix();
          this.emergencyBoxMesh.setMatrixAt(emergIdx++, this._dummy.matrix);
        }

        // Transmission Pylon Towers (every 80m = 16 * 5m)
        if (!inTunnel && segIndex % 16 === 0 && pylonIdx < this.pylonMesh.count) {
          const side = segIndex % 32 === 0 ? -1 : 1;
          this._dummy.position.set(midX + (side < 0 ? -74 : 84), midY + 9, -midS);
          this._dummy.rotation.set(0, (segIndex * 0.4) % Math.PI, 0);
          this._dummy.scale.set(1, 1, 1);
          this._dummy.updateMatrix();
          this.pylonMesh.setMatrixAt(pylonIdx++, this._dummy.matrix);
        }

        // Multi-part Roadside Cedar/Cypress Trees (every 20m = 4 * 5m, kept clear of SA/PA/IC/JCT & tunnels!)
        if (!inTunnel && viaductWR < 0.5 && segIndex % 4 === 0 && treeIdx + 4 <= this.treeTrunkMesh.count) {
          const hash = Math.abs(Math.sin(segIndex * 12.9898) * 43758.5453);
          const frac1 = hash - Math.floor(hash);
          const frac2 = (hash * 3.7) % 1;

          if (!midInRamp && !midProf.milestone) {
            for (let k = 0; k < 2; k++) {
              const off = -15 - frac1 * 24 - k * 10;
              const scale = 0.85 + ((frac2 + k * 0.3) % 0.55);
              this._dummy.position.set(midX + off, midY + 1.4 + k * 2.1, -midS + (k - 0.5) * 8);
              this._dummy.rotation.set(0, frac1 * Math.PI, 0);
              this._dummy.scale.set(scale, scale, scale);
              this._dummy.updateMatrix();
              this.treeTrunkMesh.setMatrixAt(treeIdx, this._dummy.matrix);
              this.treeLowerCrownMesh.setMatrixAt(treeIdx, this._dummy.matrix);
              this.treeUpperCrownMesh.setMatrixAt(treeIdx, this._dummy.matrix);
              treeIdx++;
            }
          }

          for (let k = 0; k < 2; k++) {
            const off = 30 + frac2 * 24 + k * 10;
            const scale = 0.85 + ((frac1 + k * 0.25) % 0.55);
            this._dummy.position.set(midX + off, midY + 1.2 + k * 1.9, -midS + (k - 0.5) * 9);
            this._dummy.rotation.set(0, frac2 * Math.PI, 0);
            this._dummy.scale.set(scale, scale, scale);
            this._dummy.updateMatrix();
            this.treeTrunkMesh.setMatrixAt(treeIdx, this._dummy.matrix);
            this.treeLowerCrownMesh.setMatrixAt(treeIdx, this._dummy.matrix);
            this.treeUpperCrownMesh.setMatrixAt(treeIdx, this._dummy.matrix);
            treeIdx++;
          }
        }
      }
    }

    const hideUnused = (mesh: THREE.InstancedMesh, fromIdx: number) => {
      this._dummy.position.set(0, -900, 0);
      this._dummy.scale.set(0.001, 0.001, 0.001);
      this._dummy.updateMatrix();
      for (let i = fromIdx; i < mesh.count; i++) {
        mesh.setMatrixAt(i, this._dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };

    while (treeIdx < this.treeTrunkMesh.count) {
      this._dummy.position.set(0, -900, 0);
      this._dummy.scale.set(0.001, 0.001, 0.001);
      this._dummy.updateMatrix();
      this.treeTrunkMesh.setMatrixAt(treeIdx, this._dummy.matrix);
      this.treeLowerCrownMesh.setMatrixAt(treeIdx, this._dummy.matrix);
      this.treeUpperCrownMesh.setMatrixAt(treeIdx, this._dummy.matrix);
      treeIdx++;
    }
    this.treeTrunkMesh.instanceMatrix.needsUpdate = true;
    this.treeLowerCrownMesh.instanceMatrix.needsUpdate = true;
    this.treeUpperCrownMesh.instanceMatrix.needsUpdate = true;

    hideUnused(this.delineatorMesh, delIdx);
    hideUnused(this.soundBarrierMesh, sbIdx);
    hideUnused(this.viaductPierMesh, pierIdx);
    hideUnused(this.emergencyBoxMesh, emergIdx);
    hideUnused(this.pylonMesh, pylonIdx);

    roadPos.needsUpdate = true;
    roadNorm.needsUpdate = true;
    roadUv.needsUpdate = true;

    oncPos.needsUpdate = true;
    oncNorm.needsUpdate = true;
    oncUv.needsUpdate = true;

    rampPos.needsUpdate = true;
    rampNorm.needsUpdate = true;
    rampUv.needsUpdate = true;

    plazaPos.needsUpdate = true;
    plazaNorm.needsUpdate = true;
    plazaUv.needsUpdate = true;

    guidePos.needsUpdate = true;
    guideNorm.needsUpdate = true;
    guideUv.needsUpdate = true;

    gorePos.needsUpdate = true;
    goreNorm.needsUpdate = true;
    goreUv.needsUpdate = true;

    islandPos.needsUpdate = true;
    islandNorm.needsUpdate = true;
    islandUv.needsUpdate = true;

    grIslandPos.needsUpdate = true;
    grIslandNorm.needsUpdate = true;
    grIslandUv.needsUpdate = true;

    medPos.needsUpdate = true;
    medNorm.needsUpdate = true;
    medUv.needsUpdate = true;

    grLPos.needsUpdate = true;
    grLNorm.needsUpdate = true;
    grLUv.setUsage(THREE.DynamicDrawUsage);
    grLUv.needsUpdate = true;

    grRPos.needsUpdate = true;
    grRNorm.needsUpdate = true;
    grRUv.needsUpdate = true;

    terLPos.needsUpdate = true;
    terLNorm.needsUpdate = true;
    terLUv.needsUpdate = true;

    terRPos.needsUpdate = true;
    terRNorm.needsUpdate = true;
    terRUv.needsUpdate = true;

    this.catsEyeMesh.instanceMatrix.needsUpdate = true;
    this.glarePaddleMesh.instanceMatrix.needsUpdate = true;

    // Streetlamps at 40m intervals (8 * 5m segments)
    const firstLampSeg = Math.ceil(startSeg / 8) * 8;
    for (let i = 0; i < this.lamps.length; i++) {
      const lampS = (firstLampSeg + i * 8) * EXPRESSWAY.SEGMENT_LENGTH;
      const lamp = this.lamps[i];
      if (isTunnelAt(lampS)) {
        lamp.group.visible = false;
      } else {
        lamp.group.visible = true;
        const lx = roadCenterX(lampS) + EXPRESSWAY.MEDIAN_X;
        const ly = roadElevationY(lampS) + 0.5;
        const yaw = -Math.atan2(roadCenterDX(lampS), 1);
        lamp.group.position.set(lx, ly, -lampS);
        lamp.group.rotation.set(0, yaw + Math.PI, 0);
      }
    }

    const playerS = baseSeg * EXPRESSWAY.SEGMENT_LENGTH;
    for (const g of this.gantries) {
      if (g.sPos < minS - 40) {
        g.sPos += this.gantries.length * EXPRESSWAY.GANTRY_INTERVAL_M;
        if (g.sPos < playerS + 160) g.sPos = playerS + 260;
      }
      let gs = g.sPos;
      if (isTunnelAt(gs) || getMilestoneNear(gs, 60, 'jct')) {
        gs += 140;
        g.sPos = gs;
      }
      g.group.position.set(roadCenterX(gs), roadElevationY(gs), -gs);
      g.group.rotation.set(0, -Math.atan2(roadCenterDX(gs), 1), 0);
    }
  }

  public dispose(): void {
    this.skyMesh.geometry.dispose();
    this.skyMat.dispose();
    this.roadGeo.dispose();
    this.oncomingRoadGeo.dispose();
    this.rampRoadGeo.dispose();
    this.plazaOverlayGeo.dispose();
    this.rampGuideGeo.dispose();
    this.goreGeo.dispose();
    this.islandGeo.dispose();
    this.islandGuardrailGeo.dispose();
    this.medianGeo.dispose();
    this.terrainLeftGeo.dispose();
    this.terrainRightGeo.dispose();
    this.guardrailLeftGeo.dispose();
    this.guardrailRightGeo.dispose();
    this.roadMaterial.dispose();
    this.terrainMaterial.dispose();
    this.groundFloorMesh.geometry.dispose();
    this.groundFloorMat.dispose();
    this.mountainRingMesh.geometry.dispose();
    this.mountainRingMat.dispose();
    this.fujiMaterial.dispose();
    this.rainMat.dispose();
    this.rainLines.geometry.dispose();
    this.sprayMat.dispose();
    this.sprayPoints.geometry.dispose();
  }
}
