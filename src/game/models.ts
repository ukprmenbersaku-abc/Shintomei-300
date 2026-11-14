import * as THREE from 'three';
import { CAR_PAINTS, PARKING_BAY_COORDS, TRAFFIC_SPECS } from './constants';
import { CarPaintId, TrafficArchetype } from '../types/game';
import { ProceduralTexturePack } from './textures';

export interface PlayerCarRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  paintMaterial: THREE.MeshPhysicalMaterial;
  wheels: THREE.Group[];
  frontSteerPivots: THREE.Group[];
  wiperLeft: THREE.Group;
  wiperRight: THREE.Group;
  tailLightMaterial: THREE.MeshStandardMaterial;
  headLightBeamLeft: THREE.Mesh;
  headLightBeamRight: THREE.Mesh;
  headLightEmissiveMat: THREE.MeshStandardMaterial;
  brakeRotorMat: THREE.MeshStandardMaterial;
  exhaustFlameGroup: THREE.Group;
  exhaustFlameMat: THREE.MeshBasicMaterial;
}

export interface TrafficCarRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  wheels: THREE.Group[];
  tailLightMat: THREE.MeshStandardMaterial;
  headLightMat: THREE.MeshStandardMaterial;
  leftBlinkerMat: THREE.MeshStandardMaterial;
  rightBlinkerMat: THREE.MeshStandardMaterial;
  patrolLightLeftMat?: THREE.MeshStandardMaterial;
  patrolLightRightMat?: THREE.MeshStandardMaterial;
  patrolFrontFlashMat?: THREE.MeshStandardMaterial;
}

const sharedTireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 22);
sharedTireGeo.rotateZ(Math.PI / 2);
const sharedSidewallGeo = new THREE.TorusGeometry(0.27, 0.068, 8, 22);
sharedSidewallGeo.rotateY(Math.PI / 2);

const sharedRimRingGeo = new THREE.TorusGeometry(0.22, 0.025, 8, 20);
sharedRimRingGeo.rotateY(Math.PI / 2);
const sharedHubGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.24, 12);
sharedHubGeo.rotateZ(Math.PI / 2);
const sharedSpokeGeo = new THREE.BoxGeometry(0.03, 0.39, 0.028);
const sharedRotorGeo = new THREE.CylinderGeometry(0.185, 0.185, 0.04, 18);
sharedRotorGeo.rotateZ(Math.PI / 2);

const sharedTireMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.88, metalness: 0.05 });
const sharedRimMat = new THREE.MeshStandardMaterial({ color: 0xc2c9d4, roughness: 0.22, metalness: 0.88, envMapIntensity: 0.7 });
const sharedDarkRimMat = new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.26, metalness: 0.84, envMapIntensity: 0.7 });
const sharedRotorMat = new THREE.MeshStandardMaterial({ color: 0x8f97a3, roughness: 0.32, metalness: 0.85, envMapIntensity: 0.6 });
const sharedCaliperMat = new THREE.MeshStandardMaterial({ color: 0xc91a28, roughness: 0.32, metalness: 0.35 });
const sharedDarkTrimMat = new THREE.MeshStandardMaterial({ color: 0x16191f, roughness: 0.78, metalness: 0.18, envMapIntensity: 0.35 });
const sharedInteriorMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.94, metalness: 0.05 });
const sharedSeatMat = new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.9, metalness: 0.05 });
const sharedChromeMat = new THREE.MeshStandardMaterial({ color: 0xd0d7e2, roughness: 0.16, metalness: 0.92, envMapIntensity: 0.75 });

// Real transparent, reflective automotive window glass!
const sharedWindowGlassMat = new THREE.MeshPhysicalMaterial({
  color: 0x0b1626,
  roughness: 0.05,
  metalness: 0.12,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
  envMapIntensity: 1.1,
  transparent: true,
  opacity: 0.44,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const sharedMirrorGlassMat = new THREE.MeshStandardMaterial({
  color: 0xaab9cc,
  roughness: 0.06,
  metalness: 0.95,
  envMapIntensity: 0.8,
});

function createDetailedWheel(
  isLeftSide: boolean,
  isPlayer: boolean,
  darkAlloy = false,
  playerRotorMat?: THREE.MeshStandardMaterial,
): { hubCarrier: THREE.Group; spinGroup: THREE.Group } {
  const hubCarrier = new THREE.Group();
  const spinGroup = new THREE.Group();
  hubCarrier.add(spinGroup);

  const tire = new THREE.Mesh(sharedTireGeo, sharedTireMat);
  tire.castShadow = isPlayer;
  spinGroup.add(tire);

  const sideSign = isLeftSide ? -1 : 1;
  const sidewall = new THREE.Mesh(sharedSidewallGeo, sharedTireMat);
  sidewall.position.x = sideSign * 0.06;
  spinGroup.add(sidewall);

  const rimMat = darkAlloy ? sharedDarkRimMat : sharedRimMat;
  const rimRing = new THREE.Mesh(sharedRimRingGeo, rimMat);
  rimRing.position.x = sideSign * 0.11;
  spinGroup.add(rimRing);

  const hub = new THREE.Mesh(sharedHubGeo, rimMat);
  spinGroup.add(hub);

  const spokeCount = isPlayer ? 5 : 4;
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI;
    const spoke = new THREE.Mesh(sharedSpokeGeo, rimMat);
    spoke.rotation.x = angle;
    spoke.position.x = sideSign * 0.105;
    spinGroup.add(spoke);
  }

  if (isPlayer) {
    const rotor = new THREE.Mesh(sharedRotorGeo, playerRotorMat ?? sharedRotorMat);
    rotor.position.x = sideSign * 0.04;
    spinGroup.add(rotor);

    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, 0.11), sharedCaliperMat);
    caliper.position.set(sideSign * 0.04, 0.05, -0.11);
    hubCarrier.add(caliper);
  }

  return { hubCarrier, spinGroup };
}

function addInteriorCabin(parent: THREE.Group, width: number, yFloor: number, zCenter: number, isCoupe: boolean): void {
  // Dark interior floor & lower dash
  const tub = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 0.18, 1.45), sharedInteriorMat);
  tub.position.set(0, yFloor, zCenter);
  parent.add(tub);

  const dash = new THREE.Mesh(new THREE.BoxGeometry(width * 0.76, 0.22, 0.34), sharedInteriorMat);
  dash.position.set(0, yFloor + 0.18, zCenter - 0.56);
  parent.add(dash);

  // Right-hand drive steering wheel (Japan!)
  const steer = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 16), sharedDarkTrimMat);
  steer.position.set(0.32, yFloor + 0.25, zCenter - 0.38);
  steer.rotation.x = 0.35;
  parent.add(steer);

  // Left & Right front seats + headrests (clearly visible through rear & side windows!)
  for (const side of [-1, 1]) {
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.11), sharedSeatMat);
    backrest.position.set(side * (width * 0.21), yFloor + 0.26, zCenter + 0.12);
    backrest.rotation.x = isCoupe ? 0.24 : 0.16;
    parent.add(backrest);

    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.08), sharedSeatMat);
    headrest.position.set(side * (width * 0.21), yFloor + 0.54, zCenter + 0.19);
    parent.add(headrest);
  }
}

