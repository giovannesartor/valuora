import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
};

const slideRight = {
  initial: { opacity: 0, x: 24 },
  enter:   { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, x: -16, transition: { duration: 0.18, ease: 'easeIn' } },
};

const scaleUp = {
  initial: { opacity: 0, scale: 0.96 },
  enter:   { opacity: 1, scale: 1, transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, scale: 0.98, transition: { duration: 0.15, ease: 'easeIn' } },
};

const VARIANT_MAP = {
  '/dashboard': fadeUp,
  '/new-analysis': slideRight,
  '/profile': scaleUp,
};

export default function PageTransition({ children }) {
  const location = useLocation();
  const base = '/' + (location.pathname.split('/')[1] || '');
  const v = VARIANT_MAP[base] || fadeUp;

  return (
    <motion.div
      variants={v}
      initial="initial"
      animate="enter"
      exit="exit"
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
}
