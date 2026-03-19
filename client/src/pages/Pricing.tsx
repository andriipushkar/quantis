import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Check, ChevronDown, ChevronUp, Crown, Zap, ArrowLeft } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Tier {
  id: string;
  name: string;
  price: number;
  annualPrice: number;
  currency: string;
  interval: string;
  popular?: boolean;
  features: string[];
}

const Pricing: React.FC = () => {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userTier = useAuthStore((s) => s.user?.tier || 'starter');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/v1/subscription/pricing')
      .then((r) => r.json())
      .then((data) => {
        setTiers(data.tiers || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const faqs = [
    {
      q: 'Can I cancel my subscription anytime?',
      a: 'Yes. You can cancel anytime from your Settings page. Your access continues until the end of the current billing period — no partial refunds, but no surprise charges either.',
    },
    {
      q: 'What crypto can I pay with?',
      a: 'We accept USDT, BTC, ETH, and SOL through NOWPayments. After checkout you will receive a payment address and QR code. Once confirmed on-chain your subscription activates automatically.',
    },
    {
      q: 'What happens when my subscription expires?',
      a: 'You are downgraded to the Starter tier. Your data (watchlists, alerts, paper trades) is kept for 90 days so you can pick up where you left off.',
    },
    {
      q: 'Is there a free trial for paid plans?',
      a: 'We do not offer time-limited trials, but the Starter tier is completely free with no credit card required. Upgrade only when you need more power.',
    },
    {
      q: 'How does the referral program work?',
      a: 'Share your unique referral link. When someone signs up and subscribes to a paid plan, you earn 20% of their first payment as commission. Withdraw anytime once the balance exceeds $10.',
    },
  ];

  const getDisplayPrice = (tier: Tier) => {
    if (tier.price === 0) return '$0';
    if (annual) {
      const monthly = Math.round(tier.annualPrice / 12);
      return `$${monthly}`;
    }
    return `$${tier.price}`;
  };

  const getAnnualTotal = (tier: Tier) => {
    if (tier.price === 0) return null;
    if (annual) return `$${tier.annualPrice}/yr`;
    return null;
  };

  const handleUpgrade = (tierId: string) => {
    if (!isAuthenticated) {
      navigate('/register');
      return;
    }
    // In production, this would redirect to checkout
    navigate('/settings');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center animate-pulse">
            <span className="text-black font-bold text-lg">Q</span>
          </div>
          <span className="text-muted-foreground text-sm">Loading pricing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center">
              <span className="text-black font-bold text-sm">Q</span>
            </div>
            <span className="text-primary font-bold text-lg tracking-wide">Quantis</span>
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start free. Upgrade when you need more indicators, alerts, and AI-powered tools.
          </p>
        </div>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span
            className={cn(
              'text-sm font-medium transition-colors',
              !annual ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={cn(
              'relative w-14 h-7 rounded-full transition-colors duration-200',
              annual ? 'bg-primary' : 'bg-secondary'
            )}
          >
            <span
              className={cn(
                'absolute top-1 w-5 h-5 rounded-full bg-foreground transition-transform duration-200',
                annual ? 'translate-x-8' : 'translate-x-1'
              )}
            />
          </button>
          <span
            className={cn(
              'text-sm font-medium transition-colors',
              annual ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            Annual
          </span>
          {annual && (
            <span className="text-xs font-semibold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              Save 20%
            </span>
          )}
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
          {tiers.map((tier) => {
            const isCurrent = isAuthenticated && userTier === tier.id;
            const isPopular = tier.popular;
            const isFree = tier.price === 0;

            return (
              <div
                key={tier.id}
                className={cn(
                  'relative bg-card border rounded-xl p-6 flex flex-col transition-all duration-200',
                  isPopular
                    ? 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/30'
                    : 'border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5'
                )}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 bg-gold-gradient text-black text-xs font-bold px-3 py-1 rounded-full">
                      <Crown className="w-3 h-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Tier name */}
                <h3 className="text-lg font-semibold text-foreground mb-1 mt-1">
                  {tier.name}
                </h3>

                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      {getDisplayPrice(tier)}
                    </span>
                    {!isFree && (
                      <span className="text-muted-foreground text-sm">/mo</span>
                    )}
                  </div>
                  {getAnnualTotal(tier) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Billed {getAnnualTotal(tier)}
                    </p>
                  )}
                  {isFree && (
                    <p className="text-xs text-muted-foreground mt-1">Free forever</p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full h-10 rounded-lg text-sm font-medium bg-secondary text-muted-foreground cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : isFree ? (
                  isAuthenticated ? (
                    <button
                      disabled
                      className="w-full h-10 rounded-lg text-sm font-medium bg-secondary text-muted-foreground cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <Link
                      to="/register"
                      className="w-full h-10 rounded-lg text-sm font-medium border border-primary/50 text-primary hover:bg-primary/10 hover:border-primary transition-all duration-200 flex items-center justify-center"
                    >
                      Get Started
                    </Link>
                  )
                ) : (
                  <button
                    onClick={() => handleUpgrade(tier.id)}
                    className={cn(
                      'w-full h-10 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5',
                      isPopular
                        ? 'bg-gold-gradient text-black hover:shadow-gold-md active:scale-[0.98]'
                        : 'border border-primary/50 text-primary hover:bg-primary/10 hover:border-primary'
                    )}
                  >
                    <Zap className="w-4 h-4" />
                    Upgrade
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Payment info */}
        <div className="text-center mb-16">
          <p className="text-sm text-muted-foreground">
            Pay with{' '}
            <span className="text-foreground font-medium">USDT, BTC, ETH, SOL</span>
            {' '}&mdash; powered by{' '}
            <span className="text-foreground font-medium">NOWPayments</span>
          </p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="border border-border rounded-lg overflow-hidden bg-card"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <span>{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
