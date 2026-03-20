import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  LineChart,
  Layers,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Check,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useThemeStore } from '@/stores/theme';
import { cn } from '@/utils/cn';

const STORAGE_KEY = 'quantis-onboarded';

const EXPERIENCE_LEVELS = [
  {
    id: 'beginner',
    icon: BookOpen,
    titleKey: 'onboarding.beginner',
    descKey: 'onboarding.beginnerDesc',
  },
  {
    id: 'intermediate',
    icon: LineChart,
    titleKey: 'onboarding.intermediate',
    descKey: 'onboarding.intermediateDesc',
  },
  {
    id: 'advanced',
    icon: Layers,
    titleKey: 'onboarding.advanced',
    descKey: 'onboarding.advancedDesc',
  },
] as const;

const COINS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'LINK', name: 'Chainlink' },
];

interface OnboardingWizardProps {
  onComplete: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();

  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<string | null>(null);
  const [selectedCoins, setSelectedCoins] = useState<Set<string>>(
    new Set(['BTC', 'ETH', 'SOL'])
  );
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'light'>(theme);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const totalSteps = 3;

  const toggleCoin = useCallback((symbol: string) => {
    setSelectedCoins((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  }, []);

  const handleThemeSelect = useCallback(
    (t: 'dark' | 'light') => {
      setSelectedTheme(t);
      setTheme(t);
    },
    [setTheme]
  );

  const animateStep = useCallback((dir: 1 | -1) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep((s) => s + dir);
      setIsTransitioning(false);
    }, 200);
  }, []);

  const handleNext = useCallback(() => {
    if (step < totalSteps - 1) {
      animateStep(1);
    }
  }, [step, animateStep]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      animateStep(-1);
    }
  }, [step, animateStep]);

  const handleComplete = useCallback(async () => {
    // Add selected coins to watchlist via API
    try {
      const symbols = Array.from(selectedCoins).map((c) => `${c}USDT`);
      for (const symbol of symbols) {
        await fetch('/api/v1/watchlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('quantis_token')}`,
          },
          body: JSON.stringify({ symbol }),
        });
      }
    } catch {
      // Silently ignore watchlist errors
    }

    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
    navigate('/dashboard');
  }, [selectedCoins, navigate, onComplete]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleComplete();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleComplete]);

  const canProceed =
    step === 0 ? !!experience : step === 1 ? selectedCoins.size >= 1 : true;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl mx-4">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === step
                  ? 'w-8 bg-gold-gradient'
                  : i < step
                    ? 'w-2 bg-primary/60'
                    : 'w-2 bg-border'
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div
          className={cn(
            'transition-all duration-200',
            isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          )}
        >
          {/* Step 1: Experience Level */}
          {step === 0 && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-black" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t('onboarding.experienceTitle')}
              </h2>
              <p className="text-muted-foreground mb-8">
                {t('onboarding.experienceSubtitle')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setExperience(level.id)}
                    className={cn(
                      'flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 bg-card hover:border-primary/50',
                      experience === level.id
                        ? 'border-primary shadow-lg shadow-primary/10'
                        : 'border-border'
                    )}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center transition-colors',
                        experience === level.id
                          ? 'bg-primary/20 text-primary'
                          : 'bg-secondary text-muted-foreground'
                      )}
                    >
                      <level.icon className="w-6 h-6" />
                    </div>
                    <span className="font-semibold text-foreground">{t(level.titleKey)}</span>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      {t(level.descKey)}
                    </span>
                    {experience === level.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-black" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Interests */}
          {step === 1 && (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t('onboarding.interestsTitle')}
              </h2>
              <p className="text-muted-foreground mb-8">
                {t('onboarding.interestsSubtitle')}
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                {COINS.map((coin) => (
                  <button
                    key={coin.symbol}
                    onClick={() => toggleCoin(coin.symbol)}
                    className={cn(
                      'flex items-center gap-2 px-5 py-3 rounded-full border-2 transition-all duration-200 font-medium text-sm',
                      selectedCoins.has(coin.symbol)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    {selectedCoins.has(coin.symbol) && (
                      <Check className="w-4 h-4" />
                    )}
                    <span>{coin.symbol}</span>
                    <span className="text-xs opacity-70">{coin.name}</span>
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                {t('onboarding.selectedCount', { count: selectedCoins.size })}
              </p>
            </div>
          )}

          {/* Step 3: Choose Theme */}
          {step === 2 && (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t('onboarding.themeTitle')}
              </h2>
              <p className="text-muted-foreground mb-8">
                {t('onboarding.themeSubtitle')}
              </p>

              <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
                <button
                  onClick={() => handleThemeSelect('dark')}
                  className={cn(
                    'flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all duration-200',
                    selectedTheme === 'dark'
                      ? 'border-primary shadow-lg shadow-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="w-full aspect-video rounded-lg bg-[#0B0E11] border border-[#1E2329] flex items-center justify-center">
                    <Moon className="w-8 h-8 text-[#C9A84C]" />
                  </div>
                  <span className="font-semibold text-foreground">
                    {t('onboarding.darkTheme')}
                  </span>
                  {selectedTheme === 'dark' && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-black" />
                    </div>
                  )}
                </button>

                <button
                  onClick={() => handleThemeSelect('light')}
                  className={cn(
                    'flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all duration-200',
                    selectedTheme === 'light'
                      ? 'border-primary shadow-lg shadow-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="w-full aspect-video rounded-lg bg-[#F8F6F0] border border-[#E5E0D5] flex items-center justify-center">
                    <Sun className="w-8 h-8 text-[#A08840]" />
                  </div>
                  <span className="font-semibold text-foreground">
                    {t('onboarding.lightTheme')}
                  </span>
                  {selectedTheme === 'light' && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-black" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-10">
          <div>
            {step > 0 && (
              <Button variant="ghost" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t('common.back')}
              </Button>
            )}
          </div>
          <div>
            {step < totalSteps - 1 ? (
              <Button onClick={handleNext} disabled={!canProceed}>
                {t('common.next')}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleComplete}>
                {t('onboarding.getStarted')}
                <Sparkles className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
