const LEGEND_MARKERS = ["0", "I", "II", "III", "∴"];
const LEGEND_CLASSES = ["", "legend-marker--blue", "legend-marker--gold", "legend-marker--teal", "legend-marker--accent"];

const MAP_SOURCES = [
  "assets/explanatory-map.png",
  "assets/explanatory-map@2x.png",
];

let currentLang = localStorage.getItem("bhc-lang") || "en";
let mapViewerApi = null;

document.addEventListener("DOMContentLoaded", () => {
  initI18n();
  initNav();
  initReveal();
  mapViewerApi = initMapViewer();
  initLightbox();
  renderMath();
});

function t(key, lang = currentLang) {
  const parts = key.split(".");
  let val = I18N[lang];
  for (const p of parts) {
    if (val == null) return key;
    val = val[p];
  }
  return val;
}

function initI18n() {
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
  });
  setLanguage(currentLang, false);
}

function setLanguage(lang, save = true) {
  if (!I18N[lang]) return;
  currentLang = lang;
  if (save) localStorage.setItem("bhc-lang", lang);

  document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  document.body.classList.toggle("lang-zh", lang === "zh");

  document.getElementById("doc-title").textContent = t("meta.title");
  const metaDesc = document.getElementById("meta-desc");
  if (metaDesc) metaDesc.setAttribute("content", t("meta.description"));

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const val = t(el.getAttribute("data-i18n"));
    if (val != null) el.textContent = val;
  });

  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const val = t(el.getAttribute("data-i18n-html"));
    if (val != null) el.innerHTML = val;
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const val = t(el.getAttribute("data-i18n-aria"));
    if (val != null) el.setAttribute("aria-label", val);
  });

  document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    const val = t(el.getAttribute("data-i18n-alt"));
    if (val != null) el.setAttribute("alt", val);
  });

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  renderLegend(lang);
  renderInternalPoints(lang);

  const enhanceBtn = document.getElementById("enhance-btn");
  if (enhanceBtn) {
    enhanceBtn.textContent = enhanceBtn.classList.contains("is-on")
      ? t("map.enhanceOn")
      : t("map.enhance");
  }

  const hdBtn = document.getElementById("hd-btn");
  if (hdBtn && !hdBtn.classList.contains("is-on")) {
    hdBtn.textContent = t("map.hd");
  }

  renderMath();
}

function renderLegend(lang) {
  const grid = document.getElementById("legend-grid");
  if (!grid) return;
  grid.innerHTML = I18N[lang].map.legend
    .map(
      (item, i) => `
    <li>
      <span class="legend-marker ${LEGEND_CLASSES[i]}">${LEGEND_MARKERS[i]}</span>
      <div>
        <strong>${item.title}</strong>
        <p>${item.text}</p>
      </div>
    </li>`
    )
    .join("");
  if (typeof renderMathInElement === "function") {
    renderMathInElement(grid, mathOpts());
  }
}

function renderInternalPoints(lang) {
  const ul = document.getElementById("internal-points");
  if (!ul) return;
  ul.innerHTML = I18N[lang].internal.points.map((p) => `<li>${p}</li>`).join("");
  if (typeof renderMathInElement === "function") {
    renderMathInElement(ul, mathOpts());
  }
}

function mathOpts() {
  return {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
  };
}

function renderMath() {
  if (typeof renderMathInElement === "function") {
    renderMathInElement(document.body, mathOpts());
  }
}

function setMenuOpen(open) {
  const menuBtn = document.querySelector(".menu-btn");
  const nav = document.querySelector(".site-nav");
  if (!menuBtn || !nav) return;
  menuBtn.setAttribute("aria-expanded", String(open));
  nav.classList.toggle("open", open);
  document.body.classList.toggle("menu-open", open);
}

function initNav() {
  const menuBtn = document.querySelector(".menu-btn");
  const nav = document.querySelector(".site-nav");
  const links = nav.querySelectorAll("a[href^='#']");

  menuBtn.addEventListener("click", () => {
    const open = menuBtn.getAttribute("aria-expanded") === "true";
    setMenuOpen(!open);
  });

  links.forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenuOpen(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) setMenuOpen(false);
  });

  const sections = document.querySelectorAll("section[id], .hero[id]");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach((a) => {
          a.classList.toggle("active", a.getAttribute("href") === `#${id}`);
        });
      });
    },
    { rootMargin: "-35% 0px -55% 0px" }
  );
  sections.forEach((s) => observer.observe(s));
}

function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

