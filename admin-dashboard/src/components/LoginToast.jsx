import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, X, Info } from 'lucide-react';

import { cn } from '@/lib/utils';

const CONFIG = {
  success: {
    icon: CheckCircle2,
    label: 'Success',
    border: 'border-emerald-500/30',
    iconWrap: 'bg-emerald-500/15 text-emerald-400',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    border: 'border-red-500/35',
    iconWrap: 'bg-red-500/15 text-red-300',
  },
  info: {
    icon: Info,
    label: 'Info',
    border: 'border-red-500/25',
    iconWrap: 'bg-red-500/12 text-red-300',
  },
};

function ToastItem({ id, message, type = 'info', onDismiss }) {
  const cfg = CONFIG[type] || CONFIG.info;
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      className={cn(
        'pointer-events-auto flex min-w-[280px] max-w-[360px] items-start gap-3 rounded-xl border bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md',
        cfg.border,
      )}
      initial={{ opacity: 0, x: 24, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.94 }}
      transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          cfg.iconWrap,
        )}
      >
        <Icon size={14} />
      </div>
      <span className="flex-1 text-sm leading-normal text-slate-400">{message}</span>
      <button
        type="button"
        className="shrink-0 border-0 bg-transparent p-0 text-slate-500 transition-colors hover:text-slate-400"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export default function LoginToast({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed right-5 top-5 z-[9999] flex flex-col gap-2"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
