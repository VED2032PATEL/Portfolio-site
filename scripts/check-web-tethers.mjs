import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import { WEB_PULL } from '../lib/mascot-motion.ts';
// Load the renderer in Node without a browser or a new runtime dependency.
const source = fs.readFileSync(
  new URL('../components/web-tethers.ts', import.meta.url),
  'utf8',
);
let compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
compiled = compiled
  .replace(/from ['"]three['"]/g, `from '${import.meta.resolve('three')}'`)
  .replace(
    /from ['"]\.\.\/lib\/mascot-motion['"]/g,
    `from '${new URL('../lib/mascot-motion.ts', import.meta.url)}'`,
  );
const { WebTethers } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
for (const [width, height] of [
  [1600, 900],
  [390, 844],
  [1000, 1000],
]) {
  const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 60);
  camera.position.set(0, 8.4, 12);
  camera.lookAt(0, 8.4, 0);
  camera.updateMatrixWorld();
  const webs = new WebTethers();
  const hands = [new THREE.Vector3(1.5, 9, 2), new THREE.Vector3(-1.5, 8.9, 2)];
  const bounds = { left: 0, top: 0, width, height };
  for (const shutterY of [0.008, 0.3, 0.75, 1]) {
    webs.update(2, hands, shutterY, camera, bounds, width, height);
    webs.group.children.forEach((cord, index) => {
      assert(cord.visible);
      const geometry = cord.children[0].geometry;
      const positions = geometry.getAttribute('position');
      const normals = geometry.getAttribute('normal');
      assert(
        [...positions.array].every(Number.isFinite),
        'Web vertices must be finite',
      );
      const first = new THREE.Vector3(),
        last = new THREE.Vector3();
      for (let f = 0; f < 3; f++)
        for (let s = 0; s < 6; s++) {
          first.add(
            new THREE.Vector3().fromBufferAttribute(positions, f * 65 * 6 + s),
          );
          last.add(
            new THREE.Vector3().fromBufferAttribute(
              positions,
              (f * 65 + 64) * 6 + s,
            ),
          );
        }
      first.divideScalar(18);
      last.divideScalar(18);
      assert(
        first.distanceTo(hands[index]) < 1e-5,
        'Web must remain on the wrist',
      );
      last.project(camera);
      assert(
        Math.abs((1 - last.y) / 2 - shutterY) < 1e-5,
        'Web attachment must follow shutter in screen space',
      );
      const x = (last.x + 1) / 2;
      assert(Math.min(Math.abs(x - 0.29), Math.abs(x - 0.71)) < 1e-5);
      for (let i = 0; i < normals.count; i++)
        assert(
          Math.abs(
            new THREE.Vector3().fromBufferAttribute(normals, i).length() - 1,
          ) < 1e-5,
        );
    });
  }
  webs.update(0, hands, 0, camera, bounds, width, height);
  assert(webs.group.children.every((c) => !c.visible));
  webs.update(WEB_PULL.release + 0.01, hands, 1, camera, bounds, width, height);
  assert(webs.group.children.every((c) => !c.visible));
  webs.dispose();
}
console.log(
  'Passed: web attachment and emitter alignment at three aspect ratios; finite geometry; unit normals; launch/release visibility.',
);
