import React, { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Sidebar } from '../components/Sidebar';
import { Loader2, Plus, Building2, MapPin, Phone, Map as MapIcon, Search } from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';

type Library = "places" | "drawing" | "geometry" | "visualization";
const libraries: Library[] = ["places"];

const mapContainerStyle = {
    width: '100%',
    height: '220px',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0'
};

const defaultCenter = {
    lat: 28.6139,
    lng: 77.2090
};

interface Hospital {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    address: string;
    phone: string;
    isActive: boolean;
}

const Hospitals: React.FC = () => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        libraries: libraries
    });

    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);

    // Form Data
    const [newHospital, setNewHospital] = useState({
        name: '',
        latitude: '',
        longitude: '',
        address: '',
        phone: ''
    });

    const fetchHospitals = async () => {
        try {
            setLoading(true);
            const response = await api.get('/hospitals');
            // API returns Spring Page<T>: { content: [...], totalPages, ... }
            setHospitals(response.data.content ?? response.data);
        } catch (error) {
            console.error("Failed to fetch hospitals", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHospitals();
    }, []);

    const handleAddHospital = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalLoading(true);
        try {
            await api.post('/hospitals', {
                name: newHospital.name,
                latitude: parseFloat(newHospital.latitude),
                longitude: parseFloat(newHospital.longitude),
                address: newHospital.address,
                phone: newHospital.phone
            });
            setShowAddModal(false);
            setNewHospital({ name: '', latitude: '', longitude: '', address: '', phone: '' });
            fetchHospitals();
        } catch (error: any) {
            const msg = typeof error.response?.data === 'string'
                ? error.response.data
                : error.response?.data?.message || 'Failed to add hospital';
            toast.error(msg);
        } finally {
            setModalLoading(false);
        }
    };

    const handleMapClick = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            setNewHospital({
                ...newHospital,
                latitude: e.latLng.lat().toFixed(6),
                longitude: e.latLng.lng().toFixed(6)
            });
        }
    };

    const onLoadAutocomplete = (autocompleteInstance: google.maps.places.Autocomplete) => {
        setAutocomplete(autocompleteInstance);
    };

    const onPlaceChanged = () => {
        if (autocomplete) {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                setNewHospital(prev => ({
                    ...prev,
                    name: place.name || prev.name,
                    latitude: place.geometry!.location!.lat().toFixed(6),
                    longitude: place.geometry!.location!.lng().toFixed(6),
                    address: place.formatted_address || prev.address,
                    phone: place.formatted_phone_number || prev.phone
                }));
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <Sidebar />

            <main className="flex-1 p-8 overflow-y-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Hospitals Network</h1>
                        <p className="text-slate-500">Manage registered hospitals and medical centers</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-cyan-500 transition-colors flex items-center gap-2 font-medium"
                    >
                        <Plus size={18} /> Add Hospital
                    </button>
                </header>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-primary" size={40} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {hospitals.map(hospital => (
                            <div key={hospital.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 rounded-xl bg-blue-50 text-blue-500">
                                        <Building2 size={24} />
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${hospital.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                        {hospital.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-slate-800">{hospital.name}</h3>

                                <div className="mt-4 space-y-2">
                                    <div className="flex items-start gap-2 text-slate-500">
                                        <MapPin size={16} className="mt-1 shrink-0" />
                                        <p className="text-sm">{hospital.address || <span className="italic">No address provided</span>}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Phone size={16} className="shrink-0" />
                                        <p className="text-sm">{hospital.phone || <span className="italic">No phone provided</span>}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                                        Lat: {hospital.latitude.toFixed(4)}, Lng: {hospital.longitude.toFixed(4)}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {hospitals.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-500">
                                No hospitals registered yet. Click "Add Hospital" to create one.
                            </div>
                        )}
                    </div>
                )}

                {/* Add Hospital Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200 shadow-2xl overflow-y-auto max-h-[90vh]">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Building2 className="text-primary" />
                                Add New Hospital
                            </h2>
                            <form onSubmit={handleAddHospital} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hospital Name</label>
                                    <input
                                        required
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                        placeholder="Enter hospital name"
                                        value={newHospital.name}
                                        onChange={e => setNewHospital({ ...newHospital, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                    <input
                                        required
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                        placeholder="Enter contact number"
                                        value={newHospital.phone}
                                        onChange={e => setNewHospital({ ...newHospital, phone: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                        <MapIcon size={16} className="text-primary" />
                                        Pin Location on Map
                                        <span className="text-xs text-slate-400 font-normal ml-auto">(Search or click map)</span>
                                    </label>
                                    {isLoaded ? (
                                        <div className="space-y-3">
                                            <Autocomplete
                                                onLoad={onLoadAutocomplete}
                                                onPlaceChanged={onPlaceChanged}
                                            >
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <Search size={16} className="text-slate-400" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Search for a hospital or location..."
                                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                                                    />
                                                </div>
                                            </Autocomplete>

                                            <GoogleMap
                                                mapContainerStyle={mapContainerStyle}
                                                center={
                                                    newHospital.latitude && newHospital.longitude
                                                        ? { lat: parseFloat(newHospital.latitude), lng: parseFloat(newHospital.longitude) }
                                                        : defaultCenter
                                                }
                                                zoom={12}
                                                onClick={handleMapClick}
                                                options={{
                                                    disableDefaultUI: true,
                                                    zoomControl: true,
                                                    streetViewControl: false,
                                                    mapTypeControl: false,
                                                    fullscreenControl: false
                                                }}
                                            >
                                                {newHospital.latitude && newHospital.longitude && (
                                                    <Marker
                                                        position={{
                                                            lat: parseFloat(newHospital.latitude),
                                                            lng: parseFloat(newHospital.longitude)
                                                        }}
                                                        animation={google.maps.Animation.DROP}
                                                    />
                                                )}
                                            </GoogleMap>
                                        </div>
                                    ) : (
                                        <div className="h-[220px] bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 border border-slate-200">
                                            <Loader2 className="animate-spin mr-2" /> Loading Map...
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
                                        <input
                                            required
                                            type="number"
                                            step="any"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                            placeholder="e.g., 28.6139"
                                            value={newHospital.latitude}
                                            onChange={e => setNewHospital({ ...newHospital, latitude: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
                                        <input
                                            required
                                            type="number"
                                            step="any"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                            placeholder="e.g., 77.2090"
                                            value={newHospital.longitude}
                                            onChange={e => setNewHospital({ ...newHospital, longitude: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Complete Address</label>
                                    <textarea
                                        required
                                        rows={3}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                                        placeholder="Enter complete hospital address"
                                        value={newHospital.address}
                                        onChange={e => setNewHospital({ ...newHospital, address: e.target.value })}
                                    />
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={modalLoading}
                                        className="px-6 py-2 bg-primary text-white rounded-lg shadow-lg shadow-primary/20 hover:bg-cyan-500 transition-colors flex items-center gap-2"
                                    >
                                        {modalLoading && <Loader2 className="animate-spin" size={16} />}
                                        Save Hospital
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Hospitals;
