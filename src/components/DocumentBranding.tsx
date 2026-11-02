// Shared branded header and footer used on Proposals, Invoices, and Contracts.
// Designed to look professional on screen and when printed.

interface DocumentHeaderProps {
  docType: string;       // e.g. "PROPOSAL", "INVOICE", "SERVICE CONTRACT"
  docNumber?: string;    // e.g. "INV-2026-0010"
  docDate?: string;      // already formatted date string
  badge?: React.ReactNode; // status badge
}

export function DocumentHeader({ docType, docNumber, docDate, badge }: DocumentHeaderProps) {
  return (
    <div className="rounded-t-xl overflow-hidden">
      {/* Navy top bar */}
      <div className="bg-navy px-6 py-5 flex items-center justify-between gap-4">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-3">
          <img
            src="/Connect.jpg"
            alt="Connect Digitals"
            className="w-12 h-12 rounded-full object-cover border-2 border-gold"
          />
          <div>
            <p className="text-gold font-bold text-lg leading-tight tracking-wide">Connect Digitals</p>
            <p className="text-cream/70 text-xs">Digital Marketing &amp; Management Services</p>
          </div>
        </div>

        {/* Doc type + number */}
        <div className="text-right">
          <p className="text-gold/70 text-xs font-semibold uppercase tracking-widest">{docType}</p>
          {docNumber && <p className="text-cream font-bold text-lg leading-tight">{docNumber}</p>}
          {docDate && <p className="text-cream/60 text-xs mt-0.5">{docDate}</p>}
          {badge && <div className="mt-1">{badge}</div>}
        </div>
      </div>

      {/* Gold accent bar */}
      <div className="h-1 bg-gold" />
    </div>
  );
}

export function DocumentFooter() {
  return (
    <div className="mt-8">
      {/* Gold top line */}
      <div className="h-0.5 bg-gold mb-4" />
      {/* Navy footer */}
      <div className="bg-navy rounded-b-xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-cream/60">
        <div className="flex items-center gap-2">
          <img src="/Connect.jpg" alt="" className="w-6 h-6 rounded-full object-cover opacity-80" />
          <span className="font-semibold text-cream/80">Connect Digitals</span>
        </div>
        <div className="text-center space-y-0.5">
          <p>Addis Ababa, Ethiopia</p>
          <p>+251 923 988 883</p>
          <a
            href="https://connectdigitals.pro.et"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold/80 hover:text-gold transition-colors"
          >
            connectdigitals.pro.et
          </a>
        </div>
        <p className="text-cream/40 text-xs">Digital Marketing &amp; Management Services</p>
      </div>
    </div>
  );
}

export function DocumentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {/* Section title with left gold bar */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 bg-gold rounded-full" />
        <h3 className="text-xs font-bold text-navy uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </div>
  );
}
