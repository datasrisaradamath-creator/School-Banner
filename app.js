import { cleanEditableText, normalizeHex, wrapText } from "./banner-utils.mjs";
import { downloadDesignsDocx } from "./word-export.mjs";

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
  Anton: "'Anton', Impact, sans-serif",
  "Archivo Black": "'Archivo Black', 'Arial Black', sans-serif",
  "League Spartan": "'League Spartan', Arial, sans-serif",
  Cinzel: "'Cinzel', Georgia, serif",
  "Libre Baskerville": "'Libre Baskerville', Georgia, serif",
  "Roboto Slab": "'Roboto Slab', Georgia, serif",
  Montserrat: "'Montserrat', Arial, sans-serif",
  Oswald: "'Oswald', Arial, sans-serif",
  "Bebas Neue": "'Bebas Neue', Arial, sans-serif",
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
  textColor: "#FFFFD9",
  backgroundColor: "#A50001",
  borderColor: "#FFFFD9",
  borderWidth: 6,
  logoSize: 214,
  boardWidth: DESIGN_WIDTH,
  boardHeight: DESIGN_HEIGHT,
  sideSpacing: 40,
  heritageLogoSize: 300,
  heritageGap: 20,
  layout: "classic",
  matchEmblemColor: true,
});

const elements = {
  boardWidthRange: document.querySelector("#boardWidthRange"),
  boardHeightRange: document.querySelector("#boardHeightRange"),
  boardWidthInput: document.querySelector("#boardWidthInput"),
  boardHeightInput: document.querySelector("#boardHeightInput"),
  sideSpacingRange: document.querySelector("#sideSpacingRange"),
  sideSpacingOutput: document.querySelector("#sideSpacingOutput"),
  matchEmblemColor: document.querySelector("#matchEmblemColor"),
  layoutSelect: document.querySelector("#layoutSelect"),
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
  heritageGapControl: document.querySelector("#heritageGapControl"),
  heritageGapRange: document.querySelector("#heritageGapRange"),
  heritageGapOutput: document.querySelector("#heritageGapOutput"),
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
let monochromeMaskPromise;
let previewVersion = 0;

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== "object") return { ...defaultState };

    const next = { ...defaultState, ...stored };
    next.text = typeof next.text === "string" && next.text ? next.text : DEFAULT_TEXT;
    next.font = FONT_OPTIONS[next.font] ? next.font : defaultState.font;
    next.fontSize = clampNumber(next.fontSize, 12, 240, defaultState.fontSize);
    next.boardWidth = clampNumber(next.boardWidth, 400, 3000, DESIGN_WIDTH);
    next.boardHeight = clampNumber(next.boardHeight, 120, 1200, DESIGN_HEIGHT);
    next.logoSize = clampNumber(next.logoSize, 140, 255, defaultState.logoSize);
    next.sideSpacing = clampNumber(next.sideSpacing, 0, 120, defaultState.sideSpacing);
    next.heritageLogoSize = clampNumber(next.heritageLogoSize, 240, 400, defaultState.heritageLogoSize);
    next.heritageGap = clampNumber(next.heritageGap, 0, 100, defaultState.heritageGap);
    next.borderWidth = clampNumber(next.borderWidth, 0, 14, defaultState.borderWidth);
    next.textColor = normalizeHex(next.textColor) || defaultState.textColor;
    next.backgroundColor = normalizeHex(next.backgroundColor) || defaultState.backgroundColor;
    next.borderColor = normalizeHex(next.borderColor) || defaultState.borderColor;
    next.align = ["left", "center", "right"].includes(next.align) ? next.align : defaultState.align;
    next.bold = Boolean(next.bold);
    next.italic = Boolean(next.italic);
    next.layout = "classic";
    next.matchEmblemColor = typeof stored.matchEmblemColor === "boolean" ? stored.matchEmblemColor : false;
    delete next.led;
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
  state.layout = "classic";
  elements.matchEmblemColor.checked = Boolean(state.matchEmblemColor);
  elements.layoutSelect.value = state.layout;
  elements.banner.dataset.layout = state.layout;
  elements.banner.style.width = `${getDesignWidth()}px`;
  elements.banner.style.height = `${getDesignHeight()}px`;
  elements.boardWidthRange.value = elements.boardWidthInput.value = String(getDesignWidth());
  elements.boardHeightRange.value = elements.boardHeightInput.value = String(getDesignHeight());
  const geometry = getBoardGeometry();
  elements.banner.style.setProperty("--logo-column-width", `${geometry.columnWidth}px`);
  elements.banner.style.setProperty("--text-max-height", `${geometry.textHeight + 20}px`);
  for (const option of elements.exportScale.options) {
    const scale = Number(option.value);
    option.textContent = `${scale === 1 ? "Standard" : scale === 2 ? "High" : "Print"} · ${getDesignWidth() * scale} × ${getDesignHeight() * scale}`;
  }
  scaleBanner();
  const family = FONT_OPTIONS[state.font];
  elements.banner.style.setProperty("--banner-background", state.backgroundColor);
  elements.banner.style.setProperty("--banner-border", state.borderColor);
  elements.banner.style.setProperty("--border-width", `${state.borderWidth}px`);
  elements.banner.style.setProperty("--inner-border-width", `${state.borderWidth > 0 ? Math.max(1, state.borderWidth / 2) : 0}px`);
  elements.banner.classList.toggle("has-border", state.borderWidth > 0);
  elements.banner.style.setProperty("--logo-height", `${geometry.logoHeight}px`);
  elements.banner.style.setProperty("--side-spacing", `${geometry.padding}px`);
  elements.sideSpacingRange.value = String(state.sideSpacing);
  elements.sideSpacingOutput.textContent = `${state.sideSpacing} px`;
  elements.banner.style.setProperty("--heritage-logo-height", `${state.heritageLogoSize}px`);
  elements.banner.style.setProperty("--heritage-gap", `${state.heritageGap}px`);
  elements.heritageGapControl.hidden = state.layout !== "arched";
  elements.heritageGapRange.value = String(state.heritageGap);
  elements.heritageGapOutput.textContent = `${state.heritageGap} px`;
  elements.logoSizeRange.min = state.layout === "arched" ? "240" : "140";
  elements.logoSizeRange.max = state.layout === "arched" ? "400" : "255";
  if (state.layout === "arched") {
    const frame = document.createElement("canvas");
    frame.width = 1200;
    frame.height = 800;
    drawArchedFrame(frame.getContext("2d"));
    elements.banner.style.backgroundImage = `url(${frame.toDataURL()})`;
  } else {
    elements.banner.style.backgroundImage = "none";
  }

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
  const activeLogoSize = state.layout === "arched" ? state.heritageLogoSize : state.logoSize;
  elements.logoSizeRange.value = String(activeLogoSize);
  elements.logoSizeOutput.value = `${activeLogoSize} px`;
  elements.logoSizeOutput.textContent = `${activeLogoSize} px`;
  elements.borderWidthRange.value = String(state.borderWidth);
  elements.borderWidthOutput.value = `${state.borderWidth} px`;
  elements.borderWidthOutput.textContent = `${state.borderWidth} px`;

  requestAnimationFrame(checkOverflow);
  prepareLogoPreview().catch(() => {});
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

