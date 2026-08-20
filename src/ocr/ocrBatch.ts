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
