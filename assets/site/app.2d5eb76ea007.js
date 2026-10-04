(() => {
  "use strict";
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const canAnimate = Boolean(gsap && ScrollTrigger);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 800px)");
  const landscape = matchMedia("(max-height: 600px) and (min-width: 561px)");
  const header = document.querySelector(".nav");
  const menu = document.querySelector("#site-menu");
  const toggle = document.querySelector(".menu-toggle");
  const main = document.querySelector("#main");
  let locomotive;
  let navigationUntil = 0;
  let refreshTimer;
  let introPlayed = false;
  if (canAnimate) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }
  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (performance.now() < navigationUntil) return refresh();
      locomotive?.lenisInstance?.resize();
      if (canAnimate) ScrollTrigger.refresh();
      resizeCanvas();
    }, 180);
  }
  function closeMenu(focus = false) {
    document.body.classList.remove("menu-active");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    menu.inert = mobile.matches;
    main.inert = false;
    locomotive?.start();
    if (focus) toggle.focus({ preventScroll: true });
  }
  toggle.addEventListener("click", () => {
    if (document.body.classList.contains("menu-active")) return closeMenu();
    menu.inert = false;
    main.inert = true;
    document.body.classList.add("menu-active");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close navigation");
    locomotive?.stop();
  });
  mobile.addEventListener("change", () => {
    closeMenu();
    refresh();
  });
  closeMenu();
  document.addEventListener("pointerdown", (event) => {
    if (!header.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu(true);
    if (event.key !== "Tab" || !document.body.classList.contains("menu-active"))
      return;
    const controls = [...header.querySelectorAll("a,button")];
    const first = controls[0],
      last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (
      !link ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const href = link.getAttribute("href");
    if (!href?.startsWith("#")) {
      if (menu.contains(link)) closeMenu();
      return;
    }
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    event.preventDefault();
    const wasMenu = document.body.classList.contains("menu-active");
    closeMenu();
    navigationUntil = performance.now() + 1300;
    history.pushState(null, "", href);
    if (wasMenu || link.classList.contains("skip-link")) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
    requestAnimationFrame(() => {
      if (locomotive) {
        const offset =
          -parseFloat(
            getComputedStyle(document.documentElement).scrollPaddingTop,
          ) || 0;
        locomotive.scrollTo(target, { duration: 0.9, offset });
      } else
        target.scrollIntoView({
          behavior: reduced.matches ? "instant" : "smooth",
        });
    });
  });

  const story = document.querySelector(".scroll-story");
  const stage = document.querySelector(".canvas-stage");
  const canvas = stage.querySelector("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  const frameCount = 118;
  const sequence = { frame: 0 };
  const blobs = new Array(frameCount);
  const cache = new Map();
  const fetching = new Set();
  const decoding = new Set();
  const fetchQueue = new Set(
    Array.from({ length: frameCount }, (_, index) => index),
  );
  const decodeQueue = new Set();
  let targetFrame = 0;
  let direction = 1;
  let renderRaf;
  let storyVisible = true;
  let drawWidth = 0,
    drawHeight = 0;
  const url = (index) =>
    `assets/sequence/${String(index + 1).padStart(3, "0")}.webp`;
  const cacheLimit = () => (mobile.matches ? 12 : 24);
  function dispose(image) {
    if (typeof image.close === "function") image.close();
    else image.removeAttribute("src");
  }
  function trimCache() {
    while (cache.size > cacheLimit()) {
      const farthest = [...cache.keys()].sort(
        (a, b) => Math.abs(b - targetFrame) - Math.abs(a - targetFrame),
      )[0];
      dispose(cache.get(farthest));
      cache.delete(farthest);
    }
  }
  async function decode(blob) {
    if ("createImageBitmap" in window) return createImageBitmap(blob);
    const source = URL.createObjectURL(blob);
    const image = new Image();
    image.src = source;
    try {
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(source);
    }
  }
  function pumpDecode() {
    const slots = mobile.matches ? 2 : 3;
    while (decoding.size < slots && decodeQueue.size) {
      const index = [...decodeQueue].sort(
        (a, b) => Math.abs(a - targetFrame) - Math.abs(b - targetFrame),
      )[0];
      decodeQueue.delete(index);
      if (!blobs[index] || cache.has(index) || decoding.has(index)) continue;
      if (Math.abs(index - targetFrame) >= cacheLimit()) continue;
      decoding.add(index);
      decode(blobs[index])
        .then((image) => {
          if (Math.abs(index - targetFrame) < cacheLimit()) {
            cache.set(index, image);
            trimCache();
            requestRender();
          } else dispose(image);
        })
        .catch(() => {})
        .finally(() => {
          decoding.delete(index);
          pumpDecode();
        });
    }
  }
  function warmFrames() {
    const radius = mobile.matches ? 5 : 8;
    for (let distance = 0; distance <= radius; distance++) {
      for (const sign of [direction, -direction]) {
        const index = targetFrame + distance * sign;
        if (
          index >= 0 &&
          index < frameCount &&
          blobs[index] &&
          !cache.has(index) &&
          !decoding.has(index)
        )
          decodeQueue.add(index);
      }
    }
    pumpDecode();
  }
  function pumpFetch() {
    while (fetching.size < 6 && fetchQueue.size) {
      const index = [...fetchQueue].sort(
        (a, b) => Math.abs(a - targetFrame) - Math.abs(b - targetFrame),
      )[0];
      fetchQueue.delete(index);
      fetching.add(index);
      fetch(url(index))
        .then((response) => {
          if (!response.ok) throw new Error("Sequence frame unavailable");
          return response.blob();
        })
        .then((blob) => {
          blobs[index] = blob;
          warmFrames();
        })
        .catch(() => {})
        .finally(() => {
          fetching.delete(index);
          pumpFetch();
        });
    }
  }
  function requestRender() {
    if (renderRaf || !storyVisible || !context) return;
    renderRaf = requestAnimationFrame(() => {
      renderRaf = undefined;
      const ready = cache.has(targetFrame)
        ? targetFrame
        : [...cache.keys()].sort(
            (a, b) => Math.abs(a - targetFrame) - Math.abs(b - targetFrame),
          )[0];
      if (ready === undefined || !drawWidth || !drawHeight) return;
      const image = cache.get(ready);
      // Every frame uses its original resolution, including while the user scrolls.
      const ratio = Math.max(
        (drawWidth * (landscape.matches ? 1.45 : 1)) / image.width,
        drawHeight / image.height,
      );
      const width = image.width * ratio,
        height = image.height * ratio;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        (drawWidth - width) / 2 + (landscape.matches ? drawWidth * 0.22 : 0),
        (drawHeight - height) / 2,
        width,
        height,
      );
      stage.classList.add("is-ready");
      canvas.dataset.frame = String(ready + 1);
    });
  }
  function resizeCanvas() {
    const bounds = stage.getBoundingClientRect();
    const density = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(bounds.width * density),
      height = Math.round(bounds.height * density);
    drawWidth = bounds.width;
    drawHeight = bounds.height;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      context?.setTransform(density, 0, 0, density, 0, 0);
    }
    trimCache();
    requestRender();
  }
  function updateFrame() {
    const next = Math.max(
      0,
      Math.min(frameCount - 1, Math.round(sequence.frame)),
    );
    if (next !== targetFrame) direction = next >= targetFrame ? 1 : -1;
    targetFrame = next;
    canvas.dataset.targetFrame = String(next + 1);
    warmFrames();
    requestRender();
  }
  resizeCanvas();
  pumpFetch();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        storyVisible = entries[0].isIntersecting;
        if (storyVisible) {
          warmFrames();
          requestRender();
        }
      },
      { rootMargin: "200px" },
    ).observe(story);
  }
  if (canAnimate) {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      if (window.LocomotiveScroll) {
        locomotive = new window.LocomotiveScroll({
          lenisOptions: { lerp: 0.12, smoothWheel: true, syncTouch: false },
          scrollCallback: () => ScrollTrigger.update(),
          initCustomTicker: (render) => gsap.ticker.add(render),
          destroyCustomTicker: (render) => gsap.ticker.remove(render),
        });
        gsap.ticker.lagSmoothing(0);
      }
      gsap.to(sequence, {
        frame: frameCount - 1,
        ease: "none",
        onUpdate: updateFrame,
        scrollTrigger: {
          trigger: story,
          start: "top top",
          end: "bottom bottom",
          pin: stage,
          pinSpacing: false,
          scrub: 0.12,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
      if (
        !introPlayed &&
        scrollY < 80 &&
        (!location.hash || location.hash === "#home")
      ) {
        introPlayed = true;
        gsap.from(".page-1 .story-copy > *", {
          y: 18,
          opacity: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,opacity",
        });
      }
      refresh();
      return () => {
        locomotive?.destroy();
        locomotive = undefined;
        sequence.frame = 0;
        updateFrame();
      };
    });
  }

  const videos = [...document.querySelectorAll("video[data-src]")];
  function loadVideo(video) {
    if (video.hasAttribute("src")) return;
    video.src = video.dataset.src;
    video.muted = true;
    video.load();
  }
  function wantsVideo(video) {
    return (
      !document.hidden &&
      video.dataset.visible === "true" &&
      video.dataset.userPaused !== "true" &&
      (!reduced.matches || video.dataset.userPlayed === "true")
    );
  }
  function updateVideo(video) {
    if (!wantsVideo(video)) {
      video.pause();
      return;
    }
    loadVideo(video);
    video
      .play()
      .then(() => {
        if (!wantsVideo(video)) video.pause();
      })
      .catch(() => {
        const button = video.parentElement.querySelector(".video-toggle");
        button.textContent = "Play animation";
        button.setAttribute(
          "aria-label",
          `Play ${video.dataset.name} animation`,
        );
      });
  }
  videos.forEach((video) => {
    const button = video.parentElement.querySelector(".video-toggle");
    video.dataset.name = video.dataset.src.includes("people-centric")
      ? "people-centric"
      : "enabling";
    function state() {
      const paused = video.paused;
      button.textContent = paused ? "Play animation" : "Pause animation";
      button.setAttribute(
        "aria-label",
        `${paused ? "Play" : "Pause"} ${video.dataset.name} animation`,
      );
      button.setAttribute(
        "aria-pressed",
        String(video.dataset.userPaused === "true"),
      );
    }
    video.addEventListener("play", state);
    video.addEventListener("pause", state);
    video.addEventListener("loadedmetadata", () => {
      video.width = video.videoWidth;
      video.height = video.videoHeight;
    });
    button.addEventListener("click", () => {
      if (video.paused) {
        video.dataset.userPaused = "false";
        video.dataset.userPlayed = "true";
        video.dataset.visible = "true";
        loadVideo(video);
        video.play().catch(state);
      } else {
        video.dataset.userPaused = "true";
        video.pause();
      }
      state();
    });
    state();
  });
  if ("IntersectionObserver" in window) {
    const preload = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadVideo(entry.target);
            preload.unobserve(entry.target);
          }
        }),
      { rootMargin: "350px" },
    );
    const playback = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          entry.target.dataset.visible = String(entry.isIntersecting);
          updateVideo(entry.target);
        }),
      { threshold: 0.15 },
    );
    videos.forEach((video) => {
      preload.observe(video);
      playback.observe(video);
    });
  } else
    videos.forEach((video) => {
      video.dataset.visible = "true";
      updateVideo(video);
    });
  document.addEventListener("visibilitychange", () =>
    videos.forEach(updateVideo),
  );
  reduced.addEventListener("change", () => {
    videos.forEach(updateVideo);
    refresh();
  });
  document.fonts?.ready.then(refresh);
  addEventListener("resize", refresh, { passive: true });
  addEventListener("pageshow", refresh);
})();
