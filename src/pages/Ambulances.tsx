import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Sidebar } from '../components/Sidebar';
import { Loader2, Ambulance as AmbulanceIcon, Plus, UserPlus, CheckCircle } from 'lucide-react';

interface Ambulance {
    id: number;
    licensePlate: string;
    ambulanceType: string;
    status: string;
    driver: string | null;
    driverPhone: string | null;
    latitude: number;
    longitude: number;
}

interface User {
    id: number;
    name: string;
    phone: string;
}

const Ambulances: React.FC = () => {
    const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<number | null>(null);

    // Data for Modals
    const [newAmbulance, setNewAmbulance] = useState({ licensePlate: '', ambulanceType: 'GOVERNMENT' });
    const [verifiedDrivers, setVerifiedDrivers] = useState<User[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
    const [modalLoading, setModalLoading] = useState(false);

    const fetchAmbulances = async () => {
        try {
            setLoading(true);
            const response = await api.get('/ambulances');
            // API returns Spring Page<T>: { content: [...], totalPages, ... }
            setAmbulances(response.data.content ?? response.data);
        } catch (error) {
            console.error("Failed to fetch ambulances", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchVerifiedDrivers = async () => {
        try {
            const response = await api.get('/admin/verified-drivers');
            setVerifiedDrivers(response.data.content ?? response.data);
        } catch (error) {
            console.error("Failed to fetch drivers", error);
        }
    };

    useEffect(() => {
        fetchAmbulances();
    }, []);

    const handleAddAmbulance = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalLoading(true);
        try {
            await api.post('/ambulances', {
                licensePlate: newAmbulance.licensePlate,
                ambulanceType: newAmbulance.ambulanceType,
                status: 'AVAILABLE'
            });
            setShowAddModal(false);
            setNewAmbulance({ licensePlate: '', ambulanceType: 'GOVERNMENT' });
            fetchAmbulances();
        } catch (error: any) {
            const msg = typeof error.response?.data === 'string'
                ? error.response.data
                : error.response?.data?.message || 'Failed to add ambulance';
            alert(msg);
        } finally {
            setModalLoading(false);
        }
    };

    const openAssignModal = (ambulanceId: number) => {
        setSelectedAmbulanceId(ambulanceId);
        setShowAssignModal(true);
        fetchVerifiedDrivers();
    };

    const handleAssignDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAmbulanceId || !selectedDriverId) return;

        setModalLoading(true);
        try {
            await api.put(`/ambulances/${selectedAmbulanceId}/assign`, {
                driverId: selectedDriverId
            });
            setShowAssignModal(false);
            setSelectedDriverId(null);
            fetchAmbulances();
        } catch (error: any) {
            const msg = typeof error.response?.data === 'string'
                ? error.response.data
                : error.response?.data?.message || 'Failed to assign driver';
            alert(msg);
        } finally {
            setModalLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <Sidebar />

            <main className="flex-1 p-8 overflow-y-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Fleet Management</h1>
                        <p className="text-slate-500">Manage ambulances and driver assignments</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-cyan-500 transition-colors flex items-center gap-2 font-medium"
                    >
                        <Plus size={18} /> Add Ambulance
                    </button>
                </header>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-primary" size={40} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ambulances.map(amb => (
                            <div key={amb.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${amb.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
                                        <AmbulanceIcon size={24} />
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${amb.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {amb.status}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-slate-800">{amb.licensePlate}</h3>
                                <p className="text-sm text-slate-500 mb-4">{amb.ambulanceType}</p>

                                <div className="border-t border-slate-100 pt-4 mt-2">
                                    {amb.driver ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 text-xs font-bold">
                                                {amb.driver[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">{amb.driver}</p>
                                                <p className="text-xs text-slate-500">{amb.driverPhone}</p>
                                            </div>
                                            <button
                                                onClick={() => openAssignModal(amb.id)}
                                                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                title="Change Driver"
                                            >
                                                <UserPlus size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => openAssignModal(amb.id)}
                                            className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                        >
                                            <UserPlus size={16} /> Assign Driver
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add Ambulance Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                            <h2 className="text-xl font-bold text-slate-800 mb-4">Add New Ambulance</h2>
                            <form onSubmit={handleAddAmbulance} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">License Plate</label>
                                    <input
                                        required
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                        placeholder="DL 01 AB 1234"
                                        value={newAmbulance.licensePlate}
                                        onChange={e => setNewAmbulance({ ...newAmbulance, licensePlate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                    <select
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                        value={newAmbulance.ambulanceType}
                                        onChange={e => setNewAmbulance({ ...newAmbulance, ambulanceType: e.target.value })}
                                    >
                                        <option value="GOVERNMENT">Government (Free)</option>
                                        <option value="PRIVATE">Private (Paid)</option>
                                    </select>
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
                                        Add Fleet
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Assign Driver Modal */}
                {showAssignModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                            <h2 className="text-xl font-bold text-slate-800 mb-4">Assign Driver</h2>
                            <p className="text-slate-500 text-sm mb-4">Select a verified driver to operate this ambulance.</p>

                            <form onSubmit={handleAssignDriver} className="space-y-4">
                                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                                    {verifiedDrivers.length === 0 ? (
                                        <div className="p-4 text-center text-slate-400">No verified drivers available.</div>
                                    ) : verifiedDrivers.map(driver => (
                                        <div
                                            key={driver.id}
                                            onClick={() => setSelectedDriverId(driver.id)}
                                            className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedDriverId === driver.id ? 'bg-primary/5' : ''}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedDriverId === driver.id ? 'border-primary bg-primary text-white' : 'border-slate-300'}`}>
                                                {selectedDriverId === driver.id && <CheckCircle size={12} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-800">{driver.name}</p>
                                                <p className="text-xs text-slate-500">{driver.phone}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowAssignModal(false)}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!selectedDriverId || modalLoading}
                                        className="px-6 py-2 bg-primary text-white rounded-lg shadow-lg shadow-primary/20 hover:bg-cyan-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {modalLoading && <Loader2 className="animate-spin" size={16} />}
                                        Assign
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

export default Ambulances;
