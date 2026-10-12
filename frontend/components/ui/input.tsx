import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn('h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none transition placeholder:text-muted/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60', className)}
      {...props}
    />
  );
}
