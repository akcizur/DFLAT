// Subtle low-poly apparitions for the DFLAT outdoor scene. They never block movement.
export function createGhosts({ THREE, scene }) {
  const bodyGeometry = new THREE.ConeGeometry(0.42, 1.12, 7, 2);
  const headGeometry = new THREE.IcosahedronGeometry(0.19, 1);
  const wispGeometry = new THREE.SphereGeometry(0.14, 6, 4);
  const eyeGeometry = new THREE.SphereGeometry(0.045, 6, 4);
  const eyesMaterial = new THREE.MeshBasicMaterial({ color: 0xb7fbff });
  const definitions = [
    { x: -4.9, z: -8.8, phase: 0.4, drift: 0.30 },
    { x: 4.9, z: -9.4, phase: 2.6, drift: 0.34 },
    { x: 0.0, z: -4.5, phase: 4.7, drift: 0.22 }
  ];
  const spirits = definitions.map((definition, index) => {
    const group = new THREE.Group();
    group.name = `DFLAT / přízrak ${index + 1}`;
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: 0xc5e1e6,
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.name = "Přízrak / tělo";
    body.position.y = 0.73;
    body.renderOrder = 2;
    group.add(body);

    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.name = "Přízrak / hlava";
    head.position.set(0, 1.36, 0.015);
    head.renderOrder = 2;
    group.add(head);

    for (const side of [-1, 1]) {
      const wisp = new THREE.Mesh(wispGeometry, bodyMaterial);
      wisp.position.set(side * 0.21, 0.17, 0);
      wisp.scale.set(1.15, 0.62, 0.82);
      wisp.renderOrder = 2;
      group.add(wisp);
      const eye = new THREE.Mesh(eyeGeometry, eyesMaterial);
      eye.position.set(side * 0.067, 1.39, 0.168);
      eye.renderOrder = 3;
      group.add(eye);
    }

    group.position.set(definition.x, -0.03, definition.z);
    group.traverse(object => {
      if (object.isMesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    scene.add(group);
    return { group, bodyMaterial, ...definition };
  });

  return {
    update(timeSeconds) {
      for (const spirit of spirits) {
        const phase = timeSeconds * 0.38 + spirit.phase;
        spirit.group.position.x = spirit.x + Math.sin(phase) * spirit.drift;
        spirit.group.position.y = -0.03 + Math.sin(timeSeconds * 1.1 + spirit.phase) * 0.10;
        spirit.group.position.z = spirit.z + Math.cos(phase * 0.8) * 0.18;
        spirit.group.rotation.y = Math.sin(phase * 0.45) * 0.13;
        spirit.bodyMaterial.opacity = 0.14 + (0.5 + 0.5 * Math.sin(timeSeconds * 1.35 + spirit.phase)) * 0.10;
      }
    }
  };
}
