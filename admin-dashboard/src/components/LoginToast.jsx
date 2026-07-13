import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, X, Info } from 'lucide-react';

const CONFIG = {
  success: { icon: CheckCircle2, cls: 'toast-success', label: 'Success'  },
  error:   { icon: XCircle,      cls: 'toast-error',   label: 'Error'    },
  info:    { icon: Info,         cls: 'toast-info',     label: 'Info'     },
};

function ToastItem({ id, message, type = 'info', onDismiss }) {
  const cfg = CONFIG[type] || CONFIG.info;
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      className={`login-toast ${cfg.cls}`}
      initial={{ opacity: 0, x: 24, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.94 }}
      transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <div className="toast-icon">
        <Icon size={14} />
      </div>
      <span className="toast-message">{message}</span>
      <button
        className="toast-dismiss"
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
    <div className="login-toast-wrap" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
