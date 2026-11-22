import * as THREE from 'three';
import { smoothstep, WEB_PULL } from '../lib/mascot-motion';

const SEGMENTS = 64;
const SIDES = 6;
const FIBERS = 3;
const UP = new THREE.Vector3(0, 1, 0);

/** Reused buffers: no geometry allocation or scene traversal during playback. */
class WebCord {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions = new Float32Array(
    FIBERS * (SEGMENTS + 1) * SIDES * 3,
  );
  private readonly normals = new Float32Array(this.positions.length);
  private readonly material = new THREE.MeshStandardMaterial({
    color: '#c8cdd0',
    roughness: 0.58,
    metalness: 0.06,
    transparent: true,
    depthWrite: false,
  });
  private readonly patchMaterial = new THREE.LineBasicMaterial({
    color: '#939fa8',
    transparent: true,
    depthWrite: false,
  });
  private readonly patch = new THREE.Group();
  private readonly patchGeometry = new THREE.BufferGeometry();
  private readonly direction = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly binormal = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly radial = new THREE.Vector3();

  constructor() {
    const indices: number[] = [];
    const colors = new Float32Array(this.positions.length);
    for (let f = 0; f < FIBERS; f++) {
      for (let i = 0; i <= SEGMENTS; i++) {
        for (let s = 0; s < SIDES; s++) {
          const v = (f * (SEGMENTS + 1) + i) * SIDES + s;
          const brightness = 0.8 + f * 0.09;
          colors.set([brightness, brightness, brightness], v * 3);
          if (i < SEGMENTS) {
            const next = (s + 1) % SIDES;
            const a = (f * (SEGMENTS + 1) + i) * SIDES;
            indices.push(
              a + s,
              a + next,
              a + SIDES + s,
              a + next,
              a + SIDES + next,
              a + SIDES + s,
            );
          }
        }
      }
    }
    this.geometry.setIndex(indices);
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(this.normals, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.material.vertexColors = true;
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.group.add(mesh);

    // An irregular eight-spoke attachment with two fine connecting rings.
    const patch: number[] = [];
    const point = (i: number, ring: number) => {
      const a = (i / 8) * Math.PI * 2;
      const r = ring * (0.82 + 0.18 * Math.sin(i * 3.7));
      return [Math.cos(a) * r, Math.sin(a) * r, 0];
    };
    for (let i = 0; i < 8; i++) {
      patch.push(0, 0, 0, ...point(i, 1));
      for (const ring of [0.4, 0.72])
        patch.push(...point(i, ring), ...point((i + 1) % 8, ring));
    }
    this.patchGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(patch, 3),
    );
    this.patch.add(
      new THREE.LineSegments(this.patchGeometry, this.patchMaterial),
    );
    this.group.add(this.patch);
    this.group.visible = false;
  }

