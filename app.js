import { cleanEditableText, normalizeHex, wrapText } from "./banner-utils.mjs";

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 300;
const STORAGE_KEY = "banner-studio-design-v1";
const LOGO_SOURCE = "./9ef5593a-f6d5-403c-8da9-908024e3b4e3.JPG";

const DEFAULT_TEXT = [
  "RAMAKRISHNA SARADA MISSION GIRLS’ SCHOOL, KHONSA",
  "DISTRICT TIRAP, ARUNACHAL PRADESH 792130",
  "Affiliated to CBSE, New Delhi",
  "Established:1973",
].join("\n");

const FONT_OPTIONS = {
  Arial: "Arial, Helvetica, sans-serif",
  "Arial Black": "'Arial Black', 'Arial Bold', sans-serif",
  Calibri: "Calibri, 'Segoe UI', sans-serif",
  Cambria: "Cambria, Georgia, serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Tahoma: "Tahoma, Geneva, sans-serif",
  "Times New Roman": "'Times New Roman', Times, serif",
  "Trebuchet MS": "'Trebuchet MS', Arial, sans-serif",
  Verdana: "Verdana, Geneva, sans-serif",
  "Courier New": "'Courier New', Courier, monospace",
};

const defaultState = Object.freeze({
  text: DEFAULT_TEXT,
  font: "Arial",
  fontSize: 40,
  bold: true,
  italic: false,
  align: "center",
  textColor: "#9E1014",
  backgroundColor: "#FFF8E7",
  borderColor: "#171717",
  borderWidth: 6,
  logoSize: 214,
});

const elements = {
  banner: document.querySelector("#banner"),
  bannerViewport: document.querySelector("#bannerViewport"),
  bannerText: document.querySelector("#bannerText"),
  saveStatus: document.querySelector("#saveStatus"),
  overflowMessage: document.querySelector("#overflowMessage"),
  fontSelect: document.querySelector("#fontSelect"),
  fontSizeRange: document.querySelector("#fontSizeRange"),
  fontSizeOutput: document.querySelector("#fontSizeOutput"),
  boldButton: document.querySelector("#boldButton"),
  italicButton: document.querySelector("#italicButton"),
  alignButtons: [...document.querySelectorAll(".align-button")],
  textColor: document.querySelector("#textColor"),
  textHex: document.querySelector("#textHex"),
  backgroundColor: document.querySelector("#backgroundColor"),
  backgroundHex: document.querySelector("#backgroundHex"),
  borderColor: document.querySelector("#borderColor"),
  borderHex: document.querySelector("#borderHex"),
  logoSizeRange: document.querySelector("#logoSizeRange"),
  logoSizeOutput: document.querySelector("#logoSizeOutput"),
  borderWidthRange: document.querySelector("#borderWidthRange"),
  borderWidthOutput: document.querySelector("#borderWidthOutput"),
  exportFormat: document.querySelector("#exportFormat"),
  exportScale: document.querySelector("#exportScale"),
  undoButton: document.querySelector("#undoButton"),
  redoButton: document.querySelector("#redoButton"),
  resetButton: document.querySelector("#resetButton"),
  downloadButton: document.querySelector("#downloadButton"),
};

let state = loadState();
let saveTimer;
let logoPromise;
let transparentLogoSource;

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== "object") return { ...defaultState };

    const next = { ...defaultState, ...stored };
    next.text = typeof next.text === "string" && next.text ? next.text : DEFAULT_TEXT;
    next.font = FONT_OPTIONS[next.font] ? next.font : defaultState.font;
    next.fontSize = clampNumber(next.fontSize, 24, 64, defaultState.fontSize);
    next.logoSize = clampNumber(next.logoSize, 140, 255, defaultState.logoSize);
    next.borderWidth = clampNumber(next.borderWidth, 0, 14, defaultState.borderWidth);
    next.textColor = normalizeHex(next.textColor) || defaultState.textColor;
    next.backgroundColor = normalizeHex(next.backgroundColor) || defaultState.backgroundColor;
    next.borderColor = normalizeHex(next.borderColor) || defaultState.borderColor;
    next.align = ["left", "center", "right"].includes(next.align) ? next.align : defaultState.align;
    next.bold = Boolean(next.bold);
    next.italic = Boolean(next.italic);
    return next;
  } catch {
    return { ...defaultState };
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function populateFonts() {
  elements.fontSelect.replaceChildren(
    ...Object.entries(FONT_OPTIONS).map(([name, family]) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      option.style.fontFamily = family;
      return option;
    }),
  );
}

