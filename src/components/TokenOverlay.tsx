import type { NormalizedRect, OCRToken } from "../models";

interface TokenOverlayProps {
  tokens: OCRToken[];
  rotation: number;
  selectedTokenIds: string[];
  onTokenToggle?: (tokenId: string) => void;
  interactive?: boolean;
}

export function TokenOverlay({
  tokens,
  rotation,
  selectedTokenIds,
  onTokenToggle,
  interactive = false,
}: TokenOverlayProps) {
  return (
    <div className={`token-overlay${interactive ? " is-interactive" : ""}`} aria-label="Erkannte Textelemente">
      {tokens.map((token) => {
        const bounds = rotateRect(token.bounds, rotation);
        return (
          <button
            aria-label={`${token.text}, Confidence ${Math.round(token.confidence)} Prozent`}
            aria-pressed={selectedTokenIds.includes(token.id)}
            className={`token-box confidence-${token.confidenceLevel}${
              selectedTokenIds.includes(token.id) ? " is-selected" : ""
            }`}
            key={token.id}
            onClick={() => onTokenToggle?.(token.id)}
            style={{
              left: `${bounds.x * 100}%`,
              top: `${bounds.y * 100}%`,
              width: `${bounds.width * 100}%`,
              height: `${bounds.height * 100}%`,
            }}
            tabIndex={interactive ? 0 : -1}
            title={`${token.text} · ${Math.round(token.confidence)} %`}
            type="button"
          />
        );
      })}
    </div>
  );
}

export function rotateRect(rect: NormalizedRect, rotation: number): NormalizedRect {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: 1 - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width };
    case 180:
      return {
        x: 1 - rect.x - rect.width,
        y: 1 - rect.y - rect.height,
        width: rect.width,
        height: rect.height,
      };
    case 270:
      return { x: rect.y, y: 1 - rect.x - rect.width, width: rect.height, height: rect.width };
    default:
      return rect;
  }
}

