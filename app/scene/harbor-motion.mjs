import { CatmullRomCurve3, Vector3 } from "three";
import { HARBOR_WATER_LEVEL, sampleHarborWave } from "./harbor-waves.mjs";

// 路徑與船舶都使用校區局部座標，轉動底座不會讓船脫離港池。
export function createBoatAnimations(boats, radar, wake) {
  const route = new CatmullRomCurve3([
    new Vector3(-7.2, 0, 7.15), new Vector3(-2.8, 0, 7.55),
    new Vector3(2.8, 0, 7.1), new Vector3(7.2, 0, 7.65),
    new Vector3(7.25, 0, 8.75), new Vector3(.8, 0, 9), new Vector3(-7.2, 0, 8.6),
  ], true, "centripetal");
  const point = new Vector3(), tangent = new Vector3();
  const wave = { height: 0, dx: 0, dz: 0 };
  const moorings = boats.map(boat => ({ position: boat.position.clone(), yaw: boat.rotation.y }));
  function sampleLaunch(seconds, result) {
    const t = ((seconds / 140 + .23) % 1 + 1) % 1;
    route.getPointAt(t, point); route.getTangentAt(t, tangent);
    return result.set(point.x, point.z, tangent.x, tangent.z);
  }
  function update(seconds, waveScale = 1) {
    boats.forEach((boat, i) => {
      const mooring = moorings[i];
      boat.position.copy(mooring.position);
      boat.rotation.y = mooring.yaw;
      if (i === boats.length - 1) {
        const t = (seconds / 140 + .23) % 1;
        route.getPointAt(t, point); route.getTangentAt(t, tangent);
        boat.position.x = point.x; boat.position.z = point.z;
        boat.rotation.y = -Math.atan2(tangent.z, tangent.x);
        // 尾流貼著港面，不繼承船身 pitch / roll，避免浮動時穿入水面。
        if (wake) { wake.position.set(point.x, HARBOR_WATER_LEVEL, point.z); wake.rotation.y = boat.rotation.y; }
      }
      sampleHarborWave(boat.position.x, boat.position.z, seconds, wave);
      boat.position.y += wave.height * waveScale;
      const c = Math.cos(boat.rotation.y), s = Math.sin(boat.rotation.y), xLimit = i === 0 ? .006 : .012, zLimit = i === 0 ? .005 : .009;
      boat.rotation.x = Math.max(-xLimit, Math.min(xLimit, -(wave.dx * s + wave.dz * c) * .22 * waveScale));
      boat.rotation.z = Math.max(-zLimit, Math.min(zLimit, (wave.dx * c - wave.dz * s) * .22 * waveScale));
    });
    radar.rotation.y = seconds * .25;
  }
  return { update, route, sampleLaunch };
}
