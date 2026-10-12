const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const DEAD_ZONE = 0.045;
const STEERING_RANGE = 0.32;
const POSITION_SMOOTHING = 0.28;

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const FINGERS = [
  { tip: 8, pip: 6 },
  { tip: 12, pip: 10 },
  { tip: 16, pip: 14 },
  { tip: 20, pip: 18 },
];

function distance3D(first, second) {
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
    (first.z ?? 0) - (second.z ?? 0),
  );
}

function fingerExtended(landmarks, tipIndex, pipIndex) {
  const wrist = landmarks[0];
  return distance3D(landmarks[tipIndex], wrist) >
    distance3D(landmarks[pipIndex], wrist) * 1.12;
}

export function getPalmCenter(landmarks) {
  const palm = [0, 5, 9, 13, 17].map((index) => landmarks[index]);
  return {
    x: palm.reduce((sum, point) => sum + point.x, 0) / palm.length,
    y: palm.reduce((sum, point) => sum + point.y, 0) / palm.length,
  };
}

export function getTwoFingerCenter(landmarks) {
  return {
    x: (landmarks[8].x + landmarks[12].x) / 2,
    y: (landmarks[8].y + landmarks[12].y) / 2,
  };
}

export function getVisiblePosition(position) {
  return {
    x: Math.max(0, Math.min(1, 1 - position.x)),
    y: Math.max(0, Math.min(1, position.y)),
  };
}

export function mapHandPositionToSteering(positionX, neutralX) {
  const offset = positionX - neutralX;
  if (Math.abs(offset) <= DEAD_ZONE) return 0;
  return Math.sign(offset) * Math.min(
    1,
    (Math.abs(offset) - DEAD_ZONE) / (STEERING_RANGE - DEAD_ZONE),
  );
}

export function hasOpenPalm(landmarks) {
  return FINGERS.filter(({ tip, pip }) => fingerExtended(landmarks, tip, pip)).length >= 3;
}

export function hasTwoFingerPose(landmarks) {
  const indexAndMiddleExtended =
    fingerExtended(landmarks, 8, 6) && fingerExtended(landmarks, 12, 10);
  const ringAndPinkyFolded =
    !fingerExtended(landmarks, 16, 14) && !fingerExtended(landmarks, 20, 18);
  const palmWidth = Math.hypot(
    landmarks[5].x - landmarks[17].x,
    landmarks[5].y - landmarks[17].y,
  );
  const thumbFolded = distance3D(landmarks[4], landmarks[5]) <
    distance3D(landmarks[2], landmarks[5]) * 1.25;
  return indexAndMiddleExtended && ringAndPinkyFolded && thumbFolded && palmWidth > 0;
}

