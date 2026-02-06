import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';

// Shipping rates by distance (in km)
const PRICE_RANGES = [
    { maxDistance: 5, price: 100, label: 'Zona 1 (0-5km)' },
    { maxDistance: 10, price: 150, label: 'Zona 2 (5-10km)' },
    { maxDistance: 20, price: 200, label: 'Zona 3 (10-20km)' },
    { maxDistance: 50, price: 350, label: 'Zona 4 (20-50km)' },
    { maxDistance: Infinity, price: 600, label: 'Zona 5 (>50km)' }
];

// Distribution center location (Santo Domingo, Dominican Republic)
const WAREHOUSE_LOCATION = {
    lat: 18.462673,
    lng: -69.936051,
    address: 'Centro de Distribución - Santo Domingo'
};

function DeliveryMap({ mapData, setMapData, onAddressSelect, onError, currencyCode, addressFields }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const warehouseMarkerRef = useRef(null);
    const deliveryMarkerRef = useRef(null);
    const routeLineRef = useRef(null);
    const geocoderRef = useRef(null);
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [ratesExpanded, setRatesExpanded] = useState(false);
    const geocodeTimeoutRef = useRef(null);
    const lastGeocodedRef = useRef(''); // Para evitar búsquedas repetidas
    const initialGeocodeAttemptedRef = useRef(false); // Para geocodificar al entrar al paso 2
    
    // Refs para callbacks estables
    const setMapDataRef = useRef(setMapData);
    const onErrorRef = useRef(onError);
    
    // Mantener refs actualizados
    useEffect(() => {
        setMapDataRef.current = setMapData;
        onErrorRef.current = onError;
    }, [setMapData, onError]);

    // Calculate distance using Haversine formula
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Calculate shipping cost based on distance
    const calculateShippingCost = (distance) => {
        const range = PRICE_RANGES.find(r => distance <= r.maxDistance);
        return range ? range.price : PRICE_RANGES[PRICE_RANGES.length - 1].price;
    };

    // Update delivery location on map - usando refs para evitar recreación
    const updateDeliveryLocation = useCallback((lat, lng) => {
        const distance = calculateDistance(
            WAREHOUSE_LOCATION.lat,
            WAREHOUSE_LOCATION.lng,
            lat,
            lng
        );
        const cost = calculateShippingCost(distance);

        setMapDataRef.current(prev => ({
            ...prev,
            selectedLocation: { lat, lng },
            distance,
            shippingCost: cost
        }));

        if (onErrorRef.current) {
            onErrorRef.current('');
        }

        // Update delivery marker
        if (mapInstanceRef.current && window.L) {
            const L = window.L;
            if (deliveryMarkerRef.current) {
                deliveryMarkerRef.current.setLatLng([lat, lng]);
            } else {
                const deliveryIcon = L.divIcon({
                    html: '<div style="background-color: #ef4444; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
                    className: '',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                });

                deliveryMarkerRef.current = L.marker([lat, lng], {
                    icon: deliveryIcon,
                    draggable: true
                }).addTo(mapInstanceRef.current);

                deliveryMarkerRef.current.on('dragend', (e) => {
                    const { lat: newLat, lng: newLng } = e.target.getLatLng();
                    updateDeliveryLocation(newLat, newLng);
                });
            }

            // Draw route line
            if (routeLineRef.current) {
                mapInstanceRef.current.removeLayer(routeLineRef.current);
            }

            routeLineRef.current = L.polyline([
                [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
                [lat, lng]
            ], {
                color: '#3b82f6',
                weight: 4,
                opacity: 0.7,
                dashArray: '10, 10'
            }).addTo(mapInstanceRef.current);
        }
    }, []); // Sin dependencias - usa refs

    // Geocode address with fallback strategy - usando fetch directo para mejor compatibilidad móvil
    const geocodeAddress = useCallback((searchQueries) => {
        if (searchQueries.length === 0) {
            setIsGeocoding(false);
            return;
        }
        
        let isCompleted = false;
        
        // Timeout de seguridad - cancelar después de 20 segundos (más tiempo para móviles)
        const safetyTimeout = setTimeout(() => {
            if (!isCompleted) {
                isCompleted = true;
                setIsGeocoding(false);
                console.warn('Geocoding timeout - búsqueda cancelada');
            }
        }, 20000);
        
        const tryGeocode = async (index) => {
            if (isCompleted) return;
            
            if (index >= searchQueries.length) {
                isCompleted = true;
                clearTimeout(safetyTimeout);
                setIsGeocoding(false);
                return;
            }
            
            const query = searchQueries[index];
            if (!query || query.trim().length < 3) {
                tryGeocode(index + 1);
                return;
            }
            
            try {
                // Usar fetch directo a Nominatim con timeout más largo para móviles
                const controller = new AbortController();
                const fetchTimeout = setTimeout(() => controller.abort(), 15000); // 15 segundos por query
                
                const encodedQuery = encodeURIComponent(query);
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=1`,
                    {
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json'
                        }
                    }
                );
                
                clearTimeout(fetchTimeout);
                
                if (isCompleted) return;
                
                const results = await response.json();
                
                if (results && results.length > 0) {
                    isCompleted = true;
                    clearTimeout(safetyTimeout);
                    const lat = parseFloat(results[0].lat);
                    const lng = parseFloat(results[0].lon);
                    updateDeliveryLocation(lat, lng);
                    if (mapInstanceRef.current) {
                        mapInstanceRef.current.setView([lat, lng], 15);
                    }
                    setIsGeocoding(false);
                } else {
                    // Intentar con la siguiente query
                    tryGeocode(index + 1);
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.warn('Query timeout, trying next:', query);
                } else {
                    console.error('Geocoding error:', error);
                }
                // Intentar con la siguiente query
                if (!isCompleted) {
                    tryGeocode(index + 1);
                }
            }
        };
        
        setIsGeocoding(true);
        tryGeocode(0);
    }, [updateDeliveryLocation]);

    // Auto-geocode when address fields change
    useEffect(() => {
        if (!leafletLoaded || !geocoderRef.current) return;
        
        // Extraer valores de addressFields de forma segura
        const address = addressFields?.address || '';
        const sector = addressFields?.sector || '';
        const city = addressFields?.city || '';
        
        // Solo intentar si hay al menos ciudad con más de 2 caracteres
        if (!city || city.trim().length < 2) return;
        
        // Crear una clave única para esta combinación de dirección
        const addressKey = `${address}|${sector}|${city}`;
        
        // Si ya geocodificamos esta dirección, no repetir
        if (lastGeocodedRef.current === addressKey) return;
        
        // Limpiar timeout anterior
        if (geocodeTimeoutRef.current) {
            clearTimeout(geocodeTimeoutRef.current);
        }
        
        // Debounce de 1200ms para evitar muchas llamadas
        geocodeTimeoutRef.current = setTimeout(() => {
            // Verificar de nuevo después del timeout
            if (lastGeocodedRef.current === addressKey) return;
            
            // Construir queries con estrategia de fallback
            const searchQueries = [];
            
            // 1. Dirección completa
            if (address && sector && city) {
                searchQueries.push(`${address}, ${sector}, ${city}, República Dominicana`);
            }
            
            // 2. Sector + Ciudad
            if (sector && city) {
                searchQueries.push(`${sector}, ${city}, República Dominicana`);
            }
            
            // 3. Solo Ciudad
            if (city) {
                searchQueries.push(`${city}, República Dominicana`);
            }
            
            if (searchQueries.length > 0) {
                lastGeocodedRef.current = addressKey;
                geocodeAddress(searchQueries);
            }
        }, 1200);
        
        return () => {
            if (geocodeTimeoutRef.current) {
                clearTimeout(geocodeTimeoutRef.current);
            }
        };
    }, [addressFields?.address, addressFields?.sector, addressFields?.city, leafletLoaded, geocodeAddress]);

    // Get current location from browser
    const getCurrentLocation = useCallback(() => {
        if (!navigator.geolocation) {
            if (onErrorRef.current) {
                onErrorRef.current('Tu navegador no soporta geolocalización');
            }
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                updateDeliveryLocation(latitude, longitude);

                if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([latitude, longitude], 15);
                }
                setIsLocating(false);
            },
            (error) => {
                console.error('Error getting location:', error);
                if (onErrorRef.current) {
                    onErrorRef.current('No se pudo obtener tu ubicación. Verifica los permisos del navegador.');
                }
                setIsLocating(false);
            },
            { enableHighAccuracy: true }
        );
    }, [updateDeliveryLocation]);

    // Load Leaflet scripts dynamically
    useEffect(() => {
        if (window.L) {
            setLeafletLoaded(true);
            return;
        }

        const leafletCss = document.createElement('link');
        leafletCss.rel = 'stylesheet';
        leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCss);

        const geocoderCss = document.createElement('link');
        geocoderCss.rel = 'stylesheet';
        geocoderCss.href = 'https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.css';
        document.head.appendChild(geocoderCss);

        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletScript.onload = () => {
            const geocoderScript = document.createElement('script');
            geocoderScript.src = 'https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.js';
            geocoderScript.onload = () => setLeafletLoaded(true);
            document.body.appendChild(geocoderScript);
        };
        document.body.appendChild(leafletScript);
    }, []);

    // Ref para onAddressSelect
    const onAddressSelectRef = useRef(onAddressSelect);
    useEffect(() => {
        onAddressSelectRef.current = onAddressSelect;
    }, [onAddressSelect]);

    // Initialize map when Leaflet is loaded
    useEffect(() => {
        if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;

        const L = window.L;

        const map = L.map(mapRef.current).setView(
            [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
            12
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        const warehouseIcon = L.divIcon({
            html: '<div style="font-size: 26px;">📍</div>',
            className: '',
            iconSize: [26, 26],
            iconAnchor: [13, 26]
        });

        warehouseMarkerRef.current = L.marker(
            [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
            { icon: warehouseIcon }
        ).addTo(map);

        warehouseMarkerRef.current.bindPopup(
            `<strong>${WAREHOUSE_LOCATION.address}</strong>`
        );

        map.on('click', (e) => {
            updateDeliveryLocation(e.latlng.lat, e.latlng.lng);
        });

        // Guardar referencia al geocoder para uso externo
        geocoderRef.current = L.Control.Geocoder.nominatim();
        
        L.Control.geocoder({
            geocoder: geocoderRef.current,
            defaultMarkGeocode: false,
            placeholder: 'Buscar dirección...',
            errorMessage: 'No se encontró la dirección'
        }).on('markgeocode', (e) => {
            const { center, name } = e.geocode;
            updateDeliveryLocation(center.lat, center.lng);
            if (onAddressSelectRef.current) {
                onAddressSelectRef.current(name);
            }
            map.setView(center, 15);
        }).addTo(map);

        mapInstanceRef.current = map;

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                deliveryMarkerRef.current = null;
                routeLineRef.current = null;
                geocoderRef.current = null;
            }
        };
    }, [leafletLoaded, updateDeliveryLocation]);

    // Geocodificar una vez al entrar al paso 2 si hay datos de dirección
    useEffect(() => {
        // Solo ejecutar una vez cuando el mapa y geocoder estén listos
        if (!leafletLoaded || !geocoderRef.current || initialGeocodeAttemptedRef.current) return;
        
        const address = addressFields?.address || '';
        const sector = addressFields?.sector || '';
        const city = addressFields?.city || '';
        
        // Si hay al menos ciudad, intentar geocodificar
        if (city && city.trim().length >= 2) {
            initialGeocodeAttemptedRef.current = true;
            
            const searchQueries = [];
            
            if (address && sector && city) {
                searchQueries.push(`${address}, ${sector}, ${city}, República Dominicana`);
            }
            if (sector && city) {
                searchQueries.push(`${sector}, ${city}, República Dominicana`);
            }
            if (city) {
                searchQueries.push(`${city}, República Dominicana`);
            }
            
            if (searchQueries.length > 0) {
                const addressKey = `${address}|${sector}|${city}`;
                lastGeocodedRef.current = addressKey;
                // Pequeño delay para asegurar que el mapa esté completamente listo
                setTimeout(() => {
                    geocodeAddress(searchQueries);
                }, 500);
            }
        }
    }, [leafletLoaded, addressFields?.address, addressFields?.sector, addressFields?.city, geocodeAddress]);

    return (
        <div className="shipping-map-section">
            <div className="map-header">
                <h4>📍 Ubicación de Entrega (Opcional)</h4>
                <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="btn-location"
                    disabled={isLocating || isGeocoding}
                >
                    {isLocating ? ' Buscando / cargando...' : isGeocoding ? '🔍 Ubicando dirección...' : '📌 Mi Ubicación'}
                </button>
            </div>

            <div 
                ref={mapRef}
                className="shipping-map-container"
            />

            {/* <div className="map-instructions">
                <p>✅ El mapa se actualiza automáticamente al escribir la dirección</p>
                <p>🔍 Usa el buscador en el mapa para encontrar direcciones</p>
                <p>👆 Haz clic en cualquier punto del mapa para seleccionar</p>
                <p>📍 Arrastra el marcador rojo para ajustar la posición</p>
            </div> */}

            {mapData.distance && (
                <div className="shipping-cost-card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '8px',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <span style={{ fontWeight: 600, color: '#166534' }}>
                        💵 Costo de Envío: <span className="shipping-price">{formatCurrency(mapData.shippingCost, currencyCode)}</span>
                    </span>
                    <span style={{ color: '#475569', fontSize: '0.9rem' }}>
                        Distancia: <span className="shipping-distance" style={{ fontWeight: 500 }}>{mapData.distance.toFixed(2)} km</span>
                    </span>
                </div>
            )}

            <div className="shipping-rates-table">
                <div 
                    className="rates-header-toggle"
                    onClick={() => setRatesExpanded(!ratesExpanded)}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: ratesExpanded ? '8px 8px 0 0' : '8px',
                        border: '1px solid #e2e8f0',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <h5 style={{ margin: 0, fontSize: '0.95rem', color: '#374151' }}>📋 Tarifas de Envío</h5>
                    <span style={{ 
                        transform: ratesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        fontSize: '0.9rem'
                    }}>
                        ▼
                    </span>
                </div>
                {ratesExpanded && (
                    <div className="rates-list" style={{
                        borderRadius: '0 0 8px 8px',
                        border: '1px solid #e2e8f0',
                        borderTop: 'none'
                    }}>
                        {PRICE_RANGES.map((range, index) => {
                            const isActive = mapData.distance && 
                                mapData.distance <= range.maxDistance && 
                                (index === 0 || mapData.distance > PRICE_RANGES[index - 1].maxDistance);

                            return (
                                <div 
                                    key={index}
                                    className={`rate-item ${isActive ? 'active' : ''}`}
                                >
                                    <span className="rate-label">{range.label}</span>
                                    <span className="rate-price">{formatCurrency(range.price, currencyCode)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default DeliveryMap;
