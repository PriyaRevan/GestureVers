import * as THREE from "three";
import { createGame } from "./game.js";
import { createHandTracking } from "./handTracking.js";
import { createRunner } from "./player.js";
import { createWorld } from "./world.js";
import "./style.css";

const canvas = document.querySelector(".scene");
const errorPanel = document.querySelector(".render-error");
const scoreLabel = document.querySelector("#score");
const coinsLabel = document.querySelector("#coins");
const walletLabel = document.querySelector("#wallet");
const levelIndicator = document.querySelector("#level-indicator");
const gamePanel = document.querySelector("#game-panel");
const panelTitle = document.querySelector("#panel-title");
const panelCopy = document.querySelector("#panel-copy");
const startButton = document.querySelector("#start-button");
const continueButton = document.querySelector("#continue-button");
const panelMenuButton = document.querySelector("#panel-menu-button");
const pauseButton = document.querySelector("#pause-button");
const garageButton = document.querySelector("#garage-button");
const garagePanel = document.querySelector("#garage-panel");
const closeGarageButton = document.querySelector("#close-garage");
const shopGrid = document.querySelector("#shop-grid");
const garageWallet = document.querySelector("#garage-wallet");
const garageRunCoins = document.querySelector("#garage-run-coins");
const avatarSelect = document.querySelector("#avatar-select");
const levelSelect = document.querySelector("#level-select");
const avatarDescription = document.querySelector("#avatar-description");
const notice = document.querySelector("#game-notice");
const noticeText = document.querySelector("#game-notice-text");
const cameraButton = document.querySelector("#camera-button");
const cameraStatus = document.querySelector("#camera-status");
const trackingStatus = document.querySelector("#tracking-status");
const cameraDot = document.querySelector("#camera-dot");
const gestureMode = document.querySelector("#gesture-mode");
const recenterButton = document.querySelector("#recenter-button");
const gestureDebug = document.querySelector("#gesture-debug");
const gestureAction = document.querySelector("#gesture-action");
const inputMode = document.querySelector("#input-mode");
const video = document.querySelector("#camera-preview");
const previewStage = document.querySelector("#camera-preview-stage");
const previewMessage = document.querySelector("#preview-message");
const landmarkOverlay = document.querySelector("#landmark-overlay");

let renderer;
let animationFrame = 0;
let game;
let handTracking;
let lastState = "ready";
let resumeAfterGarage = false;
let noticeTimer = 0;

try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
} catch (error) {
  errorPanel.hidden = false;
  errorPanel.textContent =
    "This game needs WebGL, but a compatible graphics context could not be created. Update your browser or graphics driver, then try again.";
  console.error("Three.js could not initialize WebGL.", error);
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = createWorld();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, 3.25, 10.8);
camera.lookAt(0, 1.15, -8);

const runner = createRunner();
runner.group.position.set(0, 0, 1.1);
scene.add(runner.group);

function showNotice({ message, kind = "info" }) {
  noticeText.textContent = message;
  notice.classList.toggle("is-error", kind === "error");
  notice.hidden = false;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    notice.hidden = true;
  }, 3200);
}

function updateProfileLabels(profile) {
  walletLabel.textContent = String(profile.wallet);
  garageWallet.textContent = String(profile.wallet);
  levelIndicator.textContent = String(profile.selectedLevel).padStart(2, "0");
  if (game) renderGarage();
}

function showGameState(state, summary) {
  lastState = state;
  levelIndicator.textContent = String(summary.level).padStart(2, "0");
  const panelStates = {
    ready: ["NIGHT<br /><span>RIDE</span>", `Level ${summary.level}: ${summary.levelName}. Steer clean and reach the finish.`, "Start Ride"],
    paused: ["RIDE<br /><span>PAUSED</span>", "Take a breath. Resume when ready.", "Resume"],
    caught: ["CHASE<br /><span>CAUGHT</span>", "A patrol car has caught up with you.", "Caught"],
    gameover: ["RIDE<br /><span>OVER</span>", `Level ${summary.level} ended at ${summary.distance} m with ${summary.coins} coins collected.`, "Restart"],
    levelcomplete: [
      summary.level >= 3 ? "CHAMPION<br /><span>FINISH</span>" : "LEVEL<br /><span>COMPLETE</span>",
      `${summary.levelName} complete · ${summary.levelDistance} m this level · ${summary.coins} coins collected.`,
      summary.level >= 3 ? "Run Complete" : "Continue",
    ],
  };
  const content = panelStates[state];
  gamePanel.hidden = state === "playing";
  if (content) {
    panelTitle.innerHTML = content[0];
    panelCopy.textContent = content[1];
    startButton.textContent = content[2];
  }
  startButton.hidden = state === "caught" || state === "levelcomplete";
  continueButton.hidden = state !== "levelcomplete" || summary.level >= 3;
  panelMenuButton.hidden = state !== "gameover" && !(state === "levelcomplete" && summary.level >= 3);
  pauseButton.disabled = state !== "playing" && state !== "paused";
  pauseButton.textContent = state === "paused" ? "Resume" : "Pause";
  if (state === "playing" && handTracking?.isActive()) handTracking.recenter();
}

