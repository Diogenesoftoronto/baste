"""Comparison sheets only; the original Graphite exports are left untouched."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont, ImageStat

ROOT = Path(__file__).resolve().parent.parent
FONT = '/usr/share/fonts/google-noto-vf/NotoSans[wght].ttf'
SERIF = '/usr/share/fonts/google-noto-vf/NotoSerif[wght].ttf'
def font(size, serif=False):
    return ImageFont.truetype(SERIF if serif and Path(SERIF).exists() else FONT, size)

def drafts():
    archive = json.loads((ROOT / 'archive.json').read_text())['candidates']
    sheet = Image.new('RGB', (1440, 1130), '#F1ECE2')
    draw = ImageDraw.Draw(sheet)
    families = ['flax-linen', 'cutting-room', 'chalk-draft', 'ink-selvedge']
    for index, candidate in enumerate(archive):
        row = families.index(candidate['family'])
        col = candidate['round'] - 1
        x, y = 20 + col * 284, 50 + row * 266
        image = Image.open(candidate['artifactPath']).convert('RGB')
        image.thumbnail((272, 170), Image.Resampling.LANCZOS)
        sheet.paste(image, (x, y))
        draw.text((x, y + 179), f"{candidate['title']} · {candidate['round']}", font=font(15), fill='#1C1B19')
        draw.text((x, y + 202), f"{candidate['nodeCount']} nodes · {candidate['params']['seed']} seed", font=font(11), fill='#716756')
    draw.text((20, 12), 'BASTE / GRAPHITE — FIVE ROUNDS, FOUR MATERIALS', font=font(18), fill='#1C1B19')
    sheet.save(ROOT / 'candidate-sheet.jpg', quality=94)

def final():
    suite = json.loads((ROOT / 'baste-atelier-suite.json').read_text())
    sheet = Image.new('RGB', (1640, 1230), '#F1ECE2')
    context = Image.new('RGB', (1640, 1230), '#F1ECE2')
    draw, ctx = ImageDraw.Draw(sheet), ImageDraw.Draw(context)
    for i, output in enumerate(suite['outputs']):
        x, y = 24 + (i % 2) * 812, 76 + (i // 2) * 568
        bg = Image.open(output['artifactPath']).convert('RGB')
        bg = bg.resize((788, 493), Image.Resampling.LANCZOS)
        sheet.paste(bg, (x, y)); context.paste(bg, (x, y))
        label = f"0{i + 1} / {output['title'].upper()}"
        draw.text((x, y + 505), label, font=font(17), fill='#1C1B19')
        ctx.text((x, y + 505), label, font=font(17), fill='#1C1B19')
        dark = output['family'] == 'ink-selvedge'
        ink, accent = ('#F1ECE2', '#F1836D') if dark else ('#1C1B19', '#A9311E')
        ctx.text((x + 40, y + 35), 'BASTE', font=font(20), fill=ink)
        ctx.text((x + 40, y + 140), 'Cut to fit', font=font(52, True), fill=ink)
        ctx.text((x + 40, y + 207), 'one person.', font=font(52, True), fill=ink)
        ctx.text((x + 42, y + 301), 'Films, music, rooms and obsessions.', font=font(15), fill=ink)
        ctx.text((x + 42, y + 331), 'A design system with a world of its own.', font=font(15), fill=ink)
        ctx.rounded_rectangle((x + 42, y + 393, x + 215, y + 435), radius=3, fill=ink)
        ctx.text((x + 61, y + 403), 'Open the Studio →', font=font(14), fill='#22211F' if dark else '#F1ECE2')
        # Assess contrast across the entire reserved left reading area.
        pixels = Image.open(output['artifactPath']).convert('RGB')
        pixels = pixels.crop((0, 0, int(pixels.width * .56), pixels.height))
        def luminance(rgb):
            channels = [c / 255 for c in rgb]
            channels = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels]
            return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
        ink_rgb = tuple(int(ink[j:j+2], 16) for j in (1, 3, 5))
        ink_l = luminance(ink_rgb)
        extrema = [luminance(p) for p in set(pixels.getdata())]
        nearest = max(extrema) if dark else min(extrema)
        contrast = (max(nearest, ink_l) + .05) / (min(nearest, ink_l) + .05)
        output['readingAreaContrast'] = { 'textColor': ink, 'minimumRatio': round(contrast, 2), 'area': 'left 56% of canvas', 'method': 'WCAG relative luminance; background pixels only; real page layouts remain untested' }
    draw.text((24, 22), 'BASTE / GRAPHITE — MATERIAL STUDIES', font=font(23), fill='#1C1B19')
    ctx.text((24, 22), 'BASTE / GRAPHITE — TEXT PLACEMENT STUDIES', font=font(23), fill='#1C1B19')
    sheet.save(ROOT / 'background-options.jpg', quality=96)
    context.save(ROOT / 'background-context.jpg', quality=96)
    (ROOT / 'baste-atelier-suite.json').write_text(json.dumps(suite, indent=2))

if (ROOT / 'baste-atelier-suite.json').exists(): final()
else: drafts()
