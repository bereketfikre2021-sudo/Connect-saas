import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';

export default function PWAInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed (running in standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Don't show if user previously dismissed
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm
                    bg-navy border border-gold/30 rounded-xl shadow-2xl px-4 py-3
                    flex items-center gap-3 animate-fade-in">
      <img src="/Connect.jpg" alt="Connect SaaS" className="w-9 h-9 rounded-full object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-cream font-semibold text-sm leading-tight">Install Connect SaaS</p>
        <p className="text-cream/50 text-xs mt-0.5">Add to your home screen for quick access</p>
      </div>
      <button
        onClick={handleInstall}
        className="shrink-0 flex items-center gap-1.5 bg-gold text-dark text-xs font-semibold
                   px-3 py-1.5 rounded-lg hover:bg-gold/90 transition-colors"
      >
        <Download size={13} />
        Install
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-cream/40 hover:text-cream transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
