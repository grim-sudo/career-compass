import { Float32BufferAttribute, MathUtils } from 'three';

// ponytail: one hand-authored jaw shape for this static GLB, not phoneme visemes.
// Accurate articulation would need a facial rig plus audio/phoneme timings unavailable from browser TTS.
export function createJoeMouth(source) {
  const scene = source.clone(true);
  const meshes = [];
  for (const name of ['node_id788', 'node_id791']) {
    const mesh = scene.getObjectByName(name);
    if (!mesh?.isMesh) continue;
    mesh.geometry = mesh.geometry.clone();
    const position = mesh.geometry.attributes.position;
    const delta = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      if (name === 'node_id791') {
        // Inspected topology: 0–29 upper teeth, 30–59 lower teeth, 60–83 tongue.
        delta[i * 3 + 1] = i < 30 ? 0 : i < 60 ? -.01 : -.006;
      } else {
        const seam = 1.65225 + .00025 * x / .023 - .0006 * Math.abs(x) / .023;
        const width = Math.max(0, 1 - (x / .03) ** 2) ** 2;
        const front = MathUtils.smoothstep(z, .07, .105);
        delta[i * 3 + 1] = width * front * (y < seam
          ? -.012 * MathUtils.smoothstep(y, 1.605, 1.64)
          : .002 * (1 - MathUtils.smoothstep(y, 1.653, 1.673)));
      }
    }
    mesh.geometry.morphAttributes.position = [new Float32BufferAttribute(delta, 3)];
    mesh.geometry.morphTargetsRelative = true;
    mesh.updateMorphTargets();
    meshes.push(mesh);
  }
  return {
    scene,
    setOpening: value => meshes.forEach(mesh => { mesh.morphTargetInfluences[0] = MathUtils.clamp(value, 0, 1); }),
    dispose: () => meshes.forEach(mesh => mesh.geometry.dispose()),
  };
}

export function sampleJoeMouth(speech, now) {
  if (!speech.active) return 0;
  // Boundary events reanchor this cadence; missing boundaries retain a modest playback-linked fallback.
  const elapsed = Math.max(0, now - speech.cueAt);
  const cycle = speech.cueDuration || .28;
  return .7 * Math.sin(Math.PI * ((elapsed / cycle) % 1)) ** 2;
}
