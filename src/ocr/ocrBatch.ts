export function normalizeOcrPageSelection(selectedPages: number[], activePages: number[]): number[] {
  const selected = new Set(selectedPages);
  return activePages.filter((page) => selected.has(page));
}

export function combineOcrBatchProgress(
  pageIndex: number,
  pageCount: number,
  currentPageProgress: number,
): number {
  if (pageCount <= 0) return 0;
  const safePageIndex = Math.min(Math.max(pageIndex, 0), pageCount - 1);
  const safePageProgress = Math.min(Math.max(currentPageProgress, 0), 1);
  return (safePageIndex + safePageProgress) / pageCount;
}

export class OcrBatchRunController {
  private activeController?: AbortController;

  start(): AbortController | undefined {
    if (this.activeController) return undefined;
    this.activeController = new AbortController();
    return this.activeController;
  }

  cancel(): boolean {
    const controller = this.activeController;
    if (!controller) return false;
    this.activeController = undefined;
    controller.abort();
    return true;
  }

  isCurrent(controller: AbortController): boolean {
    return this.activeController === controller;
  }

  finish(controller: AbortController): boolean {
    if (!this.isCurrent(controller)) return false;
    this.activeController = undefined;
    return true;
  }
}
