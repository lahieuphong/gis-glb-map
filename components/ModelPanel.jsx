'use client';

import { useEffect, useState } from 'react';

export default function ModelPanel({ selectedPlace, isOpen, onClose }) {
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadModelViewer() {
      if (!isOpen || !selectedPlace || viewerReady) return;

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
  }, [isOpen, selectedPlace, viewerReady]);

  const shouldRenderPlace = isOpen && selectedPlace;

  return (
    <aside className={`viewer-panel ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen} aria-live="polite">
      <button
        type="button"
        className="close-button"
        onClick={onClose}
        aria-label="Đóng khung xem 3D"
      >
        ×
      </button>

      {shouldRenderPlace ? (
        <>
          <div className="viewer-header">
            <p className="eyebrow">Mô hình GLB</p>
            <h2>{selectedPlace.name}</h2>
            <p>{selectedPlace.description}</p>
          </div>

          {viewerReady ? (
            <model-viewer
              key={selectedPlace.id}
              className="model-viewer"
              src={selectedPlace.modelUrl}
              alt={`Mô hình 3D của ${selectedPlace.name}`}
              loading="lazy"
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
            <div className="model-viewer model-loading">
              Đang chuẩn bị trình xem 3D...
            </div>
          )}

          <div className="model-meta">
            <span>File model:</span>
            <code>{selectedPlace.modelUrl}</code>
          </div>

          <div className="tips">
            <strong>Cách dùng:</strong> kéo để xoay, cuộn để zoom, bấm “Xem AR” trên thiết bị hỗ trợ AR.
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2>Chưa chọn điểm</h2>
          <p>Bấm một chấm trên bản đồ để mở file GLB.</p>
        </div>
      )}
    </aside>
  );
}
