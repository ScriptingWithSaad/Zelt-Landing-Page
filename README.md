# Zelt Landing Page

A responsive HTML, CSS and JavaScript recreation of Zelt's people operations website.

[View the website](https://scriptingwithsaad.github.io/Zelt-Landing-Page/)

## Layout and motion

- Original 118-frame canvas sequence, story sections, SVG illustrations and both full-length animated videos retained.
- GSAP and ScrollTrigger keep the canvas pinned and scrub its frames with scrolling. Locomotive Scroll is upgraded to version 5, retaining smooth scrolling through its built-in Lenis engine and a shared GSAP ticker.
- Readable layouts for phones, tablets and desktops; landscape phones place story text beside the artwork. The mobile menu opens without changing header geometry.
- Frame files load locally, with compressed data prefetched and a bounded cache of original-resolution decoded images. Canvas density stays fixed while scrolling; there is no temporary low-quality mode.
- Product videos load near the viewport, play inline, loop while visible and pause offscreen. Each has a pause/play control and immediate poster. Reduced-motion preferences are respected.
- Fonts, illustrations and animation libraries are served locally. Versioned CSS and JavaScript avoid stale deployment caches.

## Development

Run `python -m http.server 8784 --bind 127.0.0.1` from the repository directory and open `http://127.0.0.1:8784/`.

After editing `stylesheet/style.css` or `javascript/script.js`, run:

```sh
python scripts/build_assets.py
python scripts/verify_site.py
node --check javascript/script.js
```

`scripts/prepare_assets.py` caches the original artwork and Montserrat font. `scripts/optimize_videos.py` requires Pillow and imageio-ffmpeg to regenerate full-length optimized videos and posters. Original attribution and licenses are in [THIRD_PARTY.md](THIRD_PARTY.md).

Browser checks cover 320–1920px widths, phone landscape, mobile navigation and anchor offsets, responsive canvas pinning, forward/backward scrubbing, both videos and pause/play controls. These are viewport checks rather than tests on every physical device.