export function createPlayerCar(
  textures: ProceduralTexturePack,
  initialPaint: CarPaintId,
  isSoftwareGl: boolean,
): PlayerCarRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const paintSpec = CAR_PAINTS[initialPaint];
  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: paintSpec.hex,
    metalness: paintSpec.metalness,
    roughness: paintSpec.roughness,
    clearcoat: 1.0,
    clearcoatRoughness: 0.09,
    envMapIntensity: 0.78, // Rich outdoor horizon-sky lacquer reflections
  });

  const carbonMat = new THREE.MeshPhysicalMaterial({
    map: textures.carbonTexture,
    normalMap: textures.carbonNormalTexture,
    normalScale: new THREE.Vector2(0.45, 0.45),
    color: 0xffffff,
    roughness: 0.34,
    metalness: 0.24,
    clearcoat: 0.72,
    clearcoatRoughness: 0.14,
    envMapIntensity: 0.68,
  });

  const brakeRotorMat = new THREE.MeshStandardMaterial({
    color: 0x8f97a3,
    roughness: 0.32,
    metalness: 0.85,
    emissive: 0xff4500,
    emissiveIntensity: 0.0,
    envMapIntensity: 0.65,
  });

  // Ground contact shadow plane
  const shadowGeo = new THREE.PlaneGeometry(2.75, 5.4);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.015;
  root.add(shadowMesh);

  // 1. Lower Body Below Beltline (Leaves Greenhouse Open for Real Transparent Windows!)
  const lowerProfile = new THREE.Shape();
  lowerProfile.moveTo(-2.34, 0.2);
  lowerProfile.lineTo(-2.36, 0.44);
  lowerProfile.quadraticCurveTo(-2.12, 0.69, -1.16, 0.79);
  lowerProfile.lineTo(1.88, 0.84);
  lowerProfile.lineTo(2.28, 0.76);
  lowerProfile.lineTo(2.31, 0.3);
  lowerProfile.lineTo(2.05, 0.2);
  lowerProfile.closePath();

  const lowerBodyGeo = new THREE.ExtrudeGeometry(lowerProfile, {
    depth: 1.66,
    bevelEnabled: true,
    bevelThickness: 0.075,
    bevelSize: 0.06,
    bevelSegments: 3,
  });
  lowerBodyGeo.translate(0, 0, -0.83);
  lowerBodyGeo.rotateY(-Math.PI / 2);
  const lowerBody = new THREE.Mesh(lowerBodyGeo, paintMaterial);
  lowerBody.castShadow = !isSoftwareGl;
  lowerBody.receiveShadow = true;
  bodyPivot.add(lowerBody);

  // 2. Interior Cabin (Visible through Front, Side, and Rear Window Glass!)
  addInteriorCabin(bodyPivot, 1.56, 0.54, 0.1, true);

  // 3. Greenhouse Pillars & Roof Panel
  const roofGeo = new THREE.BoxGeometry(1.24, 0.055, 1.02);
  const roof = new THREE.Mesh(roofGeo, carbonMat);
  roof.position.set(0, 1.22, 0.22);
  roof.castShadow = !isSoftwareGl;
  bodyPivot.add(roof);

  // Slim A-pillars, B-pillars, and C-pillars framing the glass!
  for (const side of [-1, 1]) {
    // A-pillar (front windshield frame: lower at -Z cowl, higher at +Z roof)
    const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.055, 0.72), sharedDarkTrimMat);
    aPillar.position.set(side * 0.65, 1.02, -0.59);
    aPillar.rotation.x = -0.6;
    aPillar.rotation.z = side * 0.14;
    bodyPivot.add(aPillar);

    // B-pillar
    const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.07), sharedDarkTrimMat);
    bPillar.position.set(side * 0.71, 1.01, 0.14);
    bPillar.rotation.z = side * 0.24;
    bodyPivot.add(bPillar);

    // C-pillar (fastback rear buttress: higher at -Z roof, lower at +Z deck)
    const cPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.04), paintMaterial);
    cPillar.position.set(side * 0.65, 1.03, 1.18);
    cPillar.rotation.x = 0.4;
    cPillar.rotation.z = side * -0.14;
    bodyPivot.add(cPillar);
  }

  // 4. Real Transparent Reflective Glass (Windshield, Rear Glass, Side Windows)
  const windshieldGeo = new THREE.PlaneGeometry(1.26, 0.72);
  windshieldGeo.rotateX(-Math.PI / 2);
  const windshield = new THREE.Mesh(windshieldGeo, sharedWindowGlassMat);
  windshield.position.set(0, 1.02, -0.59);
  windshield.rotation.x = -0.6;
  windshield.renderOrder = 2;
  bodyPivot.add(windshield);

  const rearGlassGeo = new THREE.PlaneGeometry(1.22, 1.02);
  rearGlassGeo.rotateX(-Math.PI / 2);
  const rearGlass = new THREE.Mesh(rearGlassGeo, sharedWindowGlassMat);
  rearGlass.position.set(0, 1.03, 1.18);
  rearGlass.rotation.x = 0.4;
  rearGlass.renderOrder = 2;
  bodyPivot.add(rearGlass);

  const sideWinShape = new THREE.Shape();
  sideWinShape.moveTo(-0.82, -0.18);
  sideWinShape.lineTo(-0.28, 0.2);
  sideWinShape.lineTo(0.68, 0.18);
  sideWinShape.lineTo(1.28, -0.15);
  sideWinShape.closePath();
  const sideWinGeo = new THREE.ShapeGeometry(sideWinShape);
  sideWinGeo.rotateY(-Math.PI / 2);

  for (const side of [-1, 1]) {
    const sideWin = new THREE.Mesh(sideWinGeo, sharedWindowGlassMat);
    sideWin.position.set(side * 0.71, 1.01, 0);
    sideWin.rotation.z = side * 0.24;
    sideWin.renderOrder = 2;
    bodyPivot.add(sideWin);
  }

  // 5. Flared Widebody Fenders
  const frontFenderShape = new THREE.Shape();
  frontFenderShape.moveTo(-2.22, 0.24);
  frontFenderShape.quadraticCurveTo(-1.8, 0.78, -1.15, 0.83);
  frontFenderShape.lineTo(-0.72, 0.8);
  frontFenderShape.lineTo(-0.72, 0.26);
  frontFenderShape.closePath();

  const frontFenderGeo = new THREE.ExtrudeGeometry(frontFenderShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 3,
  });
  frontFenderGeo.translate(0, 0, -0.11);
  frontFenderGeo.rotateY(-Math.PI / 2);

  const rearFenderShape = new THREE.Shape();
  rearFenderShape.moveTo(0.65, 0.24);
  rearFenderShape.lineTo(0.68, 0.86);
  rearFenderShape.quadraticCurveTo(1.38, 0.94, 2.15, 0.76);
  rearFenderShape.lineTo(2.22, 0.26);
  rearFenderShape.closePath();

  const rearFenderGeo = new THREE.ExtrudeGeometry(rearFenderShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 3,
  });
  rearFenderGeo.translate(0, 0, -0.12);
  rearFenderGeo.rotateY(-Math.PI / 2);

  for (const side of [-1, 1]) {
    const ff = new THREE.Mesh(frontFenderGeo, paintMaterial);
    ff.position.x = side * 0.85;
    ff.castShadow = !isSoftwareGl;
    bodyPivot.add(ff);

    const rf = new THREE.Mesh(rearFenderGeo, paintMaterial);
    rf.position.x = side * 0.86;
    rf.castShadow = !isSoftwareGl;
    bodyPivot.add(rf);
  }

  // 6. Sculpted Hood Power Dome & Twin Recessed Carbon NACA Vents
  const dome = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 1.25), paintMaterial);
  dome.position.set(0, 0.79, -1.42);
  dome.rotation.x = 0.095;
  bodyPivot.add(dome);

  for (const side of [-1, 1]) {
    const ventBezel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.42), carbonMat);
    ventBezel.position.set(side * 0.43, 0.785, -1.36);
    ventBezel.rotation.x = 0.095;
    ventBezel.rotation.y = side * -0.06;
    bodyPivot.add(ventBezel);

    for (let s = 0; s < 3; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.04), sharedDarkTrimMat);
      slat.position.set(side * 0.43, 0.8, -1.48 + s * 0.11);
      slat.rotation.x = 0.35;
      bodyPivot.add(slat);
    }

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 1.18), paintMaterial);
    ridge.position.set(side * 0.84, 0.795, -1.44);
    ridge.rotation.x = 0.08;
    bodyPivot.add(ridge);
  }

  // 7. Carbon Aero Splitter, Side Skirts & Diffuser
  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.06, 0.55), carbonMat);
  frontLip.position.set(0, 0.17, -2.22);
  bodyPivot.add(frontLip);

  const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.08, 2.8), carbonMat);
  sideSkirt.position.set(0, 0.18, 0.0);
  bodyPivot.add(sideSkirt);

  const diffuserBase = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.14, 0.52), carbonMat);
  diffuserBase.position.set(0, 0.22, 2.15);
  bodyPivot.add(diffuserBase);

  for (const sx of [-0.62, -0.22, 0.22, 0.62]) {
    const strake = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.48), carbonMat);
    strake.position.set(sx, 0.21, 2.18);
    bodyPivot.add(strake);
  }

  // Shark-fin antenna
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.085, 0.18), carbonMat);
  fin.position.set(0, 1.27, 0.62);
  bodyPivot.add(fin);

  // 8. Windshield Cowl & Animated Wipers
  const cowl = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, 0.18), sharedDarkTrimMat);
  cowl.position.set(0, 0.81, -0.88);
  bodyPivot.add(cowl);

  const wiperLeft = new THREE.Group();
  wiperLeft.position.set(-0.55, 0.835, -0.84);
  const bladeL = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.026), sharedDarkTrimMat);
  bladeL.position.set(0.28, 0.01, -0.02);
  wiperLeft.add(bladeL);
  bodyPivot.add(wiperLeft);

  const wiperRight = new THREE.Group();
  wiperRight.position.set(0.02, 0.835, -0.84);
  const bladeR = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.02, 0.026), sharedDarkTrimMat);
  bladeR.position.set(0.27, 0.01, -0.02);
  wiperRight.add(bladeR);
  bodyPivot.add(wiperRight);

  // 9. Side Mirrors
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.06), sharedDarkTrimMat);
    stalk.position.set(side * 0.94, 0.85, -0.68);
    bodyPivot.add(stalk);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.1, 0.14), carbonMat);
    housing.position.set(side * 1.05, 0.88, -0.65);
    housing.rotation.y = side * -0.18;
    bodyPivot.add(housing);

    const mirrorFace = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.075), sharedMirrorGlassMat);
    mirrorFace.position.set(side * 1.05, 0.88, -0.578);
    mirrorFace.rotation.y = side * -0.18;
    bodyPivot.add(mirrorFace);
  }

  // 10. Swan-Neck Carbon GT Wing
  const wingMain = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.045, 0.34), carbonMat);
  wingMain.position.set(0, 1.18, 2.06);
  wingMain.rotation.x = 0.09;
  wingMain.castShadow = !isSoftwareGl;
  bodyPivot.add(wingMain);

  const gurneyFlap = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.03, 0.04), paintMaterial);
  gurneyFlap.position.set(0, 1.2, 2.23);
  bodyPivot.add(gurneyFlap);

  const endplateGeo = new THREE.BoxGeometry(0.035, 0.21, 0.42);
  for (const side of [-1, 1]) {
    const plate = new THREE.Mesh(endplateGeo, paintMaterial);
    plate.position.set(side * 0.97, 1.16, 2.06);
    bodyPivot.add(plate);

    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.38, 0.16), sharedDarkRimMat);
    upright.position.set(side * 0.44, 1.02, 2.02);
    upright.rotation.x = -0.18;
    bodyPivot.add(upright);
  }

  // 11. Front Grille, Exhausts, Taillights & Headlights
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.24, 0.08), sharedDarkTrimMat);
  grille.position.set(0, 0.34, -2.35);
  bodyPivot.add(grille);

  const exhaustOuterMat = new THREE.MeshStandardMaterial({ color: 0xa3b3c9, metalness: 0.92, roughness: 0.2, envMapIntensity: 0.7 });
  const exhaustBlueMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.88, roughness: 0.24, envMapIntensity: 0.6 });
  const exhaustGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.18, 16);
  exhaustGeo.rotateX(Math.PI / 2);
  const innerPipeGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.19, 12);
  innerPipeGeo.rotateX(Math.PI / 2);

  const exhaustFlameGroup = new THREE.Group();
  const exhaustFlameMat = new THREE.MeshBasicMaterial({
    color: 0xff9f43,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameGeo = new THREE.ConeGeometry(0.052, 0.48, 8);
  flameGeo.rotateX(Math.PI / 2);

  for (const sx of [-0.6, -0.44, 0.44, 0.6]) {
    const pipe = new THREE.Mesh(exhaustGeo, exhaustOuterMat);
    pipe.position.set(sx, 0.25, 2.33);
    bodyPivot.add(pipe);

    const burntTip = new THREE.Mesh(innerPipeGeo, exhaustBlueMat);
    burntTip.position.set(sx, 0.25, 2.335);
    bodyPivot.add(burntTip);

    const flame = new THREE.Mesh(flameGeo, exhaustFlameMat);
    flame.position.set(sx, 0.25, 2.58);
    exhaustFlameGroup.add(flame);
  }
  exhaustFlameGroup.visible = false;
  bodyPivot.add(exhaustFlameGroup);

  const rearFascia = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.22, 0.05), sharedDarkTrimMat);
  rearFascia.position.set(0, 0.64, 2.31);
  bodyPivot.add(rearFascia);

  const tailLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xcc1420,
    emissive: 0xff1122,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  const tailRingGeo = new THREE.TorusGeometry(0.082, 0.022, 8, 20);
  for (const rx of [-0.74, -0.52, 0.52, 0.74]) {
    const ring = new THREE.Mesh(tailRingGeo, tailLightMaterial);
    ring.position.set(rx, 0.64, 2.345);
    bodyPivot.add(ring);
  }
  const centerTailBar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.035, 0.03), tailLightMaterial);
  centerTailBar.position.set(0, 0.64, 2.345);
  bodyPivot.add(centerTailBar);

  const rearPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.18),
    new THREE.MeshStandardMaterial({ map: textures.plateWhite, roughness: 0.4 }),
  );
  rearPlate.position.set(0, 0.44, 2.35);
  bodyPivot.add(rearPlate);

  const headLightEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0xeef6ff,
    emissive: 0xdbeafe,
    emissiveIntensity: 1.2,
    roughness: 0.15,
  });
  for (const side of [-1, 1]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.12), sharedDarkTrimMat);
    housing.position.set(side * 0.74, 0.54, -2.24);
    bodyPivot.add(housing);

    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.032, 0.04), headLightEmissiveMat);
    drl.position.set(side * 0.74, 0.51, -2.3);
    bodyPivot.add(drl);

    for (const px of [-0.07, 0.07]) {
      const proj = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), headLightEmissiveMat);
      proj.position.set(side * 0.74 + px, 0.56, -2.29);
      bodyPivot.add(proj);
    }
  }

  const beamGeo = new THREE.ConeGeometry(2.8, 26, 16, 1, true);
  beamGeo.translate(0, -13, 0);
  beamGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xe6f2ff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const headLightBeamLeft = new THREE.Mesh(beamGeo, beamMat);
  headLightBeamLeft.position.set(-0.74, 0.54, -2.35);
  bodyPivot.add(headLightBeamLeft);

  const headLightBeamRight = new THREE.Mesh(beamGeo, beamMat);
  headLightBeamRight.position.set(0.74, 0.54, -2.35);
  bodyPivot.add(headLightBeamRight);

  // 12. 10-Spoke Wheels with Ventilated Discs & Calipers
  const wheels: THREE.Group[] = [];
  const frontSteerPivots: THREE.Group[] = [];
  const wheelCoords: [number, number, boolean, boolean][] = [
    [-0.95, -1.42, true, true],
    [0.95, -1.42, false, true],
    [-0.97, 1.42, true, false],
    [0.97, 1.42, false, false],
  ];

  for (const [wx, wz, isLeft, isFront] of wheelCoords) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wx, 0.34, wz);
    root.add(steerPivot);

    const { hubCarrier, spinGroup } = createDetailedWheel(isLeft, true, true, brakeRotorMat);
    steerPivot.add(hubCarrier);
    wheels.push(spinGroup);
    if (isFront) frontSteerPivots.push(steerPivot);
  }

  return {
    root,
    bodyPivot,
    paintMaterial,
    wheels,
    frontSteerPivots,
    wiperLeft,
    wiperRight,
    tailLightMaterial,
    headLightBeamLeft,
    headLightBeamRight,
    headLightEmissiveMat,
    brakeRotorMat,
    exhaustFlameGroup,
    exhaustFlameMat,
  };
}

