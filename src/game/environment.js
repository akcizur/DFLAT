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

  // During a front's arrival, make that change explicit instead of reporting
  // the new weather while the visible scene is still blending to it.
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
  const { daylight, solarAngle } = environment;
  const daySky = new THREE.Color(0x858b8e);
  const nightSky = new THREE.Color(0x252b37);
  const duskSky = new THREE.Color(0xc08c69);
  const sky = nightSky.clone().lerp(daySky, Math.pow(daylight, 0.72));
  const horizonWarmth = Math.max(0, 1 - Math.abs(environment.timeHours - 7) / 2) * 0.65 +
    Math.max(0, 1 - Math.abs(environment.timeHours - 18) / 2) * 0.75;
  sky.lerp(duskSky, horizonWarmth * (1 - environment.cloudiness) * 0.55);
  sky.lerp(new THREE.Color(0x727b82), environment.cloudiness * 0.48);
  scene.background = sky;

  if (scene.fog?.color) {
    scene.fog.color.copy(sky);
    scene.fog.density = environment.fogDensity;
  }

  hemisphere.intensity = environment.ambientIntensity;
  hemisphere.color.set(0xdce8ff).lerp(new THREE.Color(0x7b879b), 1 - daylight);
  hemisphere.groundColor.set(0x625648).lerp(new THREE.Color(0x18202b), 1 - daylight);

  const daylightFactor = Math.pow(daylight, 0.5);
  const sunColor = new THREE.Color(0x6379a6)
    .lerp(new THREE.Color(0xffc18d), horizonWarmth * (1 - environment.cloudiness))
    .lerp(new THREE.Color(0xffe6c2), daylightFactor);
  sun.color.copy(sunColor);
  sun.intensity = environment.sunIntensity;
  sun.position.set(-Math.cos(solarAngle) * 18, Math.max(0.3, Math.sin(solarAngle)) * 20, 8);

  const skyMaterial = panorama?.mesh?.material;
  if (skyMaterial?.color) {
    const multiplier = mix(0.24, 1, environment.skyBrightness);
    skyMaterial.color.copy(sky).lerp(new THREE.Color(0xffffff), daylight * 0.45);
    skyMaterial.color.multiplyScalar(multiplier);
    skyMaterial.needsUpdate = true;
  }
}
