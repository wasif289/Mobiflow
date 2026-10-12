import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Native <select> (best on phones, fully accessible) dressed like the rest of the design system. */
export function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select
        className="h-9 w-full appearance-none rounded-lg border border-border bg-bg pl-3 pr-8 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-muted" />
    </div>
  );
}
