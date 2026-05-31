'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import ModelPanel from '@/components/ModelPanel';

const INITIAL_CENTER = [106.6953, 10.7769];
const INITIAL_ZOOM = 13;
const TILE_MAX_ZOOM = 18;
const MAP_MAX_ZOOM = 17.25;
const MAP_MAX_PITCH = 45;
const FOCUS_ZOOM = 17;
const FOCUS_PITCH = 45;
const FOCUS_SPEED = 0.8;
const FOCUS_CURVE = 1.2;
const MAX_TILE_CACHE_SIZE = 96;
const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      minzoom: 0,
      maxzoom: TILE_MAX_ZOOM,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm'
    }
  ]
};
const ICON_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const ICONS = {
  search: `${ICON_BASE_PATH}/icons/search.svg`,
  filter: `${ICON_BASE_PATH}/icons/filter.svg`,
  place: `${ICON_BASE_PATH}/icons/place-dot.svg`,
  open: `${ICON_BASE_PATH}/icons/panel-open.svg`,
  collapse: `${ICON_BASE_PATH}/icons/panel-collapse.svg`
};
const CATALOG_DRAG_LIMIT = 260;
const CATALOG_DRAG_RESISTANCE = 0.28;

function getFeatureById(placesGeojson, id) {
  return placesGeojson.features.find((feature) => feature.properties.id === id);
}

function getOptimizedPixelRatio() {
  if (typeof window === 'undefined') return 1;

  return Math.min(window.devicePixelRatio || 1, 1.5);
}

function focusMapOnCoordinates(map, coordinates) {
  map.stop();
  map.flyTo({
    center: coordinates,
    zoom: Math.min(Math.max(map.getZoom(), FOCUS_ZOOM), MAP_MAX_ZOOM),
    pitch: FOCUS_PITCH,
    bearing: 0,
    speed: FOCUS_SPEED,
    curve: FOCUS_CURVE,
    essential: true
  });
}

function isExpectedTileError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();

  return (
    error?.status === 0 ||
    message.includes('abort') ||
    message.includes('cancel') ||
    message.includes('failed to fetch (0)')
  );
}

function isMobileCatalogViewport() {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(max-width: 720px)').matches;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCatalogDragPreviewOffset(deltaY, isCatalogOpen, isCatalogExpanded) {
  const limitedDelta = clamp(deltaY, -CATALOG_DRAG_LIMIT, CATALOG_DRAG_LIMIT);
  const shouldResist = (!isCatalogOpen && limitedDelta > 0) || (isCatalogExpanded && limitedDelta < 0);

  return shouldResist ? limitedDelta * CATALOG_DRAG_RESISTANCE : limitedDelta;
}

