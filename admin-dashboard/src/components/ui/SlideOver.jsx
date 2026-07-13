import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function SlideOver({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur"
        >
          <motion.aside
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            className="h-full w-full max-w-md border-l border-white/10 bg-slate-950/95 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
