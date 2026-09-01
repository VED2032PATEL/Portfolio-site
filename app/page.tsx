'use client';

import { Html, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const MODEL_PATH = '/models/mascot_web.glb';
const TRACKED_BONES = ['Torso', 'Head', 'Eye_L', 'Eye_R'] as const;

type TrackedBoneName = (typeof TRACKED_BONES)[number];
type TrackedBones = Record<TrackedBoneName, THREE.Bone>;
type BoneQuaternions = Record<TrackedBoneName, THREE.Quaternion>;

const EYE_WEIGHT = 1 / 1.69;
const HEAD_WEIGHT = 0.55 / 1.69;
const TORSO_WEIGHT = 0.14 / 1.69;
const MAX_YAW = THREE.MathUtils.degToRad(25);
const MAX_PITCH = THREE.MathUtils.degToRad(15);

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

    const targetY = 7.55;
    const aspect = Math.max(size.width / size.height, 0.4);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const verticalDistance = 5.7 / (2 * Math.tan(halfFov));
    const horizontalDistance = 3.85 / (2 * Math.tan(halfFov) * aspect);
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

function CursorMascot() {
  const gltf = useGLTF(MODEL_PATH);
  const model = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const smoothPointer = useRef(new THREE.Vector2());
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
    const idle = gltf.animations.find((clip) => clip.name === 'Idle');
    const action = idle ? mixer.clipAction(idle) : null;

    if (action) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
    }

    return () => {
      action?.stop();
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    };
  }, [gltf.animations, mixer, model]);

  useFrame(({ pointer }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);

    for (const name of TRACKED_BONES) {
      scratch.inverse.copy(lastOffsets.current[name]).invert();
      bones[name].quaternion.multiply(scratch.inverse).normalize();
    }

    mixer.update(delta);

    const smoothing = 1 - Math.exp(-10 * delta);
    smoothPointer.current.x +=
      (THREE.MathUtils.clamp(pointer.x, -1, 1) - smoothPointer.current.x) *
      smoothing;
    smoothPointer.current.y +=
      (THREE.MathUtils.clamp(pointer.y, -1, 1) - smoothPointer.current.y) *
      smoothing;

    const yaw = smoothPointer.current.x * MAX_YAW;
    const pitch = smoothPointer.current.y * MAX_PITCH;

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

function CharacterCanvas() {
  return (
    <Canvas
      camera={{ fov: 28, near: 0.1, far: 60, position: [0, 7.55, 12] }}
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
        <CursorMascot />
      </Suspense>
    </Canvas>
  );
}

export default function Home() {
  return (
    <main className="portfolio-shell">
      <h1 className="sr-only">Interactive portfolio</h1>
      <p className="sr-only">
        An interactive three-dimensional character follows the cursor.
      </p>

      <div className="ambient-orb ambient-orb-left" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-right" aria-hidden="true" />

      <section
        className="glass-stage"
        aria-label="Interactive portfolio character"
      >
        <div className="glass-highlight" aria-hidden="true" />
        <CharacterCanvas />
        <div className="lower-glass-fade" aria-hidden="true" />
      </section>
    </main>
  );
}

useGLTF.preload(MODEL_PATH);
