'use client';
import * as React from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogTitle = ({ className, ...p }: React.ComponentProps<typeof D.Title>) => <D.Title className={cn('text-base font-semibold', className)} {...p} />;
export const DialogDescription = ({ className, ...p }: React.ComponentProps<typeof D.Description>) => <D.Description className={cn('text-sm text-muted', className)} {...p} />;

/** Centered by default. Pass className to turn it into a side drawer (tailwind-merge resolves the conflicts). */
export function DialogContent({ className, children, hideClose, ...p }: React.ComponentProps<typeof D.Content> & { hideClose?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <D.Content
        className={cn('animate-pop fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl outline-none', className)}
        {...p}
      >
        {children}
        {!hideClose && (
          <D.Close aria-label="Close" className="absolute right-3 top-3 rounded-md p-1 text-muted transition hover:bg-bg hover:text-text"><X className="size-4" /></D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}
