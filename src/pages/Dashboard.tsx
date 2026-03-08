import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { LogOut, Ambulance, Users, Activity, Bell, CircleDot } from 'lucide-react';
import api from '../services/api';
import WebSocketService, { type DriverStatusUpdate, type EmergencyUpdate } from '../services/websocketService';

interface ActivityFeedItem {
    id: string;
    message: string;
    time: Date;
    type: 'driver' | 'emergency';
}

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState({
        activeEmergencies: 0,
        availableAmbulances: 0,
        pendingDrivers: 0
    });
    const [loading, setLoading] = useState(true);
    const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
    const wsRef = useRef<WebSocketService | null>(null);

    useEffect(() => {
        // Initial fetch
        const fetchStats = async () => {
            try {
                const response = await api.get('/admin/dashboard-stats');
                setStats(response.data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();

        // Connect WebSocket for real-time updates (no more polling!)
        const ws = new WebSocketService(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8080');
        wsRef.current = ws;

        ws.connect(() => {
            // Subscribe to driver status
            ws.subscribeToDriverStatus((update: DriverStatusUpdate) => {
                const feedMsg = update.status === 'ONLINE' ? `🟢 Driver ${update.driverName} is now ONLINE (Amb: ${update.licensePlate})` :
                    update.status === 'OFFLINE' ? `⚫ Driver ${update.driverName} went OFFLINE` :
                        `🔵 Driver ${update.driverName} is ON_TRIP`;

                setFeed(prev => [{
                    id: `drv-${Date.now()}`,
                    message: feedMsg,
                    time: new Date(),
                    type: 'driver' as const
                }, ...prev].slice(0, 50));

                // Optimistic stat update
                setStats(prev => {
                    const deltaAmb = update.status === 'ONLINE' ? 1 : update.status === 'OFFLINE' ? -1 : -1 /* ON_TRIP = not available */;
                    return { ...prev, availableAmbulances: Math.max(0, prev.availableAmbulances + deltaAmb) };
                });
            });

            // Subscribe to emergency updates
            ws.subscribeToEmergencyUpdates((update: EmergencyUpdate) => {
                let badge = '🚨';
                if (update.event === 'DISPATCHED') badge = '🚑';
                if (update.event === 'ASSIGNMENT_ACCEPTED' || update.event === 'ACCEPTED') badge = '✅';
                if (update.event === 'ASSIGNMENT_REJECTED' || update.event === 'REJECTED') badge = '❌';
                if (update.event === 'EMERGENCY_AT_PATIENT') badge = '📍';
                if (update.event === 'ASSIGNMENT_COMPLETED' || update.event === 'COMPLETED') badge = '🏁';

                const driverInfo = update.assignedDriverName ? ` (Driver: ${update.assignedDriverName})` : '';
                const feedMsg = `${badge} Emergency #${update.emergencyId} [${update.emergencyType}]: ${update.event}${driverInfo}`;

                setFeed(prev => [{
                    id: `emg-${Date.now()}`,
                    message: feedMsg,
                    time: new Date(),
                    type: 'emergency' as const
                }, ...prev].slice(0, 50));

                // Optimistic stat update
                setStats(prev => {
                    let activeDelta = 0;
                    if (update.event === 'EMERGENCY_CREATED') activeDelta = 1;
                    if (update.event === 'ASSIGNMENT_COMPLETED' || update.status === 'COMPLETED' || update.status === 'CANCELLED') activeDelta = -1;
                    return { ...prev, activeEmergencies: Math.max(0, prev.activeEmergencies + activeDelta) };
                });
            });
        });

        return () => {
            if (wsRef.current) wsRef.current.disconnect();
        };
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <Sidebar />

            <main className="flex-1 p-8 overflow-y-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Overview</h2>
                        <p className="text-slate-500">Welcome back, {user?.name} &bull; Real-time status tracking via WebSockets</p>
                    </div>
                    <button onClick={logout} className="md:hidden p-2 text-slate-600">
                        <LogOut />
                    </button>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatCard
                        title="Active Emergencies"
                        value={loading ? "..." : stats.activeEmergencies}
                        icon={<Activity />}
                        color="text-red-500"
                        bg="bg-red-50"
                    />
                    <StatCard
                        title="Available Ambulances"
                        value={loading ? "..." : stats.availableAmbulances}
                        icon={<Ambulance />}
                        color="text-emerald-500"
                        bg="bg-emerald-50"
                    />
                    <StatCard
                        title="Pending Drivers"
                        value={loading ? "..." : stats.pendingDrivers}
                        icon={<Users />}
                        color="text-amber-500"
                        bg="bg-amber-50"
                    />
                </div>

                {/* Live Activity Feed */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[500px] flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                        <Bell className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-semibold text-slate-800">Live Activity Feed</h3>
                        <div className="ml-auto flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs text-slate-500 font-medium tracking-wide">LIVE VIA STOMP</span>
                        </div>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30">
                        {feed.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <CircleDot className="w-12 h-12 mb-3" />
                                <p>Waiting for live events...</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {feed.map(item => (
                                    <div key={item.id} className="flex gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm animate-in slide-in-from-left-4 fade-in duration-300">
                                        <div className="min-w-0 flex-1 flex justify-between items-start gap-4">
                                            <p className="text-slate-700 font-medium text-sm leading-snug">{item.message}</p>
                                            <time className="text-xs text-slate-400 shrink-0 tabular-nums">
                                                {item.time.toLocaleTimeString()}
                                            </time>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

const StatCard = ({ title, value, icon, color, bg }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className={`p-4 rounded-xl ${bg} ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-slate-500 text-sm font-medium">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800 tabular-nums">{value}</h3>
        </div>
    </div>
);

export default Dashboard;