function buildExtrudedProfile(points: [number, number][], width: number, bevel = 0.05): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

function addSedanGreenhouse(
  bodyPivot: THREE.Group,
  w: number,
  roofMat: THREE.Material,
  pillarMat: THREE.Material,
  roofY: number,
  beltY: number,
  zFront: number,
  zRear: number,
): void {
  // Roof panel
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.78, 0.055, (zRear - zFront) * 0.58),
    roofMat,
  );
  roof.position.set(0, roofY, (zFront + zRear) * 0.5);
  bodyPivot.add(roof);

  // Pillars
  for (const side of [-1, 1]) {
    const aP = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.62), pillarMat);
    aP.position.set(side * (w * 0.4), (roofY + beltY) * 0.5, zFront + 0.14);
    aP.rotation.x = -0.62;
    bodyPivot.add(aP);

    const bP = new THREE.Mesh(new THREE.BoxGeometry(0.05, roofY - beltY, 0.07), pillarMat);
    bP.position.set(side * (w * 0.42), (roofY + beltY) * 0.5, (zFront + zRear) * 0.5);
    bP.rotation.z = side * 0.18;
    bodyPivot.add(bP);

    const cP = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, 0.66), pillarMat);
    cP.position.set(side * (w * 0.4), (roofY + beltY) * 0.5, zRear - 0.1);
    cP.rotation.x = 0.58;
    bodyPivot.add(cP);
  }

  // Real Transparent Reflective Glass (Front, Rear, Left, Right)
  const frontWinGeo = new THREE.PlaneGeometry(w * 0.74, 0.62);
  frontWinGeo.rotateX(-Math.PI / 2);
  const frontWin = new THREE.Mesh(frontWinGeo, sharedWindowGlassMat);
  frontWin.position.set(0, (roofY + beltY) * 0.5, zFront + 0.14);
  frontWin.rotation.x = -0.62;
  frontWin.renderOrder = 2;
  bodyPivot.add(frontWin);

  const rearWinGeo = new THREE.PlaneGeometry(w * 0.72, 0.64);
  rearWinGeo.rotateX(-Math.PI / 2);
  const rearWin = new THREE.Mesh(rearWinGeo, sharedWindowGlassMat);
  rearWin.position.set(0, (roofY + beltY) * 0.5, zRear - 0.1);
  rearWin.rotation.x = 0.58;
  rearWin.renderOrder = 2;
  bodyPivot.add(rearWin);

  const sideWinGeo = new THREE.PlaneGeometry((zRear - zFront) * 0.82, roofY - beltY + 0.04);
  sideWinGeo.rotateY(Math.PI / 2);
  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(sideWinGeo, sharedWindowGlassMat);
    sw.position.set(side * (w * 0.41), (roofY + beltY) * 0.5, (zFront + zRear) * 0.5);
    sw.rotation.z = side * 0.18;
    sw.renderOrder = 2;
    bodyPivot.add(sw);
  }
}

