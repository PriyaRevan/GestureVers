import * as THREE from "three";

const CITY_LENGTH = 1800;
const ROAD_CENTER_Z = 13 - CITY_LENGTH / 2;
const random = (() => {
  let seed = 7319;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
})();

function makeAsphaltTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the road surface texture.");

  const image = context.createImageData(size, size);
  for (let index = 0; index < image.data.length; index += 4) {
    const value = 31 + Math.floor(random() * 20);
    image.data[index] = value;
    image.data[index + 1] = value + 2;
    image.data[index + 2] = value + 4;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 18);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addBox(parent, geometry, material, position, receiveShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
}

function addBuildings(scene) {
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x202a30, metalness: 0.52, roughness: 0.72 }),
    new THREE.MeshStandardMaterial({ color: 0x263138, metalness: 0.42, roughness: 0.68 }),
    new THREE.MeshStandardMaterial({ color: 0x182329, metalness: 0.62, roughness: 0.58 }),
  ];
  const buildingRecords = [];
  const windowRecords = [];
  const windowGeometry = new THREE.BoxGeometry(0.035, 0.5, 0.3);
  const windowMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0xd5a870,
      emissive: 0x7a431b,
      emissiveIntensity: 0.72,
      roughness: 0.38,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x88d6dc,
      emissive: 0x17636a,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x25343b,
      metalness: 0.32,
      roughness: 0.52,
    }),
  ];

  for (const side of [-1, 1]) {
    for (let index = 0; index < 230; index += 1) {
      const z = -7 - index * 4.7;
      const width = 3.3 + random() * 3.5;
      const depth = 3.3 + random() * 3.7;
      const height = 8 + random() * 18 + (index < 5 ? 5 : 0);
      const x = side * (10.5 + random() * 3.5);
      buildingRecords.push({ position: [x, height / 2, z], scale: [width, height, depth], material: Math.floor(random() * buildingMaterials.length) });

      const windowRows = Math.floor(height / 1.25);
      const windowColumns = Math.max(2, Math.floor(depth / 0.68));
      for (let row = 0; row < windowRows; row += 1) {
        for (let column = 0; column < windowColumns; column += 1) {
          if (random() > 0.68) continue;
          const windowZ = z - depth / 2 + 0.48 + column * ((depth - 0.7) / Math.max(1, windowColumns - 1));
          const windowY = 1.15 + row * 1.2;
          const isLit = random() > 0.62;
          windowRecords.push({
            position: [x - side * (width / 2 + 0.023), windowY, windowZ],
            material: isLit ? (random() > 0.45 ? 0 : 1) : 2,
          });
        }
      }

      if (index % 3 === 0) {
        const crown = addBox(
          scene,
          new THREE.BoxGeometry(width * 0.76, 0.12, 0.16),
          buildingMaterials[1],
          [x, height + 0.08, z],
        );
        crown.castShadow = true;
      }
    }
  }

  buildingMaterials.forEach((material, materialIndex) => {
    const records = buildingRecords.filter((record) => record.material === materialIndex);
    const instances = new THREE.InstancedMesh(buildingGeometry, material, records.length);
    const matrix = new THREE.Object3D();
    records.forEach((record, index) => {
      matrix.position.set(...record.position);
      matrix.scale.set(...record.scale);
      matrix.updateMatrix();
      instances.setMatrixAt(index, matrix.matrix);
    });
    instances.castShadow = true;
    instances.receiveShadow = true;
    scene.add(instances);
  });

  windowMaterials.forEach((material, materialIndex) => {
    const records = windowRecords.filter((record) => record.material === materialIndex);
    const instances = new THREE.InstancedMesh(windowGeometry, material, records.length);
    const matrix = new THREE.Object3D();
    records.forEach((record, index) => {
      matrix.position.set(...record.position);
      matrix.updateMatrix();
      instances.setMatrixAt(index, matrix.matrix);
    });
    instances.receiveShadow = true;
    scene.add(instances);
  });

  const skylineMaterial = new THREE.MeshStandardMaterial({ color: 0x10191f, roughness: 0.94 });
  for (let index = 0; index < 28; index += 1) {
    const height = 15 + random() * 34;
    const width = 4 + random() * 8;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 7 + random() * 8),
      skylineMaterial,
    );
    mesh.position.set((random() - 0.5) * 100, height / 2 - 1, -82 - random() * 45);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function addStreetLights(scene) {
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x29373c,
    metalness: 0.76,
    roughness: 0.38,
  });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0x9bddd7,
    emissive: 0x3b9b96,
    emissiveIntensity: 2.1,
    roughness: 0.26,
  });

  for (const side of [-1, 1]) {
    for (let index = 0; index < 78; index += 1) {
      const z = 4 - index * 18;
      const x = side * 7.35;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 5.3, 8), poleMaterial);
      pole.position.set(x, 2.65, z);
      pole.castShadow = true;
      scene.add(pole);
      addBox(scene, new THREE.BoxGeometry(0.8, 0.08, 0.11), poleMaterial, [x - side * 0.31, 5.22, z]);
      addBox(scene, new THREE.BoxGeometry(0.32, 0.045, 0.18), lampMaterial, [x - side * 0.56, 5.16, z]);

      if (index % 4 === 0) {
        const glow = new THREE.PointLight(0x72cdc5, 2.8, 11, 2);
        glow.position.set(x - side * 0.55, 5, z);
        scene.add(glow);
      }
    }
  }
}

