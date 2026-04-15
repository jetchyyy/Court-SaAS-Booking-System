import { format } from 'date-fns';
import { Activity, Calendar, Clock, DollarSign, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card } from '../../components/ui';
import { getAllBookings } from '../../services/booking';
import { listCourts } from '../../services/courts';

export function AdminDashboard() {
    const [stats, setStats] = useState({
        totalBookings: 0,
        revenue: 0,
        activeCourts: 0,
        todayBookings: 0
    });
    const [recentBookings, setRecentBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch all bookings and courts
            const bookings = await getAllBookings();
            const courts = await listCourts();

            // Calculate stats
            const total = bookings ? bookings.length : 0;
            const revenue = bookings ? bookings.reduce((sum, b) => sum + (b.total_price || 0), 0) : 0;

            // Count today's bookings
            const today = new Date().toISOString().split('T')[0];
            const todayCount = bookings ? bookings.filter(b => b.booking_date === today).length : 0;

            setStats({
                totalBookings: total,
                revenue: revenue,
                activeCourts: courts ? courts.length : 0,
                todayBookings: todayCount
            });

            // Get recent 5 bookings (sorted by booking_date desc)
            const recent = bookings ? bookings.sort((a, b) =>
                new Date(b.booking_date) - new Date(a.booking_date)
            ).slice(0, 5) : [];

            setRecentBookings(recent);
        } catch (err) {
            console.error('Error loading dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ title, value, icon: Icon, colorClass }) => (
        <Card className="p-6 border-none shadow-md">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="text-2xl font-bold mt-1 text-gray-800">{value}</p>
                </div>
                <div className={`p-3 rounded-xl ${colorClass}`}>
                    <Icon size={24} />
                </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-green-600">
                <TrendingUp size={16} className="mr-1" />
                <span className="font-medium">+12%</span>
                <span className="text-gray-400 ml-1">from last month</span>
            </div>
        </Card>
    );

    return (
        <div className="space-y-8 w-full max-w-full overflow-x-hidden">
            <div>
                <h1 className="text-2xl font-bold font-display text-brand-green-dark">Dashboard Overview</h1>
                <p className="text-gray-500">Welcome back, Admin! Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Bookings"
                    value={loading ? '...' : stats.totalBookings}
                    icon={Calendar}
                    colorClass="bg-brand-green-light text-brand-green-dark"
                />
                <StatCard
                    title="Total Revenue"
                    value={loading ? '...' : `₱${stats.revenue.toLocaleString()}`}
                    icon={DollarSign}
                    colorClass="bg-brand-orange-light text-brand-orange"
                />
                <StatCard
                    title="Active Courts"
                    value={loading ? '...' : stats.activeCourts}
                    icon={Users}
                    colorClass="bg-brand-green-light text-brand-green-dark"
                />
                <StatCard
                    title="Bookings Today"
                    value={loading ? '...' : stats.todayBookings}
                    icon={Activity}
                    colorClass="bg-brand-orange-light text-brand-orange"
                />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-800">Recent Bookings</h2>
                        <Link to="/admin/bookings" className="text-sm text-brand-orange hover:underline">View All</Link>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Court</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {recentBookings.map((booking) => (
                                        <tr key={booking.id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-4 font-medium text-gray-900">{booking.customer_name}</td>
                                            <td className="px-6 py-4 text-gray-600">{booking.courts?.name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {booking.booking_date ? format(new Date(booking.booking_date), 'MMM d') : '-'} • {booking.start_time}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant={booking.status === 'Confirmed' ? 'green' : booking.status === 'Cancelled' ? 'red' : 'orange'}>
                                                    {booking.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                    {recentBookings.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                                {loading ? 'Loading bookings...' : 'No bookings yet.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Quick Actions / System Health */}
                <div className="space-y-6">
                    <h2 className="text-lg font-bold text-gray-800">System Status</h2>
                    <Card className="p-6 space-y-4">
                        <div className="flex items-center justify-between p-3 bg-brand-green-light rounded-lg border border-brand-green/20">
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-brand-green"></div>
                                <span className="font-medium text-brand-green-dark">System Online</span>
                            </div>
                            <span className="text-xs text-brand-green">99.9% Uptime</span>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-500">Storage Usage</p>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full w-[24%] bg-brand-green rounded-full"></div>
                            </div>
                            <p className="text-xs text-gray-400 text-right">24% used</p>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-500">Daily API Calls</p>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full w-[65%] bg-brand-orange rounded-full"></div>
                            </div>
                            <p className="text-xs text-gray-400 text-right">1.2k / 2k</p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
