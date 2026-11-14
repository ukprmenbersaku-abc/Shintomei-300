import * as THREE from 'three';
import { FacilityStyleId, RouteMilestone } from './constants';

export interface FacilityTextureSet {
  facade: THREE.CanvasTexture;
  sign: THREE.CanvasTexture;
}

export interface ProceduralTexturePack {
  roadAlbedo: THREE.CanvasTexture;
  roadRoughness: THREE.CanvasTexture;
  roadNormalTexture: THREE.CanvasTexture;
  rampAsphaltTexture: THREE.CanvasTexture;
  rampGuideTexture: THREE.CanvasTexture;
  goreChevronTexture: THREE.CanvasTexture;
  islandGrassTexture: THREE.CanvasTexture;
  saParkingTexture: THREE.CanvasTexture;
  medianTexture: THREE.CanvasTexture;
  tunnelWallTexture: THREE.CanvasTexture;
  teaTerrainTexture: THREE.CanvasTexture;
  soundBarrierTexture: THREE.CanvasTexture;
  carbonTexture: THREE.CanvasTexture;
  carbonNormalTexture: THREE.CanvasTexture;
  neopasaFacadeTexture: THREE.CanvasTexture;
  neopasaSignTexture: THREE.CanvasTexture;
  facilityTextures: Record<'suruga-sa' | 'shimizu-pa' | 'shizuoka-sa' | 'kakegawa-pa' | 'hamamatsu-sa', FacilityTextureSet>;
  icTollSignTexture: THREE.CanvasTexture;
  saExitSignTexture: THREE.CanvasTexture;
  jctRampSignTexture: THREE.CanvasTexture;
  mergeWarningSignTexture: THREE.CanvasTexture;
  goreSplitSignTexture: THREE.CanvasTexture;
  tunnelNameTexture: THREE.CanvasTexture;
  speed300Sign: THREE.CanvasTexture;
  gantryCanvases: HTMLCanvasElement[];
  gantrySigns: THREE.CanvasTexture[];
  ledCanvas: HTMLCanvasElement;
  ledTexture: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  plateWhite: THREE.CanvasTexture;
  plateYellow: THREE.CanvasTexture;
  plateGreen: THREE.CanvasTexture;
  fujiBackdrop: THREE.CanvasTexture;
  dispose: () => void;
}

