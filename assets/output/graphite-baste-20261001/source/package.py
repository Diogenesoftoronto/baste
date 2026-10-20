from pathlib import Path
import json, hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
weights = dict(personaAlignment=.30, visualQuality=.20, uniqueness=.20, coherence=.15, usability=.15)
# Explicit subjective visual ratings after viewing all candidates on the sheet
# and representative full-size exports. They are not independent judge scores.
ratings = {
    'flax-linen': [
        [.94,.93,.80,.94,.94], [.92,.92,.78,.93,.95], [.90,.90,.74,.93,.95], [.88,.90,.71,.92,.96], [.86,.89,.68,.91,.96],
    ],
    'cutting-room': [
        [.95,.90,.90,.92,.90], [.96,.93,.89,.95,.94], [.92,.91,.86,.93,.95], [.90,.90,.81,.92,.95], [.88,.89,.76,.91,.96],
    ],
    'chalk-draft': [
        [.94,.93,.90,.94,.94], [.93,.92,.86,.94,.95], [.91,.91,.83,.92,.95], [.89,.90,.78,.91,.96], [.86,.89,.74,.90,.96],
    ],
    'ink-selvedge': [
        [.93,.93,.88,.93,.94], [.91,.92,.84,.92,.95], [.89,.91,.80,.91,.95], [.87,.90,.76,.90,.96], [.85,.89,.72,.89,.96],
    ],
}
archive = json.loads((ROOT / 'archive.json').read_text())
for candidate in archive['candidates']:
    criteria = dict(zip(weights, ratings[candidate['family']][candidate['round'] - 1]))
    candidate['review'] = dict(reviewer='Codex subjective visual review', criteria=criteria,
        weightedScore=round(sum(weights[k] * criteria[k] for k in weights), 4),
        basis='Contact sheet comparison and representative full-size sample inspection; not an independent hosted judge.')
(ROOT / 'archive.json').write_text(json.dumps(archive, indent=2))

suite = json.loads((ROOT / 'baste-atelier-suite.json').read_text())
for output in suite['outputs']:
    path = Path(output['artifactPath'])
    with Image.open(path) as image:
        image.verify()
    actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    assert actual_hash == output['render']['sha256'], f'Copied PNG hash mismatch: {path}'
    assert output['readingAreaContrast']['minimumRatio'] >= 7, output['readingAreaContrast']
    webp = path.with_suffix('.webp')
    with Image.open(path) as image:
        assert image.size == (2560, 1600)
        image.convert('RGB').save(webp, format='WEBP', quality=95, method=6)
    output['webDerivative'] = dict(artifactPath=str(webp), format='webp', quality=95,
        byteSize=webp.stat().st_size, sha256=hashlib.sha256(webp.read_bytes()).hexdigest())
    output['review'].update(next(c['review'] for c in archive['candidates'] if c['family'] == output['family'] and c['round'] == output['round']))
    print(output['title'], f'PNG {path.stat().st_size:,} B / WebP {webp.stat().st_size:,} B',
        f"reading-area contrast {output['readingAreaContrast']['minimumRatio']}:1", 'hash verified')
suite['verification'] = dict(pngHashMatchesMcpResults=True, dimensions=[2560, 1600],
    readingArea='left 56% of each background; ink text on light materials, paper text on dark material',
    websiteIntegration='Not applied; actual responsive page layouts have not been tested.',
    renderExit='All selected originals exported with exit code 0; no crash quarantine needed on this machine.')
(ROOT / 'baste-atelier-suite.json').write_text(json.dumps(suite, indent=2))
(ROOT.parent / 'baste-atelier-suite-20261001.json').write_text(json.dumps(suite, indent=2))

# Point the retained calibration archive at its retained bytes and sources.
calibration = ROOT / 'calibration'
old = json.loads((calibration / 'archive.json').read_text())
for c in old['candidates']:
    c['artifactPath'] = str(calibration / 'candidates' / Path(c['artifactPath']).name)
    c['documentPath'] = str(calibration / 'source' / Path(c['documentPath']).name)
    c['render']['originalArtifactPath'] = c['render']['artifactPath']
    c['render']['artifactPath'] = c['artifactPath']
    assert hashlib.sha256(Path(c['artifactPath']).read_bytes()).hexdigest() == c['render']['sha256']
old['note'] = 'First calibration pass; corrected sRGB-to-linear token conversion in the final study.'
(calibration / 'archive.json').write_text(json.dumps(old, indent=2))
