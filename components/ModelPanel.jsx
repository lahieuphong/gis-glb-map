'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const VIEWER_MESSAGE_TYPE = 'gis-model-viewer:set-model';
const VIEWER_READY_MESSAGE_TYPE = 'gis-model-viewer:ready';

export default function ModelPanel({ selectedPlace, isOpen, onClose }) {
  const viewerFrameRef = useRef(null);
  const debounceRef = useRef(null);
  const [iframePlaceId, setIframePlaceId] = useState(null);
  const shouldRenderPlace = isOpen && selectedPlace;

  // Debounce iframe reload: only navigate when user settles on a place for 300 ms.
  // Prevents rapid navigations during spam clicking — each navigation would reload the
  // entire iframe JS context and re-upload model textures to GPU unnecessarily.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (selectedPlace?.id) {
      debounceRef.current = setTimeout(() => setIframePlaceId(selectedPlace.id), 300);
    } else {
      setIframePlaceId(null);
    }
    return () => clearTimeout(debounceRef.current);
  }, [selectedPlace?.id]);

  const modelViewerFrameSrc = iframePlaceId
    ? `${APP_BASE_PATH}/model-viewer?p=${iframePlaceId}`
    : `${APP_BASE_PATH}/model-viewer`;

  const sendSelectedModelToViewer = useCallback(() => {
    if (!shouldRenderPlace || !viewerFrameRef.current?.contentWindow) return;

    viewerFrameRef.current.contentWindow.postMessage(
      {
        type: VIEWER_MESSAGE_TYPE,
        model: {
          src: selectedPlace.modelUrl,
          name: selectedPlace.name
        }
      },
      window.location.origin
    );
  }, [selectedPlace, shouldRenderPlace]);

  useEffect(() => {
    sendSelectedModelToViewer();
  }, [sendSelectedModelToViewer]);

  useEffect(() => {
    function handleViewerMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== VIEWER_READY_MESSAGE_TYPE) return;

      sendSelectedModelToViewer();
    }

    window.addEventListener('message', handleViewerMessage);

    return () => {
      window.removeEventListener('message', handleViewerMessage);
    };
  }, [sendSelectedModelToViewer]);

  return (
    <aside className={`viewer-panel ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen} aria-live="polite">
      <button
        type="button"
        className="close-button"
        onClick={onClose}
        aria-label="Đóng khung xem 3D"
      >
        <img src={`${APP_BASE_PATH}/icons/close.svg`} alt="" aria-hidden="true" />
      </button>

      {shouldRenderPlace ? (
        <>
          <div className="viewer-header">
            <p className="eyebrow">Mô hình GLB</p>
            <h2>{selectedPlace.name}</h2>
            <p>{selectedPlace.description}</p>
          </div>

          {shouldRenderPlace ? (
            <iframe
              ref={viewerFrameRef}
              className="model-viewer-frame"
              src={modelViewerFrameSrc}
              title={`Mô hình 3D của ${selectedPlace.name}`}
              loading="lazy"
              onLoad={sendSelectedModelToViewer}
              sandbox="allow-scripts allow-same-origin allow-popups"
              allow="fullscreen; xr-spatial-tracking"
              allowFullScreen
            />
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
