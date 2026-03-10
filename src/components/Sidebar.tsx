import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Ambulance, Users, Activity, Map as MapIcon, Building2, AlertOctagon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const Sidebar: React.FC = () => {
    const { user, logout } = useAuth();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col sticky top-0 h-screen">
            <div className="p-6">
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="text-primary" />
                    Emergency 108
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium cursor-pointer transition-colors ${isActive('/') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <LayoutDashboard size={20} />
                    Dashboard
                </Link>
                <Link to="/drivers" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium cursor-pointer transition-colors ${isActive('/drivers') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Users size={20} />
                    Drivers
                </Link>
                <Link to="/ambulances" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium cursor-pointer transition-colors ${isActive('/ambulances') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Ambulance size={20} />
                    Ambulances
                </Link>
                <Link to="/hospitals" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium cursor-pointer transition-colors ${isActive('/hospitals') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Building2 size={20} />
                    Hospitals
                </Link>
                <Link to="/live-map" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium cursor-pointer transition-colors ${isActive('/live-map') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <MapIcon size={20} />
                    Live Map
                </Link>
                <Link to="/emergencies" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium cursor-pointer transition-colors ${isActive('/emergencies') ? 'bg-red-50 text-red-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <AlertOctagon size={20} />
                    Emergencies
                </Link>
            </nav>

            <div className="p-4 border-t border-slate-200">
                <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                        {user?.name?.[0] || 'A'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{user?.name || 'Admin'}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.phone}</p>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut size={16} />
                    Sign Out
                </button>
                <p className="mt-4 text-center text-xs text-slate-400">
                    © 2026 Emergency 108. All rights reserved.
                </p>
            </div>
        </aside>
    );
};
