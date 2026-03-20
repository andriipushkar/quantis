import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Privacy: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Minimal header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <div className="w-7 h-7 rounded-lg bg-gold-gradient flex items-center justify-center">
              <span className="text-black font-bold text-xs">Q</span>
            </div>
            <span className="font-bold text-foreground">Quantis</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: March 1, 2026. Effective immediately.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Data We Collect</h2>
            <p>When you create an account and use Quantis, we collect the following data:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><span className="text-foreground font-medium">Email address</span> — for authentication, notifications, and account recovery.</li>
              <li><span className="text-foreground font-medium">Encrypted exchange API keys</span> — stored using AES-256 encryption; used exclusively for read-only portfolio syncing. We never request withdrawal permissions.</li>
              <li><span className="text-foreground font-medium">User preferences</span> — theme, language, timezone, watchlist, alert configurations, and dashboard layout.</li>
              <li><span className="text-foreground font-medium">Usage analytics</span> — anonymized interaction data (pages visited, features used) to improve the Platform.</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Data We Do NOT Collect</h2>
            <p>Quantis is designed with privacy-first principles. We do not collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Full legal names or government-issued IDs.</li>
              <li>Physical addresses or phone numbers.</li>
              <li>Financial information beyond exchange API keys (no bank accounts, credit cards stored on our servers).</li>
              <li>IP-based geolocation tracking for profiling purposes.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Data Storage & Security</h2>
            <p>
              All data is transmitted over TLS 1.3 encrypted connections. At rest, sensitive data (API keys,
              session tokens) is encrypted with AES-256-GCM. Our infrastructure uses:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>PostgreSQL with encrypted columns for sensitive fields.</li>
              <li>Redis with TLS for session and cache data.</li>
              <li>bcrypt (cost factor 12) for password hashing — we never store plaintext passwords.</li>
              <li>JWT tokens with short expiry (15 min access, 7 day refresh) and httpOnly cookies.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Third-Party Sharing</h2>
            <p>
              We do not sell, rent, or share your personal data with third parties for marketing purposes.
              Data may be shared only in the following limited circumstances:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><span className="text-foreground font-medium">Infrastructure providers</span> — hosting and CDN providers process data on our behalf under strict DPAs.</li>
              <li><span className="text-foreground font-medium">Legal requirements</span> — we may disclose data if required by law, court order, or government request.</li>
              <li><span className="text-foreground font-medium">Aggregated analytics</span> — anonymized, non-identifiable usage statistics may be shared publicly (e.g., "70% of users prefer dark mode").</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Data Retention</h2>
            <p>
              Active account data is retained for the duration of your account. Upon account deletion:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Personal data (email, preferences, API keys) is permanently deleted within 30 days.</li>
              <li>Anonymized usage analytics may be retained indefinitely for product improvement.</li>
              <li>Backups containing your data are automatically purged within 90 days.</li>
            </ul>
            <p className="mt-2">
              Inactive accounts (no login for 24 months) will receive a warning email before scheduled deletion.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Your Rights (GDPR & CCPA)</h2>
            <p>Regardless of your location, you have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><span className="text-foreground font-medium">Access</span> — request a copy of all data we hold about you.</li>
              <li><span className="text-foreground font-medium">Rectification</span> — correct inaccurate personal data.</li>
              <li><span className="text-foreground font-medium">Erasure</span> — request deletion of your account and all associated data.</li>
              <li><span className="text-foreground font-medium">Portability</span> — export your data in a machine-readable format (JSON/CSV) from Settings.</li>
              <li><span className="text-foreground font-medium">Restriction</span> — request that we limit processing of your data.</li>
              <li><span className="text-foreground font-medium">Objection</span> — opt out of non-essential data processing.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{' '}
              <span className="text-foreground">privacy@quantis.app</span> or use the data export/delete
              features in your account Settings.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Cookies & Local Storage</h2>
            <p>Quantis uses minimal cookies and local storage:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><span className="text-foreground font-medium">Authentication cookie</span> (httpOnly, secure) — stores your session token. Essential for the Platform to function.</li>
              <li><span className="text-foreground font-medium">Theme preference</span> (localStorage) — remembers your dark/light mode choice.</li>
              <li><span className="text-foreground font-medium">Language preference</span> (localStorage) — remembers your selected language.</li>
            </ul>
            <p className="mt-2">
              We do not use tracking cookies, advertising pixels, or third-party analytics that identify
              individual users (no Google Analytics, no Facebook Pixel).
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy to reflect changes in our practices or legal requirements.
              Material changes will be communicated via email at least 14 days before taking effect.
              The "Last updated" date at the top of this page indicates the most recent revision.
            </p>
          </section>

          <section className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Questions about privacy? Contact us at{' '}
              <span className="text-foreground">privacy@quantis.app</span>.
              Also see our <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
