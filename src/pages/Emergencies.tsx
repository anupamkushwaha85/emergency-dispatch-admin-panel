import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from '../components/Sidebar';
import api from '../services/api';
import WebSocketService from '../services/websocketService';
import {
    AlertOctagon,
    RefreshCw,
    XCircle,
    Clock,
    User,
    MapPin,
    ChevronDown,
    ShieldAlert,
} from 'lucide-react';

interface Emergency {
    id: number;
    type: string;
    severity?: string;
    status: string;
    userId: number;
    latitude?: number;
    longitude?: number;
    createdAt?: string;
    confirmationDeadline?: string;
    isSuspectCancellation?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    CREATED: 'bg-blue-100 text-blue-700',
    DISPATCHED: 'bg-yellow-100 text-yellow-700',
    AT_PATIENT: 'bg-orange-100 text-orange-700',
    TO_HOSPITAL: 'bg-purple-100 text-purple-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-slate-100 text-slate-500',
    IN_PROGRESS: 'bg-amber-100 text-amber-700',
    UNASSIGNED: 'bg-red-100 text-red-700',
};

const SEVERITY_COLORS: Record<string, string> = {
    LOW: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-700',
};

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
    const cls = colorMap[value] ?? 'bg-slate-100 text-slate-600';
    return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
            {value}
        </span>
    );
}

function formatDate(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString();
}

interface CancelDialogProps {
    emergency: Emergency;
    onConfirm: (reason: string) => void;
    onClose: () => void;
    loading: boolean;
}

