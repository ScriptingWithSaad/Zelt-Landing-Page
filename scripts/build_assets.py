"""Publish CSS/JS with content hashes to prevent stale Pages caches."""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/site'
OUT.mkdir(parents=True, exist_ok=True)
html = (ROOT / 'index.html').read_text(encoding='utf-8-sig')
current = set()
for source, label, extension in [('stylesheet/style.css', 'style', 'css'), ('javascript/script.js', 'app', 'js')]:
    content = (ROOT / source).read_text(encoding='utf-8-sig')
    if extension == 'css':
        content = content.replace('../assets/fonts/', '../fonts/')
    data = content.encode('utf-8')
    name = f'{label}.{hashlib.sha256(data).hexdigest()[:12]}.{extension}'
    (OUT / name).write_bytes(data)
    current.add(name)
    html = re.sub(rf'(?:{re.escape(source)}|assets/site/{label}\.[a-f0-9]+\.{extension})', f'assets/site/{name}', html)
    print(name)
(ROOT / 'index.html').write_bytes(html.encode('utf-8'))
for asset in OUT.iterdir():
    if re.fullmatch(r'(?:style|app)\.[a-f0-9]+\.(?:css|js)', asset.name) and asset.name not in current:
        asset.unlink()
