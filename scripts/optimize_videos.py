"""Prepare full-length fast-start videos and their immediate posters.

Requires Pillow and imageio-ffmpeg. The original videos remain in assets/videos.
"""
from pathlib import Path
import subprocess
import imageio_ffmpeg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/optimized'
OUT.mkdir(parents=True, exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
for name, filename in [('people-centric', 'first video.mp4'), ('enabling', 'second video.mp4')]:
    source = ROOT / 'assets/videos' / filename
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-an',
                    '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'medium',
                    '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(OUT / f'{name}.mp4')], check=True)
    temporary = OUT / f'{name}-poster.png'
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.2', '-i', str(source),
                    '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", str(temporary)], check=True)
    with Image.open(temporary) as image:
        image.save(OUT / f'{name}-poster.webp', quality=90, method=6)
    temporary.unlink()
    print(f'{name}: {(OUT / (name + ".mp4")).stat().st_size:,} bytes, full duration retained')
