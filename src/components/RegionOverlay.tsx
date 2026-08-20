import { useState, type PointerEvent } from "react";
import type { NormalizedRect, PageRotation, ResultBlock } from "../models";
import { inversePageRotation, rotateNormalizedRect } from "../utils/geometry";

interface RegionOverlayProps {
  page: number;
  blocks: ResultBlock[];
  activeBlockId?: string;
  drawing: boolean;
  rotation: PageRotation;
  onCreate: (bounds: NormalizedRect) => void;
}

export function RegionOverlay({
  page,
  blocks,
  activeBlockId,
  drawing,
  rotation,
  onCreate,
}: RegionOverlayProps) {
  const [start, setStart] = useState<{ x: number; y: number }>();
  const [draft, setDraft] = useState<NormalizedRect>();

  function pointFromEvent(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!drawing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setStart(point);
    setDraft({ ...point, width: 0, height: 0 });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drawing || !start) return;
    const point = pointFromEvent(event);
    setDraft({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!drawing || !draft) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (draft.width >= 0.03 && draft.height >= 0.03) {
      onCreate(rotateNormalizedRect(draft, inversePageRotation(rotation)));
    }
    setStart(undefined);
    setDraft(undefined);
  }

  const pageBlocks = blocks.flatMap((block) =>
    (block.boundsByPage[page] ?? []).map((bounds, index) => ({ block, bounds, index })),
  );

  return (
    <div
      className={`region-overlay${drawing ? " is-drawing" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {pageBlocks.map(({ block, bounds, index }) => (
        <div
          className={`result-region classification-${block.classification}${
            block.id === activeBlockId ? " is-active" : ""
          }`}
          key={`${block.id}-${index}`}
          style={rectStyle(rotateNormalizedRect(bounds, rotation))}
        >
          <span>{block.name}</span>
        </div>
      ))}
      {draft ? <div className="result-region is-draft" style={rectStyle(draft)} /> : null}
    </div>
  );
}

function rectStyle(bounds: NormalizedRect) {
  return {
    left: `${bounds.x * 100}%`,
    top: `${bounds.y * 100}%`,
    width: `${bounds.width * 100}%`,
    height: `${bounds.height * 100}%`,
  };
}
