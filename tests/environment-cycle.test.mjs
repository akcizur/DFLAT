import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { applyEnvironment, sampleEnvironment } from "../src/game/environment.js";

test("the clock advances through a complete day and repeats deterministically", () => {
  const start = sampleEnvironment(0);
  const midday = sampleEnvironment(50);
  const night = sampleEnvironment(170);
  const nextDay = sampleEnvironment(240);
  assert.equal(start.timeLabel, "07:00");
  assert.equal(midday.timeLabel, "12:00");
  assert.equal(night.timeLabel, "00:00");
  assert.equal(nextDay.timeLabel, "07:00");
  assert.ok(midday.daylight > start.daylight);
  assert.equal(night.daylight, 0);
  assert.equal(nextDay.daylight, start.daylight);
});

test("weather changes through clear, overcast, rain and mist with a smooth blend", () => {
  assert.equal(sampleEnvironment(0).weatherKey, "clear");
  assert.equal(sampleEnvironment(55).weatherKey, "overcast");
  assert.equal(sampleEnvironment(110).weatherKey, "rain");
  assert.equal(sampleEnvironment(165).weatherKey, "mist");
  const transitionStart = sampleEnvironment(55);
  const transitionMiddle = sampleEnvironment(59.5);
  const transitionEnd = sampleEnvironment(64);
  assert.equal(transitionStart.weatherLabel, "MĚNÍ SE");
  assert.ok(transitionMiddle.cloudiness > transitionStart.cloudiness);
  assert.ok(transitionEnd.cloudiness >= transitionMiddle.cloudiness);
  assert.ok(transitionMiddle.wind >= transitionStart.wind && transitionEnd.wind >= transitionMiddle.wind,
    "wind speed must blend with the incoming weather instead of jumping at the boundary");
  assert.equal(transitionEnd.weatherLabel, "ZATAŽENO");
});

test("lighting and fog remain finite and non-negative in every weather and daylight state", () => {
  for (let seconds = 0; seconds < 240; seconds += 3) {
    const environment = sampleEnvironment(seconds);
    for (const key of ["daylight", "precipitation", "cloudiness", "fogDensity", "ambientIntensity", "sunIntensity", "skyBrightness", "wind"]) {
      assert.ok(Number.isFinite(environment[key]), key + " must be finite at t=" + seconds);
      assert.ok(environment[key] >= 0, key + " must not be negative at t=" + seconds);
    }
  }
});

test("invalid elapsed times fall back safely to the initial conditions", () => {
  assert.deepEqual(sampleEnvironment(Number.NaN), sampleEnvironment(0));
  assert.deepEqual(sampleEnvironment(-100), sampleEnvironment(0));
});


test("applying a new time state smoothly updates sky, fog, and sun without scene churn", () => {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x858b8e, 0.0022);
  const hemisphere = new THREE.HemisphereLight(0xdce8ff, 0x625648, 1);
  const sun = new THREE.DirectionalLight(0xffe6c2, 1);
  scene.add(hemisphere, sun);
  applyEnvironment({ THREE, scene, hemisphere, sun, panorama: { mesh: null }, environment: sampleEnvironment(0) });
  const skyReference = scene.background;
  const dawnIntensity = sun.intensity;
  applyEnvironment({ THREE, scene, hemisphere, sun, panorama: { mesh: null }, environment: sampleEnvironment(50) });
  assert.equal(scene.background, skyReference, "the sky color object should be reused between frames");
  assert.ok(sun.intensity > dawnIntensity, "daylight should brighten the directional light");
  assert.ok(Number.isFinite(scene.fog.density) && scene.fog.density > 0);
  assert.ok(Number.isFinite(hemisphere.intensity) && hemisphere.intensity >= 0);
});