export function createHandTracking({
  video,
  overlay,
  previewStage,
  previewMessage,
  onStatus,
  onDebug,
  onSteering,
  isControlEnabled,
}) {
  const context = overlay.getContext("2d");
  if (!context) throw new Error("Could not create the hand-landmark overlay.");

  let stream = null;
  let landmarker = null;
  let stopped = true;
  let lastVideoTime = -1;
  let lastTimestamp = -1;
  let smoothedPosition = null;
  let neutralPosition = null;
  let mode = "palm";
  let statusKey = "";
  let lastGestureLog = "";
  let lastAction = "none";
  let warnedOutOfFrameLandmark = false;

  function log(message, data) {
    if (import.meta.env.DEV) console.info(`[HandTracking] ${message}`, data ?? "");
  }

  function setStatus(state, message, cameraAvailable) {
    const nextKey = `${state}:${message}`;
    onStatus(state, message, cameraAvailable);
    previewMessage.textContent = message;
    if (statusKey !== nextKey) {
      log(state, message);
      statusKey = nextKey;
    }
  }

  function setDebug({
    position = smoothedPosition,
    gesture = "None",
    action = lastAction,
    steering = 0,
  } = {}) {
    onDebug({
      x: position?.x ?? null,
      y: position?.y ?? null,
      gesture,
      action,
      steering,
    });
  }

  function clearOverlay() {
    const bounds = overlay.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
  }

  function drawHand(landmarks) {
    const bounds = overlay.getBoundingClientRect();
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!bounds.width || !bounds.height || !videoWidth || !videoHeight) return;

    const ratio = window.devicePixelRatio || 1;
    const canvasWidth = Math.max(1, Math.round(bounds.width * ratio));
    const canvasHeight = Math.max(1, Math.round(bounds.height * ratio));
    if (overlay.width !== canvasWidth || overlay.height !== canvasHeight) {
      overlay.width = canvasWidth;
      overlay.height = canvasHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);

    const scale = Math.max(bounds.width / videoWidth, bounds.height / videoHeight);
    const offsetX = (bounds.width - videoWidth * scale) / 2;
    const offsetY = (bounds.height - videoHeight * scale) / 2;
    const points = landmarks.map((point) => ({
      x: offsetX + point.x * videoWidth * scale,
      y: offsetY + point.y * videoHeight * scale,
    }));

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.strokeStyle = "rgba(103, 241, 235, 0.95)";
    for (const [start, end] of HAND_CONNECTIONS) {
      context.beginPath();
      context.moveTo(points[start].x, points[start].y);
      context.lineTo(points[end].x, points[end].y);
      context.stroke();
    }

    const fingertipColors = new Map([
      [0, "#ffffff"],
      [4, "#ffbf69"],
      [8, "#ff6584"],
      [12, "#b899ff"],
    ]);
    points.forEach((point, index) => {
      context.beginPath();
      context.arc(point.x, point.y, fingertipColors.has(index) ? 6 : 3.5, 0, Math.PI * 2);
      context.fillStyle = fingertipColors.get(index) ?? "#e9ffff";
      context.fill();
      if (fingertipColors.has(index)) {
        context.lineWidth = 1.5;
        context.strokeStyle = "rgba(5, 15, 19, 0.9)";
        context.stroke();
      }
    });
  }

  function resetPoseState(clearNeutral = true) {
    smoothedPosition = null;
    if (clearNeutral) neutralPosition = null;
  }

  function stop() {
    stopped = true;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    video.srcObject = null;
    previewStage.classList.remove("is-live");
    if (landmarker) {
      landmarker.close();
      landmarker = null;
    }
    resetPoseState();
    onSteering(0);
    lastAction = "none";
    clearOverlay();
    setDebug({ position: null, gesture: "None", action: "none" });
    setStatus("Camera Off", "Camera off. Enable camera to see your hand.", false);
  }

  async function start() {
    if (stream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error("Camera access requires HTTPS or localhost in a supported browser.");
      setStatus("Tracking Error", error.message, false);
      throw error;
    }

    stopped = false;
    setStatus("Searching for Hand", "Requesting webcam access…", false);
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
        return;
      }

      video.srcObject = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (!stopped) {
          stop();
          setStatus("Tracking Error", "The webcam stream ended. Re-enable the camera to continue.", false);
        }
      }, { once: true });
      await video.play();
      previewStage.classList.add("is-live");
      setStatus("Loading Model", "Webcam is live. Loading the MediaPipe hand model…", true);

      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = {
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      };
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        });
      } catch (gpuError) {
        console.warn("GPU hand tracking is unavailable; trying CPU.", gpuError);
        landmarker = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        });
      }

      if (stopped) {
        landmarker.close();
        landmarker = null;
        return;
      }
      log("MediaPipe ready", { videoWidth: video.videoWidth, videoHeight: video.videoHeight });
      setStatus("Searching for Hand", "Camera is live. Show one hand in the preview.", true);
    } catch (error) {
      stop();
      const reason = error?.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in browser settings, then try again."
        : error?.name === "NotFoundError"
          ? "No camera was found. Connect a webcam or use keyboard controls."
          : `Could not start hand tracking: ${error?.message || "unknown error"}`;
      setStatus("Tracking Error", reason, false);
      console.error("Could not start MediaPipe hand tracking.", error);
      throw error;
    }
  }

  function setMode(nextMode) {
    if (nextMode !== "palm" && nextMode !== "two-finger") {
      throw new Error(`Unsupported gesture mode: ${nextMode}`);
    }
    mode = nextMode;
    resetPoseState();
    lastAction = "none";
    setDebug({ position: null, gesture: "Waiting for pose", action: "none" });
    if (!stopped) {
      setStatus(
        "Searching for Hand",
        mode === "palm"
          ? "Palm Mode: show your palm, then move left/right or raise it to jump."
          : "Two-Finger Mode: extend index/middle and fold thumb, ring, and little finger.",
        true,
      );
    }
  }

  function recenter() {
    if (!smoothedPosition) {
      setStatus("Searching for Hand", "Show a valid hand pose before recentering.", Boolean(stream));
      return false;
    }
    neutralPosition = { ...smoothedPosition };
    onSteering(0);
    lastAction = "center set";
    setDebug({
      gesture: mode === "palm" ? "Open Palm" : "Two Fingers",
      action: lastAction,
      steering: 0,
    });
    setStatus("Hand Detected", "Neutral position set. Move left/right to steer.", true);
    log("Recentered", neutralPosition);
    return true;
  }

  function update() {
    if (stopped || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (video.videoWidth === 0 || video.videoHeight === 0 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;

    try {
      const timestamp = Math.max(performance.now(), lastTimestamp + 1);
      lastTimestamp = timestamp;
      const result = landmarker.detectForVideo(video, timestamp);
      const landmarks = result.landmarks?.[0];

      if (!landmarks || landmarks.length < 21) {
        clearOverlay();
        resetPoseState(false);
        onSteering(0);
        setDebug({ position: null, gesture: "None", action: "waiting for hand" });
        setStatus("Searching for Hand", "No hand detected. Show one hand in the preview.", true);
        return;
      }
      if (landmarks.some((point) =>
        !Number.isFinite(point.x) || !Number.isFinite(point.y)
      )) {
        throw new Error("MediaPipe returned non-finite hand landmark coordinates.");
      }
      if (!warnedOutOfFrameLandmark && landmarks.some((point) =>
        point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1
      )) {
        warnedOutOfFrameLandmark = true;
        log("Some landmarks extend beyond the video frame; retaining the valid hand track.");
      }

      drawHand(landmarks);
      const openPalm = hasOpenPalm(landmarks);
      const validPose = mode === "palm" ? openPalm : hasTwoFingerPose(landmarks);
      if (!validPose) {
        resetPoseState(false);
        onSteering(0);
        lastAction = "waiting for valid pose";
        setDebug({ position: null, gesture: "Pose not recognized", action: lastAction });
        setStatus(
          "Hand Detected",
          mode === "palm"
            ? "Pose not recognized. Palm Mode needs at least three fingers extended."
            : "Pose not recognized. Two-Finger Mode needs index/middle extended and the other fingers folded.",
          true,
        );
        return;
      }

      const cameraPosition = mode === "palm"
        ? getPalmCenter(landmarks)
        : getTwoFingerCenter(landmarks);
      const visiblePosition = getVisiblePosition(cameraPosition);
      smoothedPosition = smoothedPosition
        ? {
            x: smoothedPosition.x + (visiblePosition.x - smoothedPosition.x) * POSITION_SMOOTHING,
            y: smoothedPosition.y + (visiblePosition.y - smoothedPosition.y) * POSITION_SMOOTHING,
          }
        : visiblePosition;
      if (!neutralPosition) neutralPosition = { ...smoothedPosition };

      const canControl = isControlEnabled();
      const gesture = mode === "palm"
        ? "Open Palm"
        : "Two Fingers";
      const currentSteering = canControl
        ? mapHandPositionToSteering(smoothedPosition.x, neutralPosition.x)
        : 0;
      onSteering(currentSteering);
      const direction = currentSteering < -0.05
        ? "steer left"
        : currentSteering > 0.05
          ? "steer right"
          : "straight";
      lastAction = canControl ? direction : "tracking only";
      setDebug({ gesture, action: lastAction, steering: currentSteering });
      setStatus(
        "Hand Detected",
        canControl
          ? `${gesture}. ${direction}.`
          : `${gesture} tracked. Select Hand Gestures and start the run to steer.`,
        true,
      );

      if (gesture !== lastGestureLog) {
        lastGestureLog = gesture;
        log("Gesture recognized", { gesture, x: smoothedPosition.x, y: smoothedPosition.y });
      }
    } catch (error) {
      const message = `Hand tracking error: ${error?.message || "unknown error"}`;
      stop();
      setStatus("Tracking Error", message, false);
      console.error("MediaPipe could not process webcam frames.", error);
    }
  }

  return {
    start,
    stop,
    update,
    setMode,
    recenter,
    isActive: () => Boolean(stream) && !stopped,
  };
}
