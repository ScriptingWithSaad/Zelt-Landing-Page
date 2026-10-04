"""Cache the original sequence and SVG artwork; retain every animation frame."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
import json
import re

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://zelt.app/assets/img/home/hero/sequence/'

def download(url, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=40) as response:
        data = response.read()
    path.write_bytes(data)

jobs = [(f'{BASE}{number}.webp', ROOT / 'assets/sequence' / f'{number:03}.webp') for number in range(1, 119)]
html = (ROOT / 'index.html').read_text(encoding='utf-8')
urls = [f'https://zelt.app/wp-content/themes/zelt/assets/lottie/home/{section}/images/img_{number}.png'
        for section, count in [('overview/people', 10), ('feature/simple', 6)] for number in range(count)]
manifest = {'sequence': {'source': BASE, 'frames': 118, 'width': 1600, 'height': 1000}, 'artwork': {}}
for url in urls:
    section = 'people' if '/people/' in url else 'simple'
    path = ROOT / 'assets/images' / section / url.rsplit('/', 1)[1]
    jobs.append((url, path))
    manifest['artwork'][url] = path.relative_to(ROOT).as_posix()
with ThreadPoolExecutor(max_workers=8) as pool:
    list(pool.map(lambda pair: download(*pair), jobs))
(ROOT / 'assets/source-assets.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
request = Request('https://fonts.googleapis.com/css2?family=Montserrat:wght@400..700&display=swap', headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'})
with urlopen(request, timeout=30) as response:
    css = response.read().decode()
font_url = re.findall(r'url\(([^)]+)\)', css)[-1]
with urlopen(font_url, timeout=30) as response:
    font = response.read()
assert font[:4] == b'wOF2', 'Expected a WOFF2 font'
(ROOT / 'assets/fonts/Montserrat-latin.woff2').write_bytes(font)
download('https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/OFL.txt', ROOT / 'assets/fonts/OFL.txt')
print(f'Cached {len(jobs)} original artwork files and Montserrat; all 118 frames retained.')
