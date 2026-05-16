import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
    setUserMenuOpen(false);
  }

  const navLink = ({ isActive }) =>
    `text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}`;

  return (
    <header className="sticky top-0 z-40 w-full bg-brand/95 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-black tracking-tight text-white">
            Grabble<span className="text-brand-accent">Shop</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/events" className={navLink}>Events</NavLink>
          <NavLink to="/sellers" className={navLink}>Sellers</NavLink>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 rounded-full bg-gray-800 hover:bg-gray-700 px-3 py-1.5 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-brand-accent flex items-center justify-center text-xs font-bold text-white">
                  {user.first_name?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-sm text-gray-200 hidden sm:block max-w-[120px] truncate">
                  {user.first_name}
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-gray-900 border border-gray-800 shadow-2xl z-40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-800">
                      <p className="text-sm font-medium text-white">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <MenuItem to="/orders" onClick={() => setUserMenuOpen(false)}>My Orders</MenuItem>
                      <MenuItem to="/profile" onClick={() => setUserMenuOpen(false)}>Profile</MenuItem>
                      {user.role === 'seller' || user.role === 'admin' ? (
                        <MenuItem to="/dashboard" onClick={() => setUserMenuOpen(false)}>Seller Dashboard</MenuItem>
                      ) : (
                        <MenuItem to="/become-seller" onClick={() => setUserMenuOpen(false)}>Become a Seller</MenuItem>
                      )}
                    </div>
                    <div className="py-1 border-t border-gray-800">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-sm text-gray-300 hover:text-white transition-colors px-3 py-1.5">
                Sign in
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium bg-brand-accent hover:bg-red-600 text-white px-4 py-1.5 rounded-lg transition-colors"
              >
                Join free
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setMenuOpen(o => !o)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-brand px-4 py-3 flex flex-col gap-2">
          <MobileLink to="/events" onClick={() => setMenuOpen(false)}>Events</MobileLink>
          <MobileLink to="/sellers" onClick={() => setMenuOpen(false)}>Sellers</MobileLink>
          {user && <MobileLink to="/orders" onClick={() => setMenuOpen(false)}>My Orders</MobileLink>}
          {user && <MobileLink to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</MobileLink>}
        </div>
      )}
    </header>
  );
}

function MenuItem({ to, children, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}

function MobileLink({ to, children, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-2 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}
