#!/usr/bin/env python3
"""Build an offline comparison gallery and contact sheets from captured evidence."""
import argparse
import hashlib
from html import escape
import json
from pathlib import Path
from PIL import Image, ImageDraw

p = argparse.ArgumentParser()
p.add_argument('evidence_root', type=Path)
a = p.parse_args()
root = a.evidence_root
report = json.loads((root / 'paired/capture-report.json').read_text())
rows = [r for r in report['results'] if r['kind'] == 'react']
out = root / 'paired/comparisons'
out.mkdir(parents=True, exist_ok=True)
sections = []
nav = []
for r in rows:
    key, name = r['id'], r['name']
    image = Image.new('RGB', (1920, 580), 'white')
    draw = ImageDraw.Draw(image)
    draw.text((15, 10), 'Prototype / ' + key, fill='black')
    draw.text((975, 10), 'React / ' + key, fill='black')
    for i, kind in enumerate(['prototype', 'react']):
        with Image.open(root / 'paired' / kind / (key + '.png')) as im:
            image.paste(im.resize((960, 540)), (960*i, 40))
    image.save(out / (key + '.png'))
    nav.append(f'<a href="#{key}">{escape(name)}</a>')
    sections.append(f'''<section id="{key}"><h2>{escape(name)} <code>{escape(r['route'])}</code></h2>
<p>左：原型；右：React。以下默认使用统一字体；不同数据状态不计算像素合格分数。</p>
<img class="contact" src="paired/comparisons/{key}.png" alt="{escape(name)}并排对照">
<details><summary>滑块叠加检查（底图原型、上层 React）</summary><div class="overlay"><img src="paired/prototype/{key}.png" alt="原型"><img class="top" src="paired/react/{key}.png" alt="React"></div><input aria-label="React覆盖比例" type="range" min="0" max="100" value="50" oninput="this.previousElementSibling.style.setProperty('--cut',this.value+'%')"></details>
<p><a href="paired/prototype/{key}.png">原型 1:1</a> · <a href="paired/react/{key}.png">React 1:1</a> · <a href="paired/prototype/{key}-native.png">原型原生字体</a> · <a href="paired/react/{key}-native.png">React原生字体</a> · <a href="paired/prototype/{key}-editor.png">原型编辑器上下文</a> · <a href="react-native/{key}.png">原始React全页</a></p></section>''')
for key, name in [('share', '分享弹窗'), ('profile', '个人中心')]:
    if not (root / 'prototype-states' / (key + '.png')).exists():
        continue
    sections.append(f'''<section id="state-{key}"><h2>{name}：原型 / React</h2><div class="pair"><a href="prototype-states/{key}.png"><img src="prototype-states/{key}.png" alt="原型{name}"></a><a href="prototype-states/react-{key}.png"><img src="prototype-states/react-{key}.png" alt="React{name}"></a></div><p>原型来自真实演示热点，保留完整设计；当前实现缺少的控件不能归因字体。<a href="prototype-states/states.json">文本及状态记录</a></p></section>''')
html = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>智能知识库V1.0视觉验收证据</title><style>body{font:15px/1.6 system-ui,sans-serif;margin:0;background:#f3f5f8;color:#172033}header,section{max-width:1500px;margin:20px auto;background:white;padding:24px;border:1px solid #dae0ea;border-radius:12px}h1{font-size:26px}h2{font-size:20px}a{color:#175dcc}nav{display:flex;gap:12px;flex-wrap:wrap}.contact{width:100%;height:auto;border:1px solid #ddd}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pair img{width:100%}.overlay{position:relative;aspect-ratio:16/9;--cut:50%;overflow:hidden}.overlay img{position:absolute;width:100%;height:100%;inset:0}.overlay .top{clip-path:inset(0 calc(100% - var(--cut)) 0 0)}input[type=range]{width:100%}code{font-size:13px}summary{cursor:pointer;padding:12px;background:#eef2f8}.bad{color:#a22020}</style><header><h1>智能知识库 V1.0 · 独立视觉验收</h1><p class="bad">14/14页面可渲染；完整视觉与业务验收不通过。请先阅读报告中的字体、数据状态和模拟能力边界。</p><p>PR #9业务基线 + PR #10工具基线 69661c5；1920×1080、DPR 1、统一 Noto Sans CJK SC。保留原生截图；统一字体不代表已取得原始 PingFangSC。</p><p><a href="visual-audit.md">完整验收报告</a> · <a href="visual-audit-reproduce.md">复现步骤</a> · <a href="paired/capture-report.json">浏览器错误报告</a> · <a href="interactions/results.json">交互结果</a> · <a href="inventory.json">ZIP清单</a> · <a href="commands.json">命令/退出码</a> · <a href="manifest.json">文件SHA256</a></p><nav>''' + ' '.join(nav) + '<a href="#state-share">分享弹窗</a><a href="#state-profile">个人中心</a></nav></header>' + ''.join(sections) + '</html>'
(root / 'index.html').write_text(html)
manifest = []
for file in sorted(root.rglob('*')):
    if file.is_file() and file.name != 'manifest.json':
        manifest.append({'path':str(file.relative_to(root)), 'bytes':file.stat().st_size, 'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
(root / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print('Gallery:', root / 'index.html', 'Evidence files:', len(manifest))
