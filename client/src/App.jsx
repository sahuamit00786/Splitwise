// /client/src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/useAuthStore';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Main app layout and pages
import AppLayout from './components/AppLayout';
import GroupsPage from './pages/groups/GroupsPage';
import GroupDetailPage from './pages/groups/GroupDetailPage';
import AccountPage from './pages/account/AccountPage';

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

// Public route wrapper (redirect if authenticated)
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Navigate to="/groups" replace />;
  }
  
  return children;
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected routes with app layout */}
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/groups" replace />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="groups/:id" element={<GroupDetailPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/groups" replace />} />
    </Routes>
  );
}

export default App;