export default function GisMap({ placesGeojson }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const catalogDockRef = useRef(null);
  const catalogDragStartRef = useRef(null);
  const catalogDragFrameRef = useRef(null);
  const catalogDragOffsetRef = useRef(0);
  const catalogTouchStartRef = useRef(null);
  const suppressCatalogHandleClickRef = useRef(false);
  const drawStateRef = useRef(null);
  const markersScreenRef = useRef([]);
  const drawMarkersRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mapError, setMapError] = useState('');
  const [isMapReady, setIsMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isCatalogOpen, setIsCatalogOpen] = useState(true);
  const [isCatalogExpanded, setIsCatalogExpanded] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const placeIndexById = useMemo(
    () => new Map(placesGeojson.features.map((feature, index) => [feature.properties.id, index + 1])),
    [placesGeojson]
  );

  const categories = useMemo(
    () => Array.from(new Set(placesGeojson.features.map((feature) => feature.properties.category))),
    [placesGeojson]
  );

  const visibleFeatures = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase('vi-VN');

    return placesGeojson.features.filter((feature) => {
      const { name, category, description } = feature.properties;
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const searchableText = `${name} ${category} ${description}`.toLocaleLowerCase('vi-VN');
      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, deferredSearchQuery, placesGeojson]);

  const visiblePlaceIds = useMemo(
    () => new Set(visibleFeatures.map((feature) => feature.properties.id)),
    [visibleFeatures]
  );

  // Update draw state ref on every render so canvas draw function always reads current values
  drawStateRef.current = { visiblePlaceIds, selectedPlace, placeIndexById };

  useEffect(() => {
    let isMounted = true;
    setIsMapReady(false);

    async function setupMap() {
      try {
        const maplibreModule = await import('maplibre-gl');
        const maplibregl = maplibreModule.default ?? maplibreModule;
        maplibregl.setMaxParallelImageRequests?.(8);

        if (!isMounted || mapRef.current || !mapContainerRef.current) return;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: MAP_STYLE,
          center: INITIAL_CENTER,
          zoom: INITIAL_ZOOM,
          pitch: 0,
          bearing: 0,
          maxZoom: MAP_MAX_ZOOM,
          maxPitch: MAP_MAX_PITCH,
          renderWorldCopies: false,
          refreshExpiredTiles: false,
          fadeDuration: 0,
          maxTileCacheSize: MAX_TILE_CACHE_SIZE,
          maxTileCacheZoomLevels: 2,
          pixelRatio: getOptimizedPixelRatio(),
          cancelPendingTileRequestsWhileZooming: true
        });

        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

        map.on('load', () => {
          if (map.getSource('places')) return;

          map.addSource('places', {
            type: 'geojson',
            data: placesGeojson
          });

          map.addLayer({
            id: 'places-circle',
            type: 'circle',
            source: 'places',
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8,
                6,
                14,
                10,
                18,
                16
              ],
              'circle-color': '#2563eb',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
              'circle-opacity': 0.95
            }
          });

          // Canvas overlay: renders all markers in a single GPU-composited layer.
          // Replaces individual HTML DOM markers — scales to 1000+ places with no layout cost.
          const canvas = overlayCanvasRef.current;
          if (canvas) {
            function resizeCanvas() {
              const dpr = window.devicePixelRatio || 1;
              const container = map.getContainer();
              canvas.width = container.offsetWidth * dpr;
              canvas.height = container.offsetHeight * dpr;
            }
            resizeCanvas();
            const resizeObserver = new ResizeObserver(resizeCanvas);
            resizeObserver.observe(map.getContainer());
            resizeObserverRef.current = resizeObserver;

            function drawMarkers() {
              if (!drawStateRef.current) return;
              const { visiblePlaceIds, selectedPlace, placeIndexById } = drawStateRef.current;
              const ctx = canvas.getContext('2d');
              const dpr = window.devicePixelRatio || 1;
              const cw = canvas.width / dpr;
              const ch = canvas.height / dpr;

              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.save();
              ctx.scale(dpr, dpr);

              const visible = [];
              for (const feature of placesGeojson.features) {
                if (!visiblePlaceIds.has(feature.properties.id)) continue;
                const pt = map.project(feature.geometry.coordinates);
                if (pt.x < -20 || pt.x > cw + 20 || pt.y < -20 || pt.y > ch + 20) continue;
                visible.push({
                  x: pt.x,
                  y: pt.y,
                  index: placeIndexById.get(feature.properties.id),
                  isSelected: selectedPlace?.id === feature.properties.id,
                  coordinates: feature.geometry.coordinates,
                  properties: feature.properties
                });
              }
              markersScreenRef.current = visible;

              const R = 14;

              // Batch fill all normal circles in one path call
              ctx.fillStyle = '#2563eb';
              ctx.beginPath();
              for (const m of visible) {
                if (m.isSelected) continue;
                ctx.moveTo(m.x + R, m.y);
                ctx.arc(m.x, m.y, R, 0, 2 * Math.PI);
              }
              ctx.fill();

              // Batch stroke all normal circles
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              for (const m of visible) {
                if (m.isSelected) continue;
                ctx.moveTo(m.x + R, m.y);
                ctx.arc(m.x, m.y, R, 0, 2 * Math.PI);
              }
              ctx.stroke();

              // Selected marker drawn on top
              const sel = visible.find((m) => m.isSelected);
              if (sel) {
                ctx.fillStyle = '#1d4ed8';
                ctx.beginPath();
                ctx.arc(sel.x, sel.y, R, 0, 2 * Math.PI);
                ctx.fill();
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(sel.x, sel.y, R, 0, 2 * Math.PI);
                ctx.stroke();
              }

              // Labels
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              for (const m of visible) {
                ctx.font = `900 ${m.index > 99 ? 9 : 10}px system-ui, sans-serif`;
                ctx.fillText(String(m.index), m.x, m.y);
              }

              ctx.restore();
            }

            drawMarkersRef.current = drawMarkers;
            map.on('render', drawMarkers);
          }

          // Proximity-based click and cursor using pre-computed canvas marker positions
          map.on('click', (event) => {
            const pt = event.point;
            for (const m of markersScreenRef.current) {
              if (Math.hypot(pt.x - m.x, pt.y - m.y) <= 14) {
                focusMapOnCoordinates(map, m.coordinates);
                setSelectedPlace(m.properties);
                setIsPanelOpen(true);
                return;
              }
            }
          });

          map.on('mousemove', (event) => {
            const pt = event.point;
            const isNear = markersScreenRef.current.some(
              (m) => Math.hypot(pt.x - m.x, pt.y - m.y) <= 14
            );
            map.getCanvas().style.cursor = isNear ? 'pointer' : '';
          });

          setIsMapReady(true);
        });

        map.on('error', (event) => {
          if (isExpectedTileError(event?.error)) return;

          console.error('MapLibre error:', event?.error ?? event);
        });
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setMapError('Không tải được bản đồ. Hãy kiểm tra kết nối mạng hoặc dependency maplibre-gl.');
        }
      }
    }

    setupMap();

    return () => {
      isMounted = false;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [placesGeojson]);

  const focusPlace = useCallback((id) => {
    const feature = getFeatureById(placesGeojson, id);
    if (!feature || !mapRef.current) return;

    focusMapOnCoordinates(mapRef.current, feature.geometry.coordinates);
    setSelectedPlace(feature.properties);
    setIsPanelOpen(true);
  }, [placesGeojson]);

  const openCatalog = useCallback(() => {
    setIsCatalogExpanded(false);
    setIsCatalogOpen(true);
  }, []);

  const openCatalogExpanded = useCallback(() => {
    setIsCatalogOpen(true);
    setIsCatalogExpanded(true);
  }, []);

  const closeCatalog = useCallback(() => {
    setIsCatalogExpanded(false);
    setIsCatalogOpen(false);
  }, []);

  const setCatalogDragOffset = useCallback((offset) => {
    if (typeof window === 'undefined') return;

    const dock = catalogDockRef.current;
    if (!dock) return;

    catalogDragOffsetRef.current = offset;
    dock.classList.add('dragging');

    if (catalogDragFrameRef.current) return;

    catalogDragFrameRef.current = window.requestAnimationFrame(() => {
      catalogDragFrameRef.current = null;
      dock.style.setProperty('--catalog-drag-y', `${catalogDragOffsetRef.current.toFixed(1)}px`);
    });
  }, []);

  const resetCatalogDragOffset = useCallback(() => {
    if (typeof window !== 'undefined' && catalogDragFrameRef.current) {
      window.cancelAnimationFrame(catalogDragFrameRef.current);
      catalogDragFrameRef.current = null;
    }

    catalogDragOffsetRef.current = 0;
    const dock = catalogDockRef.current;
    if (!dock) return;

    dock.classList.remove('dragging');
    dock.style.removeProperty('--catalog-drag-y');
  }, []);

  const handleCatalogDragStart = useCallback((event) => {
    catalogDragStartRef.current = event.clientY;
    setCatalogDragOffset(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [setCatalogDragOffset]);

  const handleCatalogDragMove = useCallback((event) => {
    const startY = catalogDragStartRef.current;
    if (typeof startY !== 'number' || !isMobileCatalogViewport()) return;

    const deltaY = event.clientY - startY;
    setCatalogDragOffset(getCatalogDragPreviewOffset(deltaY, isCatalogOpen, isCatalogExpanded));
  }, [isCatalogExpanded, isCatalogOpen, setCatalogDragOffset]);

  const handleCatalogDragEnd = useCallback((event) => {
    const startY = catalogDragStartRef.current;
    const dragTarget = event.currentTarget;
    catalogDragStartRef.current = null;
    if (dragTarget.hasPointerCapture?.(event.pointerId)) {
      dragTarget.releasePointerCapture(event.pointerId);
    }

    resetCatalogDragOffset();

    if (typeof startY !== 'number' || !isMobileCatalogViewport()) return;

    const deltaY = event.clientY - startY;
    if (typeof startY === 'number' && Math.abs(deltaY) > 36) {
      suppressCatalogHandleClickRef.current = true;
      window.setTimeout(() => {
        suppressCatalogHandleClickRef.current = false;
      }, 180);
    }

    if (typeof startY === 'number' && deltaY < -36) {
      if (isCatalogOpen) {
        openCatalogExpanded();
      } else {
        openCatalog();
      }
    }

    if (typeof startY === 'number' && deltaY > 36) {
      if (isCatalogExpanded) {
        setIsCatalogExpanded(false);
      } else {
        closeCatalog();
      }
    }
  }, [closeCatalog, isCatalogExpanded, isCatalogOpen, openCatalog, openCatalogExpanded, resetCatalogDragOffset]);

  const handleCatalogDragCancel = useCallback((event) => {
    const dragTarget = event.currentTarget;
    catalogDragStartRef.current = null;
    if (dragTarget.hasPointerCapture?.(event.pointerId)) {
      dragTarget.releasePointerCapture(event.pointerId);
    }
    resetCatalogDragOffset();
  }, [resetCatalogDragOffset]);

  const handleCatalogHandleClick = useCallback((event) => {
    if (!isMobileCatalogViewport()) return;

    if (suppressCatalogHandleClickRef.current) {
      event.preventDefault();
      suppressCatalogHandleClickRef.current = false;
      return;
    }

    if (isCatalogExpanded) {
      setIsCatalogExpanded(false);
    } else {
      closeCatalog();
    }
  }, [closeCatalog, isCatalogExpanded]);

  const handleCatalogRailClick = useCallback((event) => {
    if (suppressCatalogHandleClickRef.current) {
      event.preventDefault();
      suppressCatalogHandleClickRef.current = false;
      return;
    }

    openCatalog();
  }, [openCatalog]);

  const handleCatalogWheel = useCallback((event) => {
    if (!isMobileCatalogViewport()) return;

    if (event.deltaY > 18 && !isCatalogExpanded) {
      setIsCatalogExpanded(true);
      return;
    }

    if (event.deltaY < -18 && isCatalogExpanded) {
      const catalogList = event.currentTarget.querySelector('.catalog-list');
      if (!catalogList || catalogList.scrollTop <= 4) {
        setIsCatalogExpanded(false);
      }
    }
  }, [isCatalogExpanded]);

  const handleCatalogTouchStart = useCallback((event) => {
    if (!isMobileCatalogViewport()) return;

    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.catalog-mobile-handle, .catalog-rail, input, textarea, select')) return;

    const catalogList = event.currentTarget.querySelector('.catalog-list');
    catalogTouchStartRef.current = {
      y: event.touches[0]?.clientY ?? 0,
      listScrollTop: catalogList?.scrollTop ?? 0
    };
  }, []);

  const handleCatalogTouchEnd = useCallback((event) => {
    const gesture = catalogTouchStartRef.current;
    catalogTouchStartRef.current = null;
    if (!gesture) return;

    const endY = event.changedTouches[0]?.clientY ?? gesture.y;
    const deltaY = endY - gesture.y;
    resetCatalogDragOffset();

    if (deltaY < -44 && !isCatalogExpanded) {
      suppressCatalogHandleClickRef.current = true;
      window.setTimeout(() => {
        suppressCatalogHandleClickRef.current = false;
      }, 180);
      if (isCatalogOpen) {
        openCatalogExpanded();
      } else {
        openCatalog();
      }
    }

    if (deltaY > 44 && isCatalogExpanded && gesture.listScrollTop <= 8) {
      setIsCatalogExpanded(false);
    }
    // Missing case: drag DOWN from open (non-expanded) → close catalog
    if (deltaY > 44 && !isCatalogExpanded && isCatalogOpen) {
      closeCatalog();
    }
  }, [closeCatalog, isCatalogExpanded, isCatalogOpen, openCatalog, openCatalogExpanded, resetCatalogDragOffset]);

  const handleCatalogTouchMove = useCallback((event) => {
    const gesture = catalogTouchStartRef.current;
    if (!gesture || !isMobileCatalogViewport()) return;

    const currentY = event.touches[0]?.clientY ?? gesture.y;
    const deltaY = currentY - gesture.y;
    const shouldPreviewExpand = deltaY < -8 && !isCatalogExpanded;
    // Smooth preview for: un-expand (expanded→open) OR close (open→collapsed)
    const shouldPreviewCollapse = deltaY > 8 && (
      (isCatalogExpanded && gesture.listScrollTop <= 8) ||
      (!isCatalogExpanded && isCatalogOpen)
    );

    if (shouldPreviewExpand || shouldPreviewCollapse) {
      setCatalogDragOffset(getCatalogDragPreviewOffset(deltaY, isCatalogOpen, isCatalogExpanded));
    }
  }, [isCatalogExpanded, isCatalogOpen, setCatalogDragOffset]);

  useEffect(() => {
    return () => {
      resetCatalogDragOffset();
    };
  }, [resetCatalogDragOffset]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map) return;

    const ids = Array.from(visiblePlaceIds);
    if (map.getLayer('places-circle')) {
      map.setFilter('places-circle', ['in', ['get', 'id'], ['literal', ids]]);
    }

    // Redraw canvas markers when filter/selection changes without map movement
    drawMarkersRef.current?.();
  }, [isMapReady, selectedPlace, visiblePlaceIds]);

  return (
    <main className="app-shell">
      <section
        className={`map-section ${isCatalogOpen ? 'catalog-visible' : 'catalog-hidden'} ${isCatalogExpanded ? 'catalog-expanded' : ''}`}
        aria-label="Bản đồ GIS có các điểm 3D"
      >
        <div ref={mapContainerRef} className="map-container" />
        <canvas ref={overlayCanvasRef} className="marker-overlay-canvas" aria-hidden="true" />

        <div
          ref={catalogDockRef}
          className={`catalog-dock ${isCatalogOpen ? 'open' : 'collapsed'} ${isCatalogExpanded ? 'expanded' : ''}`}
        >
          <div className="catalog-icon-rail" role="toolbar" aria-label="Điều hướng nhanh khi thu gọn">
            <div className="rail-section rail-summary-icons">
              <button
                type="button"
                className="rail-icon"
                onClick={openCatalog}
                aria-label="Mở rộng danh sách"
                title="Mở rộng"
              >
                <img src={ICONS.open} alt="" />
              </button>
            </div>

            <div className="rail-section rail-single-icon">
              <button
                type="button"
                className={`rail-icon ${searchQuery ? 'active' : ''}`}
                onClick={openCatalog}
                aria-label="Mở tìm kiếm"
                title="Tìm kiếm"
              >
                <img src={ICONS.search} alt="" />
              </button>
            </div>

            <div className="rail-section rail-single-icon">
              <button
                type="button"
                className={`rail-icon ${activeCategory !== 'all' ? 'active' : ''}`}
                onClick={openCatalog}
                aria-label="Mở bộ lọc"
                title="Bộ lọc"
              >
                <img src={ICONS.filter} alt="" />
              </button>
            </div>

            <div className="rail-section rail-place-icons">
              {visibleFeatures.map((feature) => {
                const placeIndex = placeIndexById.get(feature.properties.id);
                const isSelected = selectedPlace?.id === feature.properties.id;

                return (
                  <button
                    type="button"
                    key={feature.properties.id}
                    className={`rail-icon rail-place ${isSelected ? 'active' : ''}`}
                    onClick={() => focusPlace(feature.properties.id)}
                    aria-label={feature.properties.name}
                    title={feature.properties.name}
                  >
                    <img src={ICONS.place} alt="" />
                    <span>{placeIndex}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            id="places-catalog"
            className="catalog-panel"
            onWheel={handleCatalogWheel}
            onTouchStart={handleCatalogTouchStart}
            onTouchMove={handleCatalogTouchMove}
            onTouchEnd={handleCatalogTouchEnd}
            onPointerDown={(e) => {
              // Exclude the handle (has its own handlers), the scrollable list, and form fields
              if (e.target?.closest?.('.catalog-mobile-handle, .catalog-list, input, textarea, select')) return;
              handleCatalogDragStart(e);
            }}
            onPointerMove={handleCatalogDragMove}
            onPointerUp={handleCatalogDragEnd}
            onPointerCancel={handleCatalogDragCancel}
            aria-label="Danh sách di tích 3D"
          >
            {isCatalogOpen ? (
              <>
                <button
                  type="button"
                  className="catalog-mobile-handle"
                  onClick={handleCatalogHandleClick}
                  onPointerDown={handleCatalogDragStart}
                  onPointerMove={handleCatalogDragMove}
                  onPointerUp={handleCatalogDragEnd}
                  onPointerCancel={handleCatalogDragCancel}
                  aria-label={`${isCatalogExpanded ? 'Kéo xuống để về nửa màn hình' : 'Kéo lên để mở rộng, kéo xuống hoặc bấm để thu gọn'}. Đang hiển thị ${visibleFeatures.length} trên ${placesGeojson.features.length} điểm`}
                  title={isCatalogExpanded ? 'Về nửa màn hình' : 'Điều chỉnh danh sách'}
                >
                  <span aria-hidden="true" />
                </button>

                <div className="catalog-header">
                  <div>
                    <p className="eyebrow">GIS + GLB</p>
                    <h1>Bản đồ di tích 3D</h1>
                  </div>
                  <button
                    type="button"
                    className="catalog-collapse-button"
                    onClick={closeCatalog}
                    aria-label={`Thu gọn danh sách. Đang hiển thị ${visibleFeatures.length} trên ${placesGeojson.features.length} điểm`}
                    title="Thu gọn"
                  >
                    <img src={ICONS.collapse} alt="" />
                  </button>
                </div>

                <label className="search-field">
                  <span>Tìm kiếm</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Tên di tích, nhóm, mô tả..."
                  />
                </label>

                <div className="category-tabs" aria-label="Lọc theo nhóm">
                  <button
                    type="button"
                    className={activeCategory === 'all' ? 'active' : ''}
                    onClick={() => setActiveCategory('all')}
                  >
                    Tất cả
                  </button>
                  {categories.map((category) => (
                    <button
                      type="button"
                      key={category}
                      className={activeCategory === category ? 'active' : ''}
                      onClick={() => setActiveCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="catalog-list" role="list">
                  {visibleFeatures.length ? (
                    visibleFeatures.map((feature) => {
                      const placeIndex = placeIndexById.get(feature.properties.id);
                      const isSelected = selectedPlace?.id === feature.properties.id;

                      return (
                        <button
                          type="button"
                          key={feature.properties.id}
                          className={`catalog-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => focusPlace(feature.properties.id)}
                          role="listitem"
                        >
                          <span className="catalog-index">{placeIndex}</span>
                          <span className="catalog-copy">
                            <strong>{feature.properties.name}</strong>
                            <small>{feature.properties.category}</small>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="empty-results">Không có kết quả phù hợp.</div>
                  )}
                </div>

                {mapError ? <p className="error-text">{mapError}</p> : null}
              </>
            ) : (
              <button
                type="button"
                className="catalog-rail"
                onClick={handleCatalogRailClick}
                onPointerDown={handleCatalogDragStart}
                onPointerMove={handleCatalogDragMove}
                onPointerUp={handleCatalogDragEnd}
                onPointerCancel={handleCatalogDragCancel}
                aria-label={`Mở danh sách di tích 3D. Có ${placesGeojson.features.length} điểm`}
                title="Mở danh sách"
              >
                <span aria-hidden="true" />
                <strong>Bản đồ di tích 3D</strong>
                <small>{placesGeojson.features.length} điểm</small>
              </button>
            )}
          </div>
        </div>
      </section>

      <ModelPanel
        selectedPlace={selectedPlace}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </main>
  );
}