export function createTrafficCar(
  archetype: TrafficArchetype,
  colorHex: number,
  textures: ProceduralTexturePack,
): TrafficCarRig {
  const spec = TRAFFIC_SPECS[archetype];
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const shadowGeo = new THREE.PlaneGeometry(spec.width * 1.28, spec.length * 1.15);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.015;
  root.add(shadow);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: archetype === TrafficArchetype.BoxTruck ? 0.52 : 0.26,
    metalness: archetype === TrafficArchetype.BoxTruck ? 0.15 : 0.42,
    clearcoat: archetype === TrafficArchetype.BoxTruck ? 0.15 : 0.75,
    envMapIntensity: 0.58,
  });

  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0xaa1118,
    emissive: 0xff1a24,
    emissiveIntensity: 0.6,
    roughness: 0.22,
  });

  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    emissive: 0xfef3c7,
    emissiveIntensity: 0.4,
    roughness: 0.18,
  });

  const leftBlinkerMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.3,
  });

  const rightBlinkerMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.3,
  });

  let patrolLightLeftMat: THREE.MeshStandardMaterial | undefined;
  let patrolLightRightMat: THREE.MeshStandardMaterial | undefined;
  let patrolFrontFlashMat: THREE.MeshStandardMaterial | undefined;

  const w = spec.width;
  const len = spec.length;
  const wheels: THREE.Group[] = [];

  if (archetype === TrafficArchetype.BoxTruck) {
    // 10-Ton Freight Truck with Real Transparent Cab Windshield & Side Glass
    const cabLowerGeo = buildExtrudedProfile(
      [
        [-len * 0.5, 0.48],
        [-len * 0.5, 1.38],
        [-len * 0.5 + 2.1, 1.38],
        [-len * 0.5 + 2.1, 0.48],
      ],
      w * 0.94,
      0.05,
    );
    bodyPivot.add(new THREE.Mesh(cabLowerGeo, bodyMat));

    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.14, 1.75), bodyMat);
    cabRoof.position.set(0, 2.38, -len * 0.5 + 1.18);
    bodyPivot.add(cabRoof);

    // Cab pillars & interior seats
    addInteriorCabin(bodyPivot, w * 0.85, 1.25, -len * 0.5 + 1.0, false);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.96, 0.1), bodyMat);
      post.position.set(side * (w * 0.43), 1.86, -len * 0.5 + 0.25);
      post.rotation.x = 0.15;
      bodyPivot.add(post);

      const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.78), sharedWindowGlassMat);
      sideWin.rotation.y = Math.PI / 2;
      sideWin.position.set(side * (w * 0.45), 1.86, -len * 0.5 + 1.05);
      bodyPivot.add(sideWin);
    }

    const cabWindshield = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.82, 0.86), sharedWindowGlassMat);
    cabWindshield.position.set(0, 1.86, -len * 0.5 + 0.16);
    cabWindshield.rotation.x = 0.16;
    bodyPivot.add(cabWindshield);

    const deflectorGeo = buildExtrudedProfile(
      [
        [-len * 0.5 + 0.45, 2.44],
        [-len * 0.5 + 2.1, 3.22],
        [-len * 0.5 + 2.1, 2.44],
      ],
      w * 0.88,
      0.03,
    );
    bodyPivot.add(new THREE.Mesh(deflectorGeo, bodyMat));

    const truckGrille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.48, 0.08), sharedChromeMat);
    truckGrille.position.set(0, 1.02, -len * 0.5 - 0.01);
    bodyPivot.add(truckGrille);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.3, 0.18), sharedChromeMat);
    bumper.position.set(0, 0.48, -len * 0.5 - 0.03);
    bodyPivot.add(bumper);

    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.08), sharedDarkTrimMat);
      m.position.set(side * (w * 0.56), 1.82, -len * 0.5 + 0.18);
      bodyPivot.add(m);
    }

    const cargoMat = new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 0.46, metalness: 0.5, envMapIntensity: 0.45 });
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(w, 2.55, len - 2.38), cargoMat);
    cargo.position.set(0, 2.02, 1.12);
    cargo.castShadow = true;
    cargo.receiveShadow = true;
    bodyPivot.add(cargo);

    const ribMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.44, metalness: 0.65 });
    for (let z = -1.6; z <= 3.8; z += 1.35) {
      for (const side of [-1, 1]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.52, 0.08), ribMat);
        rib.position.set(side * (w * 0.5 + 0.01), 2.02, z);
        bodyPivot.add(rib);
      }
    }

    const frame = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.42, len * 0.94), sharedDarkTrimMat);
    frame.position.set(0, 0.52, 0);
    bodyPivot.add(frame);

    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.21),
      new THREE.MeshStandardMaterial({ map: textures.plateGreen, roughness: 0.4 }),
    );
    plate.position.set(0, 0.55, len * 0.5 + 0.02);
    bodyPivot.add(plate);

    for (const wz of [-len * 0.36, len * 0.2, len * 0.37]) {
      for (const side of [-1, 1]) {
        const { hubCarrier, spinGroup } = createDetailedWheel(side < 0, false, false);
        hubCarrier.position.set(side * (w * 0.45), 0.43, wz);
        hubCarrier.scale.setScalar(1.26);
        root.add(hubCarrier);
        wheels.push(spinGroup);
      }
    }
  } else if (archetype === TrafficArchetype.KeiWagon) {
    // Kei Tall Wagon with Lower Body + Transparent Windows + Cabin Seats
    const keiLower = buildExtrudedProfile(
      [
        [-len * 0.5, 0.25],
        [-len * 0.5, 0.82],
        [-len * 0.28, 0.95],
        [len * 0.49, 0.95],
        [len * 0.49, 0.26],
      ],
      w,
      0.045,
    );
    bodyPivot.add(new THREE.Mesh(keiLower, bodyMat));
    addInteriorCabin(bodyPivot, w, 0.72, 0.15, false);
    addSedanGreenhouse(bodyPivot, w, bodyMat, sharedDarkTrimMat, 1.62, 0.95, -0.78, 1.38);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.65, 0.2, 0.06), sharedChromeMat);
    grille.position.set(0, 0.56, -len * 0.5 - 0.01);
    bodyPivot.add(grille);

    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.16),
      new THREE.MeshStandardMaterial({ map: textures.plateYellow, roughness: 0.4 }),
    );
    plate.position.set(0, 0.44, len * 0.5 + 0.02);
    bodyPivot.add(plate);
  } else if (archetype === TrafficArchetype.PatrolCar) {
    // Black & White Crown Patrol Car with Real Transparent Windows + Interior
    const lowerGeo = buildExtrudedProfile(
      [
        [-len * 0.5, 0.22],
        [-len * 0.5, 0.62],
        [-len * 0.22, 0.66],
        [len * 0.48, 0.66],
        [len * 0.5, 0.24],
      ],
      w,
      0.04,
    );
    bodyPivot.add(new THREE.Mesh(lowerGeo, sharedDarkTrimMat));

    const whiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xdcdfe3,
      roughness: 0.22,
      metalness: 0.22,
      clearcoat: 0.8,
      envMapIntensity: 0.58,
    });
    const upperBeltGeo = buildExtrudedProfile(
      [
        [-len * 0.48, 0.64],
        [-len * 0.18, 0.86],
        [len * 0.48, 0.84],
        [len * 0.48, 0.64],
      ],
      w * 0.96,
      0.04,
    );
    bodyPivot.add(new THREE.Mesh(upperBeltGeo, whiteMat));

    addInteriorCabin(bodyPivot, w, 0.6, 0.1, false);
    addSedanGreenhouse(bodyPivot, w, whiteMat, sharedDarkTrimMat, 1.38, 0.85, -0.95, 1.25);

    const barBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.12, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xdbe2ea }),
    );
    barBase.position.set(0, 1.46, 0.08);
    bodyPivot.add(barBase);

    patrolLightLeftMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xff1111, emissiveIntensity: 2.2 });
    patrolLightRightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xff1111, emissiveIntensity: 0.4 });
    patrolFrontFlashMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xff1111, emissiveIntensity: 1.5 });

    const beaconL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.28), patrolLightLeftMat);
    beaconL.position.set(-0.28, 1.58, 0.08);
    bodyPivot.add(beaconL);

    const beaconR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.28), patrolLightRightMat);
    beaconR.position.set(0.28, 1.58, 0.08);
    bodyPivot.add(beaconR);

    for (const side of [-1, 1]) {
      const fFlash = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.05), patrolFrontFlashMat);
      fFlash.position.set(side * 0.28, 0.56, -len * 0.5 - 0.01);
      bodyPivot.add(fFlash);
    }

    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.17),
      new THREE.MeshStandardMaterial({ map: textures.plateWhite, roughness: 0.4 }),
    );
    plate.position.set(0, 0.48, len * 0.5 + 0.02);
    bodyPivot.add(plate);
  } else {
    // Sedan or Sports Coupe with Real Transparent Windows + Interior
    const isCoupe = archetype === TrafficArchetype.SportsCoupe;
    const beltGeo = buildExtrudedProfile(
      isCoupe
        ? [
            [-len * 0.5, 0.21],
            [-len * 0.5, 0.52],
            [-len * 0.24, 0.74],
            [1.42, 0.84],
            [len * 0.49, 0.76],
            [len * 0.5, 0.24],
          ]
        : [
            [-len * 0.5, 0.23],
            [-len * 0.5, 0.58],
            [-len * 0.22, 0.78],
            [1.38, 0.86],
            [len * 0.49, 0.82],
            [len * 0.5, 0.26],
          ],
      w,
      0.045,
    );
    const lowerBodyMesh = new THREE.Mesh(beltGeo, bodyMat);
    lowerBodyMesh.castShadow = true;
    lowerBodyMesh.receiveShadow = true;
    bodyPivot.add(lowerBodyMesh);

    addInteriorCabin(bodyPivot, w, 0.56, 0.12, isCoupe);
    addSedanGreenhouse(
      bodyPivot,
      w,
      bodyMat,
      sharedDarkTrimMat,
      isCoupe ? 1.2 : 1.36,
      isCoupe ? 0.78 : 0.84,
      isCoupe ? -0.92 : -0.96,
      isCoupe ? 1.22 : 1.26,
    );

    const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.54, 0.18, 0.05), sharedDarkTrimMat);
    grille.position.set(0, 0.46, -len * 0.5 - 0.01);
    bodyPivot.add(grille);

    if (isCoupe) {
      const lipWing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.04, 0.22), sharedDarkTrimMat);
      lipWing.position.set(0, 0.9, len * 0.43);
      bodyPivot.add(lipWing);
    }

    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.17),
      new THREE.MeshStandardMaterial({ map: textures.plateWhite, roughness: 0.4 }),
    );
    plate.position.set(0, 0.46, len * 0.5 + 0.02);
    bodyPivot.add(plate);
  }

  if (archetype !== TrafficArchetype.BoxTruck) {
    for (const side of [-1, 1]) {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.1), sharedDarkTrimMat);
      mirror.position.set(side * (w * 0.54), 0.86, -0.52);
      bodyPivot.add(mirror);
    }

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), sharedChromeMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(w * 0.28, 0.24, len * 0.5 + 0.01);
    bodyPivot.add(exhaust);

    const wheelZOff = len * 0.31;
    const wheelXOff = w * 0.46;
    for (const [wx, wz] of [
      [-wheelXOff, -wheelZOff],
      [wheelXOff, -wheelZOff],
      [-wheelXOff, wheelZOff],
      [wheelXOff, wheelZOff],
    ]) {
      const { hubCarrier, spinGroup } = createDetailedWheel(wx < 0, false, archetype === TrafficArchetype.SportsCoupe);
      hubCarrier.position.set(wx, 0.33, wz);
      root.add(hubCarrier);
      wheels.push(spinGroup);
    }
  }

  const lightY = archetype === TrafficArchetype.BoxTruck ? 0.72 : 0.58;
  const hlGeo = new THREE.BoxGeometry(0.28, 0.1, 0.06);
  const tlGeo = new THREE.BoxGeometry(0.34, 0.11, 0.06);
  const blinkGeo = new THREE.BoxGeometry(0.12, 0.11, 0.07);

  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(hlGeo, headLightMat);
    hl.position.set(side * (w * 0.35), lightY, -len * 0.5);
    bodyPivot.add(hl);

    const tl = new THREE.Mesh(tlGeo, tailLightMat);
    tl.position.set(side * (w * 0.33), lightY + 0.05, len * 0.5);
    bodyPivot.add(tl);

    const blinker = new THREE.Mesh(blinkGeo, side < 0 ? leftBlinkerMat : rightBlinkerMat);
    blinker.position.set(side * (w * 0.45), lightY + 0.05, len * 0.49);
    bodyPivot.add(blinker);
  }

  return {
    root,
    bodyPivot,
    wheels,
    tailLightMat,
    headLightMat,
    leftBlinkerMat,
    rightBlinkerMat,
    patrolLightLeftMat,
    patrolLightRightMat,
    patrolFrontFlashMat,
  };
}

