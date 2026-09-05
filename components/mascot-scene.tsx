'use client';

import { Html, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const MODEL_PATH = '/models/mascot_shutter.glb';
const TRACKED_BONES = ['Torso', 'Head', 'Eye_L', 'Eye_R'] as const;

type TrackedBoneName = (typeof TRACKED_BONES)[number];
type TrackedBones = Record<TrackedBoneName, THREE.Bone>;
type BoneQuaternions = Record<TrackedBoneName, THREE.Quaternion>;

const EYE_WEIGHT = 0.55;
const HEAD_WEIGHT = 0.47;
const TORSO_WEIGHT = 0.1;
const MAX_YAW = THREE.MathUtils.degToRad(28);
const MAX_PITCH = THREE.MathUtils.degToRad(18);

function makeQuaternionSet(): BoneQuaternions {
  return {
    Torso: new THREE.Quaternion(),
    Head: new THREE.Quaternion(),
    Eye_L: new THREE.Quaternion(),
    Eye_R: new THREE.Quaternion(),
  };
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

function CursorMascot({ pullSequence }: { pullSequence: number }) {
  const { gl } = useThree();
  const gltf = useGLTF(MODEL_PATH);
  const model = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const pointerTarget = useRef(new THREE.Vector2());
  const smoothPointer = useRef(new THREE.Vector2());
  const cursorBlend = useRef(1);
  const isPulling = useRef(false);
  const prefersReducedMotion = useRef(false);
  const idleAction = useRef<THREE.AnimationAction | null>(null);
  const lastOffsets = useRef(makeQuaternionSet());

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
      eyeYaw: new THREE.Quaternion(),
      eyePitch: new THREE.Quaternion(),
      xAxis: new THREE.Vector3(1, 0, 0),
      zAxis: new THREE.Vector3(0, 0, 1),
      next: makeQuaternionSet(),
    }),
    [],
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      prefersReducedMotion.current = media.matches;
    };
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    const centerPointer = () => pointerTarget.current.set(0, 0);
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
    cursorBlend.current +=
      ((isPulling.current || prefersReducedMotion.current ? 0 : 1) -
        cursorBlend.current) *
      (1 - Math.exp(-8 * smoothingDelta));

    const yaw = smoothPointer.current.x * MAX_YAW * cursorBlend.current;
    const pitch = smoothPointer.current.y * MAX_PITCH * cursorBlend.current;

    scratch.next.Torso.setFromEuler(
      scratch.euler.set(-pitch * TORSO_WEIGHT, yaw * TORSO_WEIGHT, 0, 'YXZ'),
    );
    scratch.next.Head.setFromEuler(
      scratch.euler.set(-pitch * HEAD_WEIGHT, yaw * HEAD_WEIGHT, 0, 'YXZ'),
    );

    scratch.eyeYaw.setFromAxisAngle(scratch.zAxis, yaw * EYE_WEIGHT);
    scratch.eyePitch.setFromAxisAngle(scratch.xAxis, pitch * EYE_WEIGHT);
    scratch.next.Eye_L.copy(scratch.eyeYaw)
      .multiply(scratch.eyePitch)
      .normalize();
    scratch.next.Eye_R.copy(scratch.next.Eye_L);

    for (const name of TRACKED_BONES) {
      bones[name].quaternion.multiply(scratch.next[name]).normalize();
      lastOffsets.current[name].copy(scratch.next[name]);
    }
  });

  return <primitive object={model} dispose={null} />;
}

export default function CharacterCanvas({
  pullSequence,
}: {
  pullSequence: number;
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
        <CursorMascot pullSequence={pullSequence} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_PATH);
