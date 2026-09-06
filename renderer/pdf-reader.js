// Native in-app PDF reader: renders pages onto a <canvas> via pdfjs-dist
// instead of embedding Chromium's own (unthemeable) PDF viewer in an
// <iframe>. pdfjs-dist v4 ships ES modules only, so this classic script
// lazy-loads it via a dynamic import() resolved relative to this script's
// own URL (captured up front, since document.currentScript is only valid
// during this script's synchronous top-level execution).
const PDF_READER_SCRIPT_URL = document.currentScript.src;

let pdfjsLibPromise = null;
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(new URL('../node_modules/pdfjs-dist/build/pdf.min.mjs', PDF_READER_SCRIPT_URL).href)
      .then((pdfjsLib) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', PDF_READER_SCRIPT_URL).href;
        return pdfjsLib;
      });
  }
  return pdfjsLibPromise;
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function createPdfReader({ canvas, pageLabelEl, thumbRailEl, prevBtn, nextBtn, zoomInBtn, zoomOutBtn, fitBtn, fullscreenBtn, fullscreenTarget }) {
  const ctx = canvas.getContext('2d');
  let pdfDoc = null;
  let currentPage = 1;
  let scale = 1;
  let fitToWidth = true;
  let renderToken = 0;

  async function renderCurrentPage() {
    if (!pdfDoc) return;
    const myToken = ++renderToken;
    const page = await pdfDoc.getPage(currentPage);
    if (myToken !== renderToken) return; // superseded by a newer render

    const unscaled = page.getViewport({ scale: 1 });
    if (fitToWidth) {
      const availableWidth = canvas.parentElement.clientWidth - 24;
      scale = Math.max(availableWidth / unscaled.width, 0.1);
    }
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    if (myToken !== renderToken) return;

    pageLabelEl.textContent = `Page ${currentPage} / ${pdfDoc.numPages}`;
    Array.from(thumbRailEl.children).forEach((el, idx) => {
      el.classList.toggle('active', idx + 1 === currentPage);
    });
  }

  async function renderThumbnails() {
    thumbRailEl.innerHTML = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.12 });
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = viewport.width;
      thumbCanvas.height = viewport.height;
      thumbCanvas.className = 'pdf-thumb';
      // eslint-disable-next-line no-await-in-loop
      await page.render({ canvasContext: thumbCanvas.getContext('2d'), viewport }).promise;
      thumbCanvas.addEventListener('click', () => {
        currentPage = i;
        renderCurrentPage();
      });
      thumbRailEl.appendChild(thumbCanvas);
    }
  }

  async function load() {
    const pdfjsLib = await loadPdfjs();
    // No path is passed here: the main process only ever reads back its own
    // fixed, known preview file — see fs:read-pdf-bytes in main.js.
    const bytesResult = await window.api.readPdfBytes();
    if (!bytesResult.success) {
      throw new Error(bytesResult.error);
    }
    const data = base64ToUint8Array(bytesResult.data);
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    currentPage = 1;
    fitToWidth = true;
    await renderThumbnails();
    await renderCurrentPage();
  }

  prevBtn.addEventListener('click', () => {
    if (!pdfDoc || currentPage <= 1) return;
    currentPage -= 1;
    renderCurrentPage();
  });
  nextBtn.addEventListener('click', () => {
    if (!pdfDoc || currentPage >= pdfDoc.numPages) return;
    currentPage += 1;
    renderCurrentPage();
  });
  zoomInBtn.addEventListener('click', () => {
    fitToWidth = false;
    scale = Math.min(scale + 0.25, 4);
    renderCurrentPage();
  });
  zoomOutBtn.addEventListener('click', () => {
    fitToWidth = false;
    scale = Math.max(scale - 0.25, 0.2);
    renderCurrentPage();
  });
  fitBtn.addEventListener('click', () => {
    fitToWidth = true;
    renderCurrentPage();
  });
  fullscreenBtn.addEventListener('click', () => {
    if (fullscreenTarget.requestFullscreen) fullscreenTarget.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    if (fitToWidth) renderCurrentPage();
  });

  return { load };
}
