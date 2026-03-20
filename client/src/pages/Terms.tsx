import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Terms: React.FC = () => {
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
        <h1 className="text-3xl font-extrabold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: March 1, 2026. Effective immediately upon use.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Service Description</h2>
            <p>
              Quantis ("the Platform") is a cryptocurrency market analysis and intelligence platform that provides
              real-time charting, technical signals, on-chain analytics, portfolio tracking, and AI-assisted trading
              insights. Quantis does not execute trades on your behalf and is not a broker, exchange, or custodian
              of digital assets.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. User Eligibility</h2>
            <p>
              You must be at least 18 years of age (or the legal age of majority in your jurisdiction) to use Quantis.
              By creating an account, you represent that you meet this requirement and that all information you provide
              is accurate and complete.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Account Responsibility</h2>
            <p>
              You are solely responsible for maintaining the confidentiality of your account credentials, including
              your password and any API keys you provide. You agree to notify us immediately of any unauthorized
              access. Quantis is not liable for losses arising from unauthorized use of your account.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Prohibited Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Use the Platform for any unlawful purpose or in violation of any applicable regulations.</li>
              <li>Attempt to reverse-engineer, decompile, or disassemble any portion of the Platform.</li>
              <li>Scrape, crawl, or harvest data from the Platform without prior written consent.</li>
              <li>Distribute, sublicense, or resell access to the Platform or its data feeds.</li>
              <li>Use the Platform to manipulate markets or engage in wash trading.</li>
              <li>Impersonate another user or misrepresent your affiliation with any entity.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Intellectual Property</h2>
            <p>
              All content, features, algorithms, and design of the Platform are the intellectual property of Quantis
              and its licensors. You are granted a limited, non-exclusive, non-transferable license to use the
              Platform for personal, non-commercial purposes (or commercial use under a Pro/Enterprise subscription).
              You may not copy, modify, or create derivative works from any Platform materials.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Limitation of Liability</h2>
            <p>
              Quantis provides market data and analysis on an "as-is" basis. Signals, scores, and AI-generated
              insights are informational only and do not constitute financial advice. Cryptocurrency markets are
              volatile and carry substantial risk of loss.
            </p>
            <p className="mt-2">
              To the maximum extent permitted by law, Quantis shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred
              directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting
              from your use of the Platform.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Subscription Terms</h2>
            <p>
              Paid subscriptions (Pro, Elite, Enterprise) are billed monthly or annually as selected at checkout.
              Subscriptions auto-renew unless cancelled before the renewal date. Refunds are available within
              7 days of initial purchase if no premium features have been substantially used. Downgrades take
              effect at the end of the current billing period.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Data Usage</h2>
            <p>
              By using the Platform, you consent to the collection and processing of anonymized usage data to
              improve our services. We do not sell personal data. Exchange API keys are stored using AES-256
              encryption and are used exclusively for read-only portfolio tracking. See our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>{' '}
              for full details.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Termination</h2>
            <p>
              Quantis reserves the right to suspend or terminate your account at any time for violation of these
              Terms, suspected fraudulent activity, or prolonged inactivity (accounts with no login for 24 months).
              You may delete your account at any time from the Settings page; upon deletion, all personal data
              will be permanently removed within 30 days.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated via email or
              in-app notification at least 14 days before taking effect. Continued use of the Platform after
              changes become effective constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the jurisdiction in which
              Quantis operates, without regard to conflict of law principles.
            </p>
          </section>

          <section className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              If you have questions about these Terms, contact us at{' '}
              <span className="text-foreground">legal@quantis.app</span>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Terms;