function CancelDialog({ emergency, onConfirm, onClose, loading }: CancelDialogProps) {
    const [reason, setReason] = useState('Fake emergency report');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-full bg-red-50">
                        <ShieldAlert className="text-red-500" size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Cancel Emergency #{emergency.id}</h2>
                        <p className="text-sm text-slate-500">{emergency.type} · {emergency.status}</p>
                    </div>
                </div>

                <p className="text-sm text-slate-600 mb-4">
                    This will force-cancel the emergency and release any assigned driver. The user will
                    <strong> not</strong> be penalised. Provide a reason for audit logs.
                </p>

                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <div className="relative mb-4">
                    <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                    >
                        <option>Fake emergency report</option>
                        <option>Test / accidental trigger</option>
                        <option>Duplicate emergency</option>
                        <option>User requested cancellation</option>
                        <option>Other (see notes)</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Keep Active
                    </button>
                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={loading}
                        className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center gap-2"
                    >
                        {loading && <RefreshCw size={14} className="animate-spin" />}
                        Cancel Emergency
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Emergencies() {
    const [emergencies, setEmergencies] = useState<Emergency[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<Emergency | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [wsConnected, setWsConnected] = useState(false);
    const wsRef = useRef<WebSocketService | null>(null);
    const BACKEND_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace('/api', '') || 'http://localhost:8080';
    const fetchEmergencies = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        setError(null);
        try {
            const res = await api.get('/admin/active-emergencies');
            // API returns Spring Page<T>: { content: [...], ... } — extract the array
            setEmergencies(res.data.content ?? (Array.isArray(res.data) ? res.data : []));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load emergencies';
            setError(msg);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Initial HTTP fetch to populate the list
    useEffect(() => {
        fetchEmergencies();
    }, [fetchEmergencies]);

    // Replace 30-second polling with a persistent STOMP subscription.
    // /topic/emergency-updates fires on every status transition, so the list
    // stays live with zero polling overhead.
    useEffect(() => {
        const ws = new WebSocketService(BACKEND_URL);
        wsRef.current = ws;

        ws.connect(
            () => {
                setWsConnected(true);
                ws.subscribeToEmergencyUpdates((update) => {
                    const terminal = update.status === 'COMPLETED' || update.status === 'CANCELLED';
                    setEmergencies(prev => {
                        if (terminal) {
                            // Remove completed / cancelled emergencies from the live list
                            return prev.filter(e => e.id !== update.emergencyId);
                        }
                        const exists = prev.some(e => e.id === update.emergencyId);
                        if (exists) {
                            // Update status of existing entry
                            return prev.map(e =>
                                e.id === update.emergencyId
                                    ? { ...e, status: update.status }
                                    : e
                            );
                        }
                        // New emergency — append it
                        return [
                            ...prev,
                            {
                                id: update.emergencyId,
                                type: update.emergencyType,
                                status: update.status,
                                userId: update.assignedDriverId ?? 0,
                                latitude: update.latitude,
                                longitude: update.longitude,
                            } satisfies Emergency,
                        ];
                    });
                });
            },
            () => setWsConnected(false),
        );

        return () => {
            ws.disconnect();
            setWsConnected(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleCancelConfirm = async (reason: string) => {
        if (!cancelTarget) return;
        setCancelling(true);
        try {
            await api.post(`/admin/emergencies/${cancelTarget.id}/cancel`, { reason });
            setEmergencies(prev => prev.filter(e => e.id !== cancelTarget.id));
            showToast(`Emergency #${cancelTarget.id} cancelled.`, 'success');
            setCancelTarget(null);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Cancellation failed';
            showToast(msg, 'error');
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar />

            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
                >
                    {toast.msg}
                </div>
            )}

            {/* Cancel dialog */}
            {cancelTarget && (
                <CancelDialog
                    emergency={cancelTarget}
                    onConfirm={handleCancelConfirm}
                    onClose={() => setCancelTarget(null)}
                    loading={cancelling}
                />
            )}

            <main className="flex-1 overflow-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-xl">
                            <AlertOctagon className="text-red-500" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Active Emergencies</h1>
                            <p className="text-sm text-slate-500">Cancel fake or invalid emergency reports</p>
                        </div>
                    </div>
                    <button
                        onClick={() => fetchEmergencies(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-white transition-colors disabled:opacity-60"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Stats pill */}
                <div className="mb-4 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-sm text-slate-600 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                        {emergencies.length} active {emergencies.length === 1 ? 'emergency' : 'emergencies'}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${wsConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                        <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-300'}`} />
                        {wsConnected ? 'Live' : 'Connecting…'}
                    </span>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-slate-400">
                        <RefreshCw className="animate-spin mr-2" size={20} />
                        Loading emergencies…
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600 text-sm">
                        {error}
                    </div>
                ) : emergencies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                        <AlertOctagon size={40} className="text-slate-300" />
                        <p className="text-lg font-medium">No active emergencies</p>
                        <p className="text-sm">All clear — no pending emergencies at the moment.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">ID</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Type</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Severity</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">User</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Location</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Created</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {emergencies.map(em => (
                                    <tr key={em.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-4 font-mono font-bold text-slate-700">
                                            #{em.id}
                                        </td>
                                        <td className="px-5 py-4 text-slate-700 font-medium">{em.type ?? '—'}</td>
                                        <td className="px-5 py-4">
                                            {em.severity
                                                ? <Badge value={em.severity} colorMap={SEVERITY_COLORS} />
                                                : <span className="text-slate-400">—</span>
                                            }
                                        </td>
                                        <td className="px-5 py-4">
                                            <Badge value={em.status} colorMap={STATUS_COLORS} />
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="flex items-center gap-1 text-slate-600">
                                                <User size={13} className="text-slate-400" />
                                                {em.userId}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {em.latitude != null && em.longitude != null ? (
                                                <span className="flex items-center gap-1 text-slate-600">
                                                    <MapPin size={13} className="text-slate-400" />
                                                    {em.latitude.toFixed(4)}, {em.longitude.toFixed(4)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="flex items-center gap-1 text-slate-500">
                                                <Clock size={13} className="text-slate-400" />
                                                {formatDate(em.createdAt)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <button
                                                onClick={() => setCancelTarget(em)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                            >
                                                <XCircle size={13} />
                                                Cancel
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
