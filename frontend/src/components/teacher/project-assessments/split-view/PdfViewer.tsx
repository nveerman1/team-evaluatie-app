'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface PdfViewerProps {
  proxyUrl: string;
}

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_AUTO_MAX = 2;

export function PdfViewer({ proxyUrl }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Holds the loaded PDF document across renders
  const pdfDocRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);

  const renderPage = useCallback(async (doc: import('pdfjs-dist').PDFDocumentProxy, page: number, sc: number) => {
    if (!canvasRef.current) return;
    const pdfPage = await doc.getPage(page);
    const viewport = pdfPage.getViewport({ scale: sc });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    ctx.scale(dpr, dpr);

    await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
  }, []);

  // Load the PDF
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPageNum(1);
      pdfDocRef.current = null;

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const res = await fetch(proxyUrl, { credentials: 'include' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { detail?: string }).detail || `HTTP ${res.status}`);
        }
        if (cancelled) return;

        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);

        // Auto-fit width
        const firstPage = await doc.getPage(1);
        if (cancelled) return;
        const naturalViewport = firstPage.getViewport({ scale: 1 });
        const containerWidth = containerRef.current?.clientWidth ?? naturalViewport.width;
        const autoScale = Math.min(containerWidth / naturalViewport.width, ZOOM_AUTO_MAX);

        setScale(autoScale);
        await renderPage(doc, 1, autoScale);
      } catch (e) {
        if (!cancelled) setError((e as Error).message ?? 'Onbekende fout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [proxyUrl, renderPage]);

  // Re-render when page or scale changes (but only after initial load)
  useEffect(() => {
    if (!pdfDocRef.current || loading) return;
    renderPage(pdfDocRef.current, pageNum, scale);
  }, [pageNum, scale, loading, renderPage]);

  const zoomIn = () => setScale((s) => Math.min(+(s + ZOOM_STEP).toFixed(2), ZOOM_MAX));
  const zoomOut = () => setScale((s) => Math.max(+(s - ZOOM_STEP).toFixed(2), ZOOM_MIN));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-100 bg-slate-50 shrink-0 text-xs">
        {/* Page nav */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1 || loading}
            className="rounded border border-slate-200 bg-white px-2 py-0.5 disabled:opacity-40 hover:bg-slate-100"
          >
            ‹
          </button>
          <span className="text-slate-600">{pageNum} / {numPages || '—'}</span>
          <button
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages || loading}
            className="rounded border border-slate-200 bg-white px-2 py-0.5 disabled:opacity-40 hover:bg-slate-100"
          >
            ›
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={zoomOut}
            disabled={loading}
            className="rounded border border-slate-200 bg-white px-2 py-0.5 disabled:opacity-40 hover:bg-slate-100"
          >
            −
          </button>
          <span className="w-12 text-center text-slate-600">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            disabled={loading}
            className="rounded border border-slate-200 bg-white px-2 py-0.5 disabled:opacity-40 hover:bg-slate-100"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 flex items-start justify-center p-3">
        {loading && (
          <div className="flex items-center justify-center h-full w-full text-slate-500 text-sm">
            <span className="animate-spin mr-2">⏳</span> PDF laden…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full w-full px-6 text-center">
            <div className="space-y-2 max-w-sm">
              <div className="text-2xl">⚠️</div>
              <p className="text-sm font-medium text-slate-700">PDF kon niet worden geladen</p>
              <p className="text-xs text-slate-500">{error}</p>
            </div>
          </div>
        )}
        {!loading && !error && (
          <canvas ref={canvasRef} className="shadow-md rounded" />
        )}
      </div>
    </div>
  );
}
