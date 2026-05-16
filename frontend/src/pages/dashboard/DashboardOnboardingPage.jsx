import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import * as sellersApi from '../../services/sellersApi.js';

export default function DashboardOnboardingPage() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success') === 'true';
  const refresh = searchParams.get('refresh') === 'true';

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    sellersApi.stripeStatus()
      .then(r => setStatus(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function startOnboarding() {
    setStarting(true);
    try {
      const res = await sellersApi.stripeOnboard();
      window.location.href = res.data.data.url;
    } catch {
      setStarting(false);
    }
  }

  async function openStripeDashboard() {
    setStarting(true);
    try {
      const res = await sellersApi.stripeDashboard();
      window.location.href = res.data.data.url;
    } catch {
      setStarting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <Link to="/dashboard" className="text-xs text-gray-500 hover:text-gray-300 mb-6 inline-block">← Dashboard</Link>

      <h1 className="text-2xl font-bold text-white mb-2">Payouts Setup</h1>
      <p className="text-sm text-gray-400 mb-8">
        GrabbleShop uses Stripe Connect to send your earnings directly to your bank account after each sale.
      </p>

      {success && (
        <div className="mb-6 rounded-xl bg-green-500/10 border border-green-500/30 p-4">
          <p className="text-sm font-semibold text-green-300">Onboarding submitted!</p>
          <p className="text-xs text-green-400/80 mt-1">Stripe is reviewing your information. This usually takes a few minutes.</p>
        </div>
      )}

      {refresh && (
        <div className="mb-6 rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4">
          <p className="text-sm font-semibold text-yellow-300">Let's try again</p>
          <p className="text-xs text-yellow-400/80 mt-1">Your onboarding link expired. Click below to get a fresh one.</p>
        </div>
      )}

      {/* Status card */}
      <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status?.onboarded ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
            <span className="text-xl">{status?.onboarded ? '✓' : '⚡'}</span>
          </div>
          <div>
            <p className="font-semibold text-white">
              {status?.onboarded ? 'You\'re all set!' : 'Payout account not connected'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {status?.onboarded
                ? 'Your Stripe account is active. Earnings transfer automatically after each sale.'
                : 'Complete Stripe onboarding to receive payments from buyers.'}
            </p>
          </div>
        </div>

        {status?.onboarded ? (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Charges enabled</span>
              <span className="text-green-400">{status.charges_enabled ? 'Yes' : 'No'}</span>
            </div>
            <Button variant="secondary" loading={starting} onClick={openStripeDashboard} className="w-full">
              Open Stripe Dashboard
            </Button>
          </div>
        ) : (
          <Button loading={starting} onClick={startOnboarding} className="w-full" size="lg">
            {status?.details_submitted ? 'Continue Stripe Setup' : 'Connect Stripe Account'}
          </Button>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">How payouts work</h3>
        <ul className="space-y-2 text-xs text-gray-500">
          <li className="flex gap-2"><span className="text-brand-gold shrink-0">1.</span> Buyer pays through GrabbleShop checkout</li>
          <li className="flex gap-2"><span className="text-brand-gold shrink-0">2.</span> Platform deducts its commission ({(10).toFixed(0)}%)</li>
          <li className="flex gap-2"><span className="text-brand-gold shrink-0">3.</span> The rest transfers to your Stripe account automatically</li>
          <li className="flex gap-2"><span className="text-brand-gold shrink-0">4.</span> Stripe pays out to your bank on your payout schedule</li>
        </ul>
      </div>
    </div>
  );
}
