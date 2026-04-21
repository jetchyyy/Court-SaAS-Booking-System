import { Lock, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { signIn, signOut } from '../services/auth';
import { getCurrentTenant, getTenantMembership } from '../services/tenants';

export function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        // Check if already logged in
        const checkAuth = async () => {
            const { data } = await import('../lib/supabaseClient').then(m => m.supabase.auth.getSession());
            if (data?.session) {
                const tenant = await getCurrentTenant();
                const membership = await getTenantMembership(tenant?.id);
                if (membership) {
                    navigate('/admin/dashboard');
                }
            }
        };
        checkAuth();
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signIn(email, password);
            const tenant = await getCurrentTenant();
            const membership = await getTenantMembership(tenant?.id);
            if (!membership) {
                await signOut();
                throw new Error('This account is not allowed to manage this booking site.');
            }
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.message || 'Invalid credentials. Please try again.');
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-user p-4">
            <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md border border-gray-100">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-display font-bold text-brand-green-dark">Admin Login</h1>
                    <p className="text-gray-500 mt-2">Welcome back! Please enter your details.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                                placeholder="Enter your email"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                                placeholder="Enter your password"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full text-white" size="lg" disabled={loading}>
                        {loading ? 'Signing In...' : 'Sign In'}
                    </Button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Use your Supabase admin credentials to log in
                </p>
            </div>
        </div>
    );
}
