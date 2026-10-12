import * as THREE from "three";
import { RIDER_AVATARS, RIDER_COSMETICS } from "./player.js";

const PLAYER_Z = 1.1;
const ROAD_HALF_WIDTH = 5.8;
const LEVELS = [
  { id: 1, name: "Night Run", length: 240, obstacleSpacing: 34 },
  { id: 2, name: "Harbor Sprint", length: 300, obstacleSpacing: 29 },
  { id: 3, name: "Mountain Pass", length: 360, obstacleSpacing: 25 },
];
const PROFILE_KEY = "gestureverse-night-ride-profile";
const DEFAULT_EQUIPMENT = {
  jacket: "jacket-carbon",
  outfit: "suit-graphite",
  helmet: "helmet-ceramic",
  livery: "livery-teal",
};
const DEFAULT_PROFILE = {
  wallet: 0,
  purchased: Object.values(DEFAULT_EQUIPMENT),
  equipped: { ...DEFAULT_EQUIPMENT },
  avatar: "endurance",
  unlockedLevel: 1,
  selectedLevel: 1,
};

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    if (!saved || typeof saved !== "object") return structuredClone(DEFAULT_PROFILE);
    const knownItems = new Set(RIDER_COSMETICS.map((item) => item.id));
    const purchased = Array.isArray(saved.purchased)
      ? [...new Set(saved.purchased.filter((item) => knownItems.has(item)))]
      : [...DEFAULT_PROFILE.purchased];
    for (const freeItem of Object.values(DEFAULT_EQUIPMENT)) {
      if (!purchased.includes(freeItem)) purchased.push(freeItem);
    }
    const equipped = { ...DEFAULT_EQUIPMENT };
    for (const slot of Object.keys(equipped)) {
      const selection = saved.equipped?.[slot];
      const item = RIDER_COSMETICS.find((candidate) =>
        candidate.id === selection && candidate.slot === slot && purchased.includes(selection));
      if (item) equipped[slot] = item.id;
    }
    const avatar = RIDER_AVATARS.some((candidate) => candidate.id === saved.avatar)
      ? saved.avatar
      : DEFAULT_PROFILE.avatar;
    const unlockedLevel = THREE.MathUtils.clamp(
      Number.isInteger(saved.unlockedLevel) ? saved.unlockedLevel : 1,
      1,
      LEVELS.length,
    );
    return {
      wallet: Number.isSafeInteger(saved.wallet) && saved.wallet >= 0 ? saved.wallet : 0,
      purchased,
      equipped,
      avatar,
      unlockedLevel,
      selectedLevel: THREE.MathUtils.clamp(
        Number.isInteger(saved.selectedLevel) ? saved.selectedLevel : 1,
        1,
        unlockedLevel,
      ),
    };
  } catch (error) {
    console.warn("Could not load the saved rider profile.", error);
    return structuredClone(DEFAULT_PROFILE);
  }
}

