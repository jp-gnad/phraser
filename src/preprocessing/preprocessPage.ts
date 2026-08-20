import type { PreprocessingRecipe } from "../models";

type WorkerMessage =
  | { type: "progress"; progress: number }
  | { type: "complete"; pixels: ArrayBuffer };

export async function preprocessPage(
  source: HTMLCanvasElement,
  recipe: PreprocessingRecipe,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  const rotated = rotateCanvas(source, recipe.deskewDegrees ?? 0);
  const context = rotated.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Bildvorverarbeitung wird von diesem Browser nicht unterstützt.");

  const imageData = context.getImageData(0, 0, rotated.width, rotated.height);
  const worker = new Worker(new URL("./preprocessing.worker.ts", import.meta.url), {
    type: "module",
  });

  return await new Promise<HTMLCanvasElement>((resolve, reject) => {
    const handleAbort = () => {
      worker.terminate();
      reject(new DOMException("Bildvorverarbeitung abgebrochen", "AbortError"));
    };
    signal?.addEventListener("abort", handleAbort, { once: true });

    worker.onerror = () => {
      signal?.removeEventListener("abort", handleAbort);
      worker.terminate();
      reject(new Error("Die Bildvorverarbeitung ist fehlgeschlagen."));
    };

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === "progress") {
        onProgress(event.data.progress);
        return;
      }

      const output = document.createElement("canvas");
      output.width = rotated.width;
      output.height = rotated.height;
      const outputContext = output.getContext("2d");
      if (!outputContext) {
        reject(new Error("Das optimierte Bild konnte nicht erzeugt werden."));
        return;
      }
      outputContext.putImageData(
        new ImageData(new Uint8ClampedArray(event.data.pixels), rotated.width, rotated.height),
        0,
        0,
      );
      signal?.removeEventListener("abort", handleAbort);
      worker.terminate();
      onProgress(1);
      resolve(output);
    };

    worker.postMessage(
      {
        pixels: imageData.data.buffer,
        width: rotated.width,
        height: rotated.height,
        recipe,
      },
      [imageData.data.buffer],
    );
  });
}

function rotateCanvas(source: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const context = output.getContext("2d");
  if (!context) return source;

  context.fillStyle = "white";
  context.fillRect(0, 0, output.width, output.height);
  context.translate(output.width / 2, output.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return output;
}