function configureTexture(
  tex: THREE.CanvasTexture,
  maxAnisotropy: number,
  isColor: boolean,
  repeat = false,
): THREE.CanvasTexture {
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

function createRoadAlbedo(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#252930';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 24000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const shade = 26 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const mapX = (worldX: number) => ((worldX + 8.375) / 15.5) * w;

  // Tire wear tracks
  for (const lx of [-3.75, 0, 3.75]) {
    for (const wheelOff of [-0.85, 0.85]) {
      const px = mapX(lx + wheelOff);
      const grad = ctx.createLinearGradient(px - 24, 0, px + 24, 0);
      grad.addColorStop(0, 'rgba(12,14,18,0)');
      grad.addColorStop(0.5, 'rgba(11,13,17,0.46)');
      grad.addColorStop(1, 'rgba(12,14,18,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px - 24, 0, 48, h);
    }
  }

  // Natural highway off-white markings (never over-bright neon white)
  ctx.fillStyle = '#cfd6de';
  const leftLineX = mapX(-5.625);
  const rightLineX = mapX(5.625);
  const lineWidthPx = (0.2 / 15.5) * w;
  ctx.fillRect(leftLineX - lineWidthPx / 2, 0, lineWidthPx, h);
  ctx.fillRect(rightLineX - lineWidthPx / 2, 0, lineWidthPx, h);

  const dashH = h * 0.4;
  for (const divX of [-1.875, 1.875]) {
    const px = mapX(divX);
    ctx.fillRect(px - lineWidthPx / 2, h * 0.1, lineWidthPx, dashH);
  }

  ctx.fillStyle = 'rgba(217, 164, 26, 0.55)';
  ctx.fillRect(mapX(-8.05), 0, 5, h);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createRoadRoughness(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgb(220,220,220)';
  ctx.fillRect(0, 0, w, h);

  const mapX = (worldX: number) => ((worldX + 8.375) / 15.5) * w;
  for (const lx of [-3.75, 0, 3.75]) {
    for (const wheelOff of [-0.85, 0.85]) {
      const px = mapX(lx + wheelOff);
      const grad = ctx.createLinearGradient(px - 20, 0, px + 20, 0);
      grad.addColorStop(0, 'rgba(130,130,130,0)');
      grad.addColorStop(0.5, 'rgba(105,105,105,0.85)');
      grad.addColorStop(1, 'rgba(130,130,130,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px - 20, 0, 40, h);
    }
  }

  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const v = 150 + Math.floor(Math.random() * 100);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2, 2);
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, false, true);
}

function createRoadNormal(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  // Deterministic pseudo-random porous asphalt aggregate heightfield -> tangent-space normal
  const hMap = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const frac = n - Math.floor(n);
      // Slight tire-rut longitudinal groove smoothness
      const groove = Math.sin((x / size) * Math.PI * 12) * 0.14;
      hMap[y * size + x] = frac * 0.85 + groove;
    }
  }

  const strength = 2.1;
  for (let y = 0; y < size; y++) {
    const yPrev = (y - 1 + size) & (size - 1);
    const yNext = (y + 1) & (size - 1);
    for (let x = 0; x < size; x++) {
      const xPrev = (x - 1 + size) & (size - 1);
      const xNext = (x + 1) & (size - 1);
      const dx = (hMap[y * size + xNext] - hMap[y * size + xPrev]) * strength;
      const dy = (hMap[yNext * size + x] - hMap[yPrev * size + x]) * strength;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const nx = -dx * invLen;
      const ny = -dy * invLen;
      const nz = invLen;
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, false, true);
}

function createRampAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#262a31';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 28 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle center tire tracks along ramp
  for (const cx of [size * 0.42, size * 0.62]) {
    const grad = ctx.createLinearGradient(cx - 28, 0, cx + 28, 0);
    grad.addColorStop(0, 'rgba(12,14,18,0)');
    grad.addColorStop(0.5, 'rgba(12,14,18,0.35)');
    grad.addColorStop(1, 'rgba(12,14,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 28, 0, 56, size);
  }

  // Left outer shoulder solid white line (U = 0 side -> outer edge)
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(14, 0, 10, size);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createRampGuideTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);

  // Short white dashed diverge/merge guide line on right edge (between mainline Lane 0 & decel/accel lane)
  ctx.fillStyle = '#e2e8f0';
  for (let y = 24; y < h; y += 96) {
    ctx.fillRect(w - 24, y, 16, 48);
  }

  // Subtle white pavement directional arrow in center of accel/decel lane
  ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
  ctx.beginPath();
  ctx.moveTo(w * 0.48, 80);
  ctx.lineTo(w * 0.68, 170);
  ctx.lineTo(w * 0.56, 170);
  ctx.lineTo(w * 0.56, 360);
  ctx.lineTo(w * 0.4, 360);
  ctx.lineTo(w * 0.4, 170);
  ctx.lineTo(w * 0.28, 170);
  ctx.closePath();
  ctx.fill();

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createGoreChevronTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#22262d';
  ctx.fillRect(0, 0, w, h);

  // Bold white diagonal zebra stripes (導流帯ゼブラゾーン)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 22;
  for (let y = -w; y < h + w; y += 68) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(w - 12, y + w * 0.65);
    ctx.stroke();
  }

  // Crisp outer white border lines framing the gore wedge
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 14, h);
  ctx.fillRect(w - 14, 0, 14, h);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createIslandGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2e522d';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 55 + Math.floor(Math.random() * 48);
    ctx.fillStyle = `rgb(${Math.floor(g * 0.56)}, ${g}, ${Math.floor(g * 0.48)})`;
    ctx.fillRect(x, y, 3, 3);
  }

  // Concrete curb edges on left and right sides of the divider island
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 14, size);
  ctx.fillRect(size - 14, 0, 14, size);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createSaParkingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2c3139';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 35 + Math.floor(Math.random() * 20);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Left side: passenger car parking stalls along promenade
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  for (let y = 32; y < size; y += 64) {
    ctx.beginPath();
    ctx.moveTo(46, y);
    ctx.lineTo(158, y);
    ctx.stroke();
  }

  // Right side: angled heavy-truck parking bays
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 4;
  for (let y = 20; y < size; y += 128) {
    ctx.beginPath();
    ctx.moveTo(size - 150, y);
    ctx.lineTo(size - 24, y + 48);
    ctx.stroke();
  }

  // Green pedestrian walkway right next to terminal building
  ctx.fillStyle = 'rgba(22, 101, 52, 0.72)';
  ctx.fillRect(0, 0, 38, size);

  // Center through-lane dashed centerline
  ctx.fillStyle = '#e2e8f0';
  for (let y = 16; y < size; y += 64) {
    ctx.fillRect(size * 0.45, y, 5, 30);
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createNeopasaFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#292524';
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 90, 0, h - 20);
  grad.addColorStop(0, '#fef3c7');
  grad.addColorStop(0.5, '#f59e0b');
  grad.addColorStop(1, '#78350f');
  ctx.fillStyle = grad;
  ctx.fillRect(32, 95, w - 64, h - 125);

  ctx.fillStyle = '#1c1917';
  for (let x = 32; x <= w - 32; x += 64) {
    ctx.fillRect(x, 90, 8, h - 115);
  }
  ctx.fillRect(32, 210, w - 64, 10);

  ctx.fillStyle = '#7c4a2d';
  ctx.fillRect(0, 0, w, 92);
  ctx.fillStyle = '#9a5b37';
  for (let x = 0; x < w; x += 48) {
    ctx.fillRect(x, 0, 3, 92);
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createNeopasaSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 72px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEOPASA', w / 2, 92);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 40px "Noto Sans JP", sans-serif';
  ctx.fillText('新東名 サービスエリア · フードコート / 給油', w / 2, 182);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createFacilitySignTexture(
  maxAnisotropy: number,
  bgHex: string,
  accentHex: string,
  title: string,
  subtitle: string,
): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 66px "Chakra Petch", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, 92, w - 64);

  ctx.fillStyle = accentHex;
  ctx.font = '700 38px "Noto Sans JP", sans-serif';
  ctx.fillText(subtitle, w / 2, 182, w - 64);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createSurugaFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Mediterranean cream stucco & terracotta trim
  ctx.fillStyle = '#ece3d3';
  ctx.fillRect(0, 0, w, h);

  // Terracotta cornice band at top
  ctx.fillStyle = '#b4532a';
  ctx.fillRect(0, 0, w, 64);

  // Arched warm illuminated colonnade openings
  for (let x = 36; x < w - 60; x += 118) {
    const grad = ctx.createLinearGradient(0, 110, 0, h - 20);
    grad.addColorStop(0, '#fef3c7');
    grad.addColorStop(0.55, '#f59e0b');
    grad.addColorStop(1, '#78350f');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x + 44, 155, 44, Math.PI, 0, false);
    ctx.lineTo(x + 88, h - 18);
    ctx.lineTo(x, h - 18);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createShimizuFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Red brick & dark steel garage aesthetic
  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < h; y += 24) {
    ctx.fillRect(0, y, w, 3);
  }

  // Dark steel truss header
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, w, 84);

  // Garage pit glass bays
  for (let x = 40; x < w - 120; x += 240) {
    const grad = ctx.createLinearGradient(0, 110, 0, h - 18);
    grad.addColorStop(0, '#e0f2fe');
    grad.addColorStop(0.5, '#fbbf24');
    grad.addColorStop(1, '#451a03');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 112, 196, h - 130);
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 8;
    ctx.strokeRect(x, 112, 196, h - 130);
  }

  // Checkered motorsport accent stripe
  for (let x = 0; x < w; x += 24) {
    ctx.fillStyle = (x / 24) % 2 === 0 ? '#f8fafc' : '#0f172a';
    ctx.fillRect(x, 76, 24, 14);
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createShizuokaFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#23201d';
  ctx.fillRect(0, 0, w, h);

  // Warm interior glow
  const grad = ctx.createLinearGradient(0, 80, 0, h - 20);
  grad.addColorStop(0, '#ecfccb');
  grad.addColorStop(0.45, '#fbbf24');
  grad.addColorStop(1, '#422006');
  ctx.fillStyle = grad;
  ctx.fillRect(36, 92, w - 72, h - 116);

  // Shizuoka cedar vertical wood louvers
  for (let x = 24; x < w - 24; x += 32) {
    ctx.fillStyle = x % 64 === 0 ? '#854d27' : '#a16236';
    ctx.fillRect(x, 56, 14, h - 76);
  }

  // Green tea brand accent band
  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 0, w, 58);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createKakegawaFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Traditional Japanese plaster & dark wood trim
  ctx.fillStyle = '#d6d3c9';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#292524';
  ctx.fillRect(0, 0, w, 72);

  // Convenience & 24H illuminated glass storefront
  const grad = ctx.createLinearGradient(0, 120, 0, h - 24);
  grad.addColorStop(0, '#f0fdf4');
  grad.addColorStop(0.6, '#fde68a');
  grad.addColorStop(1, '#78350f');
  ctx.fillStyle = grad;
  ctx.fillRect(80, 118, 440, h - 140);
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 10;
  ctx.strokeRect(80, 118, 440, h - 140);

  // Vending machine bank + rest pavilion doors on right
  ctx.fillStyle = '#e2e8f0';
  for (let x = 580; x < 920; x += 72) {
    ctx.fillRect(x, 140, 56, h - 165);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x + 8, 154, 40, 90);
    ctx.fillStyle = '#e2e8f0';
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createHamamatsuFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  // Warm concert-hall glow behind glass
  const grad = ctx.createLinearGradient(0, 90, 0, h - 20);
  grad.addColorStop(0, '#e0f2fe');
  grad.addColorStop(0.55, '#fde68a');
  grad.addColorStop(1, '#475569');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 90, w, h - 110);

  // Iconic Piano Keyboard Black & White Keys Pattern!
  const keyW = 48;
  for (let i = 0; i < Math.floor(w / keyW); i++) {
    const x = i * keyW;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x, 0, keyW - 4, 150);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x + keyW - 4, 0, 4, 150);

    // Realistic 2-3 piano black key grouping!
    const note = i % 7;
    if (note !== 2 && note !== 6) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + keyW * 0.65, 0, keyW * 0.62, 235);
    }
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createTeaFieldTerrainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#29442a';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 24) {
    ctx.fillStyle = y % 48 === 0 ? 'rgba(67, 118, 53, 0.55)' : 'rgba(31, 56, 33, 0.45)';
    ctx.fillRect(0, y, size, 12);
  }

  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 55 + Math.floor(Math.random() * 55);
    ctx.fillStyle = `rgba(${Math.floor(g * 0.58)}, ${g}, ${Math.floor(g * 0.52)}, 0.45)`;
    ctx.fillRect(x, y, 4, 4);
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createSoundBarrierTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8b95a1';
  ctx.fillRect(0, 110, 256, 146);

  ctx.fillStyle = 'rgba(135, 178, 204, 0.48)';
  ctx.fillRect(0, 0, 256, 110);

  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, 12, 256);
  ctx.fillRect(128, 0, 12, 256);
  ctx.fillRect(0, 106, 256, 8);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createCarbonTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#15181d';
  ctx.fillRect(0, 0, 64, 64);

  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      ctx.fillStyle = (x + y) % 16 === 0 ? '#272c35' : '#1b1f26';
      ctx.fillRect(x, y, 6, 4);
      ctx.fillStyle = '#20252d';
      ctx.fillRect(x + 2, y + 4, 4, 4);
    }
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createCarbonNormal(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tx = (x % 8) / 8;
      const ty = (y % 8) / 8;
      const checker = ((x >> 3) + (y >> 3)) & 1;
      const nx = checker ? Math.sin(tx * Math.PI * 2) * 0.35 : 0.08;
      const ny = checker ? 0.08 : Math.sin(ty * Math.PI * 2) * 0.35;
      const nz = Math.sqrt(Math.max(0.01, 1 - nx * nx - ny * ny));
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, false, true);
}

function createMedianTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8c939a';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = 'rgba(45,50,58,0.45)';
  ctx.lineWidth = 4;
  for (let x = 0; x < 512; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  ctx.fillStyle = '#c89214';
  ctx.fillRect(0, 210, 512, 18);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createTunnelWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4a5159';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#c7cfd5';
  ctx.fillRect(0, 300, 512, 212);

  ctx.strokeStyle = 'rgba(80,90,100,0.35)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 300);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 300; y < 512; y += 35) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(24,28,34,0.3)';
  ctx.fillRect(0, 0, 14, 300);
  ctx.fillRect(256, 0, 14, 300);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, true);
}

function createSpeedLimit300Sign(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 246, 0, Math.PI * 2);
  ctx.fillStyle = '#e5e7eb';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 212, 0, Math.PI * 2);
  ctx.lineWidth = 46;
  ctx.strokeStyle = '#d91c2b';
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 175px "Chakra Petch", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('300', size / 2, size / 2 + 4);

  ctx.font = '700 26px "Noto Sans JP", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('ゲーム内特例', size / 2, size / 2 + 124);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createIcTollSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1280;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  const lanes = [
    { label: '一般', sub: 'PASS / GOAL', bg: '#047857', fg: '#d1fae5' },
    { label: 'ETC / 一般', sub: '兼用レーン', bg: '#0e7490', fg: '#cffafe' },
    { label: 'ETC 専用', sub: 'ノンストップ', bg: '#6d28d9', fg: '#fde047' },
    { label: 'ETC 専用', sub: 'ノンストップ', bg: '#6d28d9', fg: '#fde047' },
  ];

  const laneW = (w - 80) / 4;
  lanes.forEach((lane, idx) => {
    const x = 16 + idx * (laneW + 16);
    ctx.fillStyle = lane.bg;
    ctx.fillRect(x, 22, laneW, h - 44);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 5;
    ctx.strokeRect(x, 22, laneW, h - 44);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 54px "Chakra Petch", "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lane.label, x + laneW / 2, 98, laneW - 20);

    ctx.fillStyle = lane.fg;
    ctx.font = '700 32px "Noto Sans JP", sans-serif';
    ctx.fillText(lane.sub, x + laneW / 2, 180, laneW - 20);
  });

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createMergeWarningSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 72px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('合流注意 ↗', w / 2, 96);

  ctx.font = '700 36px "Noto Sans JP", sans-serif';
  ctx.fillText('加速車線で十分加速して本線へ', w / 2, 188);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createGoreSplitSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#00683d';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.fillStyle = '#fde047';
  ctx.font = '900 84px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('↙ 出口  |  本線 ↑', w / 2, 105);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px "Noto Sans JP", sans-serif';
  ctx.fillText('分岐ノーズ（ゼブラ帯進入禁止）', w / 2, 192);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createTunnelNameTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 192;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#00683d';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 68px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('新東名 トンネル   延長 480m', w / 2, h / 2);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createSaExitSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#00683d';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.fillStyle = '#0284c7';
  ctx.fillRect(36, 36, 172, 92);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.strokeRect(36, 36, 172, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 50px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('出口 ↑', 122, 82);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 58px "Noto Sans JP", sans-serif';
  ctx.fillText('本線合流（静岡・名古屋方面）', 236, 84, w - 270);

  ctx.fillStyle = '#fde047';
  ctx.font = '800 40px "Noto Sans JP", sans-serif';
  ctx.fillText('前方加速車線で十分加速して合流 ↗', 44, 190, w - 88);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createJctRampSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#00683d';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.fillStyle = '#fde047';
  ctx.font = '900 62px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('JCT 連絡高架橋   ↑', w / 2, 88);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 42px "Noto Sans JP", sans-serif';
  ctx.fillText('この先 5.0km JCT連絡自動車道コースへ接続', w / 2, 184, w - 70);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

export function updateGantrySignForJctBranch(
  canvas: HTMLCanvasElement,
  texture: THREE.CanvasTexture,
  milestone: RouteMilestone,
  remainingM: number,
): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#005d36';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  // Route shield
  ctx.fillStyle = '#004125';
  ctx.fillRect(54, 48, 200, 110);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(54, 48, 200, 110);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 64px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(milestone.routeCode, 154, 104);

  ctx.textAlign = 'left';
  ctx.font = '800 68px "Noto Sans JP", sans-serif';
  ctx.fillText(`${milestone.branchNameJa}（連絡道）`, 284, 104, w - 330);

  ctx.fillStyle = '#fde047';
  ctx.font = '800 58px "Noto Sans JP", sans-serif';
  const remKm = (Math.max(0, remainingM) / 1000).toFixed(1);
  ctx.fillText(
    remainingM <= 350
      ? `まもなく ${milestone.nameJa} 5km終点ゲート ↑`
      : `${milestone.nameJa} 連絡道 終点ゲートまで あと ${remKm} km`,
    54,
    255,
    w - 108,
  );

  ctx.fillStyle = '#d1fae5';
  ctx.font = '700 40px "Noto Sans JP", sans-serif';
  ctx.fillText('片側3車線 · 最高速度 300km/h（ゲーム内JCT延長特例）', 54, 345, w - 108);

  for (const ax of [w * 0.25, w * 0.5, w * 0.75]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(ax - 16, 405);
    ctx.lineTo(ax + 16, 405);
    ctx.lineTo(ax + 16, 470);
    ctx.lineTo(ax + 42, 470);
    ctx.lineTo(ax, 530);
    ctx.lineTo(ax - 42, 470);
    ctx.lineTo(ax - 16, 470);
    ctx.closePath();
    ctx.fill();
  }

  texture.needsUpdate = true;
}

