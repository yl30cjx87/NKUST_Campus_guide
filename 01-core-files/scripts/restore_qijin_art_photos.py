from pathlib import Path

import cv2


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

source = cv2.imread(str(PUBLIC / "qijin-campus-art-map-source.jpg"), cv2.IMREAD_COLOR)
target = cv2.imread(str(PUBLIC / "qijin-campus-art-map-no-names.png"), cv2.IMREAD_COLOR)
if source is None or target is None:
    raise RuntimeError("Unable to read Qijin campus map assets")

# Exact photo-only crops from the original walking map. The surrounding white
# vignette is intentionally retained so the photographs blend into the map
# without bringing back the public-art names or orange answer numbers.
photos = [
    ((1085, 1053, 1328, 1344), (855, 828)),   # Confucius statue
    ((1490, 1052, 1718, 1338), (1174, 827)),  # Anchor
]

for (x1, y1, x2, y2), (target_x, target_y) in photos:
    crop = source[y1:y2, x1:x2]
    scale_x = target.shape[1] / source.shape[1]
    scale_y = target.shape[0] / source.shape[0]
    resized = cv2.resize(
        crop,
        (round(crop.shape[1] * scale_x), round(crop.shape[0] * scale_y)),
        interpolation=cv2.INTER_AREA,
    )
    height, width = resized.shape[:2]
    target[target_y:target_y + height, target_x:target_x + width] = resized

if not cv2.imwrite(str(PUBLIC / "qijin-campus-art-map-no-names.png"), target):
    raise RuntimeError("Unable to write restored Qijin map")
