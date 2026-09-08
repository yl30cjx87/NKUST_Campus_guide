import * as THREE from "three";

export type FirstCampusTree = { x: number; z: number; height: number; crown?: "round" | "wide" | "tall"; phase?: number; scale?: number };
type Pose = "sport" | "sit" | "walk" | "sing" | "guitar" | "drum" | "watch";
type Actor = { x: number; z: number; color: number; pose: Pose; phase: number; facing?: number; floor?: number; seat?: number };

/** Day and night activities are created once and blended without rebuilding the campus. */
export function createFirstCampusLife(group: THREE.Group, trees: FirstCampusTree[], leaves: THREE.Material) {
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const ownGeo = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g);
  const toon = (color: number, emissive = 0) => { const m = new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: emissive ? 1 : 0 }); materials.push(m); return m; };
  const dummy = new THREE.Object3D(); let clock = 0, disposed = false;

  const crownGeo = ownGeo(new THREE.IcosahedronGeometry(.5, 2));
  const crownLayers = 7;
  const canopy = new THREE.InstancedMesh(crownGeo, leaves, trees.length * crownLayers);
  canopy.name = "animated-tree-crowns"; canopy.castShadow = true; canopy.receiveShadow = true; canopy.frustumCulled = false;
  canopy.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(canopy);
  const greens = [0x4a9f45, 0x58b84b, 0x69cb4e, 0x82d95a, 0xa6e86d, 0x3d9148, 0xc0f184];
  for (let i = 0; i < canopy.count; i++) canopy.setColorAt(i, new THREE.Color(greens[i % greens.length]));

  const dayGroup = new THREE.Group(); dayGroup.name = "first-campus-day-life"; group.add(dayGroup);
  const nightGroup = new THREE.Group(); nightGroup.name = "first-campus-night-life"; group.add(nightGroup);
  const bodyGeo = ownGeo(new THREE.SphereGeometry(.22, 12, 8)), headGeo = ownGeo(new THREE.SphereGeometry(.165, 12, 8));
  const hairGeo = ownGeo(new THREE.SphereGeometry(.169, 12, 6, 0, Math.PI * 2, 0, Math.PI * .49));
  const faceGeo = ownGeo(new THREE.SphereGeometry(.024, 6, 4));
  const faceMat = toon(0xffffff);
  const dollHeight = .72;
  // Rounded ends overlap slightly at the joint instead of exposing cut cylinder ends.
  const limbGeo = ownGeo(new THREE.CapsuleGeometry(.055, .31, 3, 6));
  const contactGeo = ownGeo(new THREE.CircleGeometry(.26, 16)); contactGeo.rotateX(-Math.PI / 2);
  const skin = toon(0xf0c6a1), dark = toon(0x273747);
  const contactMat = new THREE.MeshBasicMaterial({ color: 0x26332d, transparent: true, opacity: .16, depthWrite: false }); materials.push(contactMat);

  function createActors(parent: THREE.Group, actors: Actor[]) {
    const clothes = toon(0xffffff);
    const bodies = new THREE.InstancedMesh(bodyGeo, clothes, actors.length * 3), heads = new THREE.InstancedMesh(headGeo, skin, actors.length * 3);
    const arms = new THREE.InstancedMesh(limbGeo, skin, actors.length * 4), legs = new THREE.InstancedMesh(limbGeo, dark, actors.length * 4);
    const hair = new THREE.InstancedMesh(hairGeo, dark, actors.length), shoes = new THREE.InstancedMesh(ownGeo(new THREE.BoxGeometry(.16, .10, .24)), dark, actors.length * 2);
    const faces = new THREE.InstancedMesh(faceGeo, faceMat, actors.length * 4);
    const shadows = new THREE.InstancedMesh(contactGeo, contactMat, actors.length);
    [bodies, heads, arms, legs, hair, shoes, faces].forEach(mesh => { mesh.castShadow = mesh !== faces; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parent.add(mesh); }); parent.add(shadows);
    actors.forEach((_, i) => { for (let j = 0; j < 4; j++) faces.setColorAt(i * 4 + j, new THREE.Color(j < 2 ? 0x302e39 : 0xef9b9e)); });
    actors.forEach((a, i) => { for (let j = 0; j < 3; j++) bodies.setColorAt(i * 3 + j, new THREE.Color(a.color)); });
    type Rig = { root: THREE.Group; torso: THREE.Group; head: THREE.Group; shoulders: THREE.Group[]; elbows: THREE.Group[]; hands: THREE.Group[]; hips: THREE.Group[]; knees: THREE.Group[]; feet: THREE.Group[] };
    const rigs: Rig[] = actors.map((a, index) => {
      const root = new THREE.Group(); root.name = `actor-${index}-${a.pose}`; parent.add(root);
      root.scale.y = dollHeight;
      root.userData.pose = a.pose; root.userData.actorIndex = index;
      const torso = new THREE.Group(), head = new THREE.Group(); root.add(torso); torso.add(head);
      const shoulders = [new THREE.Group(), new THREE.Group()], elbows = [new THREE.Group(), new THREE.Group()], hands = [new THREE.Group(), new THREE.Group()];
      const hips = [new THREE.Group(), new THREE.Group()], knees = [new THREE.Group(), new THREE.Group()], feet = [new THREE.Group(), new THREE.Group()];
      shoulders.forEach((joint, side) => { torso.add(joint); joint.position.set(side ? .23 : -.23, .25, 0); joint.add(elbows[side]); elbows[side].position.y = -.3; elbows[side].add(hands[side]); hands[side].position.y = -.27; });
      hips.forEach((joint, side) => { root.add(joint); joint.position.set(side ? .115 : -.115, .59, 0); joint.add(knees[side]); knees[side].position.y = -.29; knees[side].add(feet[side]); feet[side].position.y = -.29; });
      torso.position.y = .73; head.position.y = .40; return { root, torso, head, shoulders, elbows, hands, hips, knees, feet };
    });
    const localMatrix = new THREE.Matrix4(), parentInverse = new THREE.Matrix4(), localRotation = new THREE.Quaternion();
    function instanceAt(mesh: THREE.InstancedMesh, index: number, joint: THREE.Object3D, p: THREE.Vector3, s: THREE.Vector3, r = new THREE.Euler()) {
      localRotation.setFromEuler(r); localMatrix.compose(p, localRotation, s); parentInverse.copy(parent.matrixWorld).invert(); mesh.setMatrixAt(index, parentInverse.multiply(joint.matrixWorld).multiply(localMatrix));
    }
    const clamp = THREE.MathUtils.clamp;
    function update(t: number, moving: boolean, activeSport = -1, sportPulse = 0) {
      actors.forEach((a, i) => {
        const rig = rigs[i], cycle = ((t * (a.pose === "sport" ? .44 : .24) + a.phase / 6.28) % 1 + 1) % 1;
        const wave = moving ? Math.sin(cycle * Math.PI * 2) : 0, strike = a.pose === "sport" && moving && i === activeSport ? sportPulse : 0;
        const walking = a.pose === "walk" && moving, seated = a.pose === "sit" || a.pose === "drum";
        const floor = a.floor ?? .18, pathX = walking ? Math.sin(t * .32 + a.phase) * .62 : 0;
        rig.root.position.set(clamp(a.x + pathX, -6.2, 6.2), floor + (walking ? Math.abs(wave) * .018 : 0), clamp(a.z, -1.25, 6.7)); rig.root.rotation.y = a.facing ?? 0;
        rig.torso.rotation.set(0, 0, moving ? wave * .012 : 0);
        rig.head.rotation.set(0, moving ? Math.sin(t * .7 + a.phase) * .08 : 0, 0);
        rig.shoulders.forEach(j => j.rotation.set(0, 0, 0)); rig.elbows.forEach(j => j.rotation.set(0, 0, 0)); rig.hands.forEach(j => j.rotation.set(0, 0, 0)); rig.hips.forEach(j => j.rotation.set(0, 0, 0)); rig.knees.forEach(j => j.rotation.set(0, 0, 0)); rig.feet.forEach(j => j.position.y = -.29);
        if (seated) {
          const hipHeight = ((a.seat ?? floor + .42) - floor) / dollHeight;
          rig.torso.position.y = hipHeight + .14; rig.hips.forEach(h => h.position.y = hipHeight);
          const hipAngle = hipHeight > .5 ? -.45 : hipHeight > .35 ? -1.14 : -1.45;
          const shinAngle = Math.acos(clamp((hipHeight - .04 - .29 * Math.cos(hipAngle)) / .29, -1, 1));
          rig.hips.forEach(h => h.rotation.x = hipAngle); rig.knees.forEach(k => k.rotation.x = shinAngle - hipAngle);
          rig.feet.forEach(f => f.rotation.x = -shinAngle);
        } else { rig.torso.position.y = .73; rig.hips.forEach(h => h.position.y = .59); }
        if (a.pose === "sport") {
          rig.shoulders[1].rotation.set(-.32 - strike * .58, 0, -.20); rig.elbows[1].rotation.x = -.42 - strike * .28;
          rig.hands[1].rotation.z = -.22 + strike * .5;
          rig.shoulders[0].rotation.set(-.20, 0, .24); rig.elbows[0].rotation.x = -.32;
        } else if (walking) { rig.shoulders[0].rotation.x = wave * .35; rig.shoulders[1].rotation.x = -wave * .35; rig.hips[0].rotation.x = -wave * .4; rig.hips[1].rotation.x = wave * .4; rig.knees[wave > 0 ? 0 : 1].rotation.x = Math.abs(wave) * .32;
        } else if (a.pose === "guitar") { rig.shoulders[0].rotation.set(-.55, 0, .35); rig.elbows[0].rotation.x = -.55; rig.shoulders[1].rotation.set(-.5 + wave * .12, 0, -.25); rig.elbows[1].rotation.x = -.7;
        } else if (a.pose === "sing") { rig.shoulders[1].rotation.set(-1.05, 0, -.22); rig.elbows[1].rotation.x = -.65;
        } else if (a.pose === "drum") { rig.shoulders[0].rotation.set(-.75 + wave * .28, 0, .25); rig.shoulders[1].rotation.set(-.75 - wave * .28, 0, -.25); rig.elbows.forEach(e => e.rotation.x = -.45);
        } else if (a.pose === "watch" && moving) { rig.shoulders[0].rotation.x = -.10 + wave * .05; rig.shoulders[1].rotation.x = -.10 - wave * .05; }
        // Keep shoes level and project walking support feet back onto the pavement.
        if (!seated) rig.feet.forEach((f, side) => { f.rotation.x = -rig.hips[side].rotation.x - rig.knees[side].rotation.x; });
        rig.root.updateMatrixWorld(true);
        instanceAt(bodies, i * 3, rig.torso, new THREE.Vector3(0, .07, 0), new THREE.Vector3(.98, 1.05, .76));
        instanceAt(heads, i * 3, rig.head, new THREE.Vector3(), new THREE.Vector3(1.6, 1.9, 1.5));
        instanceAt(hair, i, rig.head, new THREE.Vector3(0, .008, -.006), new THREE.Vector3(1.6, 1.9, 1.5));
        for (let side = 0; side < 2; side++) {
          const sign = side ? 1 : -1;
          instanceAt(faces, i * 4 + side, rig.head, new THREE.Vector3(sign * .085, -.025, .231), new THREE.Vector3(.7, 1.1, .45));
          instanceAt(faces, i * 4 + side + 2, rig.head, new THREE.Vector3(sign * .151, -.082, .199), new THREE.Vector3(1.15, .7, .35));
        }
        for (let side = 0; side < 2; side++) {
          instanceAt(bodies, i * 3 + side + 1, rig.shoulders[side], new THREE.Vector3(0, -.065, 0), new THREE.Vector3(.36, .46, .38));
          instanceAt(heads, i * 3 + side + 1, rig.hands[side], new THREE.Vector3(), new THREE.Vector3(.34, .39, .32));
          instanceAt(arms, i * 4 + side * 2, rig.shoulders[side], new THREE.Vector3(0, -.15, 0), new THREE.Vector3(1, .72, 1));
          instanceAt(arms, i * 4 + side * 2 + 1, rig.elbows[side], new THREE.Vector3(0, -.135, 0), new THREE.Vector3(.88, .65, .88));
          instanceAt(legs, i * 4 + side * 2, rig.hips[side], new THREE.Vector3(0, -.145, 0), new THREE.Vector3(1.08, .7, 1.08));
          instanceAt(legs, i * 4 + side * 2 + 1, rig.knees[side], new THREE.Vector3(0, -.145, 0), new THREE.Vector3(.95, .7, .95));
          instanceAt(shoes, i * 2 + side, rig.feet[side], new THREE.Vector3(0, .035, .055), new THREE.Vector3(1, 1, 1));
        }
        rig.root.userData.floor = floor; rig.root.userData.seat = a.seat ?? null;
        dummy.position.set(rig.root.position.x, floor + .006, rig.root.position.z); dummy.scale.set(1.15, 1, .72); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); shadows.setMatrixAt(i, dummy.matrix);
      });
      [bodies, heads, arms, legs, hair, shoes, faces, shadows].forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
    }
    update(0, false); return { update, rigs, hand(index: number, right = true) { return rigs[index].hands[right ? 1 : 0]; } };
  }

  const net = new THREE.Mesh(ownGeo(new THREE.PlaneGeometry(3.5, .68, 10, 3)), toon(0xd9e5e3));
  net.name = "badminton-net"; net.position.set(0, .73, 2.4); dayGroup.add(net);
  const poleGeo = ownGeo(new THREE.CylinderGeometry(.035, .035, 1.05, 8)), poleMat = toon(0x5b696d);
  for (const x of [-1.8, 1.8]) { const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(x, .7, 2.4); pole.castShadow = true; dayGroup.add(pole); }
  const players: Actor[] = [
    { x: -1.05, z: 1.25, color: 0xf19c79, pose: "sport", phase: 0 }, { x: 1.05, z: 1.05, color: 0x6ca6d9, pose: "sport", phase: 1.5 },
    { x: -1.05, z: 3.55, color: 0xf2c65f, pose: "sport", phase: 3.1, facing: Math.PI }, { x: 1.05, z: 3.7, color: 0x7ebd91, pose: "sport", phase: 4.5, facing: Math.PI },
    { x: -5.7, z: 1.48, color: 0xc985b5, pose: "sit", phase: .6, seat: .59 }, { x: -5.2, z: 1.48, color: 0x779cc8, pose: "sit", phase: 2, seat: .59 }, { x: 3.65, z: 4.5, color: 0xe29b63, pose: "walk", phase: 1.2, facing: Math.PI / 2 },
  ];
  const dayActors = createActors(dayGroup, players);
  const racketGeo = ownGeo(new THREE.TorusGeometry(.15, .018, 6, 12)), racketHandleGeo = ownGeo(new THREE.CylinderGeometry(.022, .026, .28, 7)), racketMat = toon(0xe8e5d7), rackets: THREE.Group[] = [], hitPoints: THREE.Object3D[] = [];
  players.slice(0, 4).forEach((_, i) => { const racket = new THREE.Group(), ring = new THREE.Mesh(racketGeo, racketMat), handle = new THREE.Mesh(racketHandleGeo, racketMat), hit = new THREE.Object3D(); racket.name = `player-${i + 1}-racket`; ring.position.y = -.31; handle.position.y = -.14; hit.position.y = -.31; racket.rotation.x = Math.PI / 2; racket.add(ring, handle, hit); dayActors.hand(i, true).add(racket); rackets.push(racket); hitPoints.push(hit); });
  const shuttle = new THREE.Mesh(ownGeo(new THREE.ConeGeometry(.055, .15, 8)), toon(0xf7f5e9)); shuttle.name = "badminton-shuttlecock"; dayGroup.add(shuttle);

  const stageMat = toon(0x514d51), curtainMat = toon(0x733c48), speakerMat = toon(0x25282d), bulbMat = toon(0xffc067, 0xff9e45);
  const stage = new THREE.Mesh(ownGeo(new THREE.BoxGeometry(4.4, .22, 1.7)), stageMat); stage.name = "student-live-stage"; stage.position.set(0, .3, -.2); stage.castShadow = true; stage.receiveShadow = true; nightGroup.add(stage);
  const curtain = new THREE.Mesh(ownGeo(new THREE.PlaneGeometry(4.05, 1.25)), curtainMat); curtain.position.set(0, 1.05, -.98); nightGroup.add(curtain);
  const speakerGeo = ownGeo(new THREE.BoxGeometry(.42, .65, .38));
  for (const x of [-1.78, 1.78]) { const speaker = new THREE.Mesh(speakerGeo, speakerMat); speaker.position.set(x, .72, -.48); speaker.castShadow = true; nightGroup.add(speaker); }
  const bulbGeo = ownGeo(new THREE.SphereGeometry(.045, 8, 6));
  for (let i = 0; i < 13; i++) { const bulb = new THREE.Mesh(bulbGeo, bulbMat); bulb.position.set(-1.95 + i * .325, 1.65 + Math.sin(i * .7) * .08, -.91); nightGroup.add(bulb); }
  const band: Actor[] = [
    { x: 0, z: -.18, color: 0xe98b72, pose: "sing", phase: 0, floor: .41 }, { x: -.9, z: -.2, color: 0x6c99cb, pose: "guitar", phase: 1, floor: .41 },
    { x: .9, z: -.2, color: 0x7eb786, pose: "guitar", phase: 2.1, floor: .41 }, { x: 0, z: -.72, color: 0xe1bd62, pose: "drum", phase: 3.2, floor: .41, seat: .67 },
  ];
  const audiencePositions = [[-1.45,1.45],[-.55,1.7],[.5,1.4],[1.45,1.65],[-2.25,2.5],[-1.25,3.1],[-.35,2.75],[.7,3.2],[1.65,2.7],[2.5,2.2]];
  const audience: Actor[] = audiencePositions.map(([x,z], i) => ({ x, z, facing: Math.PI + x * .09, color: [0x789fc8,0xd48888,0x8eb279,0xd0a766,0x9b82b3][i % 5], pose: i < 4 ? "sit" : "watch", phase: i * .71, seat: i < 4 ? .37 : undefined }));
  const nightActors = createActors(nightGroup, [...band, ...audience]);
  const instrumentMat = toon(0xc98246), instrumentGeo = ownGeo(new THREE.SphereGeometry(1, 12, 8));
  [1, 2].forEach((actorIndex, j) => {
    const instrument = new THREE.Group(); instrument.name = j ? "bass" : "guitar";
    const body = new THREE.Mesh(instrumentGeo, instrumentMat); body.scale.set(.14,.19,.055);
    const neck = new THREE.Mesh(ownGeo(new THREE.BoxGeometry(.045,.34,.035)), dark); neck.position.y = .25;
    instrument.add(body, neck); instrument.position.set(.035,-.06,.19); instrument.rotation.z = -.48;
    nightActors.rigs[actorIndex].torso.add(instrument);
  });
  const microphone = new THREE.Mesh(ownGeo(new THREE.CylinderGeometry(.025, .035, .24, 8)), speakerMat); microphone.name = "microphone"; microphone.position.y = -.12; nightActors.hand(0, true).add(microphone);
  const stickGeo = ownGeo(new THREE.CylinderGeometry(.012, .012, .32, 6));
  for (const side of [false, true]) { const stick = new THREE.Mesh(stickGeo, racketMat); stick.name = side ? "right-drumstick" : "left-drumstick"; stick.position.y = -.16; nightActors.hand(3, side).add(stick); }
  const drum = new THREE.Mesh(ownGeo(new THREE.CylinderGeometry(.28, .28, .25, 12)), instrumentMat); drum.rotation.z = Math.PI / 2; drum.position.set(0, .65, -.48); nightGroup.add(drum);
  const stageLights = [-1.4, 1.4].map(x => { const light = new THREE.PointLight(x < 0 ? 0xffa14a : 0xffcf78, 0, 3.2, 2); light.position.set(x, 1.45, -.25); nightGroup.add(light); return light; });

  // Independent material sets allow fading without pushing seated people through surfaces.
  function fadingMaterials(parent: THREE.Group) {
    const copies = new Map<THREE.Material, THREE.Material>();
    parent.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const copy = (source: THREE.Material) => {
        if (!copies.has(source)) { const m = source.clone(); m.userData.baseOpacity = source.opacity; materials.push(m); copies.set(source, m); }
        return copies.get(source)!;
      };
      object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
    });
    return [...copies.values()];
  }
  const dayMaterials = fadingMaterials(dayGroup), nightMaterials = fadingMaterials(nightGroup);
  function fade(list: THREE.Material[], weight: number) {
    list.forEach(m => {
      const transparent = weight < .999 || m.userData.baseOpacity < 1;
      if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
      m.opacity = m.userData.baseOpacity * weight; m.depthWrite = !transparent;
    });
  }

  function updateTrees(delta: number, reduced: boolean) {
    if (!reduced) clock += delta;
    trees.forEach((tree, i) => { const form = tree.crown ?? (i % 3 === 0 ? "wide" : i % 3 === 1 ? "tall" : "round"), scale = tree.scale ?? 1, phase = tree.phase ?? i * .83;
      for (let j = 0; j < crownLayers; j++) { const angle = j * 2.399 + phase, sway = reduced ? 0 : Math.sin(clock * .7 + phase + j * .3) * .035;
        const ring = j === 0 ? 0 : .38 + (j % 3) * .15;
        dummy.position.set(tree.x + Math.cos(angle) * ring * (form === "wide" ? 1.25 : .9) + sway, tree.height + .22 + (j === 0 ? .72 : ((j * 7) % 5) * .13), tree.z + Math.sin(angle) * ring * .84);
        const variation = .83 + ((i * 11 + j * 7) % 6) * .07;
        dummy.scale.set(scale * (form === "wide" ? 1.48 : form === "tall" ? .84 : 1.12) * variation, scale * (form === "tall" ? 1.55 : form === "wide" ? .84 : 1.08) * variation, scale * variation);
        dummy.rotation.set(sway * .5, angle * .31, sway); dummy.updateMatrix(); canopy.setMatrixAt(i * crownLayers + j, dummy.matrix);
      }
    }); canopy.instanceMatrix.needsUpdate = true;
  }
  function update(delta: number, blend = 0, reduced = false) {
    if (disposed) return false; updateTrees(delta, reduced);
    const dayWeight = 1 - THREE.MathUtils.smoothstep(blend, .08, .76), nightWeight = THREE.MathUtils.smoothstep(blend, .24, .92);
    dayGroup.visible = dayWeight > .01; nightGroup.visible = nightWeight > .01;
    fade(dayMaterials, dayWeight); fade(nightMaterials, nightWeight);
    dayGroup.updateMatrixWorld(true); nightGroup.updateMatrixWorld(true);
    if (dayGroup.visible) {
      const exchange = clock * .55, sequence = [0, 2, 1, 3], leg = Math.floor(exchange) % sequence.length, p = exchange % 1;
      const poseClock = Math.floor(clock * 12) / 12;
      dayActors.update(poseClock * (.2 + dayWeight * .8), !reduced && dayWeight > .96, sequence[leg], Math.max(0, 1 - p * 5));
      const from = hitPoints[sequence[leg]].getWorldPosition(new THREE.Vector3()), to = hitPoints[sequence[(leg + 1) % sequence.length]].getWorldPosition(new THREE.Vector3());
      dayGroup.worldToLocal(from); dayGroup.worldToLocal(to); shuttle.position.lerpVectors(from, to, p); shuttle.position.y += Math.sin(Math.PI * p) * .9; shuttle.rotation.z = clock * 5;
    }
    if (nightGroup.visible) nightActors.update(Math.floor(clock * 12) / 12, !reduced && nightWeight > .96);
    stageLights.forEach(light => { light.intensity = nightWeight * (reduced ? .9 : 1.05 + Math.sin(clock * 2.3 + light.position.x) * .12); });
    nightMaterials.forEach(m => { if (m instanceof THREE.MeshToonMaterial && m.emissive.getHex() === 0xff9e45) m.emissiveIntensity = nightWeight * (reduced ? .8 : .78 + Math.sin(clock * 1.6) * .08); });
    return !reduced && (dayGroup.visible || nightGroup.visible);
  }
  update(0, 0, true);
  return { canopy, dayGroup, nightGroup, stageLights, stats: { badmintonNets: 1, dayPlayers: 4, dayExtras: 3, bandMembers: 4, audience: 10, speakers: 2 }, update,
    dispose() { if (disposed) return; disposed = true; canopy.dispose(); group.remove(canopy, dayGroup, nightGroup); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); }
  };
}
