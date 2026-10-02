# Atelier asset credits

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
| `scissors.svg` | `Scissors` |
| `ruler.svg` | `Ruler` |
| `ruler-pen.svg` | `RulerPen` |
| `pin.svg` | `PinTack` |
| `shirt.svg` | `Tshirt` |
| `hanger.svg` | `Hanger` |
| `palette.svg` | `Palette2` |
| `layers.svg` | `Layers` |
| `wand.svg` | `MagicWand` |
| `sparkle.svg` | `Sparkle` |
| `swatch.svg` | `ColorSwatch` |
| `image.svg` | `Image` |
| `video.svg` | `Video` |
| `type.svg` | `TextTool` |
| `code.svg` | `Code` |
| `download.svg` | `Download` |
| `terminal.svg` | `TerminalSquare` |
| `globe.svg` | `Globe` |
| `shuffle.svg` | `Shuffle` |
| `pen.svg` | `Pen` |
| `pen-sparkle.svg` | `PenSparkle` |
| `image-sparkle.svg` | `ImageSparkle` |
| `video-cut.svg` | `VideoCut` |
| `folder.svg` | `Folder` |
| `copy.svg` | `Copy` |
| `grid.svg` | `Grid` |
| `arrow-right.svg` | `ArrowRight` |
| `arrow-down.svg` | `ArrowDown` |
| `check.svg` | `Check` |
| `plus.svg` | `Plus` |

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

- rough_linen: colormass (Photography); Rico Cilliers (Processing).
- denim_fabric_04: colormass (Photography); Rico Cilliers (Processing).

Exact source URLs, package integrity, hashes, map types, and byte sizes are in `atelier-assets.json`.
