#!/usr/bin/env python3
"""Fetch atelier assets without installing packages or writing outside public/assets.

Run from the repo: rtk proxy python3 -E -B site/scripts/source-atelier-assets.py
Requires Python's standard library, RTK, and ImageMagick.
"""

import base64
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"
VERSION = "1.2.5"
ICONS = {
    "scissors": "Scissors",
    "ruler": "Ruler",
    "ruler-pen": "RulerPen",
    "pin": "PinTack",
    "shirt": "Tshirt",
    "hanger": "Hanger",
    "palette": "Palette2",
    "layers": "Layers",
    "wand": "MagicWand",
    "sparkle": "Sparkle",
    "swatch": "ColorSwatch",
    "image": "Image",
    "video": "Video",
    "type": "TextTool",
    "code": "Code",
    "download": "Download",
    "terminal": "TerminalSquare",
    "globe": "Globe",
    "shuffle": "Shuffle",
    "pen": "Pen",
    "pen-sparkle": "PenSparkle",
    "image-sparkle": "ImageSparkle",
    "video-cut": "VideoCut",
    "folder": "Folder",
    "copy": "Copy",
    "grid": "Grid",
    "arrow-right": "ArrowRight",
    "arrow-down": "ArrowDown",
    "check": "Check",
    "plus": "Plus",
}
FABRICS = {"linen": "rough_linen", "denim": "denim_fabric_04"}


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Baste-atelier-assets/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, str):
        content = content.encode()
    target.write_bytes(content)
    return {
        "path": path,
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def jpeg(raw):
    result = subprocess.run(
        ["rtk", "proxy", "magick", "jpg:-", "-resize", "512x512!", "-strip", "-quality", "82", "jpg:-"],
        input=raw, capture_output=True, check=True,
    )
    return result.stdout


def main():
    manifest = {"reiconVersion": VERSION, "icons": [], "textures": []}
    metadata = json.loads(fetch(f"https://registry.npmjs.org/reicon/{VERSION}"))
    package_bytes = fetch(metadata["dist"]["tarball"])
    integrity = "sha512-" + base64.b64encode(hashlib.sha512(package_bytes).digest()).decode()
    assert integrity == metadata["dist"]["integrity"], "npm package integrity mismatch"
    manifest["reiconPackageIntegrity"] = integrity
    package = tarfile.open(fileobj=io.BytesIO(package_bytes), mode="r:gz")
    manifest["reiconIconCount"] = sum(
        bool(re.fullmatch(r"package/icons/[^/]+\.js", n)) for n in package.getnames()
    )
    for concept, name in ICONS.items():
        module = package.extractfile(f"package/icons/{name}.js").read().decode()
        match = re.search(r"\bO:\s*`([^`]*)`", module)
        assert match and "${" not in match[1], f"Unexpected icon data: {name}"
        svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">' + match[1] + "</svg>\n"
        ET.fromstring(svg)
        record = write(f"icons/reicon/{concept}.svg", svg)
        record.update({"upstreamIcon": name, "weight": "Outline", "source": f"https://unpkg.com/reicon@{VERSION}/icons/{name}.js"})
        manifest["icons"].append(record)
    commit = json.loads(fetch("https://api.github.com/repos/dqev/reicon/commits/main"))["sha"]
    manifest["reiconLicenseCommit"] = commit
    license_record = write("icons/reicon/LICENSE", fetch(f"https://raw.githubusercontent.com/dqev/reicon/{commit}/LICENSE"))

    assets = json.loads(fetch("https://api.polyhaven.com/assets?t=textures"))
    fabrics = {k: v for k, v in assets.items() if any("fabric" in c.lower() for c in v.get("categories", []))}
    for name, asset_id in FABRICS.items():
        assert asset_id in fabrics
        files = json.loads(fetch(f"https://api.polyhaven.com/files/{asset_id}"))
        for suffix, key in [("nor", "nor_gl"), ("diff", "Diffuse")]:
            source = files[key]["1k"]["jpg"]
            raw = fetch(source["url"])
            assert hashlib.md5(raw).hexdigest() == source["md5"], "Poly Haven checksum mismatch"
            record = write(f"textures/{name}-{suffix}.jpg", jpeg(raw))
            record.update({"asset": asset_id, "map": "nor_gl" if suffix == "nor" else "diff", "source": source["url"], "page": f"https://polyhaven.com/a/{asset_id}", "authors": fabrics[asset_id]["authors"], "license": "CC0-1.0", "width": 512, "height": 512, "quality": 82})
            manifest["textures"].append(record)

    paper = json.loads(fetch("https://ambientcg.com/api/v2/full_json?id=Paper001&include=downloadData"))["foundAssets"][0]
    downloads = paper["downloadFolders"]["default"]["downloadFiletypeCategories"]["zip"]["downloads"]
    paper_url = next(d["downloadLink"] for d in downloads if d["attribute"] == "1K-JPG")
    archive = zipfile.ZipFile(io.BytesIO(fetch(paper_url)))
    color_name = next(n for n in archive.namelist() if n.endswith("_Color.jpg"))
    record = write("textures/paper-diff.jpg", jpeg(archive.read(color_name)))
    record.update({"asset": "Paper001", "map": "Color", "archiveMember": color_name, "source": paper_url, "page": "https://ambientcg.com/a/Paper001", "license": "CC0-1.0", "width": 512, "height": 512, "quality": 82})
    manifest["textures"].append(record)
    manifest["assetBytes"] = sum(r["bytes"] for r in manifest["icons"] + manifest["textures"]) + license_record["bytes"]
    assert manifest["assetBytes"] < 1_500_000, "Asset budget exceeded"
    write("atelier-assets.json", json.dumps(manifest, indent=2) + "\n")

    credits = """# Atelier asset credits

## Icons

30 Reicon Outline icons extracted from the integrity-verified `reicon@1.2.5` npm package.
Upstream: https://github.com/dqev/reicon and https://reicon.dev.
Reicon declares the MIT license; its copyright and complete license are retained in
`icons/reicon/LICENSE`. The package contains 2,676 icon concepts, in Outline and
Filled styles, on a 24 × 24 grid. The repository README advertises 2,700+; its
central JSON currently has 2,630 concepts, so the pinned package is the count used here.

Reicon credits base elements from Solar Icons, designed by **480 Design**, under
**CC BY 4.0**, and from **Zappicon**. Preserve these credits with redistribution:
https://solar-icons.vercel.app/ · https://creativecommons.org/licenses/by/4.0/ ·
https://zappicon.com/. Reicon does not provide per-icon origin mapping. Changes here:
Outline markup is wrapped in standalone SVGs and filenames use Baste concepts;
the icon paths are unchanged.

Individual SVGs can also be obtained by importing, for example,
`Scissors` from `reicon/icons/Scissors` and calling `Scissors.toSvg({ weight: 'Outline' })`.
No React wrapper or browser DOM is required for that string-export API. Extracted
SVGs use `currentColor`; inline SVG inherits CSS color, whereas external `<img>`
does not inherit the parent's color. An external asset can also be used as a CSS mask.

| Local filename | Upstream icon |
| --- | --- |
"""
    credits += "\n".join(f"| `{concept}.svg` | `{name}` |" for concept, name in ICONS.items())
    credits += """

Available requested concepts: scissors, pin (thumbtack), ruler, shirt, hanger,
palette, layers, wand, sparkle, swatch, image, video, type (TextTool), code,
download, terminal (TerminalSquare), globe, shuffle.
Not present: needle, thread, spool, tape measure, sewing button. Reicon has gaming
buttons, which are not sewing-button substitutes. Phosphor fallback was not needed.

## Textures

All five files are 512 × 512 JPEGs, resized from 1K JPG sources with ImageMagick,
metadata stripped, quality 82. `-nor` files retain the source OpenGL normal-map
orientation; they are shading data, while `-diff` files are visible surface color.

| Local files | Original asset | Artist | License |
| --- | --- | --- | --- |
| `textures/linen-diff.jpg`, `textures/linen-nor.jpg` | [Rough Linen](https://polyhaven.com/a/rough_linen), fine blue linen crosshatch | See authors below | CC0 1.0 |
| `textures/denim-diff.jpg`, `textures/denim-nor.jpg` | [Denim Fabric 04](https://polyhaven.com/a/denim_fabric_04), durable blue cotton twill | See authors below | CC0 1.0 |
| `textures/paper-diff.jpg` | [Paper 001](https://ambientcg.com/a/Paper001), `Paper001_1K-JPG_Color.jpg` | Lennart Demes / ambientCG | CC0 1.0 |

Poly Haven licensing: https://polyhaven.com/license.
ambientCG licensing: https://docs.ambientcg.com/license/.
CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/.
Credit is provided for provenance; CC0 does not require attribution.

"""
    for name, asset_id in FABRICS.items():
        credits += f"- {asset_id}: " + "; ".join(f"{a} ({role})" for a, role in fabrics[asset_id]["authors"].items()) + ".\n"
    credits += "\nExact source URLs, package integrity, hashes, map types, and byte sizes are in `atelier-assets.json`.\n"
    credits_record = write("CREDITS.md", credits)
    total = manifest["assetBytes"] + credits_record["bytes"] + (ROOT / "atelier-assets.json").stat().st_size
    assert total < 1_500_000
    print(json.dumps({"iconCount": len(ICONS), "files": manifest["textures"], "iconBytes": sum(i["bytes"] for i in manifest["icons"]), "totalWithCreditsAndManifest": total}, indent=2))


if __name__ == "__main__":
    main()