function getDesignHeight() {
  return state.boardHeight || DESIGN_HEIGHT;
}

function getDesignWidth() {
  return state.boardWidth || DESIGN_WIDTH;
}

function getBoardGeometry() {
  const width = getDesignWidth(), height = getDesignHeight();
  const padding = Math.min(state.sideSpacing, width * 0.08);
  const columnWidth = Math.min(state.logoSize + 46, width * 0.22);
  const logoHeight = Math.max(24, Math.min(state.logoSize, height - 56, columnWidth - 16));
  const textLeft = state.borderWidth + padding + columnWidth + 16;
  return { padding, columnWidth, logoHeight, logoCenter: state.borderWidth + padding + columnWidth / 2, textLeft, textWidth: width - 2 * textLeft, textHeight: height - 2 * state.borderWidth - 36 };
}

function scaleBanner() {
  const availableWidth = elements.bannerViewport.clientWidth;
  const scale = Math.min(1, availableWidth / getDesignWidth(), 650 / getDesignHeight());
  elements.banner.style.left = `${Math.max(0, (availableWidth - getDesignWidth() * scale) / 2)}px`;
  elements.banner.style.transform = `scale(${scale})`;
  elements.bannerViewport.style.height = `${getDesignHeight() * scale}px`;
}

function checkOverflow() {
  const context = document.createElement("canvas").getContext("2d");
  const geometry = getBoardGeometry();
  const fitted = getFittedLines(context, cleanEditableText(elements.bannerText.innerText), geometry.textWidth, geometry.textHeight);
  elements.bannerText.style.fontSize = `${fitted.fontSize}px`;
  const isOverflowing =
    elements.bannerText.scrollHeight > elements.bannerText.clientHeight + 2 ||
    elements.bannerText.scrollWidth > elements.bannerText.clientWidth + 2;
  elements.overflowMessage.hidden = !isOverflowing && fitted.fontSize === state.fontSize;
  elements.overflowMessage.textContent = isOverflowing ? "Text is crowded—enlarge the board or shorten the text." : `Text fitted to ${fitted.fontSize}px to stay inside the board (requested ${state.fontSize}px).`;
}

