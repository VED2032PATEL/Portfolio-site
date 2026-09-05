'use client';

import { Html, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const MODEL_PATH = '/models/mascot_shutter_v2.glb';
const TRACKED_BONES = ['Torso', 'Head'] as const;

type TrackedBoneName = (typeof TRACKED_BONES)[number];
type TrackedBones = Record<TrackedBoneName, THREE.Bone>;
type BoneQuaternions = Record<TrackedBoneName, THREE.Quaternion>;

const HEAD_WEIGHT = 0.54;
const TORSO_WEIGHT = 0.08;
const MAX_YAW = THREE.MathUtils.degToRad(28);
const MAX_PITCH = THREE.MathUtils.degToRad(18);
const TRACKING_PAUSE_MS = 4_600;
const GESTURE_COOLDOWN_MS = 12_000;
const GESTURE_WINDOW_MS = 1_250;

type PointerSample = {
  x: number;
  y: number;
  time: number;
};

function makeQuaternionSet(): BoneQuaternions {
  return {
    Torso: new THREE.Quaternion(),
    Head: new THREE.Quaternion(),
  };
}

function isFastCircularGesture(samples: PointerSample[]) {
  if (samples.length < 14) return false;

  const durationSeconds =
    (samples[samples.length - 1].time - samples[0].time) / 1_000;
  if (durationSeconds < 0.7) return false;

  let centerX = 0;
  let centerY = 0;
  for (const sample of samples) {
    centerX += sample.x;
    centerY += sample.y;
  }
  centerX /= samples.length;
  centerY /= samples.length;

  const radii = samples.map((sample) =>
    Math.hypot(sample.x - centerX, sample.y - centerY),
  );
  const meanRadius =
    radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  if (meanRadius < 0.028 || meanRadius > 0.3) return false;

  const radiusDeviation = Math.sqrt(
    radii.reduce((sum, radius) => sum + (radius - meanRadius) ** 2, 0) /
      radii.length,
  );
  if (radiusDeviation / meanRadius > 0.52) return false;

  let pathLength = 0;
  let signedTurn = 0;
  let absoluteTurn = 0;
  let longestPause = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    longestPause = Math.max(longestPause, current.time - previous.time);
    pathLength += Math.hypot(current.x - previous.x, current.y - previous.y);

    const previousX = previous.x - centerX;
    const previousY = previous.y - centerY;
    const currentX = current.x - centerX;
    const currentY = current.y - centerY;
    if (radii[index - 1] < 0.012 || radii[index] < 0.012) continue;

    const turn = Math.atan2(
      previousX * currentY - previousY * currentX,
      previousX * currentX + previousY * currentY,
    );
    signedTurn += turn;
    absoluteTurn += Math.abs(turn);
  }

  const speed = pathLength / durationSeconds;
  const directionConsistency =
    absoluteTurn === 0 ? 0 : Math.abs(signedTurn) / absoluteTurn;
  const orbitEfficiency =
    pathLength === 0 ? 0 : (meanRadius * absoluteTurn) / pathLength;

  return (
    longestPause <= 160 &&
    pathLength >= 0.48 &&
    speed >= 0.58 &&
    Math.abs(signedTurn) >= Math.PI * 3 &&
    absoluteTurn >= Math.PI * 3.35 &&
    directionConsistency >= 0.72 &&
    orbitEfficiency >= 0.52 &&
    orbitEfficiency <= 1.48
  );
}