function createParkedVehicleMesh(
  kind: 'sedan' | 'kei' | 'sports' | 'truck',
  colorHex: number,
): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: kind === 'truck' ? 0.52 : 0.28,
    metalness: kind === 'truck' ? 0.15 : 0.45,
  });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.12, metalness: 0.2 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.9 });

  if (kind === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.0), bodyMat);
    cab.position.set(0, 1.35, -3.0);
    g.add(cab);

    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(2.36, 2.55, 6.2),
      new THREE.MeshStandardMaterial({ color: 0xdbe2ea, roughness: 0.5, metalness: 0.35 }),
    );
    cargo.position.set(0, 1.95, 1.2);
    g.add(cargo);

    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 0.1), glassMat);
    wind.position.set(0, 1.85, -3.98);
    g.add(wind);

    for (const wz of [-2.8, 1.6, 3.1]) {
      for (const sx of [-1.05, 1.05]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 10), tireMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(sx, 0.42, wz);
        g.add(w);
      }
    }
  } else {
    const len = kind === 'kei' ? 3.35 : 4.55;
    const wid = kind === 'kei' ? 1.56 : 1.82;
    const h = kind === 'sports' ? 1.22 : kind === 'kei' ? 1.56 : 1.38;

    const lower = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.58, len), bodyMat);
    lower.position.y = 0.48;
    g.add(lower);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.84, h - 0.65, len * 0.52), glassMat);
    cabin.position.set(0, 0.74 + (h - 0.65) * 0.5, 0.12);
    g.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.8, 0.08, len * 0.44), bodyMat);
    roof.position.set(0, h, 0.14);
    g.add(roof);

    for (const wz of [-len * 0.31, len * 0.31]) {
      for (const sx of [-wid * 0.46, wid * 0.46]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10), tireMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(sx, 0.3, wz);
        g.add(w);
      }
    }
  }
  return g;
}

function createPalmTree(height = 7.5): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c5838, roughness: 0.92 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6e33, roughness: 0.78, side: THREE.DoubleSide });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, height, 7), trunkMat);
  trunk.position.y = height / 2;
  trunk.rotation.z = 0.05;
  g.add(trunk);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.9, 4), leafMat);
    frond.position.set(Math.cos(angle) * 1.15 - 0.2, height - 0.15, Math.sin(angle) * 1.15);
    frond.rotation.z = -1.15;
    frond.rotation.y = -angle;
    g.add(frond);
  }
  return g;
}

function addFuelStation(group: THREE.Group, x: number, z: number, brandColor: number, stripeColor: number): void {
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.3 });
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 0.55, 16.5),
    new THREE.MeshStandardMaterial({ color: brandColor, roughness: 0.38, metalness: 0.25 }),
  );
  roof.position.set(x, 5.1, z);
  group.add(roof);

  const fascia = new THREE.Mesh(
    new THREE.BoxGeometry(8.7, 0.22, 16.6),
    new THREE.MeshStandardMaterial({ color: stripeColor, emissive: stripeColor, emissiveIntensity: 0.45 }),
  );
  fascia.position.set(x, 4.9, z);
  group.add(fascia);

  for (const pz of [z - 5.2, z + 5.2]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 5.0, 8), pillarMat);
    pillar.position.set(x, 2.5, pz);
    group.add(pillar);

    const pump = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 1.45, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }),
    );
    pump.position.set(x, 0.72, pz + (pz < z ? 2.2 : -2.2));
    group.add(pump);
  }
}

function addPlazaParkedVehicles(
  group: THREE.Group,
  passengerX: number,
  truckX: number,
  zOffsetsPassenger: number[],
  zOffsetsTruck: number[],
): void {
  const carColors = [0xdcdfe3, 0x1e293b, 0x991b1b, 0x1d4ed8, 0x64748b, 0xd97706];
  const truckColors = [0xe2e8f0, 0x1d4ed8, 0x15803d, 0x94a3b8];

  zOffsetsPassenger.forEach((pz, i) => {
    const kind = i % 3 === 0 ? 'kei' : 'sedan';
    const car = createParkedVehicleMesh(kind, carColors[i % carColors.length]);
    car.position.set(passengerX, 0.02, pz);
    car.rotation.y = Math.PI / 2; // Parked perpendicular facing terminal building
    group.add(car);
  });

  zOffsetsTruck.forEach((tz, i) => {
    const truck = createParkedVehicleMesh('truck', truckColors[i % truckColors.length]);
    truck.position.set(truckX, 0.02, tz);
    truck.rotation.y = 0.22; // Angled pull-through truck bay
    group.add(truck);
  });
}

function addPlayerParkingBay(group: THREE.Group, x: number, z: number): void {
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.4,
    roughness: 0.35,
  });
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b,
    emissive: 0x065f46,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.52,
    roughness: 0.8,
  });

  const bayW = 4.2;
  const bayL = 7.4;

  // Translucent emerald bay highlight on asphalt
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(bayW - 0.25, bayL - 0.25), padMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, 0.032, z);
  group.add(floor);

  // Crisp glowing U-frame lines (open on +Z entry side and -Z exit side)
  const leftLine = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, bayL), lineMat);
  leftLine.position.set(x - bayW * 0.5, 0.038, z);
  group.add(leftLine);

  const rightLine = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, bayL), lineMat);
  rightLine.position.set(x + bayW * 0.5, 0.038, z);
  group.add(rightLine);

  const frontLine = new THREE.Mesh(new THREE.BoxGeometry(bayW + 0.18, 0.025, 0.2), lineMat);
  frontLine.position.set(x, 0.038, z - bayL * 0.5);
  group.add(frontLine);

  const rearLine = new THREE.Mesh(new THREE.BoxGeometry(bayW + 0.18, 0.025, 0.14), lineMat);
  rearLine.position.set(x, 0.038, z + bayL * 0.5);
  group.add(rearLine);

  // Subtle yellow/black wheel stopper curb at the front (-Z) end
  const stopper = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.11, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 }),
  );
  stopper.position.set(x, 0.055, z - bayL * 0.5 + 0.45);
  group.add(stopper);

  // Roadside "P" illuminated pole beacon beside the left edge of the bay
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 2.7, 8),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 }),
  );
  pole.position.set(x - bayW * 0.5 - 0.45, 1.35, z - bayL * 0.35);
  group.add(pole);

  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.95, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x059669, emissive: 0x10b981, emissiveIntensity: 1.1, roughness: 0.3 }),
  );
  badge.position.set(x - bayW * 0.5 - 0.45, 2.75, z - bayL * 0.35);
  group.add(badge);

  const pVertical = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.55, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 }),
  );
  pVertical.position.set(x - bayW * 0.5 - 0.58, 2.75, z - bayL * 0.35);
  group.add(pVertical);

  const pLoop = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.28, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 }),
  );
  pLoop.position.set(x - bayW * 0.5 - 0.41, 2.88, z - bayL * 0.35);
  group.add(pLoop);
}

export function createGoreNoseAssembly(
  textures: ProceduralTexturePack,
  mode: 'diverge' | 'merge',
): THREE.Group {
  const g = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.65, roughness: 0.4 });
  const tex = mode === 'diverge' ? textures.goreSplitSignTexture : textures.mergeWarningSignTexture;
  const signMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });

  if (mode === 'diverge') {
    // Yellow & black impact attenuator cushion drums at diverge gore tip
    const drumMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 });
    for (let i = 0; i < 3; i++) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.92, 12), drumMat);
      drum.position.set(0, 0.46, -i * 1.05);
      g.add(drum);

      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.2, 12), stripeMat);
      band.position.set(0, 0.62, -i * 1.05);
      g.add(band);
    }

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8), poleMat);
    pole.position.set(0, 1.8, -2.5);
    g.add(pole);

    const board = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.75, 0.14), [
      backMat,
      backMat,
      backMat,
      backMat,
      signMat,
      backMat,
    ]);
    board.position.set(0, 3.55, -2.5);
    g.add(board);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 2.2 }),
    );
    beacon.position.set(0, 4.6, -2.5);
    g.add(beacon);
  } else {
    // Merge gore: sign pole right at the downstream island tip (z = +0.8), plus slim flexible bollards along zebra gore (-Z)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8), poleMat);
    pole.position.set(0, 1.8, 0.8);
    g.add(pole);

    const board = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.65, 0.14), [
      backMat,
      backMat,
      backMat,
      backMat,
      signMat,
      backMat,
    ]);
    board.position.set(0, 3.55, 0.8);
    g.add(board);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 2.2 }),
    );
    beacon.position.set(0, 4.55, 0.8);
    g.add(beacon);

    // Slim orange reflective flexible bollards down the painted merge gore chevron wedge
    const bollardMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xffffff,
      emissiveIntensity: 0.4,
      roughness: 0.3,
    });
    for (let i = 0; i < 4; i++) {
      const bz = -2.8 - i * 4.6;
      const bx = i * 0.22; // Follows tapering gore centerline toward mainline edge
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.82, 8), bollardMat);
      bollard.position.set(bx, 0.41, bz);
      g.add(bollard);

      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.16, 8), bandMat);
      stripe.position.set(bx, 0.62, bz);
      g.add(stripe);
    }
  }

  return g;
}

