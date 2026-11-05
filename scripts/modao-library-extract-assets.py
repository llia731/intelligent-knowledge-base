#!/usr/bin/env python3
"""Extract authentic library SVG resources from a real Modao capture; preserve paths and computed paint.
Usage: python scripts/modao-library-extract-assets.py <source-geometry.json> <output-directory>
No approximated icon library, remote downloads, or raster redraws.
"""
import base64,gzip,hashlib,json,re,sys,urllib.parse,xml.etree.ElementTree as ET,zipfile
from pathlib import Path
source=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
data=json.loads(source.read_text());records=[]
sha=lambda b:hashlib.sha256(b).hexdigest()
ET.register_namespace('', 'http://www.w3.org/2000/svg')
# Actual runtime positions identify the source widgets; stable data-cids are preserved in provenance.
points={'cover-blue':(904.64,245),'cover-purple':(1227.97,245),'cover-green':(1551.3,245),'folder':(462,187),'tags':(462,873),'development':(470,250),'product':(470,286),'operations':(470,322),'marketing':(470,358),'project-alpha':(470,430),'project-beta':(470,466),'public':(470,538),'internal':(470,574),'restricted':(470,610),'pdf':(470,682),'word':(470,718),'markdown':(470,754),'web':(470,790),'documents':(787.97,390),'storage':(1004.62,390),'view':(1589.98,634.8),'share':(1621.98,634.8),'edit':(1653.98,634.8),'delete':(1685.98,634.8),'file-pdf':(832.98,637.2),'file-markdown':(832.98,703.3),'file-word':(832.98,768.1),'file-web':(832.98,833.1),'trash':(799.98,982.1),'history':(1284.98,982.1),'chevron-right':(1202.98,984.1),'plus':(1615,118)}
for name,(x,y) in points.items():
 choices=sorted(data['icons'],key=lambda a:abs(a['rect']['x']-x)+abs(a['rect']['y']-y))
 a=choices[0];assert abs(a['rect']['x']-x)+abs(a['rect']['y']-y)<3,(name,a['rect'])
 raw=a['svg'];root=ET.fromstring(raw);root.attrib.pop('class',None)
 paints=list(root.iter());paints=[e for e in paints if e.tag.split('}')[-1] in ['path','line','polyline','rect','circle']]
 assert len(paints)==len(a['paths'])
 for e,p in zip(paints,a['paths']):
  for attr in ['fill','stroke']:e.set(attr,p[attr])
 # Geometry, viewBox, d, and drawing attributes remain from the original SVG.
 svg=ET.tostring(root,encoding='utf-8');assert b'<script' not in svg and b'foreignObject' not in svg
 (out/(name+'.svg')).write_bytes(svg)
 records.append({'file':name+'.svg','cid':a['cid'],'rect':a['rect'],'sourceSvgSha256':sha(raw.encode()),'sha256':sha(svg),'treatment':'original SVG geometry; inherited computed fill/stroke made standalone'})
for text,name in [('移动','move'),('导出','export'),('打标签','tag'),('改分类','classify'),('列表','list'),('卡片','grid')]:
 a=next(a for a in data['icons'] if 'wbt' in a['cid'] and any(e['cid']==a['cid'] and e['text']==text for e in data['items']))
 root=ET.fromstring(a['svg']);root.attrib.pop('class',None);paints=[e for e in root.iter() if e.tag.split('}')[-1] in ['path','line','polyline','rect','circle']]
 assert len(paints)==len(a['paths'])
 for e,p in zip(paints,a['paths']):
  for attr in ['fill','stroke']:e.set(attr,p[attr])
 svg=ET.tostring(root,encoding='utf-8');(out/(name+'.svg')).write_bytes(svg);records.append({'file':name+'.svg','cid':a['cid'],'rect':a['rect'],'sourceSvgSha256':sha(a['svg'].encode()),'sha256':sha(svg),'treatment':'original SVG geometry; inherited computed fill/stroke made standalone'})
bg=sorted([a for a in data['items'] if 'data:image/svg' in a['backgroundImage'] and 200<a['rect']['y']<220],key=lambda a:a['rect']['x'])
assert len(bg)==3
for name,a in zip(['blue','purple','green'],bg):
 url=re.fullmatch(r'url\("(.*)"\)',a['backgroundImage']).group(1);raw=urllib.parse.unquote(url.split(',',1)[1]).encode();ET.fromstring(raw)
 (out/(name+'-background.svg')).write_bytes(raw);records.append({'file':name+'-background.svg','cid':a['cid'],'rect':a['rect'],'sha256':sha(raw),'treatment':'unchanged decoded embedded SVG background'})
archive=Path('prototype/智能知识库V1.0.zip')
with zipfile.ZipFile(archive) as z:
 entries={}
 for n in z.namelist():
  if n.endswith('/extra/data.1.js'):
   payload=gzip.decompress(base64.b64decode(re.search(rb'H4sIA[A-Za-z0-9+/=]+',z.read(n)).group(0)))
   entries[n+'#gzip-decoded']=payload
 for r in records:
  cid=r['cid'].split('/')[-1].encode();r['zipEntriesContainingWidgetId']=[n for n,b in entries.items() if cid in b];assert r['zipEntriesContainingWidgetId'],r['file']
# Prove that standalone paint serialization did not replace or approximate any drawing geometry.
for r in records:
 if r.get('sourceSvgSha256'):
  original=next(a['svg'] for a in data['icons'] if a['cid']==r['cid'])
  def geometry(svg):
   return [(e.tag, sorted((k,v) for k,v in e.attrib.items() if k not in ['fill','stroke','class'])) for e in ET.fromstring(svg).iter()]
  assert geometry(original)==geometry((out/r['file']).read_bytes()),r['file']
  r['drawingGeometrySha256']=sha(json.dumps(geometry(original),sort_keys=True).encode())
  r['drawingGeometryUnchanged']=True
manifest={'prototypeZipSha256':sha(archive.read_bytes()),'captureGeometrySha256':sha(source.read_bytes()),'source':'original ZIP running offline; SVG/gradient payloads embedded in its data JS; no standalone illustration image in ZIP','assets':records}
(out/'provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('EXTRACTED',len(records),'traceable original assets')
