import { useAuth } from '../context/AuthContext';

export default function UnauthorizedPage() {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-10 shadow-2xl max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-cream font-bold text-xl mb-2">Access Denied</h1>
        <p className="text-cream/60 text-sm mb-6">
          Your account ({user?.email ?? 'unknown'}) is not authorised to access
          the Connect Digitals admin portal.
        </p>
        <p className="text-cream/40 text-xs mb-8">
          If you believe this is an error, ask an existing administrator to
          grant you access.
        </p>
        <button
          onClick={() => void signOut()}
          className="w-full bg-brand_red text-white font-semibold py-2.5 rounded-lg hover:bg-brand_red/90 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