// 1. NEOPASA 駿河湾沼津 (SA): 地中海リゾート風・駿河湾展望テラス＆鐘の広場・ヤシの木・海景
export function createSurugaSaComplex(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const fTex = textures.facilityTextures['suruga-sa'];

  // Suruga Bay Ocean Vista below the coastal bluff (-X)
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.18,
    metalness: 0.55,
    envMapIntensity: 0.85,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(560, 1200), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-350, -32, 0);
  group.add(ocean);

  // Coastal retaining wall & grassy bluff slope beneath the elevated terrace
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
  const terraceWall = new THREE.Mesh(new THREE.BoxGeometry(24, 4.2, 180), wallMat);
  terraceWall.position.set(-57.5, -2.0, 0);
  group.add(terraceWall);

  // Coastal terrace platform & promenade deck behind plaza (X = -46 to -66)
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xd6c7b2, roughness: 0.85 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(24, 0.4, 180), deckMat);
  deck.position.set(-57.5, 0.15, 0);
  group.add(deck);

  // Scenic ocean overlook railing along X = -68.5
  const railMat = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.7 });
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 178), railMat);
  railTop.position.set(-68.5, 1.35, 0);
  group.add(railTop);
  for (let rz = -84; rz <= 84; rz += 14) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.2, 0.22), railMat);
    post.position.set(-68.5, 0.75, rz);
    group.add(post);
  }

  // Mediterranean Stucco Terminal Building
  const facadeMat = new THREE.MeshStandardMaterial({
    map: fTex.facade,
    emissive: 0x451a03,
    emissiveMap: fTex.facade,
    emissiveIntensity: 0.35,
    roughness: 0.45,
  });
  const stuccoMat = new THREE.MeshStandardMaterial({ color: 0xe7dfd1, roughness: 0.78 });
  const terracottaMat = new THREE.MeshStandardMaterial({ color: 0xb4532a, roughness: 0.65 });

  const building = new THREE.Mesh(new THREE.BoxGeometry(12, 7.2, 88), [
    facadeMat,
    stuccoMat,
    stuccoMat,
    stuccoMat,
    stuccoMat,
    stuccoMat,
  ]);
  building.position.set(-55, 3.6, 0);
  group.add(building);

  // Pitched Terracotta Roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10.5, 3.2, 4), terracottaMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.0, 1.0, 6.2);
  roof.position.set(-55, 8.8, 0);
  group.add(roof);

  // Iconic Clock & Bell Observation Tower ("鐘の広場")
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4.4, 15.5, 4.4), stuccoMat);
  tower.position.set(-48.5, 7.75, 0);
  group.add(tower);

  const towerCap = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.8, 4), terracottaMat);
  towerCap.rotation.y = Math.PI / 4;
  towerCap.position.set(-48.5, 16.9, 0);
  group.add(towerCap);

  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 20),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfde68a, emissiveIntensity: 1.4 }),
  );
  clockFace.rotation.y = Math.PI / 2;
  clockFace.position.set(-46.25, 12.8, 0);
  group.add(clockFace);

  // Illuminated Signboard
  const signMat = new THREE.MeshStandardMaterial({
    map: fTex.sign,
    emissive: 0xffffff,
    emissiveMap: fTex.sign,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 24), [
    signMat,
    stuccoMat,
    stuccoMat,
    stuccoMat,
    signMat,
    signMat,
  ]);
  signBoard.position.set(-48.4, 9.2, 16);
  group.add(signBoard);

  // Palm trees along promenade
  for (const pz of [-58, -32, 32, 58]) {
    const palm = createPalmTree(7.4);
    palm.position.set(-47.5, 0.25, pz);
    group.add(palm);
  }

  addFuelStation(group, -37.5, -76, 0xea580c, 0x0284c7);
  addPlazaParkedVehicles(group, -41.5, -21.5, [-42, -26, -12, 8, 22, 38], [-34, -8, 18, 44]);
  addPlayerParkingBay(group, PARKING_BAY_COORDS.sa.laneOffset, PARKING_BAY_COORDS.sa.ds);
  return group;
}

// 2. NEOPASA 清水 (PA): 赤レンガ＆黒鉄骨ガレージ・名車展示ピット・二輪駐輪シェルター
export function createShimizuPaComplex(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const fTex = textures.facilityTextures['shimizu-pa'];

  // Compact PA Concrete Apron + foundation skirt behind curb (X = -33 to -46)
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(14, 3.4, 108),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 }),
  );
  apron.position.set(-40, -1.4, 0);
  group.add(apron);

  // Red-Brick & Steel Garage Building
  const facadeMat = new THREE.MeshStandardMaterial({
    map: fTex.facade,
    emissive: 0x3b1806,
    emissiveMap: fTex.facade,
    emissiveIntensity: 0.35,
    roughness: 0.45,
  });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.82 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.72 });

  const building = new THREE.Mesh(new THREE.BoxGeometry(9.5, 6.2, 52), [
    facadeMat,
    brickMat,
    steelMat,
    steelMat,
    brickMat,
    brickMat,
  ]);
  building.position.set(-40.5, 3.1, 0);
  group.add(building);

  // Exposed Black Steel Garage Truss Canopy
  const trussRoof = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.4, 56), steelMat);
  trussRoof.position.set(-38.8, 6.4, 0);
  group.add(trussRoof);

  // Glass Motorsport Showcase Bay at plaza front (with 2 bright display sports cars!)
  const bayFloor = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.25, 14),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
  );
  bayFloor.position.set(-34.6, 0.28, 12);
  group.add(bayFloor);

  const displayCar1 = createParkedVehicleMesh('sports', 0xdc2626);
  displayCar1.position.set(-34.5, 0.4, 8.5);
  displayCar1.rotation.y = 0.25;
  group.add(displayCar1);

  const displayCar2 = createParkedVehicleMesh('sports', 0x0284c7);
  displayCar2.position.set(-34.5, 0.4, 15.5);
  displayCar2.rotation.y = -0.25;
  group.add(displayCar2);

  // Covered Motorcycle Parking Shelter (二輪車駐輪スペース)
  const motoRoof = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.18, 14),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.5 }),
  );
  motoRoof.position.set(-34.5, 2.7, -22);
  group.add(motoRoof);

  const signMat = new THREE.MeshStandardMaterial({
    map: fTex.sign,
    emissive: 0xffffff,
    emissiveMap: fTex.sign,
    emissiveIntensity: 0.58,
    roughness: 0.3,
  });
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.0, 20), [
    signMat,
    steelMat,
    steelMat,
    steelMat,
    signMat,
    signMat,
  ]);
  signBoard.position.set(-35.4, 8.0, -4);
  group.add(signBoard);

  addPlazaParkedVehicles(group, -29.2, -17.8, [-28, -14, 14, 26], [-22, 4, 28]);
  addPlayerParkingBay(group, PARKING_BAY_COORDS.pa.laneOffset, PARKING_BAY_COORDS.pa.ds);
  return group;
}

// 3. NEOPASA 静岡 (SA): 静岡杉ルーバー建築・茶畑テラス＆しずおかマルシェ・給油所
export function createShizuokaSaComplex(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const fTex = textures.facilityTextures['shizuoka-sa'];

  const terracePad = new THREE.Mesh(
    new THREE.BoxGeometry(20, 3.8, 168),
    new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.88 }),
  );
  terracePad.position.set(-56, -1.56, 0);
  group.add(terracePad);

  const facadeMat = new THREE.MeshStandardMaterial({
    map: fTex.facade,
    emissive: 0x2c1b06,
    emissiveMap: fTex.facade,
    emissiveIntensity: 0.38,
    roughness: 0.42,
  });
  const cedarMat = new THREE.MeshStandardMaterial({ color: 0x854d27, roughness: 0.72 });
  const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.58 });

  const building = new THREE.Mesh(new THREE.BoxGeometry(11.5, 7.6, 86), [
    facadeMat,
    cedarMat,
    darkRoofMat,
    darkRoofMat,
    cedarMat,
    cedarMat,
  ]);
  building.position.set(-55, 3.8, 0);
  group.add(building);

  // Physical 3D Shizuoka Cedar Louver Columns along front colonnade
  for (let lz = -40; lz <= 40; lz += 5.0) {
    const louver = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7.4, 0.32), cedarMat);
    louver.position.set(-48.6, 3.7, lz);
    group.add(louver);
  }

  // Sweeping Double-Tiered Japanese Modern Gable Canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.45, 92), cedarMat);
  canopy.position.set(-52, 7.9, 0);
  canopy.rotation.z = -0.07;
  group.add(canopy);

  // Terraced Green Tea-Bush Planters (茶畑テラス) along the plaza edge
  const teaBushMat = new THREE.MeshStandardMaterial({ color: 0x2f6b29, roughness: 0.9 });
  const planterWallMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.85 });
  for (const [tz, len] of [
    [-40, 22],
    [0, 22],
    [40, 22],
  ] as const) {
    const planter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, len), planterWallMat);
    planter.position.set(-47.2, 0.35, tz);
    group.add(planter);

    const teaRow = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, len - 1, 8), teaBushMat);
    teaRow.rotation.x = Math.PI / 2;
    teaRow.position.set(-47.2, 0.95, tz);
    group.add(teaRow);
  }

  const signMat = new THREE.MeshStandardMaterial({
    map: fTex.sign,
    emissive: 0xffffff,
    emissiveMap: fTex.sign,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 24), [
    signMat,
    darkRoofMat,
    darkRoofMat,
    darkRoofMat,
    signMat,
    signMat,
  ]);
  signBoard.position.set(-48.5, 9.8, 0);
  group.add(signBoard);

  addFuelStation(group, -37.5, -76, 0xb91c1c, 0xf8fafc);
  addPlazaParkedVehicles(group, -41.5, -21.5, [-46, -28, -14, 12, 28, 44], [-36, -10, 14, 40]);
  addPlayerParkingBay(group, PARKING_BAY_COORDS.sa.laneOffset, PARKING_BAY_COORDS.sa.ds);
  return group;
}

