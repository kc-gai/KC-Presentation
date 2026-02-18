import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

let initialized = false;

function initWorker() {
  if (initialized) return;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/presentation";
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${basePath}/pdf.worker.min.mjs`;
  initialized = true;
}

export async function loadPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  initWorker();
  const loadingTask = pdfjsLib.getDocument({
    data,
    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/cmaps/",
    cMapPacked: true,
  });
  return await loadingTask.promise;
}
