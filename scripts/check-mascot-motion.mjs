import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_PULL, motionDelta, webPullProgress } from '../lib/mascot-motion.ts';

const bytes = readFileSync(new URL('../public/models/mascot_web_pull.glb', import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binary = bytes.subarray(28 + jsonLength);
const clip = gltf.animations.find((animation) => animation.name === 'PullShutter');
assert(clip, 'Web pull clip must exist');

function floats(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType, 5126);
  assert(!view.extensions, 'New clip channels must be directly readable');
  const size = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return { size, values: Array.from({ length: accessor.count * size }, (_, i) => binary.readFloatLE(offset + i * 4)) };
}

for (const channel of clip.channels) {
  const sampler = clip.samplers[channel.sampler];
  const time = floats(sampler.input).values;
  const { size, values } = floats(sampler.output);
  assert(Math.abs(time[0]) < 1e-6);
  assert(Math.abs(time.at(-1) - WEB_PULL.duration) < 1e-5);
  assert(time.every((value, i) => i === 0 || value > time[i - 1]));
  const name = gltf.nodes[channel.target.node].name;
  if (channel.target.path === 'scale') {
    assert(values.every((value) => Math.abs(value - 1) < 1e-4), `${name} must not inflate`);
  }
  for (let i = 0; i < size; i++) {
    assert(Math.abs(values[i] - values[values.length - size + i]) < 1e-4, `${name} must return to neutral`);
  }
  if (channel.target.path === 'rotation') {
    for (let i = 0; i < values.length; i += 4) {
      assert(Math.abs(Math.hypot(...values.slice(i, i + 4)) - 1) < 1e-4, `${name} quaternion normalized`);
      if (i > 0) {
        const dot = values.slice(i, i + 4).reduce((sum, value, j) => sum + value * values[i - 4 + j], 0);
        assert(dot > Math.cos(Math.PI / 20), `${name} must not flip or jump between 60 fps samples`);
      }
    }
  }
}
assert.equal(webPullProgress(WEB_PULL.pull), 0);
assert.equal(webPullProgress(WEB_PULL.land), 1);
assert.equal(motionDelta(1 / 15, false, false), 1 / 15, '15fps must not become slow motion');
assert.equal(motionDelta(2, false, true), 0, 'Resume must not jump');
assert.equal(motionDelta(1 / 60, true, false), 0, 'Hidden tabs pause');
for (const fps of [15, 30, 60, 120]) {
  let time = 0;
  for (let frame = 0; frame < fps * 5; frame++) time += motionDelta(1 / fps, false, false);
  assert(Math.abs(time - 5) < 1e-10);
}
console.log(`Passed: ${clip.channels.length} animation channels; neutral endpoints; joint scales; quaternion continuity; frame-rate independent clock.`);