// 4. 掛川 PA: 落ち着きある小型パーキング（和風宿場モダン休憩棟・自販機・茶垣・石灯籠）
export function createKakegawaPaComplex(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const fTex = textures.facilityTextures['kakegawa-pa'];

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(13, 3.4, 96),
    new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.88 }),
  );
  apron.position.set(-39.5, -1.4, 0);
  group.add(apron);

  const facadeMat = new THREE.MeshStandardMaterial({
    map: fTex.facade,
    emissive: 0x2e230b,
    emissiveMap: fTex.facade,
    emissiveIntensity: 0.36,
    roughness: 0.45,
  });
  const plasterMat = new THREE.MeshStandardMaterial({ color: 0xd6d3c9, roughness: 0.82 });
  const slateMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.65 });

  // Compact low-profile PA rest house
  const building = new THREE.Mesh(new THREE.BoxGeometry(8.8, 5.2, 42), [
    facadeMat,
    plasterMat,
    slateMat,
    slateMat,
    plasterMat,
    plasterMat,
  ]);
  building.position.set(-40, 2.6, 0);
  group.add(building);

  const gableRoof = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.42, 46), slateMat);
  gableRoof.position.set(-39.2, 5.35, 0);
  gableRoof.rotation.z = -0.08;
  group.add(gableRoof);

  // Trimmed Kakegawa green tea hedges + warm stone lanterns
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2d6a30, roughness: 0.9 });
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.85 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfbbf24, emissiveIntensity: 1.6 });

  for (const hz of [-28, 28]) {
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 12), hedgeMat);
    hedge.position.set(-34.2, 0.6, hz);
    group.add(hedge);

    const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.6, 0.55), lanternMat);
    post.position.set(-34.2, 0.8, hz + (hz < 0 ? 7.5 : -7.5));
    group.add(post);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.4), glowMat);
    lamp.position.set(-34.2, 1.75, hz + (hz < 0 ? 7.5 : -7.5));
    group.add(lamp);
  }

  const signMat = new THREE.MeshStandardMaterial({
    map: fTex.sign,
    emissive: 0xffffff,
    emissiveMap: fTex.sign,
    emissiveIntensity: 0.58,
    roughness: 0.3,
  });
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.8, 18), [
    signMat,
    slateMat,
    slateMat,
    slateMat,
    signMat,
    signMat,
  ]);
  signBoard.position.set(-35.2, 6.8, 0);
  group.add(signBoard);

  addPlazaParkedVehicles(group, -29.2, -17.8, [-22, -8, 10, 22], [-18, 10]);
  addPlayerParkingBay(group, PARKING_BAY_COORDS.pa.laneOffset, PARKING_BAY_COORDS.pa.ds);
  return group;
}

// 5. NEOPASA 浜松 (SA): 音楽のまち浜松・巨大ピアノ鍵盤ファサード＆音楽ドーム
export function createHamamatsuSaComplex(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const fTex = textures.facilityTextures['hamamatsu-sa'];

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(20, 3.8, 168),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 }),
  );
  apron.position.set(-56, -1.56, 0);
  group.add(apron);

  const facadeMat = new THREE.MeshStandardMaterial({
    map: fTex.facade,
    emissive: 0x1e293b,
    emissiveMap: fTex.facade,
    emissiveIntensity: 0.35,
    roughness: 0.32,
  });
  const ivoryMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.28, metalness: 0.12 });
  const ebonyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.18, metalness: 0.35 });

  const building = new THREE.Mesh(new THREE.BoxGeometry(11.5, 7.8, 88), [
    facadeMat,
    ivoryMat,
    ebonyMat,
    ebonyMat,
    ivoryMat,
    ivoryMat,
  ]);
  building.position.set(-55, 3.9, 0);
  group.add(building);

  // Physical 3D Piano Keyboard Keys across the entire facade!
  const keyCount = 24;
  for (let i = 0; i < keyCount; i++) {
    const kz = -42 + i * 3.6;
    const whiteKey = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.6, 3.2), ivoryMat);
    whiteKey.position.set(-49.1, 3.8, kz);
    group.add(whiteKey);

    const note = i % 7;
    if (note !== 2 && note !== 6) {
      const blackKey = new THREE.Mesh(new THREE.BoxGeometry(0.95, 5.1, 1.45), ebonyMat);
      blackKey.position.set(-48.7, 5.1, kz + 1.6);
      group.add(blackKey);
    }
  }

  // Musical Sound-Stage Dome Pavilion at center
  const dome = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 6.2, 3.2, 20, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.45 }),
  );
  dome.rotation.y = Math.PI / 2;
  dome.position.set(-49, 7.8, 0);
  group.add(dome);

  const glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(5.7, 0.2, 8, 24, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.8 }),
  );
  glowRing.rotation.y = Math.PI / 2;
  glowRing.position.set(-48.2, 7.8, 0);
  group.add(glowRing);

  const signMat = new THREE.MeshStandardMaterial({
    map: fTex.sign,
    emissive: 0xffffff,
    emissiveMap: fTex.sign,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 24), [
    signMat,
    ebonyMat,
    ebonyMat,
    ebonyMat,
    signMat,
    signMat,
  ]);
  signBoard.position.set(-48.2, 10.6, 0);
  group.add(signBoard);

  addFuelStation(group, -37.5, -76, 0x0284c7, 0xf97316);
  addPlazaParkedVehicles(group, -41.5, -21.5, [-42, -26, -12, 10, 26, 40], [-34, -8, 16, 42]);
  addPlayerParkingBay(group, PARKING_BAY_COORDS.sa.laneOffset, PARKING_BAY_COORDS.sa.ds);
  return group;
}

export const JCT_RAMP_LOCAL_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(-20.2, 0.02, 105),
  new THREE.Vector3(-22.0, 0.14, 80),
  new THREE.Vector3(-27.5, 1.5, 52),
  new THREE.Vector3(-33.5, 4.8, 22),
  new THREE.Vector3(-27.5, 8.6, -8),
  new THREE.Vector3(-8.0, 10.9, -26),
  new THREE.Vector3(20.0, 11.2, -37),
  new THREE.Vector3(54.0, 9.8, -50),
  new THREE.Vector3(90.0, 6.4, -68),
];

export function createJctRampCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(JCT_RAMP_LOCAL_POINTS, false, 'catmullrom', 0.5);
}

