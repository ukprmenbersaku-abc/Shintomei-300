import { ActiveWeather, LiveWeatherInfo } from '../types/game';

// Shin-Tomei Expressway (Suruga Bay Numazu SA / Mt. Fuji foothills) coordinates
const SHINTOMEI_LAT = 35.098;
const SHINTOMEI_LON = 138.862;

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    is_day?: number;
    precipitation?: number;
    rain?: number;
    weather_code?: number;
    cloud_cover?: number;
    visibility?: number;
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
  };
}

function parseIsoTimeToMinutesOfDay(iso?: string): number | null {
  if (!iso) return null;
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function describeWmoWeatherJa(code: number): string {
  if (code === 0) return '快晴';
  if (code === 1) return '晴れ';
  if (code === 2) return '一部曇り';
  if (code === 3) return '曇り';
  if (code === 45 || code === 48) return '霧・濃霧';
  if (code === 51 || code === 53 || code === 55) return '霧雨';
  if (code === 56 || code === 57) return '着氷性霧雨';
  if (code === 61) return '弱い雨';
  if (code === 63) return '雨';
  if (code === 65) return '強い雨';
  if (code === 66 || code === 67) return '冷たい雨';
  if (code === 71 || code === 73 || code === 75 || code === 77) return '雪';
  if (code === 80 || code === 81 || code === 82) return 'にわか雨';
  if (code === 85 || code === 86) return 'にわか雪';
  if (code === 95 || code === 96 || code === 99) return '雷雨';
  return '晴れ';
}

function mapOpenMeteoToActiveWeather(data: OpenMeteoResponse): {
  mappedWeather: ActiveWeather;
  weatherLabelJa: string;
  temperatureC: number;
} {
  const cur = data.current;
  const code = cur?.weather_code ?? 0;
  const precip = cur?.precipitation ?? 0;
  const rain = cur?.rain ?? 0;
  const visibility = cur?.visibility ?? 24000;
  const isDay = cur?.is_day ?? 1;
  const temp = cur?.temperature_2m ?? 18;
  const label = describeWmoWeatherJa(code);

  const isRainCode =
    (code >= 51 && code <= 67) ||
    (code >= 71 && code <= 77) ||
    (code >= 80 && code <= 86) ||
    (code >= 95 && code <= 99);

  if (precip > 0.15 || rain > 0.1 || isRainCode) {
    return { mappedWeather: ActiveWeather.Rain, weatherLabelJa: label, temperatureC: temp };
  }

  if (code === 45 || code === 48 || visibility < 2200) {
    return { mappedWeather: ActiveWeather.Fog, weatherLabelJa: label, temperatureC: temp };
  }

  // Check sunrise / sunset golden-hour window (±45 minutes)
  const curMin = parseIsoTimeToMinutesOfDay(cur?.time);
  const sunriseMin = parseIsoTimeToMinutesOfDay(data.daily?.sunrise?.[0]);
  const sunsetMin = parseIsoTimeToMinutesOfDay(data.daily?.sunset?.[0]);

  if (curMin !== null) {
    if (
      (sunriseMin !== null && Math.abs(curMin - sunriseMin) <= 45) ||
      (sunsetMin !== null && Math.abs(curMin - sunsetMin) <= 45)
    ) {
      return {
        mappedWeather: ActiveWeather.Sunset,
        weatherLabelJa: `${label}（朝夕）`,
        temperatureC: temp,
      };
    }
  }

  if (isDay === 0) {
    return { mappedWeather: ActiveWeather.Night, weatherLabelJa: `${label}（夜）`, temperatureC: temp };
  }

  return { mappedWeather: ActiveWeather.Clear, weatherLabelJa: label, temperatureC: temp };
}

function buildClockFallback(): LiveWeatherInfo {
  const hour = new Date().getHours();
  let mappedWeather = ActiveWeather.Clear;
  let weatherLabelJa = '現地時刻ベース（日中）';
  if (hour >= 19 || hour < 5) {
    mappedWeather = ActiveWeather.Night;
    weatherLabelJa = '現地時刻ベース（夜間）';
  } else if (hour === 5 || hour === 6 || hour === 16 || hour === 17 || hour === 18) {
    mappedWeather = ActiveWeather.Sunset;
    weatherLabelJa = '現地時刻ベース（朝夕）';
  }
  return {
    locationLabel: 'オフライン推定（現地時刻）',
    weatherLabelJa,
    temperatureC: 18,
    mappedWeather,
    source: 'fallback',
    updatedAt: Date.now(),
  };
}

function getCurrentPositionOptional(timeoutMs = 4500): Promise<{ lat: number; lon: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 180_000,
      },
    );
  });
}

export async function fetchRealWeather(preferGeolocation = false): Promise<LiveWeatherInfo> {
  let lat = SHINTOMEI_LAT;
  let lon = SHINTOMEI_LON;
  let source: 'geolocation' | 'shintomei' = 'shintomei';
  let locationLabel = '新東名（駿河湾沼津付近）';

  if (preferGeolocation) {
    const geo = await getCurrentPositionOptional(4500);
    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
      source = 'geolocation';
      locationLabel = '現在地（GPS連動）';
    }
  }

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=temperature_2m,is_day,precipitation,rain,weather_code,cloud_cover,visibility` +
    `&daily=sunrise,sunset&timezone=auto&forecast_days=1`;

  const controller = new AbortController();
  const abortTimer = window.setTimeout(() => controller.abort(), 5500);

  try {
    const res = await fetch(url, { signal: controller.signal });
    window.clearTimeout(abortTimer);
    if (!res.ok) {
      return buildClockFallback();
    }
    const data = (await res.json()) as OpenMeteoResponse;
    const mapped = mapOpenMeteoToActiveWeather(data);
    return {
      locationLabel,
      weatherLabelJa: mapped.weatherLabelJa,
      temperatureC: mapped.temperatureC,
      mappedWeather: mapped.mappedWeather,
      source,
      updatedAt: Date.now(),
    };
  } catch {
    window.clearTimeout(abortTimer);
    return buildClockFallback();
  }
}
