'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const SET_MODEL_MESSAGE_TYPE = 'gis-model-viewer:set-model';
const READY_MESSAGE_TYPE = 'gis-model-viewer:ready';

function isAllowedModelSource(src) {
  return src.startsWith('/') && src.includes('/models/') && !src.includes('://');
}

function clearResourceTimingBuffer() {
  window.performance?.clearResourceTimings?.();
}

export default function ModelViewerPage() {
  const viewerRef = useRef(null);
  const frameIdRef = useRef(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [model, setModel] = useState(null);
  const [modelResetKey, setModelResetKey] = useState(0);

  useEffect(() => {
    // Prevent BFCache: Chrome freezes the iframe document in memory instead of unloading it,
    // preserving @google/model-viewer's global model cache and WebGL resources across navigations.
    // An unload listener disables BFCache, ensuring the old JS context is truly freed each time
    // the iframe navigates to a different place URL (?p=...).
    function noop() {}
    window.addEventListener('unload', noop);
    return () => window.removeEventListener('unload', noop);
  }, []);

  useEffect(() => {
    function resetModel(nextModel) {
      clearResourceTimingBuffer();

      if (frameIdRef.current) {
        window.cancelAnimationFrame(frameIdRef.current);
      }

      if (viewerRef.current) {
        viewerRef.current.pause?.();
        viewerRef.current.removeAttribute('src');
      }

      setModel(null);
      setModelResetKey((currentKey) => currentKey + 1);

      frameIdRef.current = window.requestAnimationFrame(() => {
        setModel(nextModel);
      });
    }

    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== SET_MODEL_MESSAGE_TYPE) return;

      const src = event.data.model?.src ?? '';
      const name = event.data.model?.name ?? 'Mô hình 3D';

      if (!isAllowedModelSource(src)) {
        resetModel(null);
        return;
      }

      resetModel({ src, name });
    }

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: READY_MESSAGE_TYPE }, window.location.origin);

    return () => {
      window.removeEventListener('message', handleMessage);

      if (frameIdRef.current) {
        window.cancelAnimationFrame(frameIdRef.current);
      }

      if (viewerRef.current) {
        viewerRef.current.pause?.();
        viewerRef.current.removeAttribute('src');
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadModelViewer() {
      try {
        await import('@google/model-viewer/dist/model-viewer.min.js');
        if (isMounted) setViewerReady(true);
      } catch (error) {
        console.error('Không tải được @google/model-viewer:', error);
      }
    }

    loadModelViewer();

    return () => {
      isMounted = false;
    };
  }, []);

  const modelSrc = useMemo(() => {
    if (!model) return '';

    return `${model.src}#viewer-reset-${modelResetKey}`;
  }, [model, modelResetKey]);

  if (!model) {
    return (
      <main className="isolated-model-page">
        <div className="model-loading">Đang chuẩn bị mô hình 3D...</div>
      </main>
    );
  }

  return (
    <main className="isolated-model-page">
      {viewerReady ? (
        <model-viewer
          ref={viewerRef}
          key={`${model.src}-${modelResetKey}`}
          className="isolated-model-viewer"
          src={modelSrc}
          alt={`Mô hình 3D của ${model.name}`}
          loading="eager"
          camera-controls
          touch-action="pan-y"
          auto-rotate
          shadow-intensity="1"
          exposure="0.9"
          ar
          ar-modes="webxr scene-viewer quick-look"
        >
          <div className="model-loading" slot="poster">
            Đang tải mô hình 3D...
          </div>
          <button className="ar-button" slot="ar-button">Xem AR</button>
        </model-viewer>
      ) : (
        <div className="model-loading">Đang chuẩn bị trình xem 3D...</div>
      )}
    </main>
  );
}
