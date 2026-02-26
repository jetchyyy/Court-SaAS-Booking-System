import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';
import { AdminBookings } from './pages/admin/AdminBookings';
import { AdminCalendar } from './pages/admin/AdminCalendar';
import { AdminCourts } from './pages/admin/AdminCourts';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminLogin } from './pages/AdminLogin';
import { ChangePassword } from './pages/admin/AdminChangepassword';
import { TimeSlotManagement } from './pages/admin/TimeSlotManagement';
import { Home } from './pages/Home';
import { SplashScreen } from './components/SplashScreen';
import { useState } from 'react';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryProvider>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminLogin />} />

          {/* Protected Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="courts" element={<AdminCourts />} />
            <Route path="calendar" element={<AdminCalendar />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="time-slots" element={<TimeSlotManagement />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}

export default App;