function initMapViewer() {
  const canvas = document.getElementById("map-canvas");
  const stage = document.getElementById("map-stage");
  const img = document.getElementById("map-image");
  const zoomLabel = document.getElementById("zoom-level");
  const viewer = document.getElementById("map-viewer");
  const enhanceBtn = document.getElementById("enhance-btn");
  const hdBtn = document.getElementById("hd-btn");

  if (!canvas || !stage || !img || !viewer) return null;

  stage.classList.add("map-stage--fallback");

  const state = {
    scale: 1,
    minScale: 0.1,
    maxScale: 6,
    x: 0,
    y: 0,
    dragging: false,
    startX: 0,
    startY: 0,
  };

  let imgW = 0;
  let imgH = 0;
  let sourceIndex = 0;

  function applyTransform() {
    stage.classList.add("map-stage--ready");
    stage.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    if (zoomLabel) zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
  }

  function clampPan() {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const sw = imgW * state.scale;
    const sh = imgH * state.scale;
    state.x = sw <= cw ? (cw - sw) / 2 : Math.min(0, Math.max(cw - sw, state.x));
    state.y = sh <= ch ? (ch - sh) / 2 : Math.min(0, Math.max(ch - sh, state.y));
  }

  function fitToView() {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!imgW || !imgH || cw < 10 || ch < 10) return false;

    const padding = 20;
    state.scale = Math.max(
      state.minScale,
      Math.min((cw - padding) / imgW, (ch - padding) / imgH)
    );
    state.x = (cw - imgW * state.scale) / 2;
    state.y = (ch - imgH * state.scale) / 2;
    applyTransform();
    return true;
  }

  function resetView() {
    fitToView();
  }

  function zoomAt(factor, cx, cy) {
    const prev = state.scale;
    state.scale = Math.min(state.maxScale, Math.max(state.minScale, state.scale * factor));
    cx ??= canvas.clientWidth / 2;
    cy ??= canvas.clientHeight / 2;
    const ratio = state.scale / prev;
    state.x = cx - (cx - state.x) * ratio;
    state.y = cy - (cy - state.y) * ratio;
    clampPan();
    applyTransform();
  }

  function onImageReady() {
    imgW = img.naturalWidth;
    imgH = img.naturalHeight;
    if (!imgW || !imgH) return;

    viewer.classList.remove("map-viewer--error");
    stage.classList.remove("map-stage--fallback");

    if (!fitToView()) {
      requestAnimationFrame(() => fitToView());
    }
  }

  function tryNextSource() {
    sourceIndex += 1;
    if (sourceIndex < MAP_SOURCES.length) {
      img.src = MAP_SOURCES[sourceIndex];
    } else {
      viewer.classList.add("map-viewer--error");
    }
  }

  function bindImage() {
    img.addEventListener(
      "load",
      () => onImageReady(),
      { once: false }
    );
    img.addEventListener("error", tryNextSource);
    img.src = MAP_SOURCES[0];
    if (img.complete && img.naturalWidth) onImageReady();
  }

  function loadHiRes() {
    if (hdBtn?.classList.contains("is-on")) return;

    const hires = MAP_SOURCES[1];
    const loader = new Image();
    loader.onload = () => {
      const prevScale = state.scale;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const cx = cw / 2;
      const cy = ch / 2;
      const oldSw = imgW * prevScale;
      const oldSh = imgH * prevScale;
      const relX = oldSw > cw ? (cx - state.x) / oldSw : 0.5;
      const relY = oldSh > ch ? (cy - state.y) / oldSh : 0.5;
      const oldNaturalW = imgW;

      img.onload = () => {
        imgW = img.naturalWidth;
        imgH = img.naturalHeight;
        state.scale = prevScale * (imgW / oldNaturalW);
        state.x = cx - relX * imgW * state.scale;
        state.y = cy - relY * imgH * state.scale;
        clampPan();
        applyTransform();
        hdBtn?.classList.add("is-on");
        if (hdBtn) hdBtn.textContent = t("map.hdOn");
        viewer.classList.add("map-viewer--hd");
      };
      img.onerror = tryNextSource;
      img.src = hires;
    };
    loader.onerror = () => {
      if (hdBtn) hdBtn.textContent = t("map.hdFail");
    };
    loader.src = hires;
  }

  viewer.querySelectorAll("[data-zoom]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.zoom;
      if (action === "in") zoomAt(1.25);
      else if (action === "out") zoomAt(1 / 1.25);
      else if (action === "fit" || action === "reset") resetView();
    });
  });

  enhanceBtn?.addEventListener("click", () => {
    const on = stage.classList.toggle("map-stage--sharp");
    enhanceBtn.classList.toggle("is-on", on);
    enhanceBtn.textContent = on ? t("map.enhanceOn") : t("map.enhance");
  });

  stage.classList.add("map-stage--sharp");
  enhanceBtn?.classList.add("is-on");
  if (enhanceBtn) enhanceBtn.textContent = t("map.enhanceOn");

  hdBtn?.addEventListener("click", loadHiRes);

  viewer.querySelector("[data-action='fullscreen']")?.addEventListener("click", () => {
    document.getElementById("lightbox")?.showModal();
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
    },
    { passive: false }
  );

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    state.dragging = true;
    state.startX = e.clientX - state.x;
    state.startY = e.clientY - state.y;
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!state.dragging) return;
    state.x = e.clientX - state.startX;
    state.y = e.clientY - state.startY;
    clampPan();
    applyTransform();
  });

  function endDrag(e) {
    if (!state.dragging) return;
    state.dragging = false;
    canvas.classList.remove("is-dragging");
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("dblclick", resetView);

  let pinchDist = 0;
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (pinchDist > 0) {
        const rect = canvas.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        zoomAt(dist / pinchDist, cx, cy);
      }
      pinchDist = dist;
    },
    { passive: false }
  );

  const onViewportChange = () => {
    if (imgW && imgH) {
      clampPan();
      applyTransform();
    } else {
      fitToView();
    }
  };

  const ro = new ResizeObserver(onViewportChange);
  ro.observe(canvas);
  window.addEventListener("resize", onViewportChange);
  window.visualViewport?.addEventListener("resize", onViewportChange);

  bindImage();

  return { fitToView, resetView, loadHiRes };
}

function initLightbox() {
  const dialog = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightbox-image");
  if (!dialog) return;

  dialog.querySelector(".lightbox-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  if (lbImg) {
    lbImg.src = MAP_SOURCES[0];
    lbImg.onerror = () => {
      lbImg.onerror = null;
    };
  }
}