export function updateGantrySignForMilestone(
  canvas: HTMLCanvasElement,
  texture: THREE.CanvasTexture,
  milestone: RouteMilestone,
  distanceToM: number,
): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;

  // Classic Japanese Highway Green (clean, high contrast)
  ctx.fillStyle = '#006e41';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  // Vertical divider between Branch (Left) and Mainline (Right)
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillRect(w * 0.47, 32, 6, h - 64);

  // LEFT SIDE: Branch IC / JCT / SA / PA
  const badgeColor =
    milestone.type === 'sa'
      ? '#0284c7'
      : milestone.type === 'pa'
        ? '#0f766e'
        : milestone.type === 'ic'
          ? '#b45309'
          : '#00492a';
  ctx.fillStyle = badgeColor;
  ctx.fillRect(46, 46, 148, 86);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(46, 46, 148, 86);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 54px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(milestone.routeCode, 120, 90);

  ctx.textAlign = 'left';
  ctx.font = '800 58px "Noto Sans JP", sans-serif';
  ctx.fillText(milestone.nameJa, 214, 90, w * 0.46 - 228);

  // Distance & action instruction (huge yellow text for instant far-distance readability)
  ctx.fillStyle = '#fde047';
  ctx.font = '800 46px "Noto Sans JP", sans-serif';
  const distStr =
    distanceToM <= 240
      ? milestone.type === 'ic'
        ? '↙ 出口（左へ・ゴール）'
        : milestone.type === 'sa'
          ? '↙ SA入口（減速車線へ）'
          : milestone.type === 'pa'
            ? '↙ PA入口（減速車線へ）'
            : '↙ 分岐（左へ）'
      : `あと ${Math.max(100, Math.round(distanceToM / 50) * 50)}m ↙`;
  ctx.fillText(distStr, 48, 198, w * 0.45 - 60);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 38px "Noto Sans JP", sans-serif';
  const subLabel =
    milestone.type === 'sa' || milestone.type === 'pa' ? milestone.featureJa : milestone.branchNameJa;
  ctx.fillText(subLabel, 48, 290, w * 0.45 - 60);

  // Large bold diagonal left exit arrow
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(320, 378);
  ctx.lineTo(205, 485);
  ctx.lineTo(175, 455);
  ctx.lineTo(165, 525);
  ctx.lineTo(235, 515);
  ctx.lineTo(205, 485);
  ctx.lineTo(345, 405);
  ctx.closePath();
  ctx.fill();

  // RIGHT SIDE: Mainline E1A Shin-Tomei
  const rx = w * 0.5;
  ctx.fillStyle = '#00492a';
  ctx.fillRect(rx, 46, 150, 86);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(rx, 46, 150, 86);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 54px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('E1A', rx + 75, 90);

  ctx.textAlign = 'left';
  ctx.font = '800 56px "Noto Sans JP", sans-serif';
  ctx.fillText('新東名 本線', rx + 172, 90);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = '700 36px "Noto Sans JP", sans-serif';
  ctx.fillText('現実100-120 / 特例300km/h', rx, 200, w * 0.47);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 56px "Noto Sans JP", sans-serif';
  ctx.fillText(milestone.mainAheadJa, rx, 292, w * 0.47);

  // Large downward mainline arrows
  for (const ax of [rx + 185, rx + 470]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(ax - 14, 385);
    ctx.lineTo(ax + 14, 385);
    ctx.lineTo(ax + 14, 455);
    ctx.lineTo(ax + 38, 455);
    ctx.lineTo(ax, 518);
    ctx.lineTo(ax - 38, 455);
    ctx.lineTo(ax - 14, 455);
    ctx.closePath();
    ctx.fill();
  }

  texture.needsUpdate = true;
}

