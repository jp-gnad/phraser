import type { OCRToken, TextLayerAssessment } from "../models";

export interface TextItemLike {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
}

export interface ViewportLike {
  width: number;
  height: number;
  transform: number[];
  scale: number;
}

export function assessTextLayer(items: TextItemLike[]): TextLayerAssessment {
  const strings = items
    .map((item) => item.str ?? "")
    .filter((value) => value.trim().length > 0);
  const text = strings.join(" ");
  const characters = [...text];
  const printableCharacters = characters.filter(
    (character) => !/\p{Cc}|\p{Cs}/u.test(character),
  ).length;
  const printableCharacterRatio = characters.length
    ? printableCharacters / characters.length
    : 0;
  const reasonCodes: string[] = [];

  if (strings.length === 0) reasonCodes.push("no-text-items");
  if (characters.length > 0 && characters.length < 24) reasonCodes.push("too-few-characters");
  if (characters.length > 0 && printableCharacterRatio < 0.85) {
    reasonCodes.push("low-printable-ratio");
  }

  const quality =
    strings.length === 0
      ? "missing"
      : characters.length >= 24 && printableCharacterRatio >= 0.85
        ? "good"
        : "poor";

  return {
    quality,
    tokenCount: strings.length,
    printableCharacterRatio,
    coverageRatio: 0,
    reasonCodes,
  };
}

export function textItemsToTokens(
  items: TextItemLike[],
  viewport: ViewportLike,
  page: number,
): OCRToken[] {
  const tokens: OCRToken[] = [];
  for (const [itemIndex, item] of items.entries()) {
    if (!item.str?.trim() || !item.transform || item.transform.length < 6) continue;

    const transform = multiplyTransforms(viewport.transform, item.transform);
    const height = Math.max(
      Math.hypot(transform[2]!, transform[3]!),
      (item.height ?? 0) * viewport.scale,
      1,
    );
    const width = Math.max((item.width ?? 0) * viewport.scale, 1);
    const parts = [...item.str.matchAll(/\S+/g)];
    const totalCharacters = Math.max(item.str.length, 1);

    for (const [partIndex, match] of parts.entries()) {
      const start = match.index ?? 0;
      const partWidth = width * (match[0].length / totalCharacters);
      tokens.push({
        id: `pdf-${page}-${itemIndex}-${partIndex}`,
        text: match[0],
        confidence: 100,
        confidenceLevel: "safe",
        page,
        bounds: {
          x: clamp01((transform[4]! + width * (start / totalCharacters)) / viewport.width),
          y: clamp01((transform[5]! - height) / viewport.height),
          width: clamp01(partWidth / viewport.width),
          height: clamp01(height / viewport.height),
        },
        source: "pdf-text",
        lineId: `pdf-line-${page}-${Math.round(transform[5]!)}`,
      });
    }
  }
  return tokens;
}

function multiplyTransforms(left: number[], right: number[]): number[] {
  return [
    left[0]! * right[0]! + left[2]! * right[1]!,
    left[1]! * right[0]! + left[3]! * right[1]!,
    left[0]! * right[2]! + left[2]! * right[3]!,
    left[1]! * right[2]! + left[3]! * right[3]!,
    left[0]! * right[4]! + left[2]! * right[5]! + left[4]!,
    left[1]! * right[4]! + left[3]! * right[5]! + left[5]!,
  ];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
