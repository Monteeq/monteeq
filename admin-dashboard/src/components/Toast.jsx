import { AnimatePresence, motion } from 'framer-motion';

export default function Toast({ message, visible }) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="toast"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
