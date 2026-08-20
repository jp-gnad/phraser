import type { OCRToken, PageRotation } from "../models";
import { rotateNormalizedRect } from "../utils/geometry";

interface TokenOverlayProps {
  tokens: OCRToken[];
  rotation: PageRotation;
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
        const bounds = rotateNormalizedRect(token.bounds, rotation);
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

export const rotateRect = rotateNormalizedRect;
