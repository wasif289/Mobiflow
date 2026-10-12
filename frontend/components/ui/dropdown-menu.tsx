'use client';
import * as React from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuSeparator = ({ className, ...p }: React.ComponentProps<typeof M.Separator>) => <M.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...p} />;
export const DropdownMenuLabel = ({ className, ...p }: React.ComponentProps<typeof M.Label>) => <M.Label className={cn('px-2 py-1.5 text-xs font-semibold text-muted', className)} {...p} />;

export function DropdownMenuContent({ className, sideOffset = 6, ...p }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content sideOffset={sideOffset} align="end" className={cn('animate-pop z-50 min-w-48 rounded-xl border border-border bg-card p-1 text-sm shadow-xl', className)} {...p} />
    </M.Portal>
  );
}
const item = 'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 outline-none transition data-[highlighted]:bg-bg data-[disabled]:opacity-50 [&_svg]:size-4';
export const DropdownMenuItem = ({ className, ...p }: React.ComponentProps<typeof M.Item>) => <M.Item className={cn(item, className)} {...p} />;
export function DropdownMenuCheckboxItem({ className, children, ...p }: React.ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem className={cn(item, 'pl-8', className)} {...p}>
      <span className="absolute left-2 flex size-4 items-center justify-center"><M.ItemIndicator><Check className="size-4 text-primary" /></M.ItemIndicator></span>
      {children}
    </M.CheckboxItem>
  );
}