function addRoad(scene) {
  const asphalt = new THREE.MeshStandardMaterial({
    map: makeAsphaltTexture(),
    bumpMap: makeAsphaltTexture(),
    bumpScale: 0.055,
    color: 0x788184,
    metalness: 0.22,
    roughness: 0.31,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(13, CITY_LENGTH), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.025, ROAD_CENTER_Z);
  road.receiveShadow = true;
  scene.add(road);

  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: 0x252f33,
    metalness: 0.3,
    roughness: 0.56,
  });
  const curbMaterial = new THREE.MeshStandardMaterial({
    color: 0x596467,
    metalness: 0.45,
    roughness: 0.4,
  });
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: 0xb7c4bf,
    emissive: 0x253533,
    emissiveIntensity: 0.2,
    roughness: 0.55,
  });
  const amberMaterial = new THREE.MeshStandardMaterial({
    color: 0xb98b54,
    emissive: 0x39200d,
    emissiveIntensity: 0.35,
    roughness: 0.5,
  });

  for (const side of [-1, 1]) {
    addBox(scene, new THREE.BoxGeometry(2.5, 0.22, CITY_LENGTH), sidewalkMaterial, [side * 7.65, 0.05, ROAD_CENTER_Z]);
    addBox(scene, new THREE.BoxGeometry(0.16, 0.25, CITY_LENGTH), curbMaterial, [side * 6.58, 0.06, ROAD_CENTER_Z]);
    addBox(scene, new THREE.BoxGeometry(0.09, 0.008, CITY_LENGTH), amberMaterial, [side * 5.8, -0.007, ROAD_CENTER_Z], false);
    addBox(scene, new THREE.BoxGeometry(0.075, 0.009, CITY_LENGTH), lineMaterial, [side * 6.15, -0.006, ROAD_CENTER_Z], false);
  }

  for (const x of [-2, 2]) {
    for (let index = 0; index < 180; index += 1) {
      addBox(
        scene,
        new THREE.BoxGeometry(0.045, 0.009, 3.3),
        lineMaterial,
        [x, -0.007, 3 - index * 9.8],
        false,
      );
    }
  }

  for (const x of [-1.84, 1.84]) {
    addBox(scene, new THREE.BoxGeometry(0.045, 0.012, 2.8), amberMaterial, [x, -0.004, -9], false);
  }
}

function addStreetDetails(scene) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x39474b, metalness: 0.72, roughness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x10191d, metalness: 0.34, roughness: 0.7 });
  const cyan = new THREE.MeshStandardMaterial({
    color: 0x93e7e6,
    emissive: 0x228f91,
    emissiveIntensity: 1.1,
    roughness: 0.35,
  });

  for (const side of [-1, 1]) {
    for (let index = 0; index < 90; index += 1) {
      const z = -4 - index * 17;
      const x = side * 6.9;
      const serviceBox = addBox(scene, new THREE.BoxGeometry(0.55, 0.82, 0.6), dark, [x, 0.53, z]);
      serviceBox.castShadow = true;
      addBox(scene, new THREE.BoxGeometry(0.08, 0.3, 0.035), cyan, [x - side * 0.285, 0.58, z - 0.11], false);
      addBox(scene, new THREE.BoxGeometry(0.8, 0.06, 0.08), metal, [side * 6.6, 0.18, z - 0.8]);
    }
  }
}

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x091117);
  scene.fog = new THREE.FogExp2(0x101a20, 0.011);

  const ambient = new THREE.HemisphereLight(0x9eb9c3, 0x15191a, 1.25);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0xb1d6dc, 2.15);
  moon.position.set(-9, 17, 4);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -14;
  moon.shadow.camera.right = 14;
  moon.shadow.camera.top = 18;
  moon.shadow.camera.bottom = -10;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 48;
  moon.shadow.bias = -0.0002;
  moon.shadow.normalBias = 0.025;
  moon.shadow.radius = 1.5;
  scene.add(moon);

  const fill = new THREE.DirectionalLight(0x457a86, 0.62);
  fill.position.set(8, 7, -13);
  scene.add(fill);

  addRoad(scene);
  addBuildings(scene);
  addStreetLights(scene);
  addStreetDetails(scene);

  return scene;
}

export { CITY_LENGTH };
