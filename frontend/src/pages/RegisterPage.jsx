import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import * as authApi from '../services/authApi.js';
import useAuthStore from '../store/authStore.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    setError('');
    setLoading(true);
    try {
      const res = await authApi.register(form);
      const { user, accessToken, refreshToken } = res.data.data;
      localStorage.setItem('refresh_token', refreshToken);
      setAuth(user, accessToken);
      navigate('/');
    } catch (err) {
      const msgs = err.response?.data?.errors;
      setError(msgs ? msgs.map(e => e.msg).join(', ') : err.response?.data?.error || 'Registration failed.');
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
          <h1 className="text-xl font-bold text-white mt-4">Create your account</h1>
          <p className="text-sm text-gray-400 mt-1">Free to join. Start grabbing today.</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" placeholder="Jane" value={form.firstName} onChange={set('firstName')} required />
              <Input label="Last name" placeholder="Doe" value={form.lastName} onChange={set('lastName')} required />
            </div>
            <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
            <Input label="Password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} required />
            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>
            )}
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Create account
            </Button>
            <p className="text-xs text-gray-600 text-center">
              By joining you agree to our terms of service.
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-accent hover:text-red-400 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
