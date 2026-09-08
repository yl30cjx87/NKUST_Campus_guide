import * as THREE from "three";
import { HARBOR_WATER_LEVEL, HARBOR_WAVES_GLSL } from "./harbor-waves.mjs";

export type ShipDetails = {
  lights: { kind: "port" | "starboard" | "mast"; position: THREE.Vector3; color: number }[];
  moorings: THREE.Vector3[];
};

// 裝飾都使用校區局部座標；只更新少量線段和平面，不使用繩索物理或反射渲染。
export function createHarborLife(parent: THREE.Group, boats: THREE.Group[], details: ShipDetails[], plane: THREE.BufferGeometry) {
  const cables = details.slice(0, 3).flatMap((ship, boatIndex) => ship.moorings.map(local => {
    const x = boats[boatIndex].position.x + local.x * boats[boatIndex].scale.x;
    return { boatIndex, local, dock: new THREE.Vector3(-10.2 + Math.round((x + 10.2) / 1.4) * 1.4, .48, 3.22) };
  }));
  const segments = 5, cablePositions = new Float32Array(cables.length * segments * 2 * 3);
  const cableGeometry = new THREE.BufferGeometry();
  cableGeometry.setAttribute("position", new THREE.BufferAttribute(cablePositions, 3).setUsage(THREE.DynamicDrawUsage));
  cableGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .6, 4), 12);
  const ropes = new THREE.LineSegments(cableGeometry, new THREE.LineBasicMaterial({ color: 0x8c8571 }));
  ropes.name = "six-mooring-lines"; parent.add(ropes);

  const reflections = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
    uniforms: { opacity: { value: 0 }, time: { value: 0 } },
    vertexShader: `${HARBOR_WAVES_GLSL}
      uniform float time;varying vec2 stripUv; varying vec3 stripColor;
      void main(){stripUv=uv;stripColor=instanceColor;vec4 p=instanceMatrix*vec4(position,1.);
        p.x+=sin(p.z*12.+time*.8)*.018;p.y=${HARBOR_WATER_LEVEL}+harborWave(p.xz,time).x+.012;
        gl_Position=projectionMatrix*modelViewMatrix*p;}`,
    fragmentShader: `varying vec2 stripUv; varying vec3 stripColor; uniform float opacity;
      void main(){vec2 d=abs(stripUv-.5);float edge=(1.-smoothstep(.08,.5,d.x))*(1.-smoothstep(.12,.5,d.y));gl_FragColor=vec4(stripColor,opacity*edge);
      #include <colorspace_fragment>
      }`,
  });
  const sources: { fixed?: THREE.Vector3; boatIndex?: number; local?: THREE.Vector3; color: number; width: number; length: number; strips: number }[] = [
    ...[-8.3, .9, 8.25].map(x => ({ fixed: new THREE.Vector3(x, .16, 4.1), color: 0xffcb8c, width: .2, length: 1.9, strips: 4 })),
    { fixed: new THREE.Vector3(-.65, .16, 4.1), color: 0xffba74, width: .18, length: 1.05, strips: 3 },
    ...details.flatMap((ship, boatIndex) => ship.lights.map(light => ({ boatIndex, local: light.position, color: light.color, width: .11, length: .66, strips: 2 }))),
  ];
  const reflectionMesh = new THREE.InstancedMesh(plane, reflections, sources.reduce((sum, source) => sum + source.strips, 0));
  reflectionMesh.name = "harbor-light-reflections"; reflectionMesh.frustumCulled = false; reflectionMesh.visible = false;
  reflectionMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parent.add(reflectionMesh);
  const point = new THREE.Vector3(), dummy = new THREE.Object3D(), color = new THREE.Color();
  let instanceIndex = 0;
  for (const source of sources) for (let strip = 0; strip < source.strips; strip++) reflectionMesh.setColorAt(instanceIndex++, color.setHex(source.color));

  function update(seconds: number) {
    reflections.uniforms.time.value = seconds;
    boats.forEach(boat => boat.updateMatrix());
    let offset = 0;
    for (const cable of cables) {
      point.copy(cable.local).applyMatrix4(boats[cable.boatIndex].matrix);
      for (let segment = 0; segment < segments; segment++) for (const t of [segment / segments, (segment + 1) / segments]) {
        cablePositions[offset++] = THREE.MathUtils.lerp(cable.dock.x, point.x, t);
        cablePositions[offset++] = THREE.MathUtils.lerp(cable.dock.y, point.y, t) - Math.sin(t * Math.PI) * .085;
        cablePositions[offset++] = THREE.MathUtils.lerp(cable.dock.z, point.z, t);
      }
    }
    cableGeometry.attributes.position.needsUpdate = true;
    if (!reflectionMesh.visible) return;
    let index = 0;
    for (const source of sources) {
      if (source.fixed) point.copy(source.fixed);
      else {
        point.copy(source.local!).applyMatrix4(boats[source.boatIndex!].matrix);
        point.z += .3 + point.y * .25;
      }
      for (let strip = 0; strip < source.strips; strip++) {
        const shimmer = Math.sin(seconds * .55 + index * 1.6);
        dummy.position.set(point.x + shimmer * .035, .158, Math.min(10.82, point.z + strip * source.length / source.strips));
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(source.width * (1 - strip * .12) * (1 + shimmer * .1), source.length / source.strips * .85, 1);
        dummy.updateMatrix(); reflectionMesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    reflectionMesh.instanceMatrix.needsUpdate = true;
  }
  function setNight(value: number) {
    reflections.uniforms.opacity.value = value * .19;
    reflectionMesh.visible = value > .001;
  }
  update(0);
  return { ropes, cables, reflectionMesh, reflections, sources, update, setNight };
}

// 三個背景剪影共用 4 個三角面；以螢幕座標滑行，不影響模型取景範圍。
export function createDistantSeabirds(time: { value: number }, night: { value: number }, aspect: { value: number }) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, -.07, 0, -.24, .13, 0, -.5, .035, 0, 0, -.07, 0, -.5, .035, 0, -.24, .045, 0,
    0, -.07, 0, .5, .035, 0, .24, .13, 0, 0, -.07, 0, .24, .045, 0, .5, .035, 0,
  ], 3));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
    uniforms: { time, night, aspect },
    vertexShader: `uniform float time; uniform float aspect;
      void main(){float phase=instanceMatrix[3].x;vec2 p=position.xy*vec2(.032/aspect,.032);
        p+=vec2(mod(time*.012+phase+1.4,2.8)-1.4,instanceMatrix[3].y+sin(time*.07+phase*3.)*.012);
        gl_Position=vec4(p,.999,1.);}`,
    fragmentShader: `uniform float night;void main(){gl_FragColor=vec4(.085,.14,.17,(1.-night)*.72);
      #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, 3), matrix = new THREE.Matrix4();
  for (let index = 0; index < 3; index++) mesh.setMatrixAt(index, matrix.makeTranslation(-.78 + index * .14, .58 + index * .035, 0));
  mesh.name = "distant-seabirds"; mesh.frustumCulled = false; mesh.renderOrder = -90;
  return { mesh, dispose() { mesh.removeFromParent(); mesh.dispose(); geometry.dispose(); material.dispose(); } };
}
