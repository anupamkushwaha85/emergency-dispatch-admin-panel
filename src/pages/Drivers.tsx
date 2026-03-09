import React, { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Sidebar } from '../components/Sidebar';
import { Loader2, CheckCircle, XCircle, FileText, User, Phone, MapPin } from 'lucide-react';
import WebSocketService, { type DriverStatusUpdate } from '../services/websocketService';

interface Driver {
    id: number;
    name: string;
    phone: string;
    documentUrl: string;
    verificationStatus: string;
    createdAt: string;
}

interface OnlineDriver {
    sessionId: number;
    driverId: number;
    ambulanceId: number;
    status: string;
    latitude: number;
    longitude: number;
    sessionStartTime: string;
    driverName?: string;
    driverPhone?: string;
    licensePlate?: string;
}

const Drivers: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'pending' | 'online'>('pending');
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [onlineDrivers, setOnlineDrivers] = useState<OnlineDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ id: number; type: 'verify' | 'reject' } | null>(null);

    const fetchDrivers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/pending-drivers');
            // API returns Spring Page envelope: { content: [...], totalPages, ... }
            setDrivers(response.data.content ?? response.data.drivers ?? []);
        } catch (error) {
            console.error("Failed to fetch drivers", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOnlineDrivers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/online-drivers');
            setOnlineDrivers(response.data || []);
        } catch (error) {
            console.error("Failed to fetch online drivers", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let ws: WebSocketService | null = null;

        if (activeTab === 'pending') {
            fetchDrivers();
        } else {
            fetchOnlineDrivers();

            // Connect WebSocket for real-time driver updates
            ws = new WebSocketService(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8080');
            ws.connect(() => {
                ws?.subscribeToDriverStatus((update: DriverStatusUpdate) => {
                    setOnlineDrivers(prev => {
                        // Remove if OFFLINE
                        if (update.status === 'OFFLINE') {
                            return prev.filter(d => d.driverId !== update.driverId);
                        }

                        // Update or Add
                        const existing = prev.find(d => d.driverId === update.driverId);
                        if (existing) {
                            return prev.map(d => d.driverId === update.driverId ? {
                                ...d,
                                status: update.status,
                                latitude: update.latitude,
                                longitude: update.longitude
                            } : d);
                        } else {
                            // New driver online
                            return [{
                                sessionId: Date.now(), // UI mock for key
                                driverId: update.driverId,
                                ambulanceId: update.ambulanceId,
                                status: update.status,
                                latitude: update.latitude,
                                longitude: update.longitude,
                                sessionStartTime: update.timestamp,
                                driverName: update.driverName,
                                licensePlate: update.licensePlate
                            }, ...prev];
                        }
                    });
                });
            });
        }

        return () => {
            if (ws) ws.disconnect();
        };
    }, [activeTab]);

    const executeConfirmAction = async () => {
        if (!confirmAction) return;
        const { id, type } = confirmAction;

        setActionLoading(id);
        try {
            if (type === 'verify') {
                await api.put(`/admin/verify-driver/${id}`);
                setDrivers(prev => prev.filter(d => d.id !== id));
                toast.success('Driver verified successfully!');
            } else {
                await api.put(`/admin/reject-driver/${id}`);
                setDrivers(prev => prev.filter(d => d.id !== id));
                toast.success('Driver rejected successfully.');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || `${type === 'verify' ? 'Verification' : 'Rejection'} failed`);
        } finally {
            setActionLoading(null);
            setConfirmAction(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <Sidebar />

            <main className="flex-1 p-8 overflow-y-auto">
                <header className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-800">Driver Management</h1>
                    <p className="text-slate-500">Manage validations and monitor active drivers in real-time</p>
                </header>

                {/* Tabs */}
                <div className="flex space-x-4 mb-6 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'pending'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        Pending Validations
                    </button>
                    <button
                        onClick={() => setActiveTab('online')}
                        className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'online'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        Online/Active Drivers
                        {activeTab === 'online' && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-primary" size={40} />
                    </div>
                ) : activeTab === 'pending' ? (
                    drivers.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
                            <h3 className="text-lg font-medium text-slate-900">All Cleared!</h3>
                            <p className="text-slate-500">No pending driver verifications.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            {drivers.map(driver => (
                                <div key={driver.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">

                                    {/* Avatar / Icon */}
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 flex-shrink-0">
                                        <User size={32} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">{driver.name}</h3>
                                            <div className="flex items-center gap-2 text-slate-500 mt-1">
                                                <Phone size={14} />
                                                <span className="text-sm font-mono">{driver.phone}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {driver.documentUrl ? (
                                                <button
                                                    onClick={() => setSelectedDocument(driver.documentUrl)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                                                >
                                                    <FileText size={16} />
                                                    View Document
                                                </button>
                                            ) : (
                                                <span className="text-amber-500 text-sm italic">No Document Uploaded</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                                        <button
                                            onClick={() => setConfirmAction({ id: driver.id, type: 'reject' })}
                                            disabled={actionLoading === driver.id}
                                            className="flex-1 md:flex-none px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={18} />
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => setConfirmAction({ id: driver.id, type: 'verify' })}
                                            disabled={actionLoading === driver.id}
                                            className="flex-1 md:flex-none px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all font-medium flex items-center justify-center gap-2"
                                        >
                                            {actionLoading === driver.id ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    onlineDrivers.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <User className="mx-auto text-slate-300 mb-4" size={48} />
                            <h3 className="text-lg font-medium text-slate-600">No Active Drivers</h3>
                            <p className="text-slate-500">There are currently no drivers online.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {onlineDrivers.map(od => (
                                <div key={od.sessionId} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${od.status === 'ONLINE' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                            <User size={24} />
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${od.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {od.status}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-800">{od.driverName || `Driver #${od.driverId}`}</h3>

                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Phone size={16} />
                                            <p className="text-sm font-mono">{od.driverPhone || 'N/A'}</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <MapPin size={16} />
                                            <p className="text-sm">Assigned: <span className="font-bold text-slate-700">{od.licensePlate || `Amb #${od.ambulanceId}`}</span></p>
                                        </div>
                                        <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                            <span>Session started:</span>
                                            <span>{new Date(od.sessionStartTime).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
                {/* Document Viewer Modal */}
                {selectedDocument && (
                    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedDocument(null)}>
                        <div className="relative max-w-4xl max-h-[90vh] bg-transparent" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setSelectedDocument(null)}
                                className="absolute -top-12 right-0 text-white/80 hover:text-white transition-colors"
                            >
                                <XCircle size={32} />
                            </button>
                            <img
                                src={selectedDocument}
                                alt="Driver Document"
                                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/20"
                            />
                        </div>
                    </div>
                )}

                {/* Confirm Modal */}
                {confirmAction && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200 shadow-2xl">
                            <h2 className="text-xl font-bold text-slate-800 mb-2">Confirm Action</h2>
                            <p className="text-slate-500 mb-6 font-medium">
                                {confirmAction.type === 'verify'
                                    ? 'Are you sure you want to approve this driver?'
                                    : 'Reject this driver verification request?'}
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeConfirmAction}
                                    disabled={actionLoading === confirmAction.id}
                                    className={`px-4 py-2 text-white rounded-lg shadow-lg transition-colors flex items-center gap-2 font-medium ${confirmAction.type === 'verify'
                                            ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                                            : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                        }`}
                                >
                                    {actionLoading === confirmAction.id && <Loader2 className="animate-spin" size={16} />}
                                    {confirmAction.type === 'verify' ? 'Approve' : 'Reject'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Drivers;
