from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SOURCE = ROOT / "source-assets" / "legacy-public"


def source_asset(name: str) -> Path:
    archived = SOURCE / name
    return archived if archived.exists() else PUBLIC / name


def keep_letter_sized_components(candidate: np.ndarray) -> np.ndarray:
    """Keep individual anti-aliased text strokes, not large map colour fields."""
    binary = candidate.astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, 8)
    kept = np.zeros_like(binary)
    for label in range(1, count):
        area = stats[label, cv2.CC_STAT_AREA]
        width = stats[label, cv2.CC_STAT_WIDTH]
        height = stats[label, cv2.CC_STAT_HEIGHT]
        if 2 <= area <= 1200 and width <= 110 and height <= 64:
            kept[labels == label] = 255
    return kept


def inpaint(input_name: str, output_name: str, outer_rectangles: list[tuple[int, int, int, int]], central_rectangles: list[tuple[int, int, int, int]], radius: int, white_rectangles: list[tuple[int, int, int, int]] | None = None, remove_colored_text: bool = False, full_outer: bool = False, full_central: bool = False, dilate_iterations: int = 1) -> None:
    image = cv2.imread(str(source_asset(input_name)), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to read {input_name}")
    mask = np.zeros(image.shape[:2], dtype=np.uint8)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    for x, y, width, height in outer_rectangles:
        if full_outer:
            cv2.rectangle(mask, (x, y), (x + width, y + height), 255, -1)
            continue
        region = hsv[y:y + height, x:x + width]
        hue, saturation, value = cv2.split(region)
        gray_letters = (value < 205) & (saturation < 105)
        blue_letters = (hue > 85) & (hue < 145) & (saturation > 45) & (value < 245)
        colored_letters = ((value < 248) & (saturation > 45) & ((hue < 35) | (hue > 90))) if remove_colored_text else np.zeros_like(value, dtype=bool)
        local_mask = keep_letter_sized_components(gray_letters | blue_letters | colored_letters)
        mask[y:y + height, x:x + width] = cv2.max(mask[y:y + height, x:x + width], local_mask)
    for x, y, width, height in central_rectangles:
        if full_central:
            cv2.rectangle(mask, (x, y), (x + width, y + height), 255, -1)
            continue
        region = hsv[y:y + height, x:x + width]
        hue, saturation, value = cv2.split(region)
        dark_letters = (value < 205) & (saturation < 125)
        if remove_colored_text:
            dark_letters |= (value < 248) & (saturation > 45) & ((hue < 35) | (hue > 90))
        local_mask = keep_letter_sized_components(dark_letters)
        mask[y:y + height, x:x + width] = cv2.max(mask[y:y + height, x:x + width], local_mask)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=dilate_iterations)
    result = cv2.inpaint(image, mask, radius, cv2.INPAINT_TELEA)
    if white_rectangles:
        for x, y, width, height in white_rectangles:
            result[y:y + height, x:x + width] = 255
    if not cv2.imwrite(str(PUBLIC / output_name), result):
        raise RuntimeError(f"Unable to write {output_name}")


