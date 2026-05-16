import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import { ProtectedRoute, SellerRoute } from './components/layout/ProtectedRoute.jsx';
import ToastContainer from './components/ui/Toast.jsx';
import { useToast } from './hooks/useToast.js';
import useAuthStore from './store/authStore.js';

// Pages
import HomePage           from './pages/HomePage.jsx';
import LoginPage          from './pages/LoginPage.jsx';
import RegisterPage       from './pages/RegisterPage.jsx';
import EventListPage      from './pages/EventListPage.jsx';
import EventPage          from './pages/EventPage.jsx';
import SellerListPage     from './pages/SellerListPage.jsx';
import SellerProfilePage  from './pages/SellerProfilePage.jsx';
import OrdersPage         from './pages/OrdersPage.jsx';
import OrderDetailPage    from './pages/OrderDetailPage.jsx';
import ProfilePage        from './pages/ProfilePage.jsx';
import BecomeSeller       from './pages/BecomeSeller.jsx';
import NotFoundPage       from './pages/NotFoundPage.jsx';

// Dashboard
import DashboardPage          from './pages/dashboard/DashboardPage.jsx';
import DashboardEventsPage    from './pages/dashboard/DashboardEventsPage.jsx';
import DashboardEventEditorPage from './pages/dashboard/DashboardEventEditorPage.jsx';
import DashboardOrdersPage    from './pages/dashboard/DashboardOrdersPage.jsx';
import DashboardOnboardingPage from './pages/dashboard/DashboardOnboardingPage.jsx';

// Rehydrate auth on load
import * as authApi from './services/authApi.js';

export default function App() {
  const { token, setAuth, logout } = useAuthStore();
  const { toasts, toast, dismiss } = useToast();

  useEffect(() => {
    if (!token) return;
    authApi.getMe()
      .then(r => setAuth(r.data.data.user, token))
      .catch(() => {
        // Try refresh
        const rt = localStorage.getItem('refresh_token');
        if (!rt) { logout(); return; }
        authApi.refresh(rt)
          .then(r => {
            localStorage.setItem('refresh_token', r.data.data.refreshToken);
            setAuth(null, r.data.data.accessToken);
            return authApi.getMe();
          })
          .then(r => setAuth(r.data.data.user, token))
          .catch(() => logout());
      });
  }, []);

  const noLayoutRoutes = ['/login', '/register'];
  const { pathname } = useLocation();
  const bare = noLayoutRoutes.includes(pathname);

  const content = (
    <Routes>
      <Route path="/"          element={<HomePage />} />
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/register"  element={<RegisterPage />} />
      <Route path="/events"    element={<EventListPage />} />
      <Route path="/events/:id" element={<EventPage />} />
      <Route path="/sellers"   element={<SellerListPage />} />
      <Route path="/sellers/:id" element={<SellerProfilePage />} />

      <Route path="/become-seller" element={<ProtectedRoute><BecomeSeller /></ProtectedRoute>} />

      <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
      <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

      <Route path="/dashboard" element={<SellerRoute><DashboardPage /></SellerRoute>} />
      <Route path="/dashboard/events" element={<SellerRoute><DashboardEventsPage /></SellerRoute>} />
      <Route path="/dashboard/events/new" element={<SellerRoute><DashboardEventEditorPage /></SellerRoute>} />
      <Route path="/dashboard/events/:id" element={<SellerRoute><DashboardEventEditorPage /></SellerRoute>} />
      <Route path="/dashboard/orders" element={<SellerRoute><DashboardOrdersPage /></SellerRoute>} />
      <Route path="/dashboard/onboarding" element={<SellerRoute><DashboardOnboardingPage /></SellerRoute>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );

  return (
    <>
      {bare ? content : <Layout>{content}</Layout>}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </>
  );
}