export function updateLedBoardCanvas(
  canvas: HTMLCanvasElement,
  texture: THREE.CanvasTexture,
  text: string,
): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#070a0f';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 0; x < w; x += 10) {
    ctx.fillRect(x, 0, 1, h);
  }
  for (let y = 0; y < h; y += 10) {
    ctx.fillRect(0, y, w, 1);
  }

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.fillStyle = '#4ade80';
  ctx.font = '800 30px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('道路情報', 32, 42);

  ctx.fillStyle = '#fb923c';
  ctx.font = '800 52px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2 + 20, w - 64);

  texture.needsUpdate = true;
}

function createContactShadow(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.88)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.48)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createLicensePlate(
  maxAnisotropy: number,
  bgColor: string,
  textColor: string,
  region: string,
  numberStr: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 120);

  ctx.fillStyle = textColor;
  ctx.font = '700 26px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(region, 128, 36);

  ctx.font = '700 54px "Chakra Petch", sans-serif';
  ctx.fillText(numberStr, 128, 96);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

function createFujiBackdrop(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.86);
  ctx.quadraticCurveTo(cx - 320, h * 0.74, cx - 185, h * 0.48);
  ctx.quadraticCurveTo(cx - 115, h * 0.28, cx - 72, h * 0.14);
  ctx.lineTo(cx + 72, h * 0.14);
  ctx.quadraticCurveTo(cx + 115, h * 0.28, cx + 185, h * 0.48);
  ctx.quadraticCurveTo(cx + 320, h * 0.74, w, h * 0.86);
  ctx.lineTo(w, h);
  ctx.closePath();

  const mountainGrad = ctx.createLinearGradient(0, h * 0.14, 0, h);
  mountainGrad.addColorStop(0, '#3a4f70');
  mountainGrad.addColorStop(0.45, '#304462');
  mountainGrad.addColorStop(0.78, '#283b55');
  mountainGrad.addColorStop(1, '#1e3046');
  ctx.fillStyle = mountainGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 72, h * 0.14);
  ctx.lineTo(cx + 72, h * 0.14);
  ctx.lineTo(cx + 150, h * 0.37);
  ctx.lineTo(cx + 88, h * 0.32);
  ctx.lineTo(cx + 38, h * 0.4);
  ctx.lineTo(cx - 8, h * 0.33);
  ctx.lineTo(cx - 60, h * 0.41);
  ctx.lineTo(cx - 108, h * 0.32);
  ctx.lineTo(cx - 150, h * 0.37);
  ctx.closePath();

  const snowGrad = ctx.createLinearGradient(0, h * 0.14, 0, h * 0.42);
  snowGrad.addColorStop(0, '#f1f5f9');
  snowGrad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = snowGrad;
  ctx.fill();

  // Soft atmospheric horizon mist along lower foothills
  const mistGrad = ctx.createLinearGradient(0, h * 0.62, 0, h);
  mistGrad.addColorStop(0, 'rgba(148, 178, 206, 0)');
  mistGrad.addColorStop(1, 'rgba(148, 178, 206, 0.45)');
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true, false);
}