function ResponsiveCamera() {
  const { camera, size } = useThree();

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const targetY = 8.4;
    const aspect = Math.max(size.width / size.height, 0.4);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const verticalDistance = 3.95 / (2 * Math.tan(halfFov));
    const horizontalDistance = 4.4 / (2 * Math.tan(halfFov) * aspect);
    const distance = Math.max(verticalDistance, horizontalDistance);

    camera.position.set(0, targetY, distance);
    camera.lookAt(0, targetY, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  return null;
}

function ModelLoading() {
  return (
    <Html center>
      <output className="model-loading" aria-live="polite">
        <span className="model-loading-dot" />
        Loading character
      </output>
    </Html>
  );
}

function CursorMascot({
  pullSequence,
  speechSequence,
  isSpeaking,
  onCursorOverload,
  onReady,
}: {
  pullSequence: number;
  speechSequence: number;
  isSpeaking: boolean;
  onCursorOverload: () => void;
  onReady: () => void;
}) {
  const { gl } = useThree();
  const gltf = useGLTF(MODEL_PATH);
  const model = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const pointerTarget = useRef(new THREE.Vector2());
  const smoothPointer = useRef(new THREE.Vector2());
  const cursorBlend = useRef(1);
  const isPulling = useRef(false);
  const trackingPausedUntil = useRef(0);
  const gestureCooldownUntil = useRef(0);
  const pointerSamples = useRef<PointerSample[]>([]);
  const onCursorOverloadRef = useRef(onCursorOverload);
  const prefersReducedMotion = useRef(false);
  const idleAction = useRef<THREE.AnimationAction | null>(null);
  const talkAction = useRef<THREE.AnimationAction | null>(null);
  const lastOffsets = useRef(makeQuaternionSet());

  useEffect(() => {
    onCursorOverloadRef.current = onCursorOverload;
  }, [onCursorOverload]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  const bones = useMemo(() => {
    const result = {} as TrackedBones;

    for (const name of TRACKED_BONES) {
      const object = model.getObjectByName(name);
      if (!(object instanceof THREE.Bone)) {
        throw new Error(`The model is missing the required ${name} bone.`);
      }
      result[name] = object;
    }

    model.traverse((object) => {
      if (object instanceof THREE.Mesh) object.frustumCulled = false;
    });

    return result;
  }, [model]);

  const scratch = useMemo(
    () => ({
      inverse: new THREE.Quaternion(),
      euler: new THREE.Euler(0, 0, 0, 'YXZ'),
      next: makeQuaternionSet(),
    }),
    [],
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      prefersReducedMotion.current = media.matches;
      if (media.matches) {
        pointerTarget.current.set(0, 0);
        smoothPointer.current.set(0, 0);
        pointerSamples.current = [];
        idleAction.current?.stop();
        talkAction.current?.stop();
      } else if (!isPulling.current) {
        idleAction.current?.reset().play();
      }
    };
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    const centerPointer = () => {
      pointerTarget.current.set(0, 0);
      pointerSamples.current = [];
    };
    const updatePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (
        bounds.width <= 0 ||
        bounds.height <= 0 ||
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        centerPointer();
        return;
      }

      const now = performance.now();
      if (now < trackingPausedUntil.current) {
        pointerTarget.current.set(0, 0);
        return;
      }

      pointerTarget.current.set(
        THREE.MathUtils.clamp(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -1,
          1,
        ),
        THREE.MathUtils.clamp(
          -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
          -1,
          1,
        ),
      );

      if (
        prefersReducedMotion.current ||
        isPulling.current ||
        now < gestureCooldownUntil.current
      ) {
        pointerSamples.current = [];
        return;
      }

      const samples = pointerSamples.current;
      const previous = samples[samples.length - 1];
      if (previous && now - previous.time < 24) return;

      const diagonal = Math.max(Math.hypot(bounds.width, bounds.height), 1);
      samples.push({
        x: (event.clientX - bounds.left) / diagonal,
        y: (event.clientY - bounds.top) / diagonal,
        time: now,
      });
      while (samples[0] && now - samples[0].time > GESTURE_WINDOW_MS) {
        samples.shift();
      }

      if (isFastCircularGesture(samples)) {
        trackingPausedUntil.current = now + TRACKING_PAUSE_MS;
        gestureCooldownUntil.current = now + GESTURE_COOLDOWN_MS;
        pointerTarget.current.set(0, 0);
        pointerSamples.current = [];
        onCursorOverloadRef.current();
      }
    };
    const handleWindowExit = (event: PointerEvent) => {
      if (event.relatedTarget === null) centerPointer();
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('blur', centerPointer);
    window.addEventListener('pointerout', handleWindowExit);
    window.addEventListener('pointercancel', centerPointer);
    window.addEventListener('touchend', centerPointer, { passive: true });
    return () => {
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('blur', centerPointer);
      window.removeEventListener('pointerout', handleWindowExit);
      window.removeEventListener('pointercancel', centerPointer);
      window.removeEventListener('touchend', centerPointer);
    };
  }, [gl]);

  useEffect(() => {
    const idleClip = gltf.animations.find((clip) => clip.name === 'Idle');
    const action = idleClip ? mixer.clipAction(idleClip) : null;
    idleAction.current = action;

    if (action && !prefersReducedMotion.current) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
    }

    return () => {
      idleAction.current = null;
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    };
  }, [gltf.animations, mixer, model]);

  useEffect(() => {
    if (pullSequence === 0 || prefersReducedMotion.current) return;

    const pullClip = gltf.animations.find(
      (clip) => clip.name === 'PullShutter',
    );
    if (!pullClip) return;

    const action = mixer.clipAction(pullClip);
    const handleFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action !== action) return;
      isPulling.current = false;
      action.fadeOut(0.16);
      idleAction.current?.reset().fadeIn(0.16).play();
    };

    isPulling.current = true;
    idleAction.current?.fadeOut(0.12);
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.fadeIn(0.12).play();
    mixer.addEventListener('finished', handleFinished);

    return () => mixer.removeEventListener('finished', handleFinished);
  }, [gltf.animations, mixer, pullSequence]);

  useEffect(() => {
    const talkClip = gltf.animations.find((clip) => clip.name === 'Talk');
    const action = talkClip ? mixer.clipAction(talkClip) : null;
    talkAction.current = action;

    if (
      !action ||
      !isSpeaking ||
      speechSequence === 0 ||
      prefersReducedMotion.current
    ) {
      return;
    }

    action.reset();
    action.enabled = true;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.fadeIn(0.08).play();

    return () => {
      action.fadeOut(0.08);
    };
  }, [gltf.animations, isSpeaking, mixer, speechSequence]);

  useFrame((_, rawDelta) => {
    const smoothingDelta = Math.min(rawDelta, 0.05);

    for (const name of TRACKED_BONES) {
      scratch.inverse.copy(lastOffsets.current[name]).invert();
      bones[name].quaternion.multiply(scratch.inverse).normalize();
    }

    mixer.update(rawDelta);

    const pointerSmoothing = 1 - Math.exp(-10 * smoothingDelta);
    smoothPointer.current.x +=
      (pointerTarget.current.x - smoothPointer.current.x) * pointerSmoothing;
    smoothPointer.current.y +=
      (pointerTarget.current.y - smoothPointer.current.y) * pointerSmoothing;
    const trackingBlocked =
      isPulling.current ||
      prefersReducedMotion.current ||
      performance.now() < trackingPausedUntil.current;
    const blendRate = trackingBlocked ? 14 : 4;
    cursorBlend.current +=
      ((trackingBlocked ? 0 : 1) - cursorBlend.current) *
      (1 - Math.exp(-blendRate * smoothingDelta));

    const yaw = smoothPointer.current.x * MAX_YAW * cursorBlend.current;
    const pitch = smoothPointer.current.y * MAX_PITCH * cursorBlend.current;

    scratch.next.Torso.setFromEuler(
      scratch.euler.set(-pitch * TORSO_WEIGHT, yaw * TORSO_WEIGHT, 0, 'YXZ'),
    );
    scratch.next.Head.setFromEuler(
      scratch.euler.set(
        -pitch * HEAD_WEIGHT,
        yaw * HEAD_WEIGHT,
        -yaw * 0.045,
        'YXZ',
      ),
    );

    for (const name of TRACKED_BONES) {
      bones[name].quaternion.multiply(scratch.next[name]).normalize();
      lastOffsets.current[name].copy(scratch.next[name]);
    }
  });

  return <primitive object={model} dispose={null} />;
}

export default function CharacterCanvas({
  pullSequence,
  speechSequence,
  isSpeaking,
  onCursorOverload,
  onReady,
}: {
  pullSequence: number;
  speechSequence: number;
  isSpeaking: boolean;
  onCursorOverload: () => void;
  onReady: () => void;
}) {
  return (
    <Canvas
      camera={{ fov: 28, near: 0.1, far: 60, position: [0, 8.4, 12] }}
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
    >
      <ResponsiveCamera />
      <ambientLight intensity={1.7} />
      <directionalLight position={[-4, 8, 7]} intensity={3.2} />
      <directionalLight position={[5, 5, 4]} intensity={1.7} color="#dcecff" />
      <directionalLight position={[0, 8, -5]} intensity={2.2} color="#fff5ed" />
      <Suspense fallback={<ModelLoading />}>
        <CursorMascot
          pullSequence={pullSequence}
          speechSequence={speechSequence}
          isSpeaking={isSpeaking}
          onCursorOverload={onCursorOverload}
          onReady={onReady}
        />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_PATH);
