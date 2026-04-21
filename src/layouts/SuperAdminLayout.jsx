import { Building2, LogOut, Receipt, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { getCurrentUser, signOut } from '../services/auth';
import { isPlatformAdmin } from '../services/tenants';

export function SuperAdminLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser || !await isPlatformAdmin()) {
          navigate('/odc');
          return;
        }
        setUser(currentUser);
      } finally {
        setLoading(false);
      }
    }
    void checkAccess();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/odc');
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-bg-light text-gray-500">
        Loading ODC...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg-light text-gray-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-gray-200 bg-white md:flex md:flex-col">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-gray-100">
          <div className="h-9 w-9 rounded-xl bg-brand-green-light grid place-items-center text-brand-green-dark">
            <Shield size={19} />
          </div>
          <span className="font-display font-bold text-lg text-brand-green-dark">ODC</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink
            to="/odc/dashboard"
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-brand-green-light text-brand-green-dark' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Building2 size={18} /> Clients
          </NavLink>
          <NavLink
            to="/odc/billing"
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-brand-green-light text-brand-green-dark' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Receipt size={18} /> Billing
          </NavLink>
        </nav>
        <div className="p-4 border-t border-gray-100">
          <p className="mb-3 truncate rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">{user.email}</p>
          <Button variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50" onClick={handleLogout}>
            <LogOut size={18} /> Logout
          </Button>
        </div>
      </aside>
      <main className="md:ml-64 p-4 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}