def texture_fill(input_name: str, output_name: str, rectangles: list[tuple[int, int, int, int]]) -> None:
    image = cv2.imread(str(PUBLIC / input_name), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to read {input_name}")
    result = image.copy()
    for x, y, width, height in rectangles:
        pad = max(10, height // 3)
        surrounding_parts = []
        if y >= pad:
            surrounding_parts.append(image[y - pad:y, x:x + width].reshape(-1, 3))
        if y + height + pad <= image.shape[0]:
            surrounding_parts.append(image[y + height:y + height + pad, x:x + width].reshape(-1, 3))
        target_color = np.median(np.concatenate(surrounding_parts), axis=0)
        best_patch, best_score = None, float("inf")
        for dy in range(-height * 5, height * 6, max(8, height)):
            for dx in range(-width * 3, width * 4, max(12, width // 2)):
                sx, sy = x + dx, y + dy
                if sx < 0 or sy < 0 or sx + width > image.shape[1] or sy + height > image.shape[0]:
                    continue
                if abs(dx) < width and abs(dy) < height:
                    continue
                candidate = image[sy:sy + height, sx:sx + width]
                color = np.median(candidate.reshape(-1, 3), axis=0)
                edges = cv2.Laplacian(cv2.cvtColor(candidate, cv2.COLOR_BGR2GRAY), cv2.CV_32F)
                score = float(np.linalg.norm(color - target_color) + np.mean(np.abs(edges)) * .42)
                if score < best_score:
                    best_score, best_patch = score, candidate.copy()
        if best_patch is None:
            continue
        clone_mask = np.full((height, width), 255, dtype=np.uint8)
        center = (x + width // 2, y + height // 2)
        result = cv2.seamlessClone(best_patch, result, clone_mask, center, cv2.NORMAL_CLONE)
    cv2.imwrite(str(PUBLIC / output_name), result)


jiangong_outer = [
    # Outer artwork captions: keep the orange number and artwork photo.
    (43, 205, 105, 44),
    (77, 352, 125, 50),
    (29, 556, 140, 51),
    (77, 682, 92, 52),
]

jiangong_central = [
    # Small artwork names immediately to the right of orange markers 1–4.
    (461, 198, 80, 22),
    (565, 183, 82, 22),
    (654, 168, 64, 23),
    (766, 367, 96, 24),
]


def yanchao_rectangles(width: int, height: int) -> tuple[list[tuple[int, int, int, int]], list[tuple[int, int, int, int]]]:
    sx, sy = width / 1200, height / 856
    def scaled(rectangles: list[tuple[int, int, int, int]]) -> list[tuple[int, int, int, int]]:
        return [(int(x * sx), int(y * sy), int(w * sx), int(h * sy)) for x, y, w, h in rectangles]
    outer = scaled([
        (374, 15, 122, 32), (808, 14, 145, 36), (1012, 36, 155, 36),
        (45, 714, 92, 47), (351, 714, 98, 47), (671, 644, 138, 47),
        (875, 598, 105, 45), (1043, 533, 132, 47),
    ])
    central = scaled([
        (486, 319, 55, 27), (638, 84, 58, 27), (658, 142, 58, 27),
        (451, 563, 62, 29), (504, 531, 62, 29), (648, 468, 65, 35),
        (853, 439, 65, 31), (889, 313, 55, 32),
    ])
    return outer, central


inpaint("jiangong-art-map-clean.png", "jiangong-art-map-no-names.png", jiangong_outer, jiangong_central, 3, white_rectangles=jiangong_outer)

yanchao_source = cv2.imread(str(source_asset("yanchao-art-map.png")), cv2.IMREAD_COLOR)
if yanchao_source is None:
    raise RuntimeError("Unable to read yanchao-art-map.png")
yanchao_height, yanchao_width = yanchao_source.shape[:2]
del yanchao_source
yanchao_outer, yanchao_central = yanchao_rectangles(yanchao_width, yanchao_height)
inpaint(
    "yanchao-art-map.png",
    "yanchao-art-map-no-names.png",
    yanchao_outer,
    yanchao_central,
    5,
    white_rectangles=[
        (int(42 * yanchao_width / 1200), int(742 * yanchao_height / 856), int(100 * yanchao_width / 1200), int(35 * yanchao_height / 856)),
        (int(350 * yanchao_width / 1200), int(742 * yanchao_height / 856), int(88 * yanchao_width / 1200), int(35 * yanchao_height / 856)),
        (int(873 * yanchao_width / 1200), int(630 * yanchao_height / 856), int(108 * yanchao_width / 1200), int(35 * yanchao_height / 856)),
    ],
)


first_source = cv2.imread(str(source_asset("first-campus-art-map.png")), cv2.IMREAD_COLOR)
if first_source is None:
    raise RuntimeError("Unable to read first-campus-art-map.png")
first_height, first_width = first_source.shape[:2]
del first_source
fsx, fsy = first_width / 1885, first_height / 1344

def first_scaled(rectangles: list[tuple[int, int, int, int]]) -> list[tuple[int, int, int, int]]:
    return [(int(x * fsx), int(y * fsy), int(w * fsx), int(h * fsy)) for x, y, w, h in rectangles]

first_outer = first_scaled([
    (126, 382, 132, 50), (118, 804, 140, 54), (42, 1138, 205, 56),
    (226, 1058, 138, 54), (510, 957, 148, 54), (760, 957, 158, 54),
    (1004, 957, 150, 54), (1214, 871, 185, 56), (1363, 708, 140, 56),
    (1383, 928, 160, 56), (1693, 1020, 175, 58), (975, 42, 162, 58),
    (1213, 62, 168, 58), (1503, 92, 142, 58),
])
first_points = [
    (33.5, 52.4), (42.9, 61.7), (42.2, 55.4), (35.2, 50.8),
    (54.0, 47.4), (56.8, 49.0), (62.0, 47.8), (63.6, 48.4),
    (63.5, 40.5), (69.8, 50.0), (73.7, 40.0), (63.1, 36.0),
    (67.5, 28.7), (81.4, 27.4),
]
first_central = [
    (int(first_width * x / 100 + 10), int(first_height * y / 100 - 25), 190, 52)
    for x, y in first_points
]
inpaint(
    "first-campus-art-map.png",
    "first-campus-art-map-no-names.png",
    first_outer,
    first_central,
    4,
    remove_colored_text=True,
    dilate_iterations=2,
)
