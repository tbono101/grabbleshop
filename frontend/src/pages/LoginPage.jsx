import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import * as authApi from '../services/authApi.js';
import useAuthStore from '../store/authStore.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(form);
      const { user, accessToken, refreshToken } = res.data.data;
      localStorage.setItem('refresh_token', refreshToken);
      setAuth(user, accessToken);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block text-2xl font-black text-white">
            Grabble<span className="text-brand-accent">Shop</span>
          </Link>
          <h1 className="text-xl font-bold text-white mt-4">Welcome back</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to your account</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          No account?{' '}
          <Link to="/register" className="text-brand-accent hover:text-red-400 font-medium">
            Join free
          </Link>
        </p>
      </div>
    </div>
  );
}
