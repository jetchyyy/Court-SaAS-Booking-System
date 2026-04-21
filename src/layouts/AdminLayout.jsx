import { BarChart3, Calendar, LayoutDashboard, LogOut, Settings, KeyRound, Menu, QrCode, X, Lock, MonitorCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui';
import { getCurrentUser, signOut } from '../services/auth';
import { AdminActionModal } from '../components/admin/AdminActionModal';
import { DeveloperAuditPanel } from '../components/admin/DeveloperAuditPanel';
import { appendAuditLog } from '../services/auditLogs';
import { getCurrentTenant, getTenantMembership } from '../services/tenants';

export function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [tenant, setTenant] = useState(null);

    const [actionModal, setActionModal] = useState({
        isOpen: false,
        title: '',
        description: '',
        action: null,
        variant: 'primary',
        confirmLabel: 'Confirm',
        successTitle: 'Success!',
        successDescription: 'Action completed successfully.',
        onSuccess: null
    });

    useEffect(() => {
        // Scroll to top on route change
        window.scrollTo(0, 0);
    }, [location.pathname]);

    useEffect(() => {
        // Check if user is authenticated
        const checkAuth = async () => {
            try {
                const currentUser = await getCurrentUser();
                if (!currentUser) {
                    navigate('/admin');
                } else {
                    const resolvedTenant = await getCurrentTenant();
                    const membership = await getTenantMembership(resolvedTenant?.id);
                    if (!resolvedTenant?.id || !membership) {
                        await signOut();
                        navigate('/admin');
                        return;
                    }
                    setTenant(resolvedTenant);
                    setUser(currentUser);
                }
            } catch (err) {
                console.error('Auth check error:', err);
                navigate('/admin');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [navigate]);

    const handleLogout = () => {
        setActionModal({
            isOpen: true,
            title: 'Confirm Logout',
            description: 'Are you sure you want to sign out?',
            variant: 'danger',
            confirmLabel: 'Logout',
            successTitle: 'Signed Out',
            successDescription: 'You have been successfully logged out.',
            action: async () => {
                appendAuditLog({
                    action: 'admin.auth.logout',
                    description: 'Admin logged out from admin panel',
                    userId: user?.id || null,
                    userEmail: user?.email || null
                });
                await signOut();
            },
            onSuccess: () => navigate('/admin')
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-light">
                <div className="text-center">
                    <div className="inline-block animate-spin">
                        <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full"></div>
                    </div>
                    <p className="mt-4 text-gray-600">Loading admin panel...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect in useEffect
    }

    const navItems = [
        { path: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
        { path: '/admin/site', label: 'Website Editor', icon: MonitorCog },
        { path: '/admin/bookings', label: 'Bookings', icon: Calendar },
        { path: '/admin/courts', label: 'Court Management', icon: Settings },
        { path: '/admin/time-slots', label: 'Time Slot Control', icon: Lock }, // **NEW**
        { path: '/admin/calendar', label: 'Calendar View', icon: Calendar },
        { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/admin/qr-codes', label: 'QR Codes', icon: QrCode },
        { path: '/admin/change-password', label: 'Change Password', icon: KeyRound },
    ];

    return (
        <div className="min-h-screen bg-bg-light font-sans flex text-gray-900">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed top-0 bottom-0 left-0 z-50 hidden md:flex flex-col">
                <div className="h-16 flex items-center gap-2 px-6 border-b border-gray-100">
                    <div className="bg-brand-orange p-1.5 rounded-lg">
                        <span className="text-white font-bold text-sm">PP</span>
                    </div>
                    <span className="font-display font-bold text-lg text-brand-green-dark">{tenant?.name || 'Admin Panel'}</span>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                                ${isActive
                                    ? 'bg-brand-green-light text-brand-green-dark'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                            `}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Signed in as</p>
                        <p className="text-sm font-medium text-gray-700 truncate">{user.email}</p>
                    </div>
                    <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleLogout}>
                        <LogOut size={18} className="mr-2" /> Logout
                    </Button>
                </div>
            </aside>

            {/* Mobile Header (visible on small screens) */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-brand-orange p-1.5 rounded-lg">
                        <span className="text-white font-bold text-sm">PP</span>
                    </div>
                    <span className="font-display font-bold text-lg text-brand-green-dark">{tenant?.name || 'Admin Panel'}</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
                    <div
                        className="absolute top-16 left-0 right-0 bg-white border-b border-gray-200 p-4 shadow-lg animate-in slide-in-from-top-5 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <nav className="space-y-1 mb-4">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={({ isActive }) => `
                                        flex items-center gap-3 px-3 py-3 rounded-xl text-base font-medium transition-colors
                                        ${isActive
                                            ? 'bg-brand-green-light text-brand-green-dark'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                    `}
                                >
                                    <item.icon size={20} />
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>

                        <div className="pt-4 border-t border-gray-100">
                            <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-500">Signed in as</p>
                                <p className="text-sm font-medium text-gray-700 truncate">{user.email}</p>
                            </div>
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    handleLogout();
                                }}
                            >
                                <LogOut size={20} className="mr-2" /> Logout
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-4 sm:p-8 pt-20 md:pt-8 min-w-0 overflow-x-hidden">
                <Outlet />
            </main>

            <AdminActionModal
                isOpen={actionModal.isOpen}
                onClose={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                title={actionModal.title}
                description={actionModal.description}
                action={actionModal.action}
                variant={actionModal.variant}
                confirmLabel={actionModal.confirmLabel}
                successTitle={actionModal.successTitle}
                successDescription={actionModal.successDescription}
                onSuccess={actionModal.onSuccess}
            />

            <DeveloperAuditPanel />
        </div>
    );
}
