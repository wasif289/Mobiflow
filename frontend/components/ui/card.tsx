import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('rounded-xl border border-border bg-card shadow-card', className)} {...p} />;
export const CardHeader = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('flex items-center gap-2 border-b border-border px-4 py-3', className)} {...p} />;
export const CardTitle = ({ className, ...p }: React.ComponentProps<'h3'>) => <h3 className={cn('text-sm font-semibold', className)} {...p} />;
export const CardContent = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('p-4', className)} {...p} />;
