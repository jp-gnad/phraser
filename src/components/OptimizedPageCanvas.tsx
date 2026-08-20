import { useEffect, useRef } from "react";

interface OptimizedPageCanvasProps {
  source: HTMLCanvasElement;
  displayWidth: number;
  displayHeight: number;
}

export function OptimizedPageCanvas({
  source,
  displayWidth,
  displayHeight,
}: OptimizedPageCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;
    canvas.width = source.width;
    canvas.height = source.height;
    context.drawImage(source, 0, 0);
  }, [source]);

  return (
    <canvas
      className="pdf-canvas optimized-canvas"
      ref={ref}
      style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
    />
  );
}

