import { Lock, Mail, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { signIn, signOut } from '../services/auth';
import { isPlatformAdmin } from '../services/tenants';

export function SuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function checkSession() {
      const { supabase } = await import('../lib/supabaseClient');
      const { data } = await supabase.auth.getSession();
      if (data?.session && await isPlatformAdmin()) {
        navigate('/odc/dashboard');
      }
    }
    void checkSession();
  }, [navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      if (!await isPlatformAdmin()) {
        await signOut();
        throw new Error('This account is not a platform superadmin.');
      }
      navigate('/odc/dashboard');
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-bg-light p-4">
      <div className="w-full max-w-md bg-white border border-gray-100 shadow-xl rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-green-light grid place-items-center text-brand-green-dark">
            <Shield size={24} />
          </div>
          <h1 className="mt-4 text-3xl font-display font-bold text-brand-green-dark">ODC Superadmin</h1>
          <p className="mt-2 text-sm text-gray-500">Manage tenants, billing, and platform access.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none"
                required
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full text-white" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
