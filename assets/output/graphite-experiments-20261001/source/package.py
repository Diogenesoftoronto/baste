from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import hashlib,json
root=Path(__file__).resolve().parent.parent
out=root.parent
records=json.loads((root/'candidate-archive.json').read_text())
selected={'chromatic-bath':1,'chalk-strata':4,'radial-dye':3,'interference-weave':4}
weights={'alignment':.30,'visualQuality':.20,'uniqueness':.20,'coherence':.15,'usability':.15}
base={'chromatic-bath':[88,85,84,87,69],'chalk-strata':[83,82,86,86,65],'radial-dye':[85,89,82,90,78],'interference-weave':[93,90,85,93,87]}
for r in records:
 scores=dict(zip(weights,base[r['family']]))
 if r['round']==selected[r['family']]: scores={k:min(100,v+4) for k,v in scores.items()}
 else: scores={k:v-(abs(r['round']-selected[r['family']]) if k!='uniqueness' else 0) for k,v in scores.items()}
 r['judgement']={'source':'Subjective visual review of the rendered contact sheet; not provider-model scores','scores':scores,'weighted':round(sum(scores[k]*v for k,v in weights.items()),2)}
 r['featureSpace']={'temperature':['warm','warm-neutral','warm-violet','cool','warm-magenta'][r['round']-1],'density':'high' if r['family']=='chalk-strata' else 'medium' if r['family']=='chromatic-bath' else ['low','medium','medium','high','high'][r['round']-1],'abstractness':'organic' if r['family'] in ['chromatic-bath','chalk-strata'] else 'geometric'}
 r['retained']=r['round']==selected[r['family']]
(root/'reviewed-archive.json').write_text(json.dumps(records,indent=2))
assets=[]
for p in sorted(out.glob('images/baste-*-2560x1600-20261001.*')):
 if not any(f in p.name for f in selected): continue
 im=Image.open(p);im.load();assert im.size==(2560,1600)
 assets.append({'file':str(p.relative_to(out)), 'dimensions':list(im.size),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
for p in sorted(out.glob('videos/baste-*-loop-20261001.gif')):
 im=Image.open(p);frames=[];duration=0
 for i in range(im.n_frames):
  im.seek(i);duration+=im.info.get('duration',0);frames.append(hashlib.sha256(im.convert('RGB').tobytes()).hexdigest())
 assert im.n_frames==64 and len(set(frames))==64
 assets.append({'file':str(p.relative_to(out)), 'dimensions':list(im.size),'frames':im.n_frames,'uniqueFrames':len(set(frames)),'durationMs':duration,'loop':im.info.get('loop'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
for p in sorted(out.glob('svg/baste-*-20261001.svg')):
 if any(f in p.name for f in ['radial-dye','interference-weave']): assets.append({'file':str(p.relative_to(out)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
manifest={'persona':'baste-atelier','suite':'Graphite colour, dynamics and interaction','iterationsPerFamily':5,'candidateCount':len(records),'selected':[{ 'family':f,'round':r,'candidate':f'baste-{f}-r{r}-20261001','features':next(x['features'] for x in records if x['family']==f)} for f,r in selected.items()], 'weights':weights,'assets':assets,'relationships':{'nativeDocuments':'documents/*.graphite','nativeAnimation':'AnimationTime -> GradientShift; AnimationTime -> Math -> domain warp or rotation','nativeInteraction':'PointerPosition -> radial field translation; headless compilation/render proved, editor pointer behaviour unverified','liveMaterials':'Baste WebGL implementation inspired by these techniques; not a Graphite runtime or native-document interpreter'},'verification':{'candidateRenders':20,'highResolutionPngRenders':4,'gifRenders':2,'svgRenders':2,'allEngineExitCodes':0,'decodedAssets':True,'browserReport':'qa/interaction-report.json'}}
(root/'baste-graphite-experiments-suite.json').write_text(json.dumps(manifest,indent=2))
(out/'baste-graphite-experiments-suite-20261001.json').write_text(json.dumps(manifest,indent=2))
font=ImageFont.truetype('/usr/share/fonts/google-noto-vf/NotoSans[wght].ttf',19)
sheet=Image.new('RGB',(1440,1060),'#F1ECE2');draw=ImageDraw.Draw(sheet)
for i,(family,round) in enumerate(selected.items()):
 im=Image.open(root/'candidates'/f'baste-{family}-r{round}-20261001.png').convert('RGB');im=im.resize((696,435),Image.Resampling.LANCZOS)
 x=12+(i%2)*720;y=12+(i//2)*530;sheet.paste(im,(x,y));draw.text((x,y+450),family.replace('-',' ').title(),fill='#1C1B19',font=font)
sheet.save(root/'selected-studies.jpg',quality=95)
print(f'{len(records)} reviewed candidates, {len(assets)} production assets packaged.')
