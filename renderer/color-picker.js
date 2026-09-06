const COLOR_PICKER_SHADE_VALUES = [1, 0.85, 0.7, 0.55, 0.4, 0.25, 0.1];

function createColorPicker({ svCanvas, hueCanvas, shadesRow, hexInput, previewEl, initialHex }) {
  const state = hexToHsv(initialHex);

  function drawHueCanvas() {
    const ctx = hueCanvas.getContext('2d');
    const { width, height } = hueCanvas;
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    for (let stop = 0; stop <= 360; stop += 30) {
      gradient.addColorStop(stop / 360, hsvToHex({ h: stop, s: 1, v: 1 }));
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const cursorX = (state.h / 360) * width;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(cursorX - 2, 0, 4, height);
  }

  function drawSvCanvas() {
    const ctx = svCanvas.getContext('2d');
    const { width, height } = svCanvas;

    const satGradient = ctx.createLinearGradient(0, 0, width, 0);
    satGradient.addColorStop(0, '#ffffff');
    satGradient.addColorStop(1, hsvToHex({ h: state.h, s: 1, v: 1 }));
    ctx.fillStyle = satGradient;
    ctx.fillRect(0, 0, width, height);

    const valGradient = ctx.createLinearGradient(0, 0, 0, height);
    valGradient.addColorStop(0, 'rgba(0,0,0,0)');
    valGradient.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = valGradient;
    ctx.fillRect(0, 0, width, height);

    const cursorX = state.s * width;
    const cursorY = (1 - state.v) * height;
    ctx.strokeStyle = state.v > 0.5 ? '#000000' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawShadesRow() {
    shadesRow.innerHTML = '';
    COLOR_PICKER_SHADE_VALUES.forEach((v) => {
      const hex = hsvToHex({ h: state.h, s: state.s, v });
      const swatch = document.createElement('div');
      swatch.className = 'color-picker-shade';
      swatch.style.backgroundColor = hex;
      swatch.addEventListener('click', () => {
        state.v = v;
        renderAll();
      });
      shadesRow.appendChild(swatch);
    });
  }

  function renderAll() {
    const hex = hsvToHex(state);
    drawHueCanvas();
    drawSvCanvas();
    drawShadesRow();
    previewEl.style.backgroundColor = hex;
    hexInput.value = hex;
  }

  function pickFromEvent(canvas, evt, apply) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(Math.max(evt.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(evt.clientY - rect.top, 0), rect.height);
    apply(x / rect.width, y / rect.height);
    renderAll();
  }

  function bindDrag(canvas, apply) {
    canvas.addEventListener('pointerdown', (evt) => {
      canvas.setPointerCapture(evt.pointerId);
      pickFromEvent(canvas, evt, apply);
    });
    canvas.addEventListener('pointermove', (evt) => {
      if (evt.buttons !== 1) return;
      pickFromEvent(canvas, evt, apply);
    });
  }

  bindDrag(hueCanvas, (xFrac) => {
    state.h = xFrac * 360;
  });

  bindDrag(svCanvas, (xFrac, yFrac) => {
    state.s = xFrac;
    state.v = 1 - yFrac;
  });

  hexInput.addEventListener('input', () => {
    if (!HEX_COLOR_PATTERN.test(hexInput.value.trim())) return;
    const next = hexToHsv(hexInput.value.trim());
    state.h = next.h;
    state.s = next.s;
    state.v = next.v;
    drawHueCanvas();
    drawSvCanvas();
    drawShadesRow();
    previewEl.style.backgroundColor = hsvToHex(state);
  });

  renderAll();

  return {
    getHex: () => hsvToHex(state),
    setHex: (hex) => {
      const next = hexToHsv(hex);
      state.h = next.h;
      state.s = next.s;
      state.v = next.v;
      renderAll();
    },
  };
}
