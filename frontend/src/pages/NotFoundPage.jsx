import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl mb-4">🏰</p>
      <h1 className="text-3xl font-black text-white mb-2">404</h1>
      <p className="text-gray-400 mb-6">This page must be in another castle.</p>
      <Link to="/" className="bg-brand-accent hover:bg-red-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
        Back to home
      </Link>
    </div>
  );
}