function archedPath(inset = 0) {
  const path = new Path2D();
  path.moveTo(20 + inset, 780 - inset);
  path.lineTo(20 + inset, 250 + inset);
  path.lineTo(140 + inset, 250 + inset);
  path.lineTo(140 + inset, 160 + inset);
  path.lineTo(320 + inset * 0.4, 160 + inset);
  path.bezierCurveTo(475, 5 + inset, 725, 5 + inset, 880 - inset * 0.4, 160 + inset);
  path.lineTo(1060 - inset, 160 + inset);
  path.lineTo(1060 - inset, 250 + inset);
  path.lineTo(1180 - inset, 250 + inset);
  path.lineTo(1180 - inset, 780 - inset);
  path.closePath();
  return path;
}

function drawArchedFrame(context) {
  const path = archedPath();
  context.fillStyle = state.backgroundColor;
  context.fill(path);
  if (state.borderWidth > 0) {
    context.strokeStyle = state.borderColor;
    context.lineWidth = state.borderWidth;
    context.lineJoin = "round";
    context.stroke(path);
    context.lineWidth = Math.max(1, state.borderWidth / 2);
    context.stroke(archedPath(18 + state.borderWidth));
  }
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
  const version = ++previewVersion;
  const source = await getActiveLogoSource();
  if (version !== previewVersion) return;
  const transparentLogoUrl = source.toDataURL("image/png");
  for (const image of document.querySelectorAll(".banner-logo")) {
    image.src = transparentLogoUrl;
  }
}

async function getActiveLogoSource() {
  const matchColor = Boolean(state.matchEmblemColor);
  const color = state.textColor;
  if (!matchColor) return getTransparentLogoSource(await loadLogo());
  if (!monochromeMaskPromise) {
    monochromeMaskPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load the matching-colour emblem."));
      image.onload = () => {
        const mask = document.createElement("canvas");
        mask.width = image.naturalWidth; mask.height = image.naturalHeight;
        const context = mask.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, mask.width, mask.height);
        // The supplied cream artwork has a bright green channel; the red background does not.
        // Use this as coverage, preserving the emblem details without redrawing the artwork.
        for (let offset = 0; offset < data.data.length; offset += 4) {
          const coverage = Math.max(0, Math.min(1, (data.data[offset + 1] - 35) / 190));
          data.data[offset + 3] = Math.round(data.data[offset + 3] * coverage);
          data.data[offset] = data.data[offset + 1] = data.data[offset + 2] = 255;
        }
        context.putImageData(data, 0, 0); resolve(mask);
      };
      image.src = "./assets/emblem-monochrome-source.png";
    });
  }
  const mask = await monochromeMaskPromise;
  const tinted = document.createElement("canvas"); tinted.width = mask.width; tinted.height = mask.height;
  const context = tinted.getContext("2d"); context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = "source-in"; context.fillStyle = color; context.fillRect(0, 0, tinted.width, tinted.height);
  return tinted;
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
  } while (fontSize > 8);

  context.font = getCanvasFont(fontSize);
  lines = wrapText(text, (line) => context.measureText(line).width, maxWidth);
  lineHeight = fontSize * 1.27;

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

