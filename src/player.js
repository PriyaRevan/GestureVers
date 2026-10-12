import * as THREE from "three";

export const RIDER_AVATARS = [
  {
    id: "endurance",
    name: "Endurance Racer",
    description: "Road-ready, restrained touring kit.",
    jacket: 0x263844,
    pants: 0x17232b,
    helmet: 0xc5c9c8,
    posture: 0.02,
  },
  {
    id: "track",
    name: "Track Racer",
    description: "A tighter race crouch with darker kit.",
    jacket: 0x34373a,
    pants: 0x111719,
    helmet: 0x252d32,
    posture: -0.12,
  },
];

export const RIDER_COSMETICS = [
  { id: "jacket-carbon", category: "Jacket", name: "Carbon Textile", price: 0, color: 0x263844, slot: "jacket" },
  { id: "jacket-oxblood", category: "Jacket", name: "Oxblood Leather", price: 80, color: 0x662f36, slot: "jacket" },
  { id: "jacket-sand", category: "Jacket", name: "Sandstone Touring", price: 120, color: 0x8c806b, slot: "jacket" },
  { id: "suit-graphite", category: "Racing suit", name: "Graphite One-Piece", price: 0, color: 0x34373a, pants: 0x111719, slot: "outfit" },
  { id: "suit-race-red", category: "Racing suit", name: "Race Red One-Piece", price: 180, color: 0x842d32, pants: 0x202126, slot: "outfit" },
  { id: "helmet-ceramic", category: "Helmet", name: "Ceramic Full-Face", price: 0, color: 0xc5c9c8, slot: "helmet" },
  { id: "helmet-white", category: "Helmet", name: "Arctic White", price: 65, color: 0xe4e3dc, slot: "helmet" },
  { id: "helmet-amber", category: "Helmet", name: "Amber Visor Shell", price: 105, color: 0xa66c32, slot: "helmet" },
  { id: "livery-teal", category: "Bike livery", name: "Midnight Teal", price: 0, color: 0x087f9e, emissive: 0x053343, slot: "livery" },
  { id: "livery-burgundy", category: "Bike livery", name: "Burgundy Racing", price: 150, color: 0x7d2937, emissive: 0x361018, slot: "livery" },
];