  update(
    hand: THREE.Vector3,
    anchor: THREE.Vector3,
    time: number,
    index: number,
  ) {
    const age = time - WEB_PULL.shoot - index * WEB_PULL.secondShotDelay;
    const flight = WEB_PULL.attach - WEB_PULL.shoot;
    const launch = smoothstep(age / flight);
    const release = smoothstep(
      (time - WEB_PULL.land) / (WEB_PULL.release - WEB_PULL.land),
    );
    this.group.visible = age > 0 && release < 1;
    if (!this.group.visible) return;
    this.material.opacity = smoothstep(age / 0.045) * (1 - release);
    this.end.copy(hand).lerp(anchor, launch);
    this.direction.subVectors(this.end, hand).normalize();
    this.normal.crossVectors(this.direction, UP);
    if (this.normal.lengthSq() < 0.001) this.normal.set(1, 0, 0);
    this.normal.normalize();
    this.binormal.crossVectors(this.direction, this.normal).normalize();
    const length = this.end.distanceTo(hand);
    const coil = 0.055 * Math.sin(Math.PI * launch) + 0.045 * release;
    // A small impact wave dies out once the strand takes the load.
    const impactAge = Math.max(0, age - flight);
    const impact = age >= flight ? 0.018 * Math.exp(-impactAge * 18) : 0;
    for (let i = 0; i <= SEGMENTS; i++) {
      const u = i / SEGMENTS;
      const envelope = Math.sin(Math.PI * u);
      const phase = u * Math.PI * 10 - launch * 8;
      this.center
        .copy(hand)
        .lerp(this.end, u)
        .addScaledVector(
          this.normal,
          envelope *
            (coil * Math.sin(phase) +
              impact * Math.sin(u * 17 - impactAge * 36)),
        )
        .addScaledVector(
          this.binormal,
          envelope * coil * Math.cos(phase) * 0.5,
        );
      this.center.y -= envelope * (0.012 + release * 0.18);
      for (let f = 0; f < FIBERS; f++) {
        const braid = u * length * 34 + (f / FIBERS) * Math.PI * 2;
        const spread = 0.0045 * Math.min(1, envelope * 8);
        const radius = 0.004 * (0.7 + 0.3 * Math.sin(Math.PI * u));
        for (let s = 0; s < SIDES; s++) {
          const a = (s / SIDES) * Math.PI * 2;
          this.radial
            .copy(this.normal)
            .multiplyScalar(Math.cos(a))
            .addScaledVector(this.binormal, Math.sin(a));
          const offset = ((f * (SEGMENTS + 1) + i) * SIDES + s) * 3;
          this.normals[offset] = this.radial.x;
          this.normals[offset + 1] = this.radial.y;
          this.normals[offset + 2] = this.radial.z;
          this.positions[offset] =
            this.center.x +
            this.normal.x * Math.cos(braid) * spread +
            this.binormal.x * Math.sin(braid) * spread +
            this.radial.x * radius;
          this.positions[offset + 1] =
            this.center.y +
            this.normal.y * Math.cos(braid) * spread +
            this.binormal.y * Math.sin(braid) * spread +
            this.radial.y * radius;
          this.positions[offset + 2] =
            this.center.z +
            this.normal.z * Math.cos(braid) * spread +
            this.binormal.z * Math.sin(braid) * spread +
            this.radial.z * radius;
        }
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    const attached = smoothstep((age - flight + 0.02) / 0.09);
    this.patch.position.copy(anchor);
    this.patch.scale.setScalar(0.09 * attached);
    this.patchMaterial.opacity = 0.75 * attached * (1 - release);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.patchGeometry.dispose();
    this.patchMaterial.dispose();
  }
}

export class WebTethers {
  readonly group = new THREE.Group();
  private readonly cords = [new WebCord(), new WebCord()];
  private readonly anchor = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  constructor() {
    this.group.add(...this.cords.map((cord) => cord.group));
  }

  update(
    time: number,
    hands: THREE.Vector3[],
    shutterY: number,
    camera: THREE.Camera,
    bounds: DOMRect,
    width: number,
    height: number,
  ) {
    this.group.visible = true;
    hands.forEach((hand, index) => {
      this.projected.copy(hand).project(camera);
      const anchorX = (this.projected.x < 0 ? 0.29 : 0.71) * width;
      this.anchor
        .set(
          ((anchorX - bounds.left) / bounds.width) * 2 - 1,
          1 - ((shutterY * height - bounds.top) / bounds.height) * 2,
          0.5,
        )
        .unproject(camera);
      this.ray.subVectors(this.anchor, camera.position).normalize();
      // Place the attachment behind the hands, on the page's virtual plane.
      this.anchor
        .copy(camera.position)
        .addScaledVector(this.ray, (0.15 - camera.position.z) / this.ray.z);
      this.cords[index].update(hand, this.anchor, time, index);
    });
  }
  hide() {
    this.group.visible = false;
  }
  dispose() {
    this.cords.forEach((cord) => cord.dispose());
  }
}
