'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { placesGeojson } from '@/data/places';
import ModelPanel from '@/components/ModelPanel';

const INITIAL_CENTER = [106.6953, 10.7769];
const INITIAL_ZOOM = 13;
const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
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
  gis: `${ICON_BASE_PATH}/icons/gis-glb.svg`,
  map: `${ICON_BASE_PATH}/icons/map-3d.svg`,
  search: `${ICON_BASE_PATH}/icons/search.svg`,
  filter: `${ICON_BASE_PATH}/icons/filter.svg`,
  place: `${ICON_BASE_PATH}/icons/place-dot.svg`,
  open: `${ICON_BASE_PATH}/icons/panel-open.svg`,
  collapse: `${ICON_BASE_PATH}/icons/panel-collapse.svg`
};

function getFeatureById(id) {
  return placesGeojson.features.find((feature) => feature.properties.id === id);
}

export default function GisMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mapError, setMapError] = useState('');
  const [isMapReady, setIsMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isCatalogOpen, setIsCatalogOpen] = useState(true);

  const categories = useMemo(
    () => Array.from(new Set(placesGeojson.features.map((feature) => feature.properties.category))),
    []
  );

  const visibleFeatures = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi-VN');

    return placesGeojson.features.filter((feature) => {
      const { name, category, description } = feature.properties;
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const searchableText = `${name} ${category} ${description}`.toLocaleLowerCase('vi-VN');
      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const visiblePlaceIds = useMemo(
    () => new Set(visibleFeatures.map((feature) => feature.properties.id)),
    [visibleFeatures]
  );

  useEffect(() => {
    let isMounted = true;
    setIsMapReady(false);

    async function setupMap() {
      try {
        const maplibreModule = await import('maplibre-gl');
        const maplibregl = maplibreModule.default ?? maplibreModule;

        if (!isMounted || mapRef.current || !mapContainerRef.current) return;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: MAP_STYLE,
          center: INITIAL_CENTER,
          zoom: INITIAL_ZOOM,
          pitch: 0,
          bearing: 0
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

          markerRefs.current = placesGeojson.features.map((feature, index) => {
            const markerElement = document.createElement('button');
            markerElement.type = 'button';
            markerElement.className = 'place-marker-pin';
            markerElement.textContent = String(index + 1);
            markerElement.setAttribute('aria-label', feature.properties.name);
            markerElement.title = feature.properties.name;
            markerElement.addEventListener('click', () => {
              map.flyTo({
                center: feature.geometry.coordinates,
                zoom: Math.max(map.getZoom(), 17),
                pitch: 55,
                bearing: 0,
                speed: 0.8,
                curve: 1.2,
                essential: true
              });

              setSelectedPlace(feature.properties);
              setIsPanelOpen(true);
            });

            const marker = new maplibregl.Marker({
              element: markerElement,
              anchor: 'center'
            })
              .setLngLat(feature.geometry.coordinates)
              .addTo(map);

            return {
              id: feature.properties.id,
              element: markerElement,
              marker
            };
          });

          map.on('mouseenter', 'places-circle', () => {
            map.getCanvas().style.cursor = 'pointer';
          });

          map.on('mouseleave', 'places-circle', () => {
            map.getCanvas().style.cursor = '';
          });

          map.on('click', 'places-circle', (event) => {
            const feature = event.features?.[0];
            if (!feature) return;

            const coordinates = feature.geometry.coordinates.slice();
            const properties = feature.properties;

            map.flyTo({
              center: coordinates,
              zoom: Math.max(map.getZoom(), 17),
              pitch: 55,
              bearing: 0,
              speed: 0.8,
              curve: 1.2,
              essential: true
            });

            setSelectedPlace(properties);
            setIsPanelOpen(true);
          });

          setIsMapReady(true);
        });

        map.on('error', (event) => {
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
      if (mapRef.current) {
        markerRefs.current.forEach(({ marker }) => marker.remove());
        markerRefs.current = [];
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const focusPlace = useCallback((id) => {
    const feature = getFeatureById(id);
    if (!feature || !mapRef.current) return;

    mapRef.current.flyTo({
      center: feature.geometry.coordinates,
      zoom: 17,
      pitch: 55,
      speed: 0.8,
      curve: 1.2,
      essential: true
    });

    setSelectedPlace(feature.properties);
    setIsPanelOpen(true);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map) return;

    const ids = Array.from(visiblePlaceIds);

    if (map.getLayer('places-circle')) {
      map.setFilter('places-circle', ['in', ['get', 'id'], ['literal', ids]]);
    }

    markerRefs.current.forEach(({ id, element }) => {
      const isVisible = visiblePlaceIds.has(id);
      const isSelected = selectedPlace?.id === id;

      element.hidden = !isVisible;
      element.classList.toggle('selected', isSelected);
    });
  }, [isMapReady, selectedPlace, visiblePlaceIds]);

  return (
    <main className="app-shell">
      <section
        className={`map-section ${isCatalogOpen ? 'catalog-visible' : 'catalog-hidden'}`}
        aria-label="Bản đồ GIS có các điểm 3D"
      >
        <div ref={mapContainerRef} className="map-container" />

        <div className={`catalog-dock ${isCatalogOpen ? 'open' : 'collapsed'}`}>
          <div className="catalog-icon-rail" role="toolbar" aria-label="Điều hướng nhanh khi thu gọn">
            <button
              type="button"
              className="rail-icon"
              onClick={() => setIsCatalogOpen(true)}
              aria-label="Mở rộng danh sách"
              title="Mở rộng"
            >
              <img src={ICONS.open} alt="" />
            </button>
            <button
              type="button"
              className="rail-icon"
              onClick={() => setIsCatalogOpen(true)}
              aria-label="Mở phần GIS và GLB"
              title="GIS + GLB"
            >
              <img src={ICONS.gis} alt="" />
            </button>
            <button
              type="button"
              className="rail-icon"
              onClick={() => setIsCatalogOpen(true)}
              aria-label="Mở tiêu đề bản đồ di tích 3D"
              title="Bản đồ di tích 3D"
            >
              <img src={ICONS.map} alt="" />
            </button>
            <button
              type="button"
              className={`rail-icon ${searchQuery ? 'active' : ''}`}
              onClick={() => setIsCatalogOpen(true)}
              aria-label="Mở tìm kiếm"
              title="Tìm kiếm"
            >
              <img src={ICONS.search} alt="" />
            </button>
            <button
              type="button"
              className={`rail-icon ${activeCategory !== 'all' ? 'active' : ''}`}
              onClick={() => setIsCatalogOpen(true)}
              aria-label="Mở bộ lọc"
              title="Bộ lọc"
            >
              <img src={ICONS.filter} alt="" />
            </button>

            <span className="rail-divider" aria-hidden="true" />

            {visibleFeatures.map((feature) => {
              const originalIndex = placesGeojson.features.findIndex(
                (place) => place.properties.id === feature.properties.id
              );
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
                  <span>{originalIndex + 1}</span>
                </button>
              );
            })}
          </div>

          <div id="places-catalog" className="catalog-panel" aria-label="Danh sách di tích 3D">
            {isCatalogOpen ? (
              <>
                <div className="catalog-header">
                  <div>
                    <p className="eyebrow">GIS + GLB</p>
                    <h1>Bản đồ di tích 3D</h1>
                  </div>
                  <button
                    type="button"
                    className="catalog-collapse-button"
                    onClick={() => setIsCatalogOpen(false)}
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
                      const originalIndex = placesGeojson.features.findIndex(
                        (place) => place.properties.id === feature.properties.id
                      );
                      const isSelected = selectedPlace?.id === feature.properties.id;

                      return (
                        <button
                          type="button"
                          key={feature.properties.id}
                          className={`catalog-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => focusPlace(feature.properties.id)}
                          role="listitem"
                        >
                          <span className="catalog-index">{originalIndex + 1}</span>
                          <span className="catalog-copy">
                            <strong>{feature.properties.name}</strong>
                            <small>{feature.properties.category}</small>
                          </span>
                          <span className="catalog-chevron" aria-hidden="true">
                            &gt;
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
              <div className="catalog-rail" aria-hidden="true">
                <span>GIS</span>
                <strong>{placesGeojson.features.length}</strong>
              </div>
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
