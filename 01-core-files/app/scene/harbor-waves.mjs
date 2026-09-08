export const HARBOR_WATER_LEVEL = .105;
export const HARBOR_WAVES = Object.freeze([
  Object.freeze({ amplitude: .018, x: 2.1, z: .7, speed: .54 }),
  Object.freeze({ amplitude: .011, x: -.9, z: 2.6, speed: -.38 }),
  Object.freeze({ amplitude: .006, x: 3.2, z: -1.4, speed: .29 }),
]);

// CPU 船舶與 GPU 水面使用相同係數；近岸衰減也納入法線導數。
export function sampleHarborWave(x, z, seconds, result = { height: 0, dx: 0, dz: 0 }) {
  let height = 0, dx = 0, dz = 0;
  for (const wave of HARBOR_WAVES) {
    const phase = x * wave.x + z * wave.z + seconds * wave.speed;
    height += Math.sin(phase) * wave.amplitude;
    dx += Math.cos(phase) * wave.amplitude * wave.x;
    dz += Math.cos(phase) * wave.amplitude * wave.z;
  }
  const t = Math.max(0, Math.min(1, (z - 3.58) / 1.35));
  const attenuation = .28 + .72 * t * t * (3 - 2 * t);
  const derivative = .72 * 6 * t * (1 - t) / 1.35;
  result.height = height * attenuation; result.dx = dx * attenuation; result.dz = dz * attenuation + height * derivative;
  return result;
}

const glsl = value => value.toFixed(6);
export const HARBOR_WAVES_GLSL = `
vec3 harborWave(vec2 p,float seconds){
  float h=0.;float dx=0.;float dz=0.;
  ${HARBOR_WAVES.map(w => `{float phase=dot(p,vec2(${glsl(w.x)},${glsl(w.z)}))+seconds*${glsl(w.speed)};
    h+=sin(phase)*${glsl(w.amplitude)};dx+=cos(phase)*${glsl(w.amplitude * w.x)};dz+=cos(phase)*${glsl(w.amplitude * w.z)};}`).join("\n")}
  float t=clamp((p.y-3.58)/1.35,0.,1.);float attenuation=.28+.72*t*t*(3.-2.*t);
  return vec3(h*attenuation,dx*attenuation,dz*attenuation+h*.72*6.*t*(1.-t)/1.35);
}`;
