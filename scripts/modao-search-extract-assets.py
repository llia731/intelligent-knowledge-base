#!/usr/bin/env python3
"""Extract authentic search SVG geometry/paint from a real offline Modao capture."""
import base64,gzip,hashlib,json,re,sys,xml.etree.ElementTree as ET,zipfile
from pathlib import Path
source=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
data=json.loads(source.read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
ET.register_namespace('', 'http://www.w3.org/2000/svg')
points={'semantic':(480,199),'keyword':(596,199),'hybrid':(726,199),'search':(482,259),'syntax':(479,368),'relevance':(1651.06,556),'like':(1649.97,589),'dislike':(1681.97,589),'knowledge':(745.97,643.5),'calendar':(835.97,643.5),'author':(930.94,643.5),'export':(1549.98,488),'download':(1633.98,488)}
archive=Path('prototype/智能知识库V1.0.zip')
with zipfile.ZipFile(archive) as z:
 entry=next(n for n in z.namelist() if n.endswith('/extra/data.1.js'))
 decoded=gzip.decompress(base64.b64decode(re.search(rb'H4sIA[A-Za-z0-9+/=]+',z.read(entry)).group(0)))
records=[]
def geometry(svg):return [(e.tag,sorted((k,v)for k,v in e.attrib.items()if k not in ['fill','stroke','class']))for e in ET.fromstring(svg).iter()]
for name,(x,y) in points.items():
 a=min(data['icons'],key=lambda a:abs(a['rect']['x']-x)+abs(a['rect']['y']-y));assert abs(a['rect']['x']-x)+abs(a['rect']['y']-y)<1
 assert a['cid'].split('/')[-1].encode() in decoded
 raw=a['svg'];root=ET.fromstring(raw);root.attrib.pop('class',None);shapes=[e for e in root.iter()if e.tag.split('}')[-1]in['path','line','polyline','rect','circle']];assert len(shapes)==len(a['paths'])
 for e,p in zip(shapes,a['paths']):
  for attr in ['fill','stroke']:e.set(attr,p[attr])
 svg=ET.tostring(root,encoding='utf-8');assert geometry(raw)==geometry(svg);assert b'<script'not in svg and b'foreignObject'not in svg
 (out/(name+'.svg')).write_bytes(svg);records.append({'file':name+'.svg','cid':a['cid'],'rect':a['rect'],'sourceSvgSha256':sha(raw.encode()),'sha256':sha(svg),'drawingGeometryUnchanged':True,'drawingGeometrySha256':sha(json.dumps(geometry(raw)).encode()),'zipEntry':entry+'#gzip-decoded','paint':'actual computed fill/stroke serialized; UI uses alpha mask/currentColor for state colors'})
(out/'provenance.json').write_text(json.dumps({'prototypeZipSha256':sha(archive.read_bytes()),'captureGeometrySha256':sha(source.read_bytes()),'assets':records},ensure_ascii=False,indent=2));print('EXTRACTED',len(records),'original search SVG resources')