function applyState({ updateText = false } = {}) {
  const family = FONT_OPTIONS[state.font];
  elements.banner.style.setProperty("--banner-background", state.backgroundColor);
  elements.banner.style.setProperty("--banner-border", state.borderColor);
  elements.banner.style.setProperty("--border-width", `${state.borderWidth}px`);
  elements.banner.style.setProperty("--logo-height", `${state.logoSize}px`);

  Object.assign(elements.bannerText.style, {
    color: state.textColor,
    fontFamily: family,
    fontSize: `${state.fontSize}px`,
    fontWeight: state.bold ? "700" : "400",
    fontStyle: state.italic ? "italic" : "normal",
    textAlign: state.align,
  });

  if (updateText) elements.bannerText.textContent = state.text;

  elements.fontSelect.value = state.font;
  elements.fontSelect.style.fontFamily = family;
  elements.fontSizeRange.value = String(state.fontSize);
  elements.fontSizeOutput.value = String(state.fontSize);
  elements.fontSizeOutput.textContent = String(state.fontSize);
  elements.boldButton.classList.toggle("is-active", state.bold);
  elements.boldButton.setAttribute("aria-pressed", String(state.bold));
  elements.italicButton.classList.toggle("is-active", state.italic);
  elements.italicButton.setAttribute("aria-pressed", String(state.italic));

  for (const button of elements.alignButtons) {
    const active = button.dataset.align === state.align;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  syncColorControls("text", state.textColor);
  syncColorControls("background", state.backgroundColor);
  syncColorControls("border", state.borderColor);
  elements.logoSizeRange.value = String(state.logoSize);
  elements.logoSizeOutput.value = `${state.logoSize} px`;
  elements.logoSizeOutput.textContent = `${state.logoSize} px`;
  elements.borderWidthRange.value = String(state.borderWidth);
  elements.borderWidthOutput.value = `${state.borderWidth} px`;
  elements.borderWidthOutput.textContent = `${state.borderWidth} px`;

  requestAnimationFrame(checkOverflow);
}

function syncColorControls(prefix, color) {
  elements[`${prefix}Color`].value = color;
  elements[`${prefix}Hex`].value = color;
  elements[`${prefix}Hex`].classList.remove("is-invalid");
}

function queueSave() {
  elements.saveStatus.classList.add("is-saving");
  elements.saveStatus.lastChild.textContent = " Saving…";
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    elements.saveStatus.classList.remove("is-saving");
    elements.saveStatus.lastChild.textContent = " Saved locally";
  }, 220);
}

function updateState(patch, options) {
  state = { ...state, ...patch };
  applyState(options);
  queueSave();
}

function scaleBanner() {
  const availableWidth = elements.bannerViewport.clientWidth;
  const scale = Math.min(1, availableWidth / DESIGN_WIDTH);
  elements.banner.style.transform = `scale(${scale})`;
  elements.bannerViewport.style.height = `${DESIGN_HEIGHT * scale}px`;
}

function checkOverflow() {
  const isOverflowing =
    elements.bannerText.scrollHeight > elements.bannerText.clientHeight + 2 ||
    elements.bannerText.scrollWidth > elements.bannerText.clientWidth + 2;
  elements.overflowMessage.hidden = !isOverflowing;
}

function bindColorControl(prefix, stateKey) {
  const picker = elements[`${prefix}Color`];
  const hexInput = elements[`${prefix}Hex`];

  picker.addEventListener("input", () => {
    updateState({ [stateKey]: picker.value.toUpperCase() });
  });

  hexInput.addEventListener("input", () => {
    const normalized = normalizeHex(hexInput.value);
    hexInput.classList.toggle("is-invalid", !normalized);
    if (normalized) updateState({ [stateKey]: normalized });
  });

  hexInput.addEventListener("blur", () => {
    const normalized = normalizeHex(hexInput.value);
    if (normalized) {
      updateState({ [stateKey]: normalized });
    } else {
      syncColorControls(prefix, state[stateKey]);
    }
  });
}

function pastePlainText(event) {
  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain") ?? "";
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  selection.deleteFromDocument();
  const range = selection.getRangeAt(0);
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  elements.bannerText.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
}

