import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-brand mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <span className="text-xl font-black text-white">
              Grabble<span className="text-brand-accent">Shop</span>
            </span>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              The live sale platform for Disney park personal shoppers.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Explore</h4>
            <ul className="space-y-2">
              <FooterLink to="/events">Live Sales</FooterLink>
              <FooterLink to="/sellers">Sellers</FooterLink>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Account</h4>
            <ul className="space-y-2">
              <FooterLink to="/register">Join free</FooterLink>
              <FooterLink to="/login">Sign in</FooterLink>
              <FooterLink to="/orders">My Orders</FooterLink>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Sell</h4>
            <ul className="space-y-2">
              <FooterLink to="/become-seller">Become a seller</FooterLink>
              <FooterLink to="/dashboard">Dashboard</FooterLink>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} GrabbleShop. Not affiliated with The Walt Disney Company.
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ to, children }) {
  return (
    <li>
      <Link to={to} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        {children}
      </Link>
    </li>
  );
}
