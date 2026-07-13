import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Sparkles,
  Video,
  Users,
  BarChart3,
  FileWarning,
  Lock,
} from 'lucide-react';

const features = [
  { icon: Video,       label: 'Monitor uploaded videos' },
  { icon: FileWarning, label: 'Review reported content' },
  { icon: Users,       label: 'Manage creators' },
  { icon: BarChart3,   label: 'View platform analytics' },
  { icon: Lock,        label: 'Secure administrator access' },
];

const stats = [
  { value: '128k+', label: 'Active creators' },
  { value: '99.9%', label: 'Uptime SLA' },
];

/* Animation variants */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

function BrandPanel() {
  return (
    <div className="brand-panel">
      {/* Animated background orbs */}
      <div className="brand-orb brand-orb-1" aria-hidden="true" />
      <div className="brand-orb brand-orb-2" aria-hidden="true" />
      <div className="brand-orb brand-orb-3" aria-hidden="true" />

      {/* Subtle grid texture */}
      <div className="brand-grid" aria-hidden="true" />

      {/* Main content */}
      <motion.div
        className="brand-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Logo */}
        <motion.div className="brand-logo-row" variants={itemVariants}>
          <div className="brand-logo-icon">
            <Sparkles size={20} />
          </div>
          <span className="brand-logo-name">
            Monteeq<span className="brand-logo-dot" />
          </span>
        </motion.div>

        {/* Status badge */}
        <motion.div className="brand-eyebrow" variants={itemVariants}>
          <span className="brand-eyebrow-dot" />
          All systems operational
        </motion.div>

        {/* Headline */}
        <motion.h1 className="brand-title" variants={itemVariants}>
          Welcome Back,{' '}
          <span className="brand-title-gradient">Administrator</span>
        </motion.h1>

        {/* Description — clean, direct, no filler */}
        <motion.p className="brand-copy" variants={itemVariants}>
          Manage creators, moderate content, and monitor platform activity
          — all from one secure dashboard.
        </motion.p>

        {/* Feature list */}
        <motion.div className="brand-features" variants={containerVariants}>
          {features.map(({ icon: Icon, label }, i) => (
            <motion.div
              key={label}
              className="brand-feature"
              variants={itemVariants}
              custom={i}
              whileHover={{ x: 4, transition: { duration: 0.2 } }}
            >
              <div className="brand-feature-icon">
                <Icon size={15} />
              </div>
              <span className="brand-feature-text">{label}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Footer stats */}
      <motion.div
        className="brand-footer"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {stats.map(({ value, label }) => (
          <div key={label} className="brand-stat">
            <div className="brand-stat-value">{value}</div>
            <div className="brand-stat-label">{label}</div>
          </div>
        ))}
        <div className="brand-stat-divider" aria-hidden="true" />
        <div className="brand-version-pill">
          <ShieldCheck size={12} />
          v1.0.0
        </div>
      </motion.div>
    </div>
  );
}

/* Static component — wrap in memo so it never re-renders on parent state changes */
export default memo(BrandPanel);
