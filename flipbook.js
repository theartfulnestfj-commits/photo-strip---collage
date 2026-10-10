// Fallback data, used only if memories.json can't be fetched (e.g. the page
// is opened directly as a local file:// URL, where fetch() of a sibling JSON
// file is blocked by the browser).
const FALLBACK_BOOK = {
  bookTitle: "Memories",
  bookSubtitle: "A little book of moments",
  photos: [
    { src: "", caption: "" },
    { src: "", caption: "" },
    { src: "", caption: "" },
    { src: "", caption: "" }
  ]
};

async function loadBook() {
  try {
    const res = await fetch("memories.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`memories.json responded ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.photos) || data.photos.length === 0) {
      throw new Error("memories.json had no photos");
    }
    return data;
  } catch (err) {
    console.warn("Falling back to built-in memory data:", err.message);
    return FALLBACK_BOOK;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Preload every photo so the browser has already fetched AND decoded each
// one before the person starts flipping. Without this, flipping back to a
// page the library had hidden (display:none) can force the browser to
// re-decode that photo from scratch — for a real, full-resolution photo
// that can take the better part of a second, which is exactly what causes
// a flip to freeze for a moment and then suddenly snap through.
function preloadImages(book) {
  const sources = [book.coverImage, book.backCoverImage, ...book.photos.map(p => p.src)]
    .filter(Boolean);
  sources.forEach(src => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  });
}

// Camera icon shown inside any polaroid slot that has no photo yet.
const PLACEHOLDER_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="#8a7860" stroke-width="1.5">
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/>
    <circle cx="12" cy="13" r="3.5"/>
  </svg>
`;

function renderPhotoPage(photo) {
  return `
    <div class="photo-frame">
      ${photo.src ? `<img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption || "")}" decoding="async">` : PLACEHOLDER_ICON}
    </div>
    ${photo.caption ? `<div class="caption-bar"><p>${escapeHtml(photo.caption)}</p></div>` : ""}
  `;
}

function buildPages(book) {
  const flipbook = document.getElementById("flipbook");

  const front = document.createElement("div");
  front.className = "page page-cover" + (book.coverImage ? " page-cover-photo" : "");
  front.innerHTML = book.coverImage
    ? `
      <div class="photo-frame">
        <img src="${escapeHtml(book.coverImage)}" alt="${escapeHtml(book.bookTitle || "Cover")}">
      </div>
    `
    : `
      <p class="cover-eyebrow">A little book of</p>
      <h2>${escapeHtml(book.bookTitle || "Memories")}</h2>
      <div class="divider"></div>
      <p class="cover-line">${escapeHtml(book.bookSubtitle || "")}</p>
    `;
  flipbook.appendChild(front);

  book.photos.forEach(photo => {
    const photoPage = document.createElement("div");
    photoPage.className = "page photo-page";
    photoPage.innerHTML = renderPhotoPage(photo);
    flipbook.appendChild(photoPage);
  });

  const back = document.createElement("div");
  back.className = "page page-cover" + (book.backCoverImage ? " page-cover-photo" : "");
  back.innerHTML = book.backCoverImage
    ? `
      <div class="photo-frame">
        <img src="${escapeHtml(book.backCoverImage)}" alt="${escapeHtml(book.backCoverTitle || "Back cover")}">
      </div>
    `
    : `
      <p class="cover-eyebrow">${escapeHtml(book.backCoverEyebrow || "With love")}</p>
      <h2>${escapeHtml(book.backCoverTitle || "The End")}</h2>
      <div class="divider"></div>
      <p class="cover-line">${escapeHtml(book.backCoverSubtitle || "")}</p>
    `;
  flipbook.appendChild(back);
}

document.addEventListener("DOMContentLoaded", async () => {
  const book = await loadBook();
  preloadImages(book);
  buildPages(book);

  const pageFlip = new St.PageFlip(document.getElementById("flipbook"), {
    width: 480,
    height: 679, // A4 ratio (210mm x 297mm)
    size: "stretch",
    minWidth: 200,
    minHeight: 283,
    maxWidth: 1000,
    maxHeight: 1415,
    maxShadowOpacity: 0.65,
    showCover: true,
    mobileScrollSupport: true,
    drawShadow: true,
    flippingTime: 550,
    usePortrait: true,
    startZIndex: 0,
    autoSize: true,
    swipeDistance: 30,
    showPageCorners: true,
    disableFlipByClick: false,
  });

  pageFlip.loadFromHTML(document.querySelectorAll(".page"));

  // Fix a rendering glitch: showCover renders covers with a different (buggy)
  // 3D transform that flashes blank mid-flip on portrait screens. Resetting
  // density to "soft" after load keeps the closed-book cover layout while
  // using the same smooth curl animation as the rest of the book.
  const pageCollection = pageFlip.getPageCollection();
  pageCollection.getPage(0).setDensity("soft");
  pageCollection.getPage(pageFlip.getPageCount() - 1).setDensity("soft");

  const total = pageFlip.getPageCount();
  const label = document.getElementById("pageLabel");
  const update = (i) => { label.textContent = `Page ${i + 1} / ${total}`; };
  update(0);

  pageFlip.on("flip", (e) => update(e.data));

  document.getElementById("prevBtn").addEventListener("click", () => pageFlip.flipPrev());
  document.getElementById("nextBtn").addEventListener("click", () => pageFlip.flipNext());

  document.getElementById("fullscreenBtn").addEventListener("click", () => {
    const el = document.documentElement;
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFullscreen) {
      const request = el.requestFullscreen || el.webkitRequestFullscreen;
      if (request) request.call(el).catch?.(err => console.log(err));
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  });
});