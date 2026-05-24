'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { placesGeojson } from '@/data/places';
import ModelPanel from '@/components/ModelPanel';

const INITIAL_CENTER = [106.6953, 10.7769];
const INITIAL_ZOOM = 13;
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';

function getFeatureById(id) {
  return placesGeojson.features.find((feature) => feature.properties.id === id);
}

export default function GisMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    let isMounted = true;

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

          map.addLayer({
            id: 'places-label',
            type: 'symbol',
            source: 'places',
            minzoom: 14,
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 13,
              'text-offset': [0, 1.5],
              'text-anchor': 'top'
            },
            paint: {
              'text-color': '#111827',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5
            }
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

  return (
    <main className="app-shell">
      <section className="map-section" aria-label="Bản đồ GIS có các điểm 3D">
        <div ref={mapContainerRef} className="map-container" />

        <div className="map-overlay">
          <p className="eyebrow">Next.js + GIS + GLB</p>
          <h1>Bản đồ điểm 3D</h1>
          <p>Zoom vào bản đồ, bấm vào chấm xanh để mở mô hình GLB của địa điểm đó.</p>
          {mapError ? <p className="error-text">{mapError}</p> : null}
        </div>

        <div className="place-list" aria-label="Danh sách điểm mẫu">
          {placesGeojson.features.map((feature) => (
            <button
              type="button"
              key={feature.properties.id}
              onClick={() => focusPlace(feature.properties.id)}
            >
              <span>{feature.properties.name}</span>
              <small>{feature.properties.category}</small>
            </button>
          ))}
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
