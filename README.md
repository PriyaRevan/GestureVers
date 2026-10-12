# GestureVerse 3D — Night Ride

GestureVerse 3D is a neon motorcycle runner built with Three.js. The bike travels forward automatically while you steer around stationary road drums and collect coins. Use held keyboard controls or steer continuously with a webcam hand gesture.

> **Screenshot:** _Add a gameplay screenshot here._  
> Suggested: `![GestureVerse 3D gameplay](./screenshots/gameplay.png)`

## Features

- A procedural 3D motorcycle and rider on a long neon city road.
- Continuous forward travel with stationary drums placed along the course.
- Direct left/right bike steering with natural lean that returns upright when steering centers.
- Coin pickups and a score that increases with distance and collected coins.
- Separate per-run coin pickup count and persistent wallet balance.
- A garage with selectable rider postures, purchasable/equippable jacket, suit, helmet, and bike-livery cosmetics.
- Three progressively harder courses with visible checkered finish lines, level completion, and saved level unlocks.
- Drum collision, patrol-car catch sequence, game-over screen, restart, and pause/resume.
- Webcam steering in Open Palm and Two-Finger modes, with a mirrored hand skeleton preview and tracking diagnostics.
- Keyboard fallback, camera status/errors, and a Recenter Hand control.

## Technologies

- **Vite** runs the local development server and bundles the browser app.
- **Vanilla JavaScript** keeps the game state and single animation loop approachable.
- **Three.js** renders the road, city, bike, lighting, drums, and coins.
- **MediaPipe Tasks Vision Hand Landmarker** detects normalized hand landmarks from webcam frames in VIDEO mode.
- **HTML and CSS** provide the game HUD, camera panel, controls, and responsive layout.

## Run locally

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open the localhost URL Vite prints (usually `http://localhost:5173`). To build and preview the production version:

```bash
npm run build
npm run preview
```

Camera access is available on `localhost` or an HTTPS site. The browser requests permission only after **Enable Camera** is clicked.

## Controls

| Action | Keyboard | Hand gesture |
| --- | --- | --- |
| Steer left | Hold `A` or `←` | Move your hand left of the recentered position |
| Steer right | Hold `D` or `→` | Move your hand right of the recentered position |
| Straighten steering | Release keys | Return your hand toward its recentered position |
| Pause / resume | `P` or `Escape` | Use the on-screen Pause/Resume button |

Select **Palm Mode** or **Two-Finger Mode**, click **Enable Camera**, and allow webcam access. The video preview is mirrored. In Palm Mode, the palm center is computed from landmarks 0, 5, 9, 13, and 17. Two-Finger Mode requires index and middle fingers extended with ring and little fingers folded; their midpoint (landmarks 8 and 12) controls the steering. Click **Recenter Hand** with a valid pose visible to calibrate the neutral center. Both modes use the same continuous steering input. The debug text shows the recognized pose, normalized hand position, and steering value/direction.

Open **Garage** before a ride to choose a rider posture or unlocked level, view your wallet and current-run coins separately, and purchase or equip cosmetics. Collected coins are added to the wallet and the profile (wallet, purchases, equipment, avatar, and unlocked/selected level) is stored in browser `localStorage`. Purchases are only charged after the updated profile is successfully saved. Complete a course without hitting a drum to unlock the next one; later courses are longer, faster, and have more closely spaced obstacles. A drum collision starts a short patrol-car catch sequence before the game-over screen.

## Project architecture

```text
index.html          Game HUD, garage/shop, start/pause screens, and webcam preview
src/
  main.js           Three.js setup, controls, garage/shop HUD, and single animation loop
  world.js          Road, city buildings, street lights, and scenery
  player.js         Procedural motorcycle/rider, avatar postures, and applied cosmetics
  game.js           Course progression, profile persistence, purchases, coins, finish, collision
  handTracking.js   Webcam lifecycle, MediaPipe inference, pose classification, hand overlay
  style.css         Responsive game and HUD styling
```

`main.js` owns the only `requestAnimationFrame` loop. The game advances the bike down the course in world space; obstacles stay at fixed world coordinates while the follow camera makes them approach in the view. Both keyboard and hand input set a steering value consumed by that same game controller. The garage applies selections to the existing procedural rider and bike rather than a preview-only model. Restart resets the current course and score without creating additional loops or event listeners; wallet purchases and level unlocks are retained in browser storage.

## Webcam troubleshooting

- Camera permission is requested only by **Enable Camera**. If permission was denied, allow it for localhost in browser settings and retry.
- If a camera is missing, use keyboard steering or connect/enable a webcam.
- MediaPipe WASM is loaded from [`jsDelivr`](https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm); the model is loaded from [Google's hosted Hand Landmarker model](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task). Internet access is needed to fetch these assets.
- GPU delegate initialization falls back to CPU. A tracking error is shown if camera or model initialization fails.
- Diagnostics: **Camera Off / Tracking Error** points to camera or initialization; **Searching for Hand** means no hand landmarks were found; the skeleton and live X/Y confirm detection; the recognized pose and steering debug line show whether control values are being produced.
- Better lighting, keeping the whole hand in view, and recentering with the selected pose improve tracking. Use `src/handTracking.js` to adjust `DEAD_ZONE`, `STEERING_RANGE`, and `POSITION_SMOOTHING`.

## Known limitations

- Physical-camera steering still needs testing on the target computer and webcam; hand shape, lighting, and camera placement affect recognition.
- The course streams stationary obstacles into the world ahead of the moving bike. City scenery is fixed rather than procedurally generated.
- There is no audio, mobile touch steering, or online leaderboard.
- Rider avatars are posture variants of one procedural rider model because the project contains no separate licensed rider-model assets. Outfit and livery options change the actual in-game model, not a separate menu preview.
- The patrol-car chase uses a simple procedural vehicle and light animation; it is not a detailed police character or cinematic animation.
- Persistent progress is browser-local and is not synchronized between browsers or devices. Clearing site data removes it.

## Interview talking points

1. **What are the Scene, Camera, and Renderer?** The scene contains objects and lights, the camera defines the view, and the renderer draws that view into the canvas.
2. **What is a Mesh?** A Mesh combines Geometry (shape) and Material (appearance). The bike is assembled from meshes grouped under one root.
3. **How is the animation loop managed?** One `requestAnimationFrame` loop updates game state, hand tracking, bike animation, and rendering using delta time.
4. **How do hand gestures steer?** MediaPipe returns normalized landmarks. The app recognizes a pose, calculates its palm/fingertip center, mirrors horizontal coordinates to match the preview, subtracts the calibrated neutral position, and maps the offset into a continuous steering value.
5. **How does collision detection work?** Drums stay at fixed positions. Each frame compares the bike's world position with each nearby drum; overlapping horizontal and forward ranges trigger game over.

## GitHub checklist

- [ ] Run `npm run build`.
- [ ] Test keyboard steering, coin collection, collisions, pause, and restart.
- [ ] Test both hand modes with a physical webcam on localhost or HTTPS.
- [ ] Add a gameplay screenshot and replace the placeholder.
- [ ] Check for credentials/private files before committing.
- [ ] Create or push to a GitHub remote only after reviewing the project.
