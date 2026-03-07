import { useCallback, useEffect, useRef, useState } from 'react';

// Default store location (Santo Domingo, DR)
const DEFAULT_LOCATION = { lat: 18.462673, lng: -69.936051 };

/**
 * StoreLocationMap — Leaflet map showing the store location.
 * In edit mode (admin), clicking the map picks a new location.
 * 
 * @param {object}   props
 * @param {number}   props.lat          - Store latitude
 * @param {number}   props.lng          - Store longitude
 * @param {boolean}  props.editable     - Allow picking location by click
 * @param {function} props.onLocationChange - Called with { lat, lng } when location changes
 * @param {number}   props.height       - Map height in px (default 260)
 */
export default function StoreLocationMap({ lat, lng, editable = false, onLocationChange, height = 260 }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const onLocationChangeRef = useRef(onLocationChange);
  const editableRef = useRef(editable);

  // Keep refs updated
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);
  useEffect(() => {
    editableRef.current = editable;
  }, [editable]);

  // Resolved coordinates (fallback to default) — stored in ref to avoid re-init
  const storeLat = lat || DEFAULT_LOCATION.lat;
  const storeLng = lng || DEFAULT_LOCATION.lng;
  const initialCoordsRef = useRef({ lat: storeLat, lng: storeLng });

  // Update marker position on the map (only moves existing marker or creates it once)
  const updateMarker = useCallback((newLat, newLng) => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;

    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
    } else {
      // Store marker icon
      const storeIcon = L.divIcon({
        html: '<div style="font-size:28px;">📍</div>',
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      });
      markerRef.current = L.marker([newLat, newLng], {
        icon: storeIcon,
        draggable: editableRef.current
      }).addTo(mapInstanceRef.current);

      // Draggable in edit mode
      if (editableRef.current) {
        markerRef.current.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          if (onLocationChangeRef.current) {
            onLocationChangeRef.current({ lat: pos.lat, lng: pos.lng });
          }
        });
      }
    }
  }, []);

  // Load Leaflet from CDN (reuse if already loaded by DeliveryMap)
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    const leafletCss = document.createElement('link');
    leafletCss.rel = 'stylesheet';
    leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(leafletCss);

    const leafletScript = document.createElement('script');
    leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletScript.onload = () => setLeafletLoaded(true);
    document.body.appendChild(leafletScript);
  }, []);

  // Initialize map ONCE when Leaflet loads — never re-inits on prop changes
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    const coords = initialCoordsRef.current;

    const map = L.map(mapRef.current, {
      // Scroll zoom only in edit mode, but always allow pinch zoom on touch
      scrollWheelZoom: editableRef.current
    }).setView([coords.lat, coords.lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    // Place initial marker
    updateMarker(coords.lat, coords.lng);

    // Click to pick location in edit mode
    if (editableRef.current) {
      map.on('click', (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        updateMarker(clickLat, clickLng);
        if (onLocationChangeRef.current) {
          onLocationChangeRef.current({ lat: clickLat, lng: clickLng });
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [leafletLoaded, updateMarker]);

  // Sync marker + view when lat/lng props change externally (e.g. loading saved position)
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([storeLat, storeLng]);
    mapInstanceRef.current.setView([storeLat, storeLng], mapInstanceRef.current.getZoom());
  }, [storeLat, storeLng]);

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: '12px',
        marginTop: '12px',
        zIndex: 0
      }}
    />
  );
}