function loadLogo() {
  if (!logoPromise) {
    logoPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The logo image could not be loaded."));
      image.src = LOGO_SOURCE;
    });
  }
  return logoPromise;
}

function getTransparentLogoSource(image) {
  if (transparentLogoSource) return transparentLogoSource;

  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = Math.round(image.naturalHeight * 0.982);
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0);

  const imageData = sourceContext.getImageData(0, 0, source.width, source.height);
  const pixels = imageData.data;
  const visited = new Uint8Array(source.width * source.height);
  const queue = new Int32Array(source.width * source.height);
  let queueStart = 0;
  let queueEnd = 0;

  const isBackground = (pixelIndex) => {
    const offset = pixelIndex * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const brightest = Math.max(red, green, blue);
    const darkest = Math.min(red, green, blue);
    return red > 218 && green > 218 && blue > 218 && brightest - darkest < 28;
  };

  const enqueue = (pixelIndex) => {
    if (visited[pixelIndex] || !isBackground(pixelIndex)) return;
    visited[pixelIndex] = 1;
    queue[queueEnd++] = pixelIndex;
  };

  for (let x = 0; x < source.width; x += 1) {
    enqueue(x);
    enqueue((source.height - 1) * source.width + x);
  }
  for (let y = 0; y < source.height; y += 1) {
    enqueue(y * source.width);
    enqueue(y * source.width + source.width - 1);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart++];
    const x = pixelIndex % source.width;
    const y = Math.floor(pixelIndex / source.width);
    pixels[pixelIndex * 4 + 3] = 0;
    if (x > 0) enqueue(pixelIndex - 1);
    if (x < source.width - 1) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - source.width);
    if (y < source.height - 1) enqueue(pixelIndex + source.width);
  }

  sourceContext.putImageData(imageData, 0, 0);
  // Remove the small orange screenshot artefact above the right side of the snake.
  sourceContext.clearRect(690, 0, 70, 82);
  transparentLogoSource = source;
  return transparentLogoSource;
}

async function prepareLogoPreview() {
  const logo = await loadLogo();
  const source = getTransparentLogoSource(logo);
  const transparentLogoUrl = source.toDataURL("image/png");
  for (const image of document.querySelectorAll(".banner-logo")) {
    image.src = transparentLogoUrl;
  }
}

function getCanvasFont(size) {
  const italic = state.italic ? "italic " : "";
  const weight = state.bold ? "700 " : "400 ";
  return `${italic}${weight}${size}px ${FONT_OPTIONS[state.font]}`;
}

function getFittedLines(context, text, maxWidth, maxHeight) {
  let fontSize = state.fontSize;
  let lines;
  let lineHeight;

  do {
    context.font = getCanvasFont(fontSize);
    lines = wrapText(text, (line) => context.measureText(line).width, maxWidth);
    lineHeight = fontSize * 1.27;
    if (lines.length * lineHeight <= maxHeight) break;
    fontSize -= 1;
  } while (fontSize > 18);

  return { fontSize, lines, lineHeight };
}

function drawLogo(context, source, x, y, height) {
  const ratio = source.width / source.height;
  const width = height * ratio;
  context.drawImage(
    source,
    0,
    0,
    source.width,
    source.height,
    x - width / 2,
    y,
    width,
    height,
  );
}

