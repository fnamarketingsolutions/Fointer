import { AnimatePresence, motion } from 'framer-motion';

export default function Toast({ message }) {
  return (
    <div className="pointer-events-none fixed top-20 right-4 z-50 sm:top-24">
      <AnimatePresence mode="wait">
        {message ? (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="pointer-events-auto max-w-sm rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37] px-4 py-2.5 text-sm text-black shadow-lg"
          >
            {message.text}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
