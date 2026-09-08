import * as THREE from "three";
import { HARBOR_WATER_LEVEL, HARBOR_WAVES_GLSL } from "./harbor-waves.mjs";

type Scalar = { value: number };

export function createHarborWake(time: Scalar) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (const side of [-1, 1]) {
    const start = positions.length / 3;
    for (let i = 0; i <= 4; i++) {
      const t = i / 4, width = .027 + t * .07;
      for (const edge of [-1, 1]) {
        positions.push(-1.04 - t * 1.12, 0, side * (.26 + t * .42) + edge * width);
        uv.push((edge + 1) / 2, t);
      }
      if (i < 4) { const n = start + i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
    uniforms: { time, pose: { value: new THREE.Vector3() }, night: { value: 0 } },
    vertexShader: `${HARBOR_WAVES_GLSL}
      uniform float time;uniform vec3 pose;varying vec2 wakeUv;
      void main(){wakeUv=uv;vec3 p=position;p.z+=sign(p.z)*uv.y*.025*sin(time*.55-uv.y*4.);
        float c=cos(pose.z),s=sin(pose.z);vec2 waterPoint=pose.xy+vec2(c*p.x+s*p.z,-s*p.x+c*p.z);
        p.y=harborWave(waterPoint,time).x+.012;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float time;uniform float night;varying vec2 wakeUv;
      void main(){float edge=1.-smoothstep(.12,.5,abs(wakeUv.x-.5));
        float fade=pow(1.-wakeUv.y,1.6)*smoothstep(0.,.08,wakeUv.y);
        float pulse=.65+.35*sin(wakeUv.y*22.-time*1.7);
        gl_FragColor=vec4(mix(vec3(.66,.82,.79),vec3(.12,.25,.3),night),edge*fade*pulse*.38);
        #include <colorspace_fragment>
      }`,
  });
  const wake = new THREE.Mesh(geometry, material); wake.name = "launch-wake"; wake.position.set(0, HARBOR_WATER_LEVEL, 8);
  wake.frustumCulled = false;
  return wake;
}