async function exportBanner() {
  const exportScale = Number(elements.exportScale.value);
  const exportFormat = elements.exportFormat.value;
  const isJpeg = exportFormat === "jpeg";
  const mimeType = isJpeg ? "image/jpeg" : "image/png";
  const extension = isJpeg ? "jpg" : "png";
  const canvas = document.createElement("canvas");
  canvas.width = DESIGN_WIDTH * exportScale;
  canvas.height = DESIGN_HEIGHT * exportScale;
  const context = canvas.getContext("2d");

  elements.downloadButton.disabled = true;
  elements.downloadButton.classList.add("is-loading");
  elements.downloadButton.lastChild.textContent = " Preparing…";

  try {
    await document.fonts.ready;
    const logo = await loadLogo();
    context.scale(exportScale, exportScale);
    context.fillStyle = state.backgroundColor;
    context.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

    const halfBorder = state.borderWidth / 2;
    if (state.borderWidth > 0) {
      context.strokeStyle = state.borderColor;
      context.lineWidth = state.borderWidth;
      context.strokeRect(halfBorder, halfBorder, DESIGN_WIDTH - state.borderWidth, DESIGN_HEIGHT - state.borderWidth);
    }

    const logoSource = getTransparentLogoSource(logo);
    const logoY = (DESIGN_HEIGHT - state.logoSize) / 2;
    drawLogo(context, logoSource, 150, logoY, state.logoSize);
    drawLogo(context, logoSource, DESIGN_WIDTH - 150, logoY, state.logoSize);

    const textLeft = 300;
    const textRight = DESIGN_WIDTH - 300;
    const maxTextWidth = textRight - textLeft;
    const text = cleanEditableText(elements.bannerText.innerText) || DEFAULT_TEXT;
    const { fontSize, lines, lineHeight } = getFittedLines(context, text, maxTextWidth, DESIGN_HEIGHT - 34);
    context.font = getCanvasFont(fontSize);
    context.fillStyle = state.textColor;
    context.textBaseline = "middle";
    context.textAlign = state.align;

    const textX = state.align === "left" ? textLeft : state.align === "right" ? textRight : DESIGN_WIDTH / 2;
    const blockHeight = (lines.length - 1) * lineHeight;
    const startY = DESIGN_HEIGHT / 2 - blockHeight / 2;
    lines.forEach((line, index) => context.fillText(line, textX, startY + index * lineHeight));

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, isJpeg ? 0.94 : undefined));
    if (!blob) throw new Error(`The browser could not create the ${exportFormat.toUpperCase()} file.`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `school-banner-${DESIGN_WIDTH * exportScale}x${DESIGN_HEIGHT * exportScale}.${extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "The banner could not be exported.");
  } finally {
    elements.downloadButton.disabled = false;
    elements.downloadButton.classList.remove("is-loading");
    updateDownloadButtonLabel();
  }
}

function updateDownloadButtonLabel() {
  const formatLabel = elements.exportFormat.value === "jpeg" ? "JPEG" : "PNG";
  elements.downloadButton.lastChild.textContent = ` Download ${formatLabel}`;
}

function bindEvents() {
  elements.bannerText.addEventListener("input", () => {
    state = { ...state, text: cleanEditableText(elements.bannerText.innerText) };
    queueSave();
    checkOverflow();
  });
  elements.bannerText.addEventListener("paste", pastePlainText);
  elements.bannerText.addEventListener("blur", () => {
    if (!cleanEditableText(elements.bannerText.innerText)) {
      elements.bannerText.textContent = DEFAULT_TEXT;
      updateState({ text: DEFAULT_TEXT });
    }
  });

  elements.fontSelect.addEventListener("change", () => updateState({ font: elements.fontSelect.value }));
  elements.fontSizeRange.addEventListener("input", () => updateState({ fontSize: Number(elements.fontSizeRange.value) }));
  elements.boldButton.addEventListener("click", () => updateState({ bold: !state.bold }));
  elements.italicButton.addEventListener("click", () => updateState({ italic: !state.italic }));
  for (const button of elements.alignButtons) {
    button.addEventListener("click", () => updateState({ align: button.dataset.align }));
  }

  bindColorControl("text", "textColor");
  bindColorControl("background", "backgroundColor");
  bindColorControl("border", "borderColor");

  elements.logoSizeRange.addEventListener("input", () => updateState({ logoSize: Number(elements.logoSizeRange.value) }));
  elements.borderWidthRange.addEventListener("input", () => updateState({ borderWidth: Number(elements.borderWidthRange.value) }));

  for (const button of [elements.undoButton, elements.redoButton]) {
    button.addEventListener("mousedown", (event) => event.preventDefault());
  }
  elements.undoButton.addEventListener("click", () => {
    elements.bannerText.focus();
    document.execCommand("undo");
  });
  elements.redoButton.addEventListener("click", () => {
    elements.bannerText.focus();
    document.execCommand("redo");
  });

  elements.resetButton.addEventListener("click", () => {
    const shouldReset = window.confirm("Reset the banner to the original design?");
    if (!shouldReset) return;
    state = { ...defaultState };
    applyState({ updateText: true });
    queueSave();
  });

  elements.downloadButton.addEventListener("click", exportBanner);
  elements.exportFormat.addEventListener("change", updateDownloadButtonLabel);
  window.addEventListener("resize", scaleBanner);
  new ResizeObserver(scaleBanner).observe(elements.bannerViewport);
}

populateFonts();
applyState({ updateText: true });
bindEvents();
scaleBanner();
prepareLogoPreview().catch(() => {});
