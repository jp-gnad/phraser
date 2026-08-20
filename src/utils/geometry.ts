import type { NormalizedRect, PageRotation } from "../models";

export function rotateNormalizedRect(
  rect: NormalizedRect,
  rotation: PageRotation,
): NormalizedRect {
  switch (rotation) {
    case 90:
      return {
        x: 1 - rect.y - rect.height,
        y: rect.x,
        width: rect.height,
        height: rect.width,
      };
    case 180:
      return {
        x: 1 - rect.x - rect.width,
        y: 1 - rect.y - rect.height,
        width: rect.width,
        height: rect.height,
      };
    case 270:
      return {
        x: rect.y,
        y: 1 - rect.x - rect.width,
        width: rect.height,
        height: rect.width,
      };
    default:
      return rect;
  }
}

export function inversePageRotation(rotation: PageRotation): PageRotation {
  return rotation === 90 ? 270 : rotation === 270 ? 90 : rotation;
}