async function exportBanner({ capture = false, captureScale = 1 } = {}) {
  const designWidth = getDesignWidth();
  const designHeight = getDesignHeight();
  const exportScale = capture ? captureScale : Number(elements.exportScale.value);
  const exportFormat = elements.exportFormat.value;
  const isJpeg = exportFormat === "jpeg";
  const mimeType = isJpeg ? "image/jpeg" : "image/png";
  const extension = isJpeg ? "jpg" : "png";
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(designWidth * exportScale);
  canvas.height = Math.ceil(designHeight * exportScale);
  const context = canvas.getContext("2d");

  elements.downloadButton.disabled = true;
  elements.downloadButton.classList.add("is-loading");
  elements.downloadButton.lastChild.textContent = " Preparing…";

  try {
    await document.fonts.load(getCanvasFont(state.fontSize));
    await document.fonts.ready;
    const logoSource = await getActiveLogoSource();
    context.scale(exportScale, exportScale);
    if (state.layout === "arched") {
      if (isJpeg) {
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, designWidth, designHeight);
      }
      drawArchedFrame(context);
    } else {
      context.fillStyle = state.backgroundColor;
      context.fillRect(0, 0, designWidth, designHeight);
    }

    const halfBorder = state.borderWidth / 2;
    if (state.borderWidth > 0 && state.layout !== "arched") {
      context.strokeStyle = state.borderColor;
      context.lineWidth = state.borderWidth;
      context.strokeRect(halfBorder, halfBorder, designWidth - state.borderWidth, designHeight - state.borderWidth);
      const innerWidth = Math.max(1, state.borderWidth / 2);
      const innerInset = state.borderWidth + 12 + innerWidth / 2;
      context.lineWidth = innerWidth;
      context.strokeRect(innerInset, innerInset, designWidth - innerInset * 2, designHeight - innerInset * 2);
    }

    const geometry = getBoardGeometry();
    const logoHeight = geometry.logoHeight;
    const logoY = (designHeight - logoHeight) / 2;
    const logoCenter = geometry.logoCenter;
    drawLogo(context, logoSource, logoCenter, logoY, logoHeight);
    drawLogo(context, logoSource, designWidth - logoCenter, logoY, logoHeight);

    const textLeft = geometry.textLeft;
    const textRight = designWidth - textLeft;
    const maxTextWidth = textRight - textLeft;
    const text = cleanEditableText(elements.bannerText.innerText) || DEFAULT_TEXT;
    const textTop = (designHeight - geometry.textHeight) / 2;
    const textBottom = designHeight - textTop;
    const { fontSize, lines, lineHeight } = getFittedLines(context, text, maxTextWidth, textBottom - textTop);
    context.font = getCanvasFont(fontSize);
    context.fillStyle = state.textColor;
    context.textBaseline = "middle";
    context.textAlign = state.align;

    const textX = state.align === "left" ? textLeft : state.align === "right" ? textRight : (textLeft + textRight) / 2;
    const blockHeight = (lines.length - 1) * lineHeight;
    const startY = state.layout === "arched" ? textTop + lineHeight / 2 : (textTop + textBottom) / 2 - blockHeight / 2;
    lines.forEach((line, index) => context.fillText(line, textX, startY + index * lineHeight));

    if (capture) return canvas;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, isJpeg ? 0.94 : undefined));
    if (!blob) throw new Error(`The browser could not create the ${exportFormat.toUpperCase()} file.`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `school-banner-${designWidth * exportScale}x${designHeight * exportScale}.${extension}`;
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
  for (const [key, minimum, maximum] of [["boardWidth", 400, 3000], ["boardHeight", 120, 1200]]) {
    elements[`${key}Range`].addEventListener("input", () => updateState({ [key]: Number(elements[`${key}Range`].value) }));
    elements[`${key}Input`].addEventListener("change", () => updateState({ [key]: clampNumber(elements[`${key}Input`].value, minimum, maximum, state[key]) }));
  }
  document.querySelector("#shortNameButton").addEventListener("click", () => {
    if (!confirm("Replace the current banner text with Sarada Vihar? Saved choices will stay unchanged.")) return;
    updateState({ text: "Sarada Vihar", boardWidth: 1200, boardHeight: 300, fontSize: 100 }, { updateText: true });
  });
  elements.sideSpacingRange.addEventListener("input", () => updateState({ sideSpacing: Number(elements.sideSpacingRange.value) }));
  elements.matchEmblemColor.addEventListener("change", () => updateState({ matchEmblemColor: elements.matchEmblemColor.checked }));
  elements.layoutSelect.addEventListener("change", () => updateState({ layout: elements.layoutSelect.value }));
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

  elements.logoSizeRange.addEventListener("input", () => updateState({ [state.layout === "arched" ? "heritageLogoSize" : "logoSize"]: Number(elements.logoSizeRange.value) }));
  elements.heritageGapRange.addEventListener("input", () => updateState({ heritageGap: Number(elements.heritageGapRange.value) }));
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
document.fonts.addEventListener("loadingdone", checkOverflow);

const FAVORITES_KEY = "school-banner-favorites-v1";
let favorites;
try { favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; } catch { favorites = []; }
if (!Array.isArray(favorites)) favorites = [];
const gallery = document.querySelector("#savedGallery");
const galleryStatus = document.querySelector("#galleryStatus");
function designMetadata(savedState) {
  const design = { ...defaultState, ...savedState };
  return [
    `Text colour: ${design.textColor} | Background: ${design.backgroundColor} | Border: ${design.borderColor}`,
    `Font: ${design.font} | Size: ${design.fontSize} px | ${design.bold ? "Bold" : "Regular"}${design.italic ? " Italic" : ""} | Alignment: ${design.align}`,
    `Border thickness: ${design.borderWidth} px | Logo size: ${design.logoSize} px`,
    `Left and right spacing: ${design.sideSpacing} px`,
    `Board dimensions: ${design.boardWidth} × ${design.boardHeight} px`,
    `Emblem style: ${savedState.matchEmblemColor === true ? "Matches text colour" : "Original colours"}`,
  ];
}
function renderFavorites() {
  gallery.replaceChildren();
  for (const favorite of favorites) {
    const card = document.createElement("article");
    const image = document.createElement("img"); image.src = favorite.image; image.alt = favorite.name;
    const title = document.createElement("h4"); title.textContent = favorite.name;
    const metadata = document.createElement("div"); metadata.className = "design-metadata";
    for (const detail of designMetadata(favorite.state)) {
      const paragraph = document.createElement("p"); paragraph.textContent = detail; metadata.append(paragraph);
    }
    const restore = document.createElement("button"); restore.className = "button button-quiet"; restore.textContent = "Restore";
    const layoutPicker = document.createElement("select");
    layoutPicker.setAttribute("aria-label", `Layout to restore for ${favorite.name}`);
    for (const option of elements.layoutSelect.options) layoutPicker.append(option.cloneNode(true));
    layoutPicker.value = "classic"; layoutPicker.hidden = true;
    const coverage = document.createElement("p"); coverage.textContent = "Classic rectangle";
    restore.onclick = () => { state = { ...defaultState, ...favorite.state, matchEmblemColor: favorite.state.matchEmblemColor === true, layout: "classic" }; applyState({ updateText: true }); queueSave(); };
    const remove = document.createElement("button"); remove.className = "button button-quiet"; remove.textContent = "Delete";
    remove.onclick = () => {
      if (!confirm(`Delete saved choice “${favorite.name}”?`)) return;
      const next = favorites.filter(item => item.id !== favorite.id);
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); favorites = next; renderFavorites(); }
      catch { galleryStatus.textContent = "Could not update saved choices."; }
    };
    card.append(image, title, coverage, metadata, layoutPicker, restore, remove); gallery.append(card);
  }
  document.querySelector("#downloadWord").disabled = favorites.length === 0;
}
const saveEmblemDialog = document.querySelector("#saveEmblemDialog");
const saveEmblemForm = document.querySelector("#saveEmblemForm");
let savingEmblem = false;
document.querySelector("#saveDesign").onclick = () => {
  saveEmblemForm.elements.savedEmblemStyle.value = state.matchEmblemColor ? "matching" : "original";
  document.querySelector("#saveEmblemStatus").textContent = "";
  saveEmblemDialog.showModal();
};
document.querySelector("#cancelEmblemSave").onclick = () => saveEmblemDialog.close();
saveEmblemDialog.addEventListener("cancel", event => { if (savingEmblem) event.preventDefault(); });
saveEmblemForm.onsubmit = async (event) => {
  event.preventDefault();
  if (savingEmblem) return;
  savingEmblem = true;
  const original = { ...state, text: cleanEditableText(elements.bannerText.innerText) || DEFAULT_TEXT };
  const mode = saveEmblemForm.elements.savedEmblemStyle.value;
  const controls = [...saveEmblemForm.querySelectorAll("button, input")];
  controls.forEach(control => { control.disabled = true; });
  try {
    const name = document.querySelector("#designName").value.trim() || `Choice ${favorites.length + 1}`;
    const additions = [];
    for (const matching of (mode === "both" ? [false, true] : [mode === "matching"])) {
    const snapshot = { ...original, matchEmblemColor: matching };
    state = snapshot; applyState();
    const canvas = await exportBanner({ capture: true });
    if (!canvas) throw new Error("Could not capture the design.");
    const thumbnail = document.createElement("canvas"); thumbnail.width = 480; thumbnail.height = Math.round(480 * canvas.height / canvas.width);
    thumbnail.getContext("2d").drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
    const savedName = mode === "both" ? `${name} (${matching ? "Text-colour emblem" : "Original emblem"})` : name;
    additions.push({ id: crypto.randomUUID(), name: savedName, state: snapshot, layouts: ["classic"], image: thumbnail.toDataURL("image/png") });
    }
    const next = [...favorites, ...additions];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); favorites = next; renderFavorites();
    galleryStatus.textContent = mode === "both" ? `Saved both emblem styles for “${name}”.` : `Saved “${name}”.`;
    document.querySelector("#designName").value = "";
    saveEmblemDialog.close();
  } catch (error) { document.querySelector("#saveEmblemStatus").textContent = `Could not save: ${error.message} Your existing choices are preserved.`; }
  finally { state = original; applyState(); savingEmblem = false; controls.forEach(control => { control.disabled = false; }); }
};
document.querySelector("#downloadWord").onclick = async () => {
  const button = document.querySelector("#downloadWord"); button.disabled = true;
  const original = { ...state, text: cleanEditableText(elements.bannerText.innerText) || DEFAULT_TEXT };
  const layoutOrder = ["arched", "top", "classic", "left"];
  const layouts = [...elements.layoutSelect.options].map(option => ({ value: option.value, name: option.textContent })).sort((a, b) => layoutOrder.indexOf(a.value) - layoutOrder.indexOf(b.value));
  try {
    const images = [];
    const backgroundBrightness = (favorite) => {
      const hex = normalizeHex(favorite.state.backgroundColor) || defaultState.backgroundColor;
      const channels = [1, 3, 5].map(offset => {
        const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const exportChoices = [...favorites].sort((a, b) => backgroundBrightness(a) - backgroundBrightness(b));
    for (const favorite of exportChoices) {
      for (const layout of layouts) {
        galleryStatus.textContent = `Preparing ${images.length + 1} of ${favorites.length * layouts.length} images…`;
        state = { ...defaultState, ...favorite.state, matchEmblemColor: favorite.state.matchEmblemColor === true, layout: "classic" }; applyState({ updateText: true });
        // Match the Word picture's maximum 6.5 × 4.4 inch footprint at 600 DPI.
        // Render text and borders at this resolution rather than enlarging a small PNG.
        const wordScale = Math.max(1, Math.min(6.5 * 600 / getDesignWidth(), 4.4 * 600 / getDesignHeight()));
        const canvas = await exportBanner({ capture: true, captureScale: wordScale });
        if (!canvas) throw new Error("Could not render a saved choice.");
        images.push({ choiceId: favorite.id, choiceName: favorite.name, layout: layout.value, layoutName: layout.name, name: `${favorite.name} — ${layout.name}`, metadata: designMetadata(state), data: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
      }
    }
    downloadDesignsDocx(images);
    galleryStatus.textContent = `Downloaded ${images.length} images in Word.`;
  } catch (error) { galleryStatus.textContent = `Word export failed: ${error.message}`; }
  finally { state = original; applyState({ updateText: true }); button.disabled = favorites.length === 0; }
};
document.querySelector("#backupChoices").onclick = () => {
  const backup = { version: 1, savedAt: new Date().toISOString(), choices: favorites };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "school-banner-choices-backup.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
renderFavorites();
