import { motion } from 'framer-motion';

const toneMap = {
  violet: 'from-violet-500/20 to-fuchsia-500/10 text-violet-200 border-violet-400/20',
  blue: 'from-sky-500/20 to-cyan-500/10 text-sky-200 border-sky-400/20',
  emerald: 'from-emerald-500/20 to-green-500/10 text-emerald-200 border-emerald-400/20',
  amber: 'from-amber-500/20 to-orange-500/10 text-amber-200 border-amber-400/20',
};

export default function MetricCard({ title, value, hint, icon: Icon, tone = 'violet' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_45px_rgba(2,8,23,0.25)] backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className={`rounded-2xl border bg-gradient-to-br p-3 ${toneMap[tone] || toneMap.violet}`}>
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-400">{hint}</p>
    </motion.div>
  );
}
