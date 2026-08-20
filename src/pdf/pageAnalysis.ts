import type { TextLayerAssessment } from "../models";

export interface TextItemLike {
  str?: string;
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