function buildExtrudedRibbonFromCurve(
  curve: THREE.CatmullRomCurve3,
  steps: number,
  halfWidth: number,
  yOffset: number,
  thickness: number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const norm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const nUp = new THREE.Vector3().crossVectors(right, tan).normalize();

    const lx = pt.x - right.x * halfWidth;
    const ly = pt.y + yOffset;
    const lz = pt.z - right.z * halfWidth;
    const rx = pt.x + right.x * halfWidth;
    const ry = pt.y + yOffset;
    const rz = pt.z + right.z * halfWidth;

    if (thickness <= 0.01) {
      // Flat top surface ribbon (asphalt or lane marking)
      pos.push(lx, ly, lz, rx, ry, rz);
      norm.push(nUp.x, nUp.y, nUp.z, nUp.x, nUp.y, nUp.z);
      uv.push(0, t * 18, 1, t * 18);
    } else {
      // 4-vert box cross-section (top-left, top-right, bottom-right, bottom-left)
      pos.push(
        lx, ly, lz,
        rx, ry, rz,
        rx, ry - thickness, rz,
        lx, ly - thickness, lz,
      );
      norm.push(0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0);
      uv.push(0, t * 18, 1, t * 18, 1, t * 18, 0, t * 18);
    }
  }

  if (thickness <= 0.01) {
    for (let i = 0; i < steps; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = (i + 1) * 2;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  } else {
    for (let i = 0; i < steps; i++) {
      const a = i * 4;
      const b = (i + 1) * 4;
      // Top
      idx.push(a, b, a + 1, a + 1, b, b + 1);
      // Right
      idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      // Bottom
      idx.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
      // Left
      idx.push(a + 3, b + 3, a, a, b + 3, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function createJctOverpass(textures?: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x808790, roughness: 0.85 });
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8 });
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: textures?.rampAsphaltTexture ?? null,
    color: textures ? 0xffffff : 0x262a31,
    roughness: 0.9,
  });

  const curve = createJctRampCurve();
  const steps = 84;

  // Concrete structural girder box deck (total width 8.8m)
  const deckGeo = buildExtrudedRibbonFromCurve(curve, steps, 4.4, -0.05, 1.15);
  group.add(new THREE.Mesh(deckGeo, concreteMat));

  // Smooth flat drivable asphalt top deck (8.0m wide, flush with y = curve.y + 0.02)
  const asphaltGeo = buildExtrudedRibbonFromCurve(curve, steps, 4.0, 0.02, 0);
  group.add(new THREE.Mesh(asphaltGeo, asphaltMat));

  // Left & Right concrete parapet barrier walls along the full elevated viaduct
  const up = new THREE.Vector3(0, 1, 0);
  const leftRailPts: THREE.Vector3[] = [];
  const rightRailPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    leftRailPts.push(pt.clone().addScaledVector(right, -4.15).add(new THREE.Vector3(0, 0.52, 0)));
    rightRailPts.push(pt.clone().addScaledVector(right, 4.15).add(new THREE.Vector3(0, 0.52, 0)));
  }
  const leftWallGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftRailPts), 48, 0.34, 4, false);
  leftWallGeo.scale(1, 1.4, 1);
  const rightWallGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rightRailPts), 48, 0.34, 4, false);
  rightWallGeo.scale(1, 1.4, 1);
  group.add(new THREE.Mesh(leftWallGeo, parapetMat));
  group.add(new THREE.Mesh(rightWallGeo, parapetMat));

  // Concrete piers supporting the JCT viaduct strictly outside mainline shoulders (X < -9.5 or X > +25.5)
  const pierGeo = new THREE.CylinderGeometry(1.05, 1.25, 12.4, 10);
  for (const [px, pz, py] of [
    [-33.5, 22, -1.6],
    [-12.5, -24, 4.2],
    [28.5, -40, 4.6],
    [66.0, -56, 2.8],
  ]) {
    const pier = new THREE.Mesh(pierGeo, concreteMat);
    pier.position.set(px, py, pz);
    group.add(pier);
  }

  // Green JCT Branch Destination Portal Arch near end of viaduct (t = 0.88)
  const portalT = 0.88;
  const portalPt = curve.getPointAt(portalT);
  const portalTan = curve.getTangentAt(portalT).normalize();
  const portalYaw = Math.atan2(-portalTan.x, -portalTan.z);
  const portalGroup = new THREE.Group();
  portalGroup.position.copy(portalPt);
  portalGroup.rotation.y = portalYaw;

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.65, roughness: 0.35 });
  const pillarGeo = new THREE.CylinderGeometry(0.18, 0.22, 6.0, 8);
  const pL = new THREE.Mesh(pillarGeo, steelMat);
  pL.position.set(-4.35, 3.0, 0);
  portalGroup.add(pL);
  const pR = new THREE.Mesh(pillarGeo, steelMat);
  pR.position.set(4.35, 3.0, 0);
  portalGroup.add(pR);

  const beam = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.36, 0.36), steelMat);
  beam.position.set(0, 5.8, 0);
  portalGroup.add(beam);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 1.9, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0x00663c,
      emissive: 0x059669,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    }),
  );
  signBoard.position.set(0, 5.65, 0.15);
  portalGroup.add(signBoard);

  group.add(portalGroup);
  return group;
}

export function createIcExitComplex(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();

  // 4-Lane Toll Gate Canopy positioned over the flared IC Toll Plaza at ds = +45 (local Z = -45), X = -35.5 (width 22m: -46.5 to -24.5)
  const tollZ = -45;
  const centerX = -35.5;

  const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.38 });
  const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(23.5, 1.5, 10.5), canopyMat);
  canopyRoof.position.set(centerX, 6.2, tollZ);
  group.add(canopyRoof);

  // Illuminated 4-Lane ETC / 一般 Overhead Sign on Front (+Z) Face
  const tollSignMat = new THREE.MeshStandardMaterial({
    map: textures.icTollSignTexture,
    emissive: 0xffffff,
    emissiveMap: textures.icTollSignTexture,
    emissiveIntensity: 0.72,
    roughness: 0.35,
  });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
  const tollSignBoard = new THREE.Mesh(new THREE.BoxGeometry(21.6, 3.0, 0.22), [
    wallMat,
    wallMat,
    wallMat,
    wallMat,
    tollSignMat, // +Z facing approaching player!
    wallMat,
  ]);
  tollSignBoard.position.set(centerX, 6.25, tollZ + 5.36);
  group.add(tollSignBoard);

  // 5 Toll Booth Islands defining 4 realistic NEXCO lanes (width 5.25m per lane)
  const boothMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.48 });
  const purpleBeaconMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0x9333ea,
    emissiveIntensity: 2.4,
  });
  const greenBeaconMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 1.8,
  });

  const islandXs = [-46.0, -40.75, -35.5, -30.25, -25.0];
  islandXs.forEach((bx, idx) => {
    const island = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.68, 12.5), curbMat);
    island.position.set(bx, 0.34, tollZ);
    group.add(island);

    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 5.4, 1.3), boothMat);
    pillar.position.set(bx, 2.7, tollZ);
    group.add(pillar);

    // Booth cabin on manned lanes (islands 0, 1)
    if (idx <= 1) {
      const booth = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.6, 3.2), boothMat);
      booth.position.set(bx, 1.5, tollZ - 0.5);
      group.add(booth);
    }

    const beacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.32, 0.42),
      idx >= 2 ? purpleBeaconMat : greenBeaconMat,
    );
    beacon.position.set(bx, 4.9, tollZ + 5.1);
    group.add(beacon);
  });

  // Raised ETC Gate Bars on the two ETC 専用 lanes
  const barMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 });
  for (const laneX of [-32.875, -27.625]) {
    const gateBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8), barMat);
    gateBar.position.set(laneX + 1.0, 2.4, tollZ - 3.6);
    gateBar.rotation.z = 0.72; // Raised open for non-stop pass
    group.add(gateBar);
  }

  return group;
}

export function createGantryStructure(
  textures: ProceduralTexturePack,
  signIndex: number,
  includeLedBoard: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x7a8694,
    metalness: 0.72,
    roughness: 0.38,
    envMapIntensity: 0.55,
  });

  const leftX = -9.1;
  const rightX = 7.85;
  const spanWidth = rightX - leftX;
  const centerX = (leftX + rightX) / 2;
  const beamY = 7.25;

  const pillarGeo = new THREE.CylinderGeometry(0.24, 0.28, beamY + 0.7, 10);
  const leftPillar = new THREE.Mesh(pillarGeo, steelMat);
  leftPillar.position.set(leftX, (beamY + 0.7) / 2, 0);
  leftPillar.castShadow = true;
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, steelMat);
  rightPillar.position.set(rightX, (beamY + 0.7) / 2, 0);
  rightPillar.castShadow = true;
  group.add(rightPillar);

  const beamGeo = new THREE.BoxGeometry(spanWidth + 0.8, 0.42, 0.38);
  const upperBeam = new THREE.Mesh(beamGeo, steelMat);
  upperBeam.position.set(centerX, beamY + 0.55, 0);
  upperBeam.castShadow = true;
  group.add(upperBeam);

  const lowerBeam = new THREE.Mesh(beamGeo, steelMat);
  lowerBeam.position.set(centerX, beamY - 0.35, 0);
  lowerBeam.castShadow = true;
  group.add(lowerBeam);

  const signTex = textures.gantrySigns[signIndex % textures.gantrySigns.length];
  const signGeo = new THREE.BoxGeometry(11.2, 4.0, 0.14);
  const signFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.4 });
  const signFaceMat = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.48,
    emissive: 0xffffff, // Multiply texture with white so Japanese text stays ultra-crisp & bright at range!
    emissiveMap: signTex,
    emissiveIntensity: 0.42,
  });
  const signBoard = new THREE.Mesh(signGeo, [
    signFrameMat,
    signFrameMat,
    signFrameMat,
    signFrameMat,
    signFaceMat,
    signFrameMat,
  ]);
  signBoard.position.set(-1.95, beamY + 0.3, 0.25);
  signBoard.castShadow = true;
  group.add(signBoard);

  const speedDiscGeo = new THREE.CylinderGeometry(1.35, 1.35, 0.08, 32);
  speedDiscGeo.rotateX(Math.PI / 2);
  const speedFaceMat = new THREE.MeshStandardMaterial({
    map: textures.speed300Sign,
    roughness: 0.45,
    emissive: 0xffffff,
    emissiveMap: textures.speed300Sign,
    emissiveIntensity: 0.35,
  });
  const speedSign = new THREE.Mesh(speedDiscGeo, [signFrameMat, speedFaceMat, signFrameMat]);
  speedSign.position.set(5.45, beamY + 0.3, 0.28);
  group.add(speedSign);

  if (includeLedBoard) {
    const ledGeo = new THREE.BoxGeometry(10.8, 1.75, 0.22);
    const ledFaceMat = new THREE.MeshStandardMaterial({
      map: textures.ledTexture,
      emissive: 0xffffff,
      emissiveMap: textures.ledTexture,
      emissiveIntensity: 1.15,
      roughness: 0.45,
    });
    const ledBoard = new THREE.Mesh(ledGeo, [
      signFrameMat,
      signFrameMat,
      signFrameMat,
      signFrameMat,
      ledFaceMat,
      signFrameMat,
    ]);
    ledBoard.position.set(centerX, beamY - 2.3, 0.25);
    group.add(ledBoard);
  }

  return group;
}

export function createStreetLamp(): { group: THREE.Group; bulbMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x828c99, metalness: 0.78, roughness: 0.34, envMapIntensity: 0.55 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 8.2, 8), poleMat);
  pole.position.y = 4.1;
  pole.castShadow = true;
  group.add(pole);

  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 8.1, 0),
    new THREE.Vector3(0.8, 8.75, 0),
    new THREE.Vector3(2.2, 8.9, 0),
  ]);
  const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 8, 0.065, 6, false), poleMat);
  group.add(arm);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, 0.34), poleMat);
  head.position.set(2.35, 8.9, 0);
  group.add(head);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d6,
    emissive: 0xffd28a,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.24), bulbMat);
  bulb.rotation.x = Math.PI / 2;
  bulb.position.set(2.35, 8.82, 0);
  group.add(bulb);

  return { group, bulbMat };
}
