from PIL import Image, ImageChops
from pathlib import Path
import json
pairs = [
 ("raw_loop", "snapshots/loop/raw-0.png", "snapshots/loop/raw-8.png"),
 ("reverse_seek", "snapshots/loop/raw-0.png", "snapshots/loop/raw-0-reseek.png"),
 ("hyperframes_loop", "snapshots/proof/frame-00-at-0s.png", "snapshots/proof/frame-06-at-8s.png"),
]
results = []
for name, left, right in pairs:
 a = Image.open(left).convert("RGB")
 b = Image.open(right).convert("RGB")
 d = ImageChops.difference(a, b)
 pixels = list(d.getdata())
 results.append(dict(gate=name, different_pixels=sum(p != (0,0,0) for p in pixels), max_channel_delta=max(map(max,pixels)), difference_bbox=d.getbbox(), exact_match=d.getbbox() is None))
print(json.dumps(results, indent=2))
p = Path("verification/fonts-seam.json")
report = json.loads(p.read_text())
report["seam"]["comparisons"] = results
report["seam"]["pixelEquality"] = all(r["exact_match"] for r in results)
p.write_text(json.dumps(report, indent=2) + "\n")
assert report["seam"]["pixelEquality"], "Loop or reverse seek pixels differ"
