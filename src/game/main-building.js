// DFLAT empty-world generator. No building, apartment, road, or architectural geometry.
export function createMainBuildingWorld({ THREE, scene }) {
  const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x77786d });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), groundMaterial);
  ground.name = "Empty world ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.frustumCulled = false;
  scene.add(ground);

  return {
    colliders: [],
    interactables: [],
    meshesToAnimate: [],
    doorAnimations: [],
    meshes: [ground],
    navigation: { floorHeight: 0, floors: 0 },
    getCoordinateData: () => ({ schemaVersion: "1.0", units: "metres", objects: [], anchors: [] }),
    exportCoordinateCSV: () => "record_type,id,name,x,y,z"
  };
}
