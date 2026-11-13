import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three';
import { createJoeMouth, sampleJoeMouth } from './joeLipSync';

test('Joe mouth shape opens the existing lips and lower teeth without changing the cached model', () => {
  const scene = new Group();
  const head = new Mesh(new BufferGeometry());
  head.name = 'node_id788';
  head.geometry.setAttribute('position', new Float32BufferAttribute([0, 1.6519, .1194, 0, 1.6526, .12, 0, 1.69, .138], 3));
  const teeth = new Mesh(new BufferGeometry());
  teeth.name = 'node_id791';
  const positions = Array.from({ length: 84 }, (_, i) => [0, i < 30 ? 1.658 : 1.644, .116]).flat();
  teeth.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  scene.add(head, teeth);
  const mouth = createJoeMouth(scene);
  const clonedHead = mouth.scene.getObjectByName(head.name);
  const clonedTeeth = mouth.scene.getObjectByName(teeth.name);
  expect(clonedHead.geometry).not.toBe(head.geometry);
  expect(head.geometry.morphAttributes.position).toBeUndefined();
  expect(clonedHead.geometry.morphAttributes.position[0].getY(0)).toBeLessThan(-.008);
  expect(clonedHead.geometry.morphAttributes.position[0].getY(1)).toBeGreaterThan(0);
  expect(clonedHead.geometry.morphAttributes.position[0].getY(2)).toBe(0);
  expect(clonedTeeth.geometry.morphAttributes.position[0].getY(0)).toBe(0);
  expect(clonedTeeth.geometry.morphAttributes.position[0].getY(30)).toBeLessThan(-.008);
  mouth.setOpening(1);
  expect(clonedHead.morphTargetInfluences[0]).toBe(1);
  mouth.setOpening(0);
  expect(clonedHead.morphTargetInfluences[0]).toBe(0);
  const dispose = jest.spyOn(clonedHead.geometry, 'dispose');
  mouth.dispose();
  expect(dispose).toHaveBeenCalled();
});

test('mouth cadence runs only during playback and reanchors at speech boundaries', () => {
  const speech = { active: false, cueAt: 1, cueDuration: .3 };
  expect(sampleJoeMouth(speech, 1.1)).toBe(0);
  speech.active = true;
  expect(sampleJoeMouth(speech, 1.1)).toBeGreaterThan(0);
  expect(sampleJoeMouth(speech, 1.1)).not.toBe(sampleJoeMouth(speech, 1.2));
  expect(sampleJoeMouth(speech, 20)).toBeGreaterThanOrEqual(0);
  expect(sampleJoeMouth(speech, 20)).toBeLessThanOrEqual(1);
  const previous = sampleJoeMouth(speech, 1.1);
  speech.cueAt = 1.1;
  expect(sampleJoeMouth(speech, 1.1)).not.toBe(previous);
  speech.active = false;
  expect(sampleJoeMouth(speech, 1.2)).toBe(0);
});

test('the bundled GLB still matches the authored lip seam and tooth groups', () => {
  const file = require('fs').readFileSync(require('path').join(__dirname, '../../public/models/teacher-joe.glb'));
  const length = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + length).toString());
  const scene = new Group();
  for (const [meshId, name] of [[3, 'node_id788'], [4, 'node_id791']]) {
    const accessor = gltf.accessors[gltf.meshes[meshId].primitives[0].attributes.POSITION];
    const view = gltf.bufferViews[accessor.bufferView];
    const offset = 28 + length + (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const points = Array.from({ length: accessor.count * 3 }, (_, i) => file.readFloatLE(offset + Math.floor(i / 3) * (view.byteStride || 12) + i % 3 * 4));
    const mesh = new Mesh(new BufferGeometry());
    mesh.name = name;
    mesh.geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
    scene.add(mesh);
  }
  const sourceHead = scene.getObjectByName('node_id788').geometry.attributes.position;
  const mouth = createJoeMouth(scene);
  const head = mouth.scene.getObjectByName('node_id788');
  const delta = head.geometry.morphAttributes.position[0];
  // These are the inspected lower/upper center lip edges, not an arbitrary face rectangle.
  expect(delta.getY(128)).toBeLessThan(-.01);
  expect(delta.getY(178)).toBeGreaterThan(.001);
  expect(sourceHead.getY(178) + delta.getY(178) - sourceHead.getY(128) - delta.getY(128)).toBeGreaterThan(.01);
  for (let i = 0; i < sourceHead.count; i++) {
    if (sourceHead.getY(i) > 1.675 || sourceHead.getZ(i) < .07) expect(Math.abs(delta.getY(i))).toBe(0);
  }
  const teeth = mouth.scene.getObjectByName('node_id791').geometry;
  expect(teeth.attributes.position.count).toBe(84);
  for (let i = 0; i < 30; i++) expect(teeth.morphAttributes.position[0].getY(i)).toBe(0);
  for (let i = 30; i < 60; i++) expect(teeth.morphAttributes.position[0].getY(i)).toBeLessThan(-.009);
  mouth.dispose();
});
