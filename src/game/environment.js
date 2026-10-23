const DAY_LENGTH_SECONDS = 240;
const WEATHER_HOLD_SECONDS = 55;
const WEATHER_BLEND_SECONDS = 9;

const WEATHER = Object.freeze([
  { key: "clear", label: "JASNO", cloud: 0.05, rain: 0, fog: 0.0016, ambient: 1.12, sun: 1.55 },
  { key: "overcast", label: "ZATAŽENO", cloud: 0.88, rain: 0.02, fog: 0.0038, ambient: 0.90, sun: 0.68 },
  { key: "rain", label: "DÉŠŤ", cloud: 1, rain: 0.92, fog: 0.0068, ambient: 0.72, sun: 0.34 },
  { key: "mist", label: "MLHA", cloud: 0.72, rain: 0.04, fog: 0.012, ambient: 0.78, sun: 0.42 }
]);

const clamp01 = value => Math.max(0, Math.min(1, value));
const smoothstep = value => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

let scratchThree = null;
let colors = null;

function getColorScratch(THREE) {
  if (scratchThree === THREE && colors) return colors;
  scratchThree = THREE;
  colors = {
    daySky: new THREE.Color(0x858b8e),
    nightSky: new THREE.Color(0x252b37),
    duskSky: new THREE.Color(0xc08c69),
    overcastSky: new THREE.Color(0x727b82),
    white: new THREE.Color(0xffffff),
    hemisphereDay: new THREE.Color(0xdce8ff),
    hemisphereNight: new THREE.Color(0x7b879b),
    groundDay: new THREE.Color(0x625648),
    groundNight: new THREE.Color(0x18202b),
    sunBase: new THREE.Color(0x6379a6),
    sunWarm: new THREE.Color(0xffc18d),
    sunDay: new THREE.Color(0xffe6c2),
    sky: new THREE.Color(0x858b8e),
    sun: new THREE.Color(0xffffff)
  };
  return colors;
}

export function sampleEnvironment(elapsedSeconds) {
  const elapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  const timeHours = (7 + elapsed * (24 / DAY_LENGTH_SECONDS)) % 24;
  const solarAngle = ((timeHours - 6) / 12) * Math.PI;
  const daylight = clamp01(Math.sin(solarAngle));
  const weatherStep = Math.floor(elapsed / WEATHER_HOLD_SECONDS);
  const current = WEATHER[weatherStep % WEATHER.length];
  const previous = WEATHER[(weatherStep + WEATHER.length - 1) % WEATHER.length];
  const transition = weatherStep === 0 ? 1 : smoothstep((elapsed % WEATHER_HOLD_SECONDS) / WEATHER_BLEND_SECONDS);
  const weather = {};
  for (const key of ["cloud", "rain", "fog", "ambient", "sun"]) {
    weather[key] = mix(previous[key], current[key], transition);
  }

  const weatherLabel = transition < 0.999 ? "MĚNÍ SE" : current.label;
  const totalMinutes = Math.floor(timeHours * 60);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return {
    elapsedSeconds: elapsed,
    timeHours,
    timeLabel: String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0"),
    daylight,
    solarAngle,
    weatherKey: current.key,
    weatherLabel,
    weatherTransition: transition,
    cloudiness: weather.cloud,
    precipitation: weather.rain,
    fogDensity: mix(0.0022, weather.fog, 0.3 + 0.7 * (1 - daylight)),
    ambientIntensity: mix(0.16, weather.ambient, daylight),
    sunIntensity: mix(0.07, weather.sun, Math.pow(daylight, 0.72)),
    skyBrightness: mix(0.20, 1 - weather.cloud * 0.28, daylight),
    wind: current.key === "rain" ? 1.1 : current.key === "mist" ? 0.25 : 0.45
  };
}

export function applyEnvironment({ THREE, scene, hemisphere, sun, panorama, environment }) {
  const c = getColorScratch(THREE);
  const daylight = environment.daylight;
  const horizonWarmth = Math.max(0, 1 - Math.abs(environment.timeHours - 7) / 2) * 0.65 +
    Math.max(0, 1 - Math.abs(environment.timeHours - 18) / 2) * 0.75;

  c.sky.copy(c.nightSky).lerp(c.daySky, Math.pow(daylight, 0.72));
  c.sky.lerp(c.duskSky, horizonWarmth * (1 - environment.cloudiness) * 0.55);
  c.sky.lerp(c.overcastSky, environment.cloudiness * 0.48);
  if (scene.background !== c.sky) scene.background = c.sky;

  if (scene.fog?.color) {
    scene.fog.color.copy(c.sky);
    scene.fog.density = environment.fogDensity;
  }

  hemisphere.intensity = environment.ambientIntensity;
  hemisphere.color.copy(c.hemisphereDay).lerp(c.hemisphereNight, 1 - daylight);
  hemisphere.groundColor.copy(c.groundDay).lerp(c.groundNight, 1 - daylight);

  const daylightFactor = Math.pow(daylight, 0.5);
  c.sun.copy(c.sunBase)
    .lerp(c.sunWarm, horizonWarmth * (1 - environment.cloudiness))
    .lerp(c.sunDay, daylightFactor);
  sun.color.copy(c.sun);
  sun.intensity = environment.sunIntensity;
  sun.position.set(-Math.cos(environment.solarAngle) * 18,
    Math.max(0.3, Math.sin(environment.solarAngle)) * 20, 8);

  const skyMaterial = panorama?.mesh?.material;
  if (skyMaterial?.color) {
    const multiplier = mix(0.24, 1, environment.skyBrightness);
    skyMaterial.color.copy(c.sky).lerp(c.white, daylight * 0.45);
    skyMaterial.color.multiplyScalar(multiplier);
  }
}