export function createProceduralTexturePack(renderer: THREE.WebGLRenderer): ProceduralTexturePack {
  const maxAniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());

  const roadAlbedo = createRoadAlbedo(maxAniso);
  const roadRoughness = createRoadRoughness(maxAniso);
  const roadNormalTexture = createRoadNormal(maxAniso);
  const rampAsphaltTexture = createRampAsphaltTexture(maxAniso);
  const rampGuideTexture = createRampGuideTexture(maxAniso);
  const goreChevronTexture = createGoreChevronTexture(maxAniso);
  const islandGrassTexture = createIslandGrassTexture(maxAniso);
  const saParkingTexture = createSaParkingTexture(maxAniso);
  saParkingTexture.repeat.set(1, 6);
  const medianTexture = createMedianTexture(maxAniso);
  const tunnelWallTexture = createTunnelWallTexture(maxAniso);
  const teaTerrainTexture = createTeaFieldTerrainTexture(maxAniso);
  teaTerrainTexture.repeat.set(3, 1);
  const soundBarrierTexture = createSoundBarrierTexture(maxAniso);
  const carbonTexture = createCarbonTexture(maxAniso);
  carbonTexture.repeat.set(4, 4);
  const carbonNormalTexture = createCarbonNormal(maxAniso);
  carbonNormalTexture.repeat.set(4, 4);
  const neopasaFacadeTexture = createNeopasaFacadeTexture(maxAniso);
  const neopasaSignTexture = createNeopasaSignTexture(maxAniso);

  const facilityTextures: Record<
    'suruga-sa' | 'shimizu-pa' | 'shizuoka-sa' | 'kakegawa-pa' | 'hamamatsu-sa',
    FacilityTextureSet
  > = {
    'suruga-sa': {
      facade: createSurugaFacadeTexture(maxAniso),
      sign: createFacilitySignTexture(
        maxAniso,
        '#0c2440',
        '#38bdf8',
        'NEOPASA 駿河湾沼津',
        '地中海リゾート・駿河湾オーシャンテラス / 給油',
      ),
    },
    'shimizu-pa': {
      facade: createShimizuFacadeTexture(maxAniso),
      sign: createFacilitySignTexture(
        maxAniso,
        '#18181b',
        '#f59e0b',
        'NEOPASA 清水 (PA)',
        'くるま旅・赤レンガ＆モータースポーツガレージ',
      ),
    },
    'shizuoka-sa': {
      facade: createShizuokaFacadeTexture(maxAniso),
      sign: createFacilitySignTexture(
        maxAniso,
        '#143321',
        '#86efac',
        'NEOPASA 静岡',
        '静岡杉ルーバー・茶畑テラス＆しずおかマルシェ',
      ),
    },
    'kakegawa-pa': {
      facade: createKakegawaFacadeTexture(maxAniso),
      sign: createFacilitySignTexture(
        maxAniso,
        '#1c241e',
        '#fde047',
        '掛川 PA (下り)',
        '茶処・和風宿場モダン休憩所（24Hコンビニ）',
      ),
    },
    'hamamatsu-sa': {
      facade: createHamamatsuFacadeTexture(maxAniso),
      sign: createFacilitySignTexture(
        maxAniso,
        '#0f172a',
        '#e2e8f0',
        'NEOPASA 浜松',
        '音楽のまち浜松・ピアノ鍵盤ファサード / 給油',
      ),
    },
  };

  const icTollSignTexture = createIcTollSignTexture(maxAniso);
  const saExitSignTexture = createSaExitSignTexture(maxAniso);
  const jctRampSignTexture = createJctRampSignTexture(maxAniso);
  const mergeWarningSignTexture = createMergeWarningSignTexture(maxAniso);
  const goreSplitSignTexture = createGoreSplitSignTexture(maxAniso);
  const tunnelNameTexture = createTunnelNameTexture(maxAniso);
  const speed300Sign = createSpeedLimit300Sign(maxAniso);

  const gantryCanvases: HTMLCanvasElement[] = [];
  const gantrySigns: THREE.CanvasTexture[] = [];
  for (let i = 0; i < 3; i++) {
    const c = document.createElement('canvas');
    c.width = 1536;
    c.height = 576;
    gantryCanvases.push(c);
    gantrySigns.push(configureTexture(new THREE.CanvasTexture(c), maxAniso, true, false));
  }

  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = 1280;
  ledCanvas.height = 200;
  const ledTexture = configureTexture(new THREE.CanvasTexture(ledCanvas), maxAniso, true, false);
  updateLedBoardCanvas(ledCanvas, ledTexture, 'この先 最高速度 300km/h（ゲーム内特例）');

  const contactShadow = createContactShadow(maxAniso);
  const plateWhite = createLicensePlate(maxAniso, '#f1f5f9', '#0f5132', '静岡 330', '30-00');
  const plateYellow = createLicensePlate(maxAniso, '#eab308', '#1e293b', '沼津 580', '86-24');
  const plateGreen = createLicensePlate(maxAniso, '#14532d', '#f1f5f9', '浜松 100', '10-48');
  const fujiBackdrop = createFujiBackdrop(maxAniso);

  return {
    roadAlbedo,
    roadRoughness,
    roadNormalTexture,
    rampAsphaltTexture,
    rampGuideTexture,
    goreChevronTexture,
    islandGrassTexture,
    saParkingTexture,
    medianTexture,
    tunnelWallTexture,
    teaTerrainTexture,
    soundBarrierTexture,
    carbonTexture,
    carbonNormalTexture,
    neopasaFacadeTexture,
    neopasaSignTexture,
    facilityTextures,
    icTollSignTexture,
    saExitSignTexture,
    jctRampSignTexture,
    mergeWarningSignTexture,
    goreSplitSignTexture,
    tunnelNameTexture,
    speed300Sign,
    gantryCanvases,
    gantrySigns,
    ledCanvas,
    ledTexture,
    contactShadow,
    plateWhite,
    plateYellow,
    plateGreen,
    fujiBackdrop,
    dispose: () => {
      roadAlbedo.dispose();
      roadRoughness.dispose();
      roadNormalTexture.dispose();
      rampAsphaltTexture.dispose();
      rampGuideTexture.dispose();
      goreChevronTexture.dispose();
      islandGrassTexture.dispose();
      saParkingTexture.dispose();
      medianTexture.dispose();
      tunnelWallTexture.dispose();
      teaTerrainTexture.dispose();
      soundBarrierTexture.dispose();
      carbonTexture.dispose();
      carbonNormalTexture.dispose();
      neopasaFacadeTexture.dispose();
      neopasaSignTexture.dispose();
      Object.values(facilityTextures).forEach((f) => {
        f.facade.dispose();
        f.sign.dispose();
      });
      icTollSignTexture.dispose();
      saExitSignTexture.dispose();
      jctRampSignTexture.dispose();
      mergeWarningSignTexture.dispose();
      goreSplitSignTexture.dispose();
      tunnelNameTexture.dispose();
      speed300Sign.dispose();
      gantrySigns.forEach((g) => g.dispose());
      ledTexture.dispose();
      contactShadow.dispose();
      plateWhite.dispose();
      plateYellow.dispose();
      plateGreen.dispose();
      fujiBackdrop.dispose();
    },
  };
}
