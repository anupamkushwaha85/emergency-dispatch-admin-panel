import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, OverlayView } from '@react-google-maps/api';
import api from '../services/api';
import WebSocketService, { type LocationUpdate, type DriverStatusUpdate, type EmergencyUpdate } from '../services/websocketService';
import { Sidebar } from '../components/Sidebar';
import { Loader2, AlertTriangle, Ambulance as AmbulanceIcon, Wifi, WifiOff, Clock, Building2 } from 'lucide-react';

const containerStyle = {
    width: '100%',
    height: '100%'
};

const center = {
    lat: 28.6139,
    lng: 77.2090
};

// Custom Map Style for "Electric Blue" theme (Dark/Night modeish map matches well)
const mapStyles = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
    },
    {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
    },
    {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
    },
    {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
    },
    {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
    },
    {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
    },
];

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const LiveMap: React.FC = () => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    });

    const [emergencies, setEmergencies] = useState<any[]>([]);
    const [ambulances, setAmbulances] = useState<any[]>([]);
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [wsConnected, setWsConnected] = useState(false);

    // WebSocket service ref — persists across renders without causing re-renders
    const wsRef = useRef<WebSocketService | null>(null);

    // ── Initial data load (one-time HTTP fetch) ──────────────────────────────
    // Static data (hospitals, emergencies) still comes from REST on mount.
    // Only ambulance positions are then updated in real-time via WebSocket.
    const fetchStaticData = useCallback(async () => {
        try {
            const [emergenciesRes, ambulancesRes, hospitalsRes] = await Promise.all([
                api.get('/admin/active-emergencies'),
                api.get('/ambulances'),
                api.get('/hospitals')
            ]);
            setEmergencies(emergenciesRes.data);
            setAmbulances(ambulancesRes.data);
            setHospitals(hospitalsRes.data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Failed to fetch initial map data", error);
        }
    }, []);

    // ── WebSocket subscription ───────────────────────────────────────────────
    useEffect(() => {
        // Initial data load
        fetchStaticData();

        // Connect WebSocket
        const ws = new WebSocketService(BACKEND_URL);
        wsRef.current = ws;

        ws.connect(
            // onConnected callback
            () => {
                setWsConnected(true);

                // Subscribe to the global live-locations topic
                ws.subscribeToLiveLocations((update: LocationUpdate) => {
                    setLastUpdated(new Date());

                    // Update only the ambulance whose driverId matches —
                    // no need to re-fetch the entire list
                    setAmbulances(prev =>
                        prev.map(amb =>
                            amb.id === update.ambulanceId
                                ? { ...amb, latitude: update.latitude, longitude: update.longitude }
                                : amb
                        )
                    );
                });

                // Subscribe to driver status to catch when they go offline/online etc.
                ws.subscribeToDriverStatus((update: DriverStatusUpdate) => {
                    setLastUpdated(new Date());
                    setAmbulances(prev => {
                        const existing = prev.find((a: any) => a.id === update.ambulanceId);
                        if (existing) {
                            return prev.map((a: any) =>
                                a.id === update.ambulanceId
                                    ? { ...a, status: update.status, latitude: update.latitude, longitude: update.longitude }
                                    : a
                            );
                        }
                        return prev;
                    });
                });

                // Subscribe to emergency events to add/remove emergency markers dynamically
                ws.subscribeToEmergencyUpdates((update: EmergencyUpdate) => {
                    setLastUpdated(new Date());
                    setEmergencies(prev => {
                        if (update.event === 'EMERGENCY_CREATED') {
                            if (prev.find((e: any) => e.id === update.emergencyId)) return prev;
                            return [...prev, {
                                id: update.emergencyId,
                                type: update.emergencyType,
                                severity: 'PENDING',
                                status: update.status,
                                latitude: update.latitude,
                                longitude: update.longitude,
                                createdAt: update.timestamp
                            }];
                        }

                        // Remove if completed or cancelled
                        if (update.status === 'COMPLETED' || update.status === 'CANCELLED') {
                            return prev.filter((e: any) => e.id !== update.emergencyId);
                        }

                        // Update status otherwise
                        return prev.map((e: any) => e.id === update.emergencyId ? { ...e, status: update.status } : e);
                    });
                });
            },
            // onError callback
            () => {
                setWsConnected(false);
                console.warn('[LiveMap] WebSocket unavailable — running without live updates');
            }
        );

        return () => {
            ws.disconnect();
            setWsConnected(false);
        };
    }, [fetchStaticData]);

    const onLoad = React.useCallback(function callback(_map: any) {
        // map reference reserved for future use (e.g. fitBounds)
    }, []);

    const onUnmount = React.useCallback(function callback(_map: any) {
        // cleanup reserved
    }, []);

    if (!isLoaded) return (
        <div className="flex items-center justify-center h-screen bg-slate-900 text-cyan-400">
            <Loader2 className="animate-spin mr-2" /> Loading Maps...
        </div>
    );

    return (
        <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
            <Sidebar />

            <main className="flex-1 relative flex flex-col">
                {/* Overlay Header */}
                <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
                    <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-4 rounded-2xl shadow-xl pointer-events-auto">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                            </span>
                            Live Operations
                        </h1>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                            <div className="flex items-center gap-1">
                                <AlertTriangle size={14} className="text-rose-500" />
                                <span className="text-white font-bold">{emergencies.length}</span> Active
                            </div>
                            <div className="flex items-center gap-1">
                                <AmbulanceIcon size={14} className="text-emerald-500" />
                                <span className="text-white font-bold">{ambulances.filter((a: any) => a.status === 'AVAILABLE').length}</span> Available
                            </div>
                            <div className="flex items-center gap-1">
                                <Building2 size={14} className="text-blue-500" />
                                <span className="text-white font-bold">{hospitals.length}</span> Hospitals
                            </div>
                        </div>
                    </div>

                    {/* Status / Last updated — WebSocket indicator replaces refresh button */}
                    <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-2 rounded-xl shadow-xl pointer-events-auto flex items-center gap-2">
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-400 font-mono">
                            {lastUpdated.toLocaleTimeString()}
                        </span>
                        {/* Live connection indicator */}
                        {wsConnected ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                                <Wifi size={14} className="text-emerald-400" />
                                Live
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
                                <WifiOff size={14} className="text-yellow-400" />
                                Reconnecting...
                            </span>
                        )}
                    </div>
                </div>

                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={center}
                    zoom={12}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                    options={{
                        styles: mapStyles,
                        disableDefaultUI: false,
                        zoomControl: true,
                        mapTypeControl: false,
                        streetViewControl: false
                    }}
                >
                    {/* Emergencies */}
                    {emergencies.map(em => (
                        <Marker
                            key={`em-${em.id}`}
                            position={{ lat: em.latitude, lng: em.longitude }}
                            icon={{
                                url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                            }}
                            onClick={() => setSelectedItem({ type: 'emergency', data: em })}
                        />
                    ))}

                    {/* Ambulances */}
                    {ambulances.map(amb => (
                        <OverlayView
                            key={`amb-${amb.id}`}
                            position={{ lat: amb.latitude, lng: amb.longitude }}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        >
                            <div
                                onClick={() => setSelectedItem({ type: 'ambulance', data: amb })}
                                className="relative flex items-center justify-center cursor-pointer"
                                style={{ transform: 'translate(-50%, -50%)', width: '32px', height: '32px' }}
                            >
                                {/* Blinking ping effect if AVAILABLE */}
                                {amb.status === 'AVAILABLE' && (
                                    <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-75"></span>
                                )}
                                {/* Core marker dot */}
                                <span className={`relative inline-flex rounded-full h-4 w-4 border-2 border-white shadow-md ${amb.status === 'AVAILABLE' ? 'bg-emerald-500' : 'bg-yellow-500'
                                    }`}></span>
                            </div>
                        </OverlayView>
                    ))}

                    {/* Hospitals */}
                    {hospitals.map(hospital => (
                        <Marker
                            key={`hosp-${hospital.id}`}
                            position={{ lat: hospital.latitude, lng: hospital.longitude }}
                            icon={{
                                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                            }}
                            onClick={() => setSelectedItem({ type: 'hospital', data: hospital })}
                        />
                    ))}

                    {selectedItem && (
                        <InfoWindow
                            position={{
                                lat: selectedItem.data.latitude,
                                lng: selectedItem.data.longitude
                            }}
                            onCloseClick={() => setSelectedItem(null)}
                        >
                            <div className="text-slate-900 p-2 min-w-[200px]">
                                {selectedItem.type === 'hospital' ? (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 border-b pb-2 border-slate-200">
                                            <Building2 size={16} className="text-blue-600" />
                                            <h3 className="font-bold text-blue-600 uppercase">Hospital</h3>
                                        </div>
                                        <p className="font-bold text-slate-800">{selectedItem.data.name}</p>
                                        <p className="text-xs text-slate-500 mt-1">{selectedItem.data.address}</p>
                                        <p className="text-xs font-mono text-slate-600 mt-1">{selectedItem.data.phone}</p>
                                    </div>
                                ) : selectedItem.type === 'emergency' ? (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 border-b pb-2 border-slate-200">
                                            <AlertTriangle size={16} className="text-rose-600" />
                                            <h3 className="font-bold text-rose-600 uppercase">Emergency</h3>
                                        </div>
                                        <p className="text-sm"><strong>Type:</strong> {selectedItem.data.type}</p>
                                        <p className="text-sm"><strong>Severity:</strong> {selectedItem.data.severity}</p>
                                        <p className="text-xs text-slate-500 mt-2">{new Date(selectedItem.data.createdAt).toLocaleString()}</p>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 border-b pb-2 border-slate-200">
                                            <AmbulanceIcon size={16} className="text-emerald-600" />
                                            <h3 className="font-bold text-emerald-600 uppercase">Ambulance</h3>
                                        </div>
                                        <p className="text-sm font-mono">{selectedItem.data.licensePlate}</p>
                                        <p className="text-xs uppercase font-bold mt-1 text-slate-500">{selectedItem.data.status}</p>
                                        {selectedItem.data.driver && (
                                            <p className="text-xs text-slate-500 mt-1">Driver: {selectedItem.data.driver}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </InfoWindow>
                    )}
                </GoogleMap>
            </main>
        </div>
    );
};

export default LiveMap;
