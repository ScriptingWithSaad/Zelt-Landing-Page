"""Check release files, responsive images, fragment links and asset hashes."""
from collections import Counter
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = []

    def handle_starttag(self, tag, attributes):
        self.elements.append((tag, dict(attributes)))

document = Document()
document.feed((ROOT / 'index.html').read_text(encoding='utf-8'))
ids = Counter(attrs['id'] for _, attrs in document.elements if 'id' in attrs)
assert all(count == 1 for count in ids.values()), 'Duplicate HTML/SVG ID'
assert sum(tag == 'h1' for tag, _ in document.elements) == 1, 'Expected one page heading'
assets = set()
for tag, attrs in document.elements:
    for key in ['src', 'poster', 'data-src', 'href', 'xlink:href']:
        value = attrs.get(key)
        if not value:
            continue
        url = urlsplit(value)
        if url.scheme or url.netloc:
            continue
        if url.path:
            path = ROOT / unquote(url.path)
            assert path.is_file(), f'Missing asset: {value}'
            assets.add(path)
        elif url.fragment:
            assert unquote(url.fragment) in ids, f'Missing fragment: {value}'
    if tag == 'img':
        assert int(attrs.get('width', 0)) > 0 and int(attrs.get('height', 0)) > 0, 'Images need intrinsic dimensions'
        assert 'alt' in attrs, 'Images need alternative text'
        for candidate in attrs.get('srcset', '').split(','):
            if candidate.strip():
                value = candidate.split()[0]
                path = ROOT / unquote(value)
                assert path.is_file(), f'Missing responsive image: {value}'
                assets.add(path)
    if tag == 'video':
        assert not attrs.get('src') and attrs.get('data-src'), 'Videos must load near the viewport'
        assert attrs.get('poster') and attrs.get('preload') == 'none', 'Videos need an immediate poster'
        assert 'playsinline' in attrs and 'loop' in attrs and 'muted' in attrs, 'Inline product animations must remain'
for css in [path for path in assets if path.suffix == '.css']:
    for value in re.findall(r'url\([\'"]?([^\)\'"]+)', css.read_text(encoding='utf-8')):
        assert (css.parent / value).is_file(), f'Missing CSS asset: {value}'
for asset in assets:
    if asset.parent.name != 'site':
        continue
    expected = asset.name.split('.')[1]
    assert sha256(asset.read_bytes()).hexdigest().startswith(expected), f'Stale asset hash: {asset.name}'
    source = ROOT / ('stylesheet/style.css' if asset.suffix == '.css' else 'javascript/script.js')
    content = source.read_text(encoding='utf-8').replace('../assets/fonts/', '../fonts/')
    assert content.encode('utf-8') == asset.read_bytes(), f'Run scripts/build_assets.py: {asset.name}'
assert all('data-scroll-container' not in attrs for _, attrs in document.elements), 'Nested transformed scrollers must not return'
frames = list((ROOT / 'assets/sequence').glob('*.webp'))
assert len(frames) == 118, 'Retain all original animation frames'
for index in range(1, 119):
    assert (ROOT / 'assets/sequence' / f'{index:03}.webp').is_file(), f'Missing frame: {index}'
assert (ROOT / 'assets/fonts/Montserrat-latin.woff2').read_bytes()[:4] == b'wOF2', 'Invalid font format'
assert sum(tag == 'video' for tag, _ in document.elements) == 2, 'Retain both animated videos'
print(f'PASS: {len(ids)} unique IDs, valid links, {len(assets)} local assets, all 118 frames, both inline videos and current CSS/JS hashes')
