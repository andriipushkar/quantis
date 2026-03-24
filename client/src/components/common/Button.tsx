import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-gold-gradient text-black hover:shadow-gold-md active:scale-[0.98]',
        bronze:
          'bg-bronze-gradient text-black hover:shadow-bronze-md active:scale-[0.98]',
        secondary:
          'border border-primary/50 bg-transparent text-primary hover:bg-primary/10 hover:border-primary',
        destructive:
          'bg-danger text-white hover:bg-danger/90',
        ghost:
          'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-secondary hover:border-muted-foreground',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-5 text-sm',
        lg: 'h-12 px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
