/// <reference lib="webworker" />

import type { PreprocessingRecipe } from "../models";

interface PreprocessRequest {
  pixels: ArrayBuffer;
  width: number;
  height: number;
  recipe: PreprocessingRecipe;
}

interface PreprocessProgress {
  type: "progress";
  progress: number;
}

interface PreprocessComplete {
  type: "complete";
  pixels: ArrayBuffer;
}

type PreprocessResponse = PreprocessProgress | PreprocessComplete;

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<PreprocessRequest>) => {
  const { width, height, recipe } = event.data;
  const pixels = new Uint8ClampedArray(event.data.pixels);
  const gray = new Uint8ClampedArray(width * height);
  const contrast = Math.max(0.5, Math.min(2.5, recipe.contrast));

  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    const value =
      pixels[offset]! * 0.299 + pixels[offset + 1]! * 0.587 + pixels[offset + 2]! * 0.114;
    gray[index] = clamp((value - 128) * contrast + 128);
  }
  post({ type: "progress", progress: 0.28 });

  const filtered = recipe.denoise ? medianDenoise(gray, width, height) : gray;
  post({ type: "progress", progress: 0.48 });

  const processed = recipe.adaptiveThreshold
    ? adaptiveBinarize(filtered, width, height)
    : recipe.threshold !== undefined
      ? globalBinarize(filtered, recipe.threshold)
      : filtered;

  if (recipe.cropDarkBorders) {
    whitenDarkBorders(processed, width, height);
  }
  post({ type: "progress", progress: 0.78 });

  for (let index = 0; index < processed.length; index += 1) {
    const offset = index * 4;
    const value = processed[index]!;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }

  const response: PreprocessComplete = { type: "complete", pixels: pixels.buffer };
  workerScope.postMessage(response satisfies PreprocessResponse, [pixels.buffer]);
};

function post(message: PreprocessResponse) {
  workerScope.postMessage(message);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function globalBinarize(gray: Uint8ClampedArray, threshold: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(gray.length);
  const normalizedThreshold = clamp(threshold);
  for (let index = 0; index < gray.length; index += 1) {
    output[index] = gray[index]! < normalizedThreshold ? 0 : 255;
  }
  return output;
}

function adaptiveBinarize(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= width; x += 1) {
      rowSum += gray[(y - 1) * width + (x - 1)]!;
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x]! + rowSum;
    }
  }

  const output = new Uint8ClampedArray(gray.length);
  const radius = Math.max(8, Math.round(Math.min(width, height) / 55));
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      const area = (right - left + 1) * (bottom - top + 1);
      const sum =
        integral[(bottom + 1) * (width + 1) + right + 1]! -
        integral[top * (width + 1) + right + 1]! -
        integral[(bottom + 1) * (width + 1) + left]! +
        integral[top * (width + 1) + left]!;
      output[y * width + x] = gray[y * width + x]! < sum / area - 11 ? 0 : 255;
    }
  }
  return output;
}

function medianDenoise(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const output = gray.slice();
  const values = new Array<number>(9);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let cursor = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          values[cursor] = gray[(y + offsetY) * width + x + offsetX]!;
          cursor += 1;
        }
      }
      values.sort((left, right) => left - right);
      output[y * width + x] = values[4]!;
    }
  }
  return output;
}

function whitenDarkBorders(data: Uint8ClampedArray, width: number, height: number): void {
  const horizontalLimit = Math.max(2, Math.round(height * 0.08));
  const verticalLimit = Math.max(2, Math.round(width * 0.08));

  for (let y = 0; y < horizontalLimit; y += 1) {
    if (darkRatioInRow(data, width, y) > 0.62) fillRow(data, width, y);
  }
  for (let y = height - horizontalLimit; y < height; y += 1) {
    if (darkRatioInRow(data, width, y) > 0.62) fillRow(data, width, y);
  }
  for (let x = 0; x < verticalLimit; x += 1) {
    if (darkRatioInColumn(data, width, height, x) > 0.62) fillColumn(data, width, height, x);
  }
  for (let x = width - verticalLimit; x < width; x += 1) {
    if (darkRatioInColumn(data, width, height, x) > 0.62) fillColumn(data, width, height, x);
  }
}

function darkRatioInRow(data: Uint8ClampedArray, width: number, y: number): number {
  let dark = 0;
  for (let x = 0; x < width; x += 1) if (data[y * width + x]! < 45) dark += 1;
  return dark / width;
}

function darkRatioInColumn(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
): number {
  let dark = 0;
  for (let y = 0; y < height; y += 1) if (data[y * width + x]! < 45) dark += 1;
  return dark / height;
}

function fillRow(data: Uint8ClampedArray, width: number, y: number): void {
  data.fill(255, y * width, (y + 1) * width);
}

function fillColumn(data: Uint8ClampedArray, width: number, height: number, x: number): void {
  for (let y = 0; y < height; y += 1) data[y * width + x] = 255;
}
