import { cn } from '@/utils/cn';

// Base shimmer animation
function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-secondary', className)} />
  );
}

// Stat card skeleton (for dashboard, admin, portfolio stats)
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-card border border-border rounded-lg p-4 space-y-3', className)}>
      <Shimmer className="h-3 w-20" />
      <Shimmer className="h-7 w-28" />
      <Shimmer className="h-2.5 w-16" />
    </div>
  );
}

// Table row skeleton
export function SkeletonRow({ cols = 5, className }: { cols?: number; className?: string }) {
  return (
    <tr className={cn('border-b border-border/50', className)}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Shimmer className={cn('h-4', i === 0 ? 'w-24' : 'w-16')} />
        </td>
      ))}
    </tr>
  );
}

// Full table skeleton
export function SkeletonTable({ rows = 5, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn('bg-card border border-border rounded-lg overflow-hidden', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Shimmer className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Chart skeleton (for canvas charts)
export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn('bg-card border border-border rounded-lg p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-4 w-20" />
      </div>
      <div className="relative h-48">
        <Shimmer className="absolute inset-0 rounded-lg" />
      </div>
    </div>
  );
}

// Page-level skeleton (cards grid + table)
export function SkeletonPage({ cards = 4, tableRows = 8, tableCols = 6 }: { cards?: number; tableRows?: number; tableCols?: number }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonTable rows={tableRows} cols={tableCols} />
    </div>
  );
}

// Text line skeleton
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export { Shimmer };
