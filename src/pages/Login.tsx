import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ShieldCheck, Phone, KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState<'PHONE' | 'OTP' | 'PASSKEY'>('PHONE');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [adminPasskey, setAdminPasskey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // We send 'ADMIN' as role request
            await api.post('/auth/send-otp', { phone, role: 'ADMIN' });
            setStep('OTP');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send OTP. Check connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();

        // If we are at OTP step and user is admin (assumed from sendOtp role), we might need passkey
        // Ideally backend tells us "passkey required", but here we can just ask for it if the backend fails or we just always ask for Admin role logic
        // Current Backend Logic: verify-otp throws "Admin passkey is required" if missing for Admin.

        // Simpler Flow: Verify OTP first? No, the backend does verifyOtp AND check passkey in one go.
        // So we need to ask for Passkey BEFORE calling verify-otp if we know it's an admin flow?
        // OR we try to verify without passkey, catch the specific error "Admin passkey is required", and then show Passkey input?

        // Let's implement the "Catch Error -> Show Passkey" flow for better UX (or just explicit step if we know it's admin)
        // Since the user explicitly sends role='ADMIN' in sendOtp, we know they intend to login as Admin.

        if (step === 'OTP') {
            // For Admin flow, enable Passkey Step immediately locally 
            // (Or we can try to verify and see if it fails, but avoiding 2 requests is better if we know we need it)
            setStep('PASSKEY');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.post('/auth/verify-otp', { phone, otp, adminPasskey });
            const data = response.data;

            const userRole = data.role;
            const token = data.token;

            if (userRole === 'ADMIN') {
                login(token, {
                    id: data.userId,
                    name: data.name,
                    phone: data.phone,
                    role: data.role
                });
                navigate('/');
            } else {
                setError('Access Denied: You are not an Administrator.');
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || '';
            if (msg.includes('Admin passkey is required')) {
                setStep('PASSKEY'); // Fallback if we didn't switch earlier
            } else {
                setError(msg || 'Invalid OTP or Passkey. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-secondary/10 rounded-full blur-3xl opacity-50"></div>
            </div>

            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 z-10 border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Admin Portal</h1>
                    <p className="text-slate-500 text-sm mt-1">Emergency 108 Control Center</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg text-center">
                        {error}
                    </div>
                )}

                {step === 'PHONE' ? (
                    <form onSubmit={handleSendOtp} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <Phone size={18} />
                                </div>
                                <input
                                    type="tel"
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors outline-none text-slate-800 bg-slate-50/50"
                                    placeholder="9876543210"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-secondary to-primary text-white rounded-xl font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                <>
                                    Send OTP <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <div className="text-center mb-4">
                            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                Sent to {phone}
                            </span>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Enter OTP</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <KeyRound size={18} />
                                </div>
                                <input
                                    type="text"
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors outline-none text-slate-800 bg-slate-50/50 tracking-widest text-center font-mono text-lg"
                                    placeholder="123456"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setStep('PHONE')}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-[2] py-3 bg-gradient-to-r from-secondary to-primary text-white rounded-xl font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        Verify & Login
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {step === 'PASSKEY' && (
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <div className="text-center mb-4">
                            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                Verify Admin Access
                            </span>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Admin Passkey</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <KeyRound size={18} />
                                </div>
                                <input
                                    type="password"
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors outline-none text-slate-800 bg-slate-50/50"
                                    placeholder="Enter Passkey"
                                    value={adminPasskey}
                                    onChange={(e) => setAdminPasskey(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setStep('OTP')}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-[2] py-3 bg-gradient-to-r from-secondary to-primary text-white rounded-xl font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        Login
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="absolute bottom-6 text-center text-slate-400 text-xs">
                &copy; 2026 Emergency 108 Support System
            </div>
        </div>
    );
};

export default Login;