export function createRunner() {
  const root = new THREE.Group();
  root.name = "NightRunBike";

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x17232b,
    metalness: 0.8,
    roughness: 0.28,
  });
  const bikeMaterial = new THREE.MeshStandardMaterial({
    color: 0x087f9e,
    metalness: 0.68,
    roughness: 0.24,
    emissive: 0x053343,
    emissiveIntensity: 0.35,
  });
  const rubberMaterial = new THREE.MeshStandardMaterial({ color: 0x090d10, roughness: 0.88 });
  const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x8ca5ae, metalness: 0.86, roughness: 0.22 });
  const riderMaterial = new THREE.MeshStandardMaterial({
    color: 0x253b4b,
    metalness: 0.25,
    roughness: 0.58,
  });
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: 0x17232b, roughness: 0.8 });
  const helmetMaterial = new THREE.MeshStandardMaterial({
    color: 0x263b48,
    metalness: 0.72,
    roughness: 0.22,
  });
  const visorMaterial = new THREE.MeshStandardMaterial({
    color: 0x08131b,
    metalness: 0.84,
    roughness: 0.12,
    emissive: 0x073b49,
    emissiveIntensity: 0.48,
  });
  const tailLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff294c,
    emissive: 0xff183c,
    emissiveIntensity: 3,
    roughness: 0.2,
  });

  function addMesh(parent, geometry, material, position, scale) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addBar(parent, start, end, radius, material) {
    const from = new THREE.Vector3(...start);
    const to = new THREE.Vector3(...end);
    const direction = new THREE.Vector3().subVectors(to, from);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), 8),
      material,
    );
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const wheels = [];
  let riderPosture = 0;
  for (const z of [-0.72, 0.64]) {
    const wheel = new THREE.Group();
    wheel.position.set(0, 0.34, z);
    wheel.rotation.y = Math.PI / 2;
    root.add(wheel);
    addMesh(wheel, new THREE.TorusGeometry(0.31, 0.07, 10, 24), rubberMaterial, [0, 0, 0]);
    addMesh(wheel, new THREE.CylinderGeometry(0.12, 0.12, 0.11, 16), metalMaterial, [0, 0, 0]);
    addMesh(wheel, new THREE.TorusGeometry(0.23, 0.018, 6, 20), metalMaterial, [0, 0, 0]);
    wheels.push(wheel);
  }

  addBar(root, [0, 0.43, 0.57], [0, 0.62, -0.47], 0.055, frameMaterial);
  addBar(root, [0, 0.39, 0.57], [0.25, 0.69, -0.36], 0.035, frameMaterial);
  addBar(root, [0, 0.39, 0.57], [-0.25, 0.69, -0.36], 0.035, frameMaterial);
  addBar(root, [0, 0.34, -0.72], [0, 0.78, -0.39], 0.035, metalMaterial);

  const tank = addMesh(
    root,
    new THREE.SphereGeometry(0.34, 18, 12),
    bikeMaterial,
    [0, 0.8, -0.1],
    [0.72, 0.7, 1.15],
  );
  addMesh(root, new THREE.BoxGeometry(0.36, 0.09, 0.49), rubberMaterial, [0, 0.73, 0.38]);
  addMesh(root, new THREE.CylinderGeometry(0.055, 0.075, 0.52, 10), metalMaterial, [0.18, 0.27, 0.06]);
  addMesh(root, new THREE.BoxGeometry(0.15, 0.11, 0.12), tailLightMaterial, [0, 0.84, 0.74]);
  addMesh(root, new THREE.BoxGeometry(0.12, 0.08, 0.15), metalMaterial, [0, 1.08, -0.59]);
  addBar(root, [-0.43, 0.95, -0.48], [0.43, 0.95, -0.48], 0.035, metalMaterial);
  for (const side of [-1, 1]) {
    addMesh(root, new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8), rubberMaterial, [side * 0.48, 0.95, -0.48]);
  }

  const rider = new THREE.Group();
  rider.position.set(0, 0.98, 0.11);
  root.add(rider);
  const riderTorso = addMesh(rider, new THREE.CapsuleGeometry(0.2, 0.38, 4, 10), riderMaterial, [0, 0.31, 0.14], [1.2, 1, 0.72]);
  addMesh(rider, new THREE.SphereGeometry(0.23, 16, 12), helmetMaterial, [0, 0.78, -0.08], [0.88, 1.04, 0.9]);
  addMesh(rider, new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0.2, 1.1), visorMaterial, [0, 0.79, -0.19], [0.96, 0.72, 0.72]);
  for (const side of [-1, 1]) {
    addBar(rider, [side * 0.14, 0.29, 0.05], [side * 0.44, 0.02, -0.44], 0.09, riderMaterial);
    addMesh(rider, new THREE.SphereGeometry(0.1, 10, 8), frameMaterial, [side * 0.44, 0.01, -0.45]);
    addBar(rider, [side * 0.13, 0.08, 0.18], [side * 0.2, -0.38, 0.48], 0.09, pantsMaterial);
    addMesh(rider, new THREE.BoxGeometry(0.17, 0.1, 0.28), rubberMaterial, [side * 0.2, -0.42, 0.54]);
  }

  return {
    group: root,
    update(time, steering = 0, delta = 1 / 60) {
      wheels.forEach((wheel) => { wheel.rotation.x = time * 5.5; });
      rider.position.y = 0.98 + Math.sin(time * 9) * 0.012;
      rider.rotation.x = riderPosture;
      riderTorso.rotation.x = -0.08;
      tank.rotation.z = Math.sin(time * 4) * 0.008;
      const lean = -steering * 0.22;
      root.rotation.z = THREE.MathUtils.damp(root.rotation.z, lean, 9, delta);
      rider.rotation.z = THREE.MathUtils.damp(rider.rotation.z, lean * 0.45, 8, delta);
    },
    setAvatar(avatarId) {
      const avatar = RIDER_AVATARS.find((candidate) => candidate.id === avatarId);
      if (!avatar) throw new Error(`Unknown rider avatar: ${avatarId}`);
      riderMaterial.color.setHex(avatar.jacket);
      pantsMaterial.color.setHex(avatar.pants);
      helmetMaterial.color.setHex(avatar.helmet);
      riderPosture = avatar.posture;
    },
    setCosmetics(selection) {
      const jacket = RIDER_COSMETICS.find((item) => item.id === selection.jacket && item.slot === "jacket");
      const outfit = RIDER_COSMETICS.find((item) => item.id === selection.outfit && item.slot === "outfit");
      const helmet = RIDER_COSMETICS.find((item) => item.id === selection.helmet && item.slot === "helmet");
      const livery = RIDER_COSMETICS.find((item) => item.id === selection.livery && item.slot === "livery");
      if (!jacket || !outfit || !helmet || !livery) {
        throw new Error("Cannot equip an unknown rider cosmetic.");
      }
      riderMaterial.color.setHex(jacket.color);
      pantsMaterial.color.setHex(outfit.pants);
      helmetMaterial.color.setHex(helmet.color);
      bikeMaterial.color.setHex(livery.color);
      bikeMaterial.emissive.setHex(livery.emissive);
    },
  };
}
