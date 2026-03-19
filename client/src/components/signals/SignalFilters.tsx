import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

interface SignalFiltersProps {
  type: string;
  strategy: string;
  strength: string;
  onTypeChange: (type: string) => void;
  onStrategyChange: (strategy: string) => void;
  onStrengthChange: (strength: string) => void;
  strategies: string[];
}

export const SignalFilters: React.FC<SignalFiltersProps> = ({
  type,
  strategy,
  strength,
  onTypeChange,
  onStrategyChange,
  onStrengthChange,
  strategies,
}) => {
  const { t } = useTranslation();

  const typeOptions = [
    { value: '', label: t('signals.all') },
    { value: 'BUY', label: t('signals.buy') },
    { value: 'SELL', label: t('signals.sell') },
  ];

  const strengthOptions = [
    { value: '', label: t('signals.all') },
    { value: 'weak', label: t('signals.weak') },
    { value: 'medium', label: t('signals.medium') },
    { value: 'strong', label: t('signals.strong') },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Type toggle buttons */}
      <div className="flex bg-secondary rounded-lg p-1">
        {typeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onTypeChange(opt.value)}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-medium transition-all',
              type === opt.value
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Strategy dropdown */}
      <select
        value={strategy}
        onChange={(e) => onStrategyChange(e.target.value)}
        className="h-9 px-3 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">{t('signals.strategy')}: {t('signals.all')}</option>
        {strategies.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Strength dropdown */}
      <select
        value={strength}
        onChange={(e) => onStrengthChange(e.target.value)}
        className="h-9 px-3 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {strengthOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t('signals.strength')}: {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