game = createGame(
  scene,
  runner,
  showGameState,
  (score) => {
    scoreLabel.textContent = String(score).padStart(5, "0");
  },
  (coins) => {
    coinsLabel.textContent = String(coins);
    garageRunCoins.textContent = String(coins);
  },
  updateProfileLabels,
  showNotice,
);

handTracking = createHandTracking({
  video,
  overlay: landmarkOverlay,
  previewStage,
  previewMessage,
  onStatus(label, message, active) {
    cameraStatus.textContent = label;
    trackingStatus.textContent = message;
    cameraDot.classList.toggle("is-active", active);
    cameraButton.textContent = active ? "Disable Camera" : "Enable Camera";
    recenterButton.disabled = !active;
  },
  onDebug({ x, y, gesture, action, steering }) {
    gestureDebug.textContent = x === null || y === null
      ? `Hand: ${gesture} · X -- · Y --`
      : `Hand: ${gesture} · X ${x.toFixed(2)} · Y ${y.toFixed(2)}`;
    gestureAction.textContent = `Steering: ${action} (${steering.toFixed(2)})`;
  },
  onSteering(value) {
    game.setSteering(value);
  },
  isControlEnabled: () => inputMode.value === "gestures" && game.getState() === "playing",
});

function renderGarage() {
  if (!game) return;
  const profile = game.getProfile();
  garageWallet.textContent = String(profile.wallet);
  garageRunCoins.textContent = String(game.getSummary().coins);

  avatarSelect.replaceChildren();
  for (const avatar of game.getAvatars()) {
    const option = document.createElement("option");
    option.value = avatar.id;
    option.textContent = avatar.name;
    option.selected = avatar.selected;
    avatarSelect.append(option);
    if (avatar.selected) avatarDescription.textContent = avatar.description;
  }

  levelSelect.replaceChildren();
  for (const level of game.getLevels()) {
    const option = document.createElement("option");
    option.value = String(level.id);
    option.textContent = `Level ${level.id} · ${level.name}${level.unlocked ? "" : " · Locked"}`;
    option.disabled = !level.unlocked;
    option.selected = level.id === profile.selectedLevel;
    levelSelect.append(option);
  }

  shopGrid.replaceChildren();
  for (const item of game.getCosmetics()) {
    const card = document.createElement("article");
    card.className = "shop-item";
    const swatch = document.createElement("span");
    swatch.className = "shop-item__swatch";
    const swatchColor = item.slot === "outfit" ? item.pants : item.color;
    swatch.style.backgroundColor = `#${swatchColor.toString(16).padStart(6, "0")}`;
    const category = document.createElement("small");
    category.textContent = item.category;
    const name = document.createElement("strong");
    name.textContent = item.name;
    const price = document.createElement("span");
    price.className = "shop-item__price";
    price.textContent = item.price === 0 ? "FREE" : `${item.price} COINS`;
    const status = document.createElement("span");
    status.className = "shop-item__status";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button--shop";

    if (item.equipped) {
      status.textContent = "EQUIPPED";
      button.textContent = "Equipped";
      button.disabled = true;
    } else if (item.purchased) {
      status.textContent = "PURCHASED";
      button.textContent = "Equip";
    } else if (profile.wallet >= item.price) {
      status.textContent = "UNLOCKED · READY TO BUY";
      button.textContent = item.price === 0 ? "Unlock" : "Purchase";
    } else {
      status.textContent = `LOCKED · NEED ${item.price - profile.wallet}`;
      button.textContent = "Locked";
      button.disabled = true;
    }
    button.addEventListener("click", () => {
      const result = item.purchased ? game.equipItem(item.id) : game.purchaseItem(item.id).success;
      if (!result) showNotice({ message: "That item could not be equipped or purchased.", kind: "error" });
      renderGarage();
    });

    card.append(swatch, category, name, price, status, button);
    shopGrid.append(card);
  }
}

function openGarage() {
  resumeAfterGarage = game.getState() === "playing";
  if (resumeAfterGarage) game.togglePause();
  renderGarage();
  garagePanel.hidden = false;
}

function closeGarage() {
  garagePanel.hidden = true;
  if (resumeAfterGarage && game.getState() === "paused") game.togglePause();
  resumeAfterGarage = false;
}

const clock = new THREE.Clock();

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
}