// 一批 Points 同時處理泡沫、水花、稀疏空氣微粒與偶發高光；不逐顆更新 CPU 位置。
export function createHarborAtmosphere(parent: THREE.Group, workboat: THREE.Group, workLight: THREE.Vector3, time: Scalar, night: Scalar, compact: boolean) {
  const counts = compact ? [24, 8, 6, 18] : [40, 12, 12, 28];
  const positions: number[] = [], seeds: number[] = [], kinds: number[] = [];
  const random = (i: number, salt: number) => { const value = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return value - Math.floor(value); };
  let index = 0;
  counts.forEach((count, kind) => {
    for (let i = 0; i < count; i++, index++) {
      kinds.push(kind); seeds.push(random(index, 1), random(index, 2), random(index, 3), random(index, 4));
      if (kind === 2) positions.push([-8.3, .9, 8.25][i % 3] + (random(index, 5) - .5) * .55, 2.25 + random(index, 6) * .8, 3.03 + random(index, 7) * .42);
      else if (kind === 3) positions.push((random(index, 5) - .5) * 19.4, 0, 4.2 + random(index, 6) * 6);
      else positions.push(0, 0, 0);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("seed", new THREE.Float32BufferAttribute(seeds, 4)); geometry.setAttribute("kind", new THREE.Float32BufferAttribute(kinds, 1));
  const trail = Array.from({ length: 8 }, () => new THREE.Vector4());
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time, night, trail: { value: trail }, pixelScale: { value: 400 }, pixelRatio: { value: 1 } },
    vertexShader: `${HARBOR_WAVES_GLSL}
      uniform float time;uniform float night;uniform float pixelScale;uniform float pixelRatio;uniform vec4 trail[8];
      attribute vec4 seed;attribute float kind;varying float alpha;varying vec3 tint;
      vec4 poseAt(float seconds){float slot=clamp(seconds/4.2*7.,0.,7.);int i=int(floor(slot));return mix(trail[i],trail[min(i+1,7)],fract(slot));}
      void main(){vec3 p=position;float size=.035;alpha=0.;tint=mix(vec3(.78,.88,.84),vec3(.15,.27,.31),night);
        if(kind<1.5){
          bool foam=kind<.5;float age=fract(time*(foam?1./4.2:1.1)+seed.x);vec4 pose=poseAt(age*(foam?4.2:.9));
          vec2 forward=normalize(pose.zw),side=vec2(-forward.y,forward.x);float signSide=seed.y<.5?-1.:1.;
          p.xz=pose.xy+forward*(foam?-1.13-age*.12:1.1)+side*signSide*(foam?.24+age*.28+seed.z*.06:.15+age*.11);
          p.y=${HARBOR_WATER_LEVEL} +harborWave(p.xz,time).x+.014+(foam?0.:sin(age*3.14159)*(.04+seed.z*.045));
          alpha=(foam?.32:.42)*smoothstep(0.,.08,age)*pow(1.-age,1.5);size=(foam?.035+age*.04:.027+seed.w*.018);
        }else if(kind<2.5){
          p+=vec3(sin(time*.16+seed.x*6.)*.045,sin(time*.2+seed.y*6.)*.055,cos(time*.13+seed.z*6.)*.045);
          tint=vec3(.75,.59,.38);alpha=night*.12*pow(max(0.,sin(time*.32+seed.w*6.)),3.);size=.024;
        }else{
          p.y=${HARBOR_WATER_LEVEL}+harborWave(p.xz,time).x+.018;
          alpha=(1.-night)*.3*pow(max(0.,sin(time*.6+seed.x*6.283)),28.);size=.026+seed.y*.025;
        }
        if(p.z>10.9||p.z<2.8||abs(p.x)>10.9)alpha=0.;
        vec4 viewPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*viewPosition;
        gl_PointSize=clamp(size*pixelScale*projectionMatrix[1][1]/max(.1,-viewPosition.z),1.,3.*pixelRatio);
      }`,
    fragmentShader: `varying float alpha;varying vec3 tint;
      void main(){float radius=length(gl_PointCoord-.5);float soft=1.-smoothstep(.08,.5,radius);
        gl_FragColor=vec4(tint,alpha*soft);
        #include <colorspace_fragment>
      }`,
  });
  const particles = new THREE.Points(geometry, material); particles.name = "harbor-micro-particles"; particles.frustumCulled = false; parent.add(particles);

  // 五個開口六邊錐共用一個材質；邊緣以視線角度淡出，不做體積採樣。
  const beamGeometry = new THREE.ConeGeometry(1, 1, 6, 1, true); beamGeometry.translate(0, -.5, 0);
  const beamMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { night },
    vertexShader: `varying vec2 beamUv;varying vec3 viewNormal;varying vec3 viewDirection;
      void main(){beamUv=uv;vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);
        vec3 n=normal/vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));
        viewNormal=normalMatrix*mat3(instanceMatrix)*n;viewDirection=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float night;varying vec2 beamUv;varying vec3 viewNormal;varying vec3 viewDirection;
      void main(){float edge=pow(abs(dot(normalize(viewNormal),normalize(viewDirection))),1.6);
        float ends=smoothstep(0.,.2,beamUv.y)*(1.-smoothstep(.85,1.,beamUv.y));
        gl_FragColor=vec4(.7,.52,.3,night*.023*edge*ends);
        #include <colorspace_fragment>
      }`,
  });
  const beams = new THREE.InstancedMesh(beamGeometry, beamMaterial, 5); beams.name = "soft-harbor-light-beams";
  beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage); beams.frustumCulled = false; beams.visible = false; parent.add(beams);
  const dummy = new THREE.Object3D(), axis = new THREE.Vector3(), start = new THREE.Vector3(), end = new THREE.Vector3();
  const workBeamOffset = new THREE.Vector3(0, -1.25, .7);
  function setBeam(i: number, from: THREE.Vector3, to: THREE.Vector3, width: number) {
    axis.copy(from).sub(to); const height = axis.length(); dummy.position.copy(from); dummy.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, axis.normalize());
    dummy.scale.set(width, height, width); dummy.updateMatrix(); beams.setMatrixAt(i, dummy.matrix);
  }
  setBeam(0, start.set(-.65, 1.78, .55), end.set(-.65, .36, 1.25), .46);
  [-8.3, .9, 8.25].forEach((x, i) => setBeam(i + 1, start.set(x, 3.14, 3.13), end.set(x, .2, 3.58), .48));
  function update(seconds: number, sampleLaunch: (seconds: number, result: THREE.Vector4) => THREE.Vector4) {
    for (let i = 0; i < trail.length; i++) sampleLaunch(seconds - i * .6, trail[i]);
    beams.visible = night.value > .001;
    if (beams.visible) {
      workboat.updateMatrix(); start.copy(workLight).applyMatrix4(workboat.matrix);
      end.copy(workLight).add(workBeamOffset).applyMatrix4(workboat.matrix);
      setBeam(4, start, end, .36); beams.instanceMatrix.needsUpdate = true;
    }
  }
  function setPixelScale(height: number, ratio: number) { material.uniforms.pixelScale.value = height * ratio / 2; material.uniforms.pixelRatio.value = ratio; }
  function dispose() {
    particles.removeFromParent(); beams.removeFromParent(); beams.dispose();
    geometry.dispose(); material.dispose(); beamGeometry.dispose(); beamMaterial.dispose();
  }
  return { particles, beams, counts, trail, update, setPixelScale, dispose };
}
