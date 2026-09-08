import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// 依校徽的書頁、星芒與海浪輪廓製作薄浮雕，不使用圖片貼面或中文字模型。
export function createCampusEmblem() {
  const group = new THREE.Group();
  group.name = "NKUST-emblem";
  const relief = new THREE.Group();
  relief.rotation.x = -.38;
  relief.position.y = .17;
  group.add(relief);
  const colors = [0x0075af, 0xf07809, 0xffbd17];
  const parts: THREE.BufferGeometry[][] = colors.map(() => []);
  const px = (x: number) => (x - 53.5) * .031;
  const py = (y: number) => (81 - y) * .031;
  function polygon(points: [number, number][]) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], index) => index ? shape.lineTo(px(x), py(y)) : shape.moveTo(px(x), py(y)));
    shape.closePath(); return shape;
  }
  function extrude(shape: THREE.Shape, color: number, depth = .09) {
    parts[color].push(new THREE.ExtrudeGeometry(shape, {
      depth, steps: 1, curveSegments: 5,
      bevelEnabled: true, bevelThickness: .009, bevelSize: .009, bevelSegments: 1,
    }));
  }
  const pages: [number, number][][] = [
    [[21, 15], [42, 32], [52, 47], [34, 31], [21, 24]],
    [[17, 24], [36, 36], [51, 47], [29, 37], [17, 32]],
    [[14, 33], [35, 41], [50, 48], [17, 39]],
  ];
  for (const page of pages) {
    extrude(polygon(page), 1);
    extrude(polygon(page.map(([x, y]) => [107 - x, y])), 1);
  }
  const star: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8 - Math.PI / 2;
    const radius = i % 2 ? 2 : i % 4 === 0 ? 12 : 7;
    star.push([53.5 + Math.cos(angle) * radius, 19 + Math.sin(angle) * radius]);
  }
  extrude(polygon(star), 2, .12);
  extrude(polygon([[52.5, 27], [54.5, 27], [54, 42], [53, 42]]), 2);
  extrude(polygon([[14, 42], [38, 46], [53.5, 51], [69, 46], [93, 42], [89, 50], [67, 51], [53.5, 55], [40, 51], [18, 50]]), 0);
  function wave(x: number, y: number, width: number, height = 5) {
    const left = px(x), right = px(x + width), top = py(y), bottom = py(y + height), r = (top - bottom) / 2;
    const shape = new THREE.Shape();
    shape.moveTo(left + r, top); shape.lineTo(right - r, top);
    shape.quadraticCurveTo(right, top, right, top - r); shape.quadraticCurveTo(right, bottom, right - r, bottom);
    shape.lineTo(left + r, bottom); shape.quadraticCurveTo(left, bottom, left, bottom + r); shape.quadraticCurveTo(left, top, left + r, top);
    extrude(shape, 0);
  }
  // 波浪保留交錯留白，短連接段讓浮雕形成完整的藍色基部。
  wave(16, 54, 20); wave(39, 54, 47); wave(89, 54, 5);
  wave(15, 63, 5); wave(23, 63, 16); wave(43, 63, 48);
  wave(23, 73, 22); wave(50, 73, 35);
  for (const [x, y, w] of [[27, 57, 5], [58, 57, 7], [80, 57, 5], [29, 67, 6], [64, 67, 13]]) wave(x, y, w, 9);
  parts.forEach((geometries, index) => {
    const geometry = mergeGeometries(geometries, false)!;
    geometries.forEach(part => part.dispose());
    const material = new THREE.MeshStandardMaterial({ color: colors[index], roughness: .46, metalness: .12 });
    const object = new THREE.Mesh(geometry, material);
    object.castShadow = true; object.receiveShadow = true;
    relief.add(object);
  });
  const stone = new THREE.MeshStandardMaterial({ color: 0xe6e9dc, roughness: .84 });
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.37, 1.45, .16, 40), stone);
  pedestal.position.y = .05; pedestal.receiveShadow = true;
  group.add(pedestal);
  return group;
}
