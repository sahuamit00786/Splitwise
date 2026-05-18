// /client/src/components/AppLayout.jsx
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

const navItems = [
  { path: '/groups', label: 'Groups', icon: '👥' },
  { path: '/account', label: 'Account', icon: '👤' }
];

export default function AppLayout() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top Bar */}
      <header className="bg-primary text-white px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Splitwise Clone</h1>
          {user && (
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-card-border safe-area-bottom">
        <div className="max-w-lg mx-auto flex">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-1 flex flex-col items-center py-3 px-2 transition-colors ${
                  isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="text-xl mb-1">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