export function createGame(
  scene,
  runner,
  onStateChange,
  onScoreChange,
  onCoinsChange = () => {},
  onProfileChange = () => {},
  onNotice = () => {},
) {
  const drumGeometry = new THREE.CylinderGeometry(0.48, 0.48, 1.05, 18);
  const drumMaterial = new THREE.MeshStandardMaterial({
    color: 0xad203b,
    emissive: 0x380611,
    emissiveIntensity: 0.45,
    metalness: 0.25,
    roughness: 0.6,
  });
  const stripeGeometry = new THREE.TorusGeometry(0.455, 0.075, 8, 20);
  const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xe7e6dc, roughness: 0.5 });
  const coinGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.075, 20);
  const coinRimGeometry = new THREE.TorusGeometry(0.22, 0.025, 6, 18);
  const coinMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd34e,
    emissive: 0x98530a,
    emissiveIntensity: 0.8,
    metalness: 0.85,
    roughness: 0.2,
  });
  const finishMaterial = new THREE.MeshStandardMaterial({
    color: 0xe3e5df,
    emissive: 0x273d40,
    emissiveIntensity: 0.45,
    roughness: 0.45,
  });
  const finishDarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x172229,
    metalness: 0.45,
    roughness: 0.45,
  });
  const policeMaterial = new THREE.MeshStandardMaterial({
    color: 0x17232b,
    metalness: 0.65,
    roughness: 0.34,
  });
  const policeWindowMaterial = new THREE.MeshStandardMaterial({
    color: 0x102d38,
    emissive: 0x0c5368,
    emissiveIntensity: 0.45,
    metalness: 0.65,
    roughness: 0.2,
  });
  const redLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff234d,
    emissive: 0xff143b,
    emissiveIntensity: 1.8,
  });
  const blueLightMaterial = new THREE.MeshStandardMaterial({
    color: 0x29bbff,
    emissive: 0x168eff,
    emissiveIntensity: 1.8,
  });

  const obstacles = [];
  const coins = [];
  let profile = loadProfile();
  let level = profile.selectedLevel;
  let lane = 1;
  let score = 0;
  let runCoins = 0;
  let elapsed = 0;
  let distance = 0;
  let levelDistance = 0;
  let nextObstacleDistance = 0;
  let steeringInput = 0;
  let keyboardInput = 0;
  let controlMode = "keyboard";
  let steering = 0;
  let caughtElapsed = 0;
  let state = "ready";
  let finishLine = null;
  let police = null;

  function getSummary() {
    return {
      score,
      coins: runCoins,
      wallet: profile.wallet,
      distance: Math.floor(distance),
      levelDistance: Math.floor(levelDistance),
      level,
      levelName: LEVELS[level - 1].name,
      lane,
      unlockedLevel: profile.unlockedLevel,
    };
  }

  function getProfile() {
    return structuredClone(profile);
  }

  function setState(nextState) {
    if (state === nextState) return;
    state = nextState;
    onStateChange(state, getSummary());
  }

  function notify(message, kind = "info") {
    onNotice({ message, kind });
  }

  function persist(candidate) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(candidate));
      return true;
    } catch (error) {
      console.warn("Could not save the rider profile.", error);
      notify("Could not save your profile. Check browser storage settings.", "error");
      return false;
    }
  }

  function commitProfile(candidate, requireSave = false) {
    if (requireSave && !persist(candidate)) return false;
    profile = candidate;
    runner.setAvatar(profile.avatar);
    runner.setCosmetics(profile.equipped);
    onProfileChange(getProfile());
    if (!requireSave) persist(profile);
    return true;
  }

  function saveAward(candidate) {
    profile = candidate;
    onProfileChange(getProfile());
    if (!persist(profile)) notify("Coins earned this run, but the wallet could not be saved.", "error");
  }

  function makeFinishLine(z) {
    const group = new THREE.Group();
    group.position.z = z;
    const postGeometry = new THREE.BoxGeometry(0.32, 4.3, 0.38);
    const beamGeometry = new THREE.BoxGeometry(12.8, 0.32, 0.44);
    const boardGeometry = new THREE.BoxGeometry(5.4, 0.88, 0.32);
    const board = new THREE.Mesh(boardGeometry, finishDarkMaterial);
    board.position.set(0, 4.15, 0);
    group.add(board);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeometry, finishMaterial);
      post.position.set(side * 6.15, 2.15, 0);
      group.add(post);
    }
    const beam = new THREE.Mesh(beamGeometry, finishMaterial);
    beam.position.set(0, 4.3, 0);
    group.add(beam);
    for (let index = 0; index < 14; index += 1) {
      const square = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.18, 0.52),
        index % 2 === 0 ? finishDarkMaterial : finishMaterial,
      );
      square.position.set(-5.98 + index * 0.92, 0.03, 0);
      group.add(square);
    }
    scene.add(group);
    return group;
  }

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
  }

  function makePoliceCar() {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.62, 2.6), policeMaterial);
    body.position.y = 0.55;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.5, 1.18), policeWindowMaterial);
    cabin.position.set(0, 1.08, -0.08);
    car.add(cabin);
    for (const side of [-1, 1]) {
      for (const z of [-0.82, 0.82]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 0.15, 12),
          finishDarkMaterial,
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 0.83, 0.32, z);
        car.add(wheel);
      }
    }
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.2), redLightMaterial);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.2), blueLightMaterial);
    red.position.set(-0.23, 1.38, -0.08);
    blue.position.set(0.23, 1.38, -0.08);
    car.add(red, blue);
    car.visible = false;
    scene.add(car);
    return { group: car, red, blue };
  }

  function createObstacle(laneIndex, z) {
    const drum = new THREE.Group();
    drum.position.set((laneIndex - 1) * 2.8, 0.53, z);
    const body = new THREE.Mesh(drumGeometry, drumMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    drum.add(body);
    for (const y of [-0.24, 0.1, 0.44]) {
      const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
      stripe.rotation.x = Math.PI / 2;
      stripe.position.y = y;
      drum.add(stripe);
    }
    scene.add(drum);
    obstacles.push({ mesh: drum, lane: laneIndex });
  }

  function createCoin(laneIndex, z) {
    const coin = new THREE.Group();
    const disc = new THREE.Mesh(coinGeometry, coinMaterial);
    disc.rotation.x = Math.PI / 2;
    coin.add(disc);
    coin.add(new THREE.Mesh(coinRimGeometry, coinMaterial));
    coin.position.set((laneIndex - 1) * 2.8, 1.15, z);
    scene.add(coin);
    coins.push({ mesh: coin, collected: false });
  }

  function addCourseAhead() {
    const finishZ = PLAYER_Z - LEVELS[level - 1].length;
    const spacing = LEVELS[level - 1].obstacleSpacing;
    while (
      runner.group.position.z - nextObstacleDistance < 92 &&
      nextObstacleDistance > finishZ + 18
    ) {
      const row = Math.round(Math.abs(nextObstacleDistance) / spacing);
      const blockedLane = (row * 2 + level) % 3;
      createObstacle(blockedLane, nextObstacleDistance);
      const coinLane = (blockedLane + 1 + row % 2) % 3;
      for (const offset of [-1.2, 0, 1.2]) {
        createCoin(coinLane, nextObstacleDistance - 7 + offset);
      }
      nextObstacleDistance -= spacing;
    }
  }

  function clearCourse() {
    for (const obstacle of obstacles) scene.remove(obstacle.mesh);
    for (const coin of coins) scene.remove(coin.mesh);
    obstacles.length = 0;
    coins.length = 0;
  }

  function resetSegment(resetRun) {
    clearCourse();
    lane = 1;
    levelDistance = 0;
    nextObstacleDistance = PLAYER_Z - 26;
    steeringInput = 0;
    keyboardInput = 0;
    steering = 0;
    caughtElapsed = 0;
    if (police) police.group.visible = false;
    runner.group.position.set(0, 0, PLAYER_Z);
    runner.group.rotation.set(0, 0, 0);
    if (finishLine) {
      finishLine.position.z = PLAYER_Z - LEVELS[level - 1].length;
    } else {
      finishLine = makeFinishLine(PLAYER_Z - LEVELS[level - 1].length);
    }
    if (resetRun) {
      score = 0;
      runCoins = 0;
      elapsed = 0;
      distance = 0;
      onScoreChange(score);
      onCoinsChange(runCoins);
    }
    addCourseAhead();
  }

  function setSteering(value) {
    steeringInput = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, -1, 1);
  }

  function setKeyboardSteering(value) {
    keyboardInput = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, -1, 1);
  }

  function setControlMode(mode) {
    if (mode !== "keyboard" && mode !== "gestures") {
      throw new Error(`Unsupported control mode: ${mode}`);
    }
    controlMode = mode;
    steeringInput = 0;
    keyboardInput = 0;
  }

  function collectCoin(coin) {
    coin.collected = true;
    scene.remove(coin.mesh);
    runCoins += 1;
    score = Math.floor(distance) + runCoins * 25;
    const candidate = structuredClone(profile);
    candidate.wallet += 1;
    saveAward(candidate);
    onCoinsChange(runCoins);
    onScoreChange(score);
  }

  function start() {
    if (state !== "ready") return;
    level = profile.selectedLevel;
    resetSegment(true);
    setState("playing");
  }

  function completeLevel() {
    const candidate = structuredClone(profile);
    candidate.unlockedLevel = Math.max(candidate.unlockedLevel, Math.min(LEVELS.length, level + 1));
    candidate.selectedLevel = candidate.unlockedLevel;
    profile = candidate;
    onProfileChange(getProfile());
    persist(profile);
    setState("levelcomplete");
  }

  function continueLevel() {
    if (state !== "levelcomplete" || level >= LEVELS.length) return false;
    const nextLevel = level + 1;
    if (nextLevel > profile.unlockedLevel) return false;
    level = nextLevel;
    const candidate = structuredClone(profile);
    candidate.selectedLevel = level;
    profile = candidate;
    persist(profile);
    onProfileChange(getProfile());
    resetSegment(false);
    setState("playing");
    return true;
  }

  function selectLevel(levelId) {
    if (!Number.isInteger(levelId) || levelId < 1 || levelId > profile.unlockedLevel) {
      return false;
    }
    const candidate = structuredClone(profile);
    candidate.selectedLevel = levelId;
    if (!commitProfile(candidate, true)) return false;
    notify(`${LEVELS[levelId - 1].name} selected.`);
    return true;
  }

  function setAvatar(avatarId) {
    if (!RIDER_AVATARS.some((avatar) => avatar.id === avatarId)) return false;
    const candidate = structuredClone(profile);
    candidate.avatar = avatarId;
    if (!commitProfile(candidate, true)) return false;
    notify(`${RIDER_AVATARS.find((avatar) => avatar.id === avatarId).name} selected.`);
    return true;
  }

  function equipItem(itemId) {
    const item = RIDER_COSMETICS.find((candidate) => candidate.id === itemId);
    if (!item || !profile.purchased.includes(itemId)) return false;
    const candidate = structuredClone(profile);
    candidate.equipped[item.slot] = itemId;
    if (!commitProfile(candidate, true)) return false;
    notify(`${item.name} equipped.`);
    return true;
  }

  function purchaseItem(itemId) {
    const item = RIDER_COSMETICS.find((candidate) => candidate.id === itemId);
    if (!item) return { success: false, reason: "Item unavailable." };
    if (profile.purchased.includes(itemId)) {
      equipItem(itemId);
      return { success: true, reason: "Already purchased; equipped." };
    }
    if (profile.wallet < item.price) {
      return { success: false, reason: `Need ${item.price - profile.wallet} more coins.` };
    }
    const candidate = structuredClone(profile);
    candidate.wallet -= item.price;
    candidate.purchased.push(item.id);
    candidate.equipped[item.slot] = item.id;
    if (!commitProfile(candidate, true)) {
      return { success: false, reason: "Purchase was not charged because it could not be saved." };
    }
    notify(`${item.name} purchased and equipped.`);
    return { success: true, reason: "Purchased and equipped." };
  }

  function update(delta) {
    if (state === "caught") {
      caughtElapsed += delta;
      if (police) {
        police.group.position.set(
          THREE.MathUtils.damp(police.group.position.x, runner.group.position.x, 2.5, delta),
          0,
          THREE.MathUtils.damp(police.group.position.z, runner.group.position.z + 1.8, 2.2, delta),
        );
        const flashing = Math.sin(caughtElapsed * 18) > 0;
        police.red.material.emissiveIntensity = flashing ? 2.2 : 0.15;
        police.blue.material.emissiveIntensity = flashing ? 0.15 : 2.2;
      }
      if (caughtElapsed >= 1.8) setState("gameover");
      return;
    }
    if (state !== "playing") return;

    const speed = 11 + (level - 1) * 1.2 + Math.min(levelDistance * 0.008, 3);
    const activeInput = controlMode === "gestures" ? steeringInput : keyboardInput;
    steering = THREE.MathUtils.damp(steering, activeInput, 16, delta);
    runner.group.position.x = THREE.MathUtils.clamp(
      runner.group.position.x + steering * (5.2 + level * 0.25) * delta,
      -ROAD_HALF_WIDTH,
      ROAD_HALF_WIDTH,
    );
    runner.group.position.z -= speed * delta;
    distance += speed * delta;
    levelDistance += speed * delta;
    score = Math.floor(distance) + runCoins * 25;
    lane = THREE.MathUtils.clamp(Math.round((runner.group.position.x + 2.8) / 2.8), 0, 2);
    runner.group.rotation.y = THREE.MathUtils.damp(runner.group.rotation.y, steering * 0.07, 8, delta);

    for (const obstacle of obstacles) {
      if (
        Math.abs(obstacle.mesh.position.z - runner.group.position.z) < 0.95 &&
        Math.abs(obstacle.mesh.position.x - runner.group.position.x) < 0.82
      ) {
        if (police) {
          police.group.visible = true;
          police.group.position.set(runner.group.position.x, 0, runner.group.position.z + 18);
        }
        caughtElapsed = 0;
        setState("caught");
        return;
      }
    }

    for (const coin of coins) {
      if (
        !coin.collected &&
        Math.abs(coin.mesh.position.z - runner.group.position.z) < 1.2 &&
        Math.abs(coin.mesh.position.x - runner.group.position.x) < 0.85
      ) {
        collectCoin(coin);
      } else if (!coin.collected) {
        coin.mesh.rotation.z += delta * 3;
      }
    }

    for (let index = obstacles.length - 1; index >= 0; index -= 1) {
      if (obstacles[index].mesh.position.z > runner.group.position.z + 18) {
        scene.remove(obstacles[index].mesh);
        obstacles.splice(index, 1);
      }
    }
    for (let index = coins.length - 1; index >= 0; index -= 1) {
      if (coins[index].collected || coins[index].mesh.position.z > runner.group.position.z + 18) {
        scene.remove(coins[index].mesh);
        coins.splice(index, 1);
      }
    }

    if (runner.group.position.z <= PLAYER_Z - LEVELS[level - 1].length) {
      completeLevel();
      return;
    }

    addCourseAhead();
    onScoreChange(score);
  }

  function dispose() {
    clearCourse();
    if (finishLine) {
      scene.remove(finishLine);
      disposeObject(finishLine);
    }
    if (police) {
      scene.remove(police.group);
      disposeObject(police.group);
    }
    drumGeometry.dispose();
    stripeGeometry.dispose();
    coinGeometry.dispose();
    coinRimGeometry.dispose();
    [drumMaterial, stripeMaterial, coinMaterial, finishMaterial, finishDarkMaterial, policeMaterial, policeWindowMaterial, redLightMaterial, blueLightMaterial]
      .forEach((material) => material.dispose());
  }

  runner.setAvatar(profile.avatar);
  runner.setCosmetics(profile.equipped);
  finishLine = makeFinishLine(PLAYER_Z - LEVELS[level - 1].length);
  police = makePoliceCar();
  addCourseAhead();
  onScoreChange(score);
  onCoinsChange(runCoins);
  onProfileChange(getProfile());

  return {
    start,
    restart() {
      resetSegment(true);
      setState("playing");
    },
    returnToMenu() {
      level = profile.selectedLevel;
      resetSegment(true);
      setState("ready");
    },
    continueLevel,
    selectLevel,
    setAvatar,
    equipItem,
    purchaseItem,
    setSteering,
    setKeyboardSteering,
    setControlMode,
    togglePause() {
      if (state === "playing") setState("paused");
      else if (state === "paused") setState("playing");
    },
    update,
    dispose,
    getLane: () => lane,
    getState: () => state,
    getSteering: () => steering,
    getSummary,
    getProfile,
    getLevels: () => LEVELS.map((item) => ({ ...item, unlocked: item.id <= profile.unlockedLevel })),
    getCosmetics: () => RIDER_COSMETICS.map((item) => ({
      ...item,
      purchased: profile.purchased.includes(item.id),
      equipped: profile.equipped[item.slot] === item.id,
    })),
    getAvatars: () => RIDER_AVATARS.map((avatar) => ({ ...avatar, selected: avatar.id === profile.avatar })),
  };
}
