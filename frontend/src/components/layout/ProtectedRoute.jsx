import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';

export function ProtectedRoute({ children }) {
  const { user, token } = useAuthStore();
  const location = useLocation();
  if (!token || !user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export function SellerRoute({ children }) {
  const { user, token } = useAuthStore();
  const location = useLocation();
  if (!token || !user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== 'seller' && user.role !== 'admin') {
    return <Navigate to="/become-seller" replace />;
  }
  return children;
}