function animate() {
  animationFrame = window.requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  game.update(delta);
  handTracking.update();
  runner.update(elapsed, game.getSteering(), delta);
  camera.position.x = THREE.MathUtils.damp(camera.position.x, runner.group.position.x * 0.55, 3, delta);
  camera.position.y = 3.25 + Math.sin(elapsed * 0.24) * 0.025;
  camera.position.z = runner.group.position.z + 10.8;
  camera.lookAt(runner.group.position.x * 0.55, 1.12, runner.group.position.z - 8);
  renderer.render(scene, camera);
}

startButton.addEventListener("click", () => {
  if (lastState === "ready") game.start();
  else if (lastState === "paused") game.togglePause();
  else if (lastState === "gameover") game.restart();
});
continueButton.addEventListener("click", () => {
  if (!game.continueLevel()) showNotice({ message: "There is no further level to unlock.", kind: "info" });
});
pauseButton.addEventListener("click", () => game.togglePause());
garageButton.addEventListener("click", openGarage);
closeGarageButton.addEventListener("click", closeGarage);
avatarSelect.addEventListener("change", () => {
  if (!game.setAvatar(avatarSelect.value)) {
    showNotice({ message: "Could not save this rider selection.", kind: "error" });
  }
});
levelSelect.addEventListener("change", () => {
  const chosenLevel = Number(levelSelect.value);
  if (game.selectLevel(chosenLevel)) {
    game.returnToMenu();
    showNotice({ message: `Level ${chosenLevel} selected.` });
  } else {
    renderGarage();
  }
});

cameraButton.addEventListener("click", async () => {
  if (handTracking.isActive()) {
    handTracking.stop();
    return;
  }
  inputMode.value = "gestures";
  game.setControlMode("gestures");
  cameraButton.disabled = true;
  try {
    await handTracking.start();
  } catch (error) {
    console.error("Could not enable hand controls.", error);
  } finally {
    cameraButton.disabled = false;
  }
});

gestureMode.addEventListener("change", () => handTracking.setMode(gestureMode.value));
inputMode.addEventListener("change", () => {
  game.setControlMode(inputMode.value);
  if (inputMode.value === "gestures") {
    handTracking.recenter();
    trackingStatus.textContent = handTracking.isActive()
      ? "Hand Gestures selected. Start the ride and move your hand."
      : "Select Enable Camera to start gesture controls.";
  } else {
    gestureAction.textContent = "Steering: keyboard";
  }
});
recenterButton.addEventListener("click", () => handTracking.recenter());

panelMenuButton.addEventListener("click", () => {
  game.returnToMenu();
  inputMode.value = "keyboard";
  game.setControlMode("keyboard");
});

const heldSteeringKeys = new Set();

function updateKeyboardSteering() {
  const left = heldSteeringKeys.has("ArrowLeft") || heldSteeringKeys.has("KeyA");
  const right = heldSteeringKeys.has("ArrowRight") || heldSteeringKeys.has("KeyD");
  const steering = Number(right) - Number(left);
  game.setKeyboardSteering(steering);
  if (inputMode.value === "keyboard") {
    gestureAction.textContent = steering < 0
      ? "Steering: keyboard left"
      : steering > 0
        ? "Steering: keyboard right"
        : "Steering: keyboard straight";
  }
}

function handleKeydown(event) {
  if (event.repeat || !garagePanel.hidden) return;
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    event.preventDefault();
    heldSteeringKeys.add(event.code);
    updateKeyboardSteering();
  } else if (event.code === "ArrowRight" || event.code === "KeyD") {
    event.preventDefault();
    heldSteeringKeys.add(event.code);
    updateKeyboardSteering();
  } else if (event.code === "KeyP" || event.code === "Escape") {
    game.togglePause();
  }
}

function handleKeyup(event) {
  heldSteeringKeys.delete(event.code);
  updateKeyboardSteering();
}

function clearKeyboardSteering() {
  heldSteeringKeys.clear();
  updateKeyboardSteering();
}

window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);
window.addEventListener("blur", clearKeyboardSteering);
window.addEventListener("resize", resize);
window.addEventListener("beforeunload", cleanup, { once: true });

function cleanup() {
  window.clearTimeout(noticeTimer);
  window.cancelAnimationFrame(animationFrame);
  window.removeEventListener("resize", resize);
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("keyup", handleKeyup);
  window.removeEventListener("blur", clearKeyboardSteering);
  handTracking.stop();
  game.dispose();
  renderer.dispose();
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        for (const value of Object.values(material)) {
          if (value && value.isTexture) value.dispose();
        }
        material.dispose();
      });
    }
  });
}

if (import.meta.hot) import.meta.hot.dispose(cleanup);

renderGarage();
animate();
