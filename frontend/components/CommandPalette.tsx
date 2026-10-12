'use client';
import { Command } from 'cmdk';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import type { LucideIcon } from 'lucide-react';

export type PaletteItem = { id: string; label: string; icon: LucideIcon; group: string; hint?: string; run: () => void };

/** Ctrl/Cmd + K: jump to any screen or start common tasks without touching the mouse. */
export default function CommandPalette({ open, onOpenChange, items }: { open: boolean; onOpenChange: (o: boolean) => void; items: PaletteItem[] }) {
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="top-[20%] max-w-xl translate-y-0 p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="flex flex-col" loop>
          <Command.Input autoFocus placeholder="Type a screen or action…" className="h-12 border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted" />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted">Nothing found.</Command.Empty>
            {groups.map((g) => (
              <Command.Group key={g} heading={g} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted">
                {items.filter((i) => i.group === g).map((i) => (
                  <Command.Item key={i.id} value={`${i.group} ${i.label}`} onSelect={() => { onOpenChange(false); i.run(); }}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary">
                    <i.icon className="size-4" />{i.label}{i.hint && <span className="ml-auto text-xs text-muted">{i.hint}</span>}
                  </Command.Item>))}
              </Command.Group>))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
