// Motion tokens. Every animation pulls from here so timing stays coherent.
// Principle: quick and quiet. Small things react in <200 ms; only meaningful
// state changes (a scan finishing, a screen push) take longer.
import type { Transition, Variants } from "motion/react";

export const duration = {
  instant: 0.12,
  quick: 0.2,
  base: 0.3,
  slow: 0.45,
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1] as const,
  emphasized: [0.3, 0, 0, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
};

export const spring = {
  press: { type: "spring", stiffness: 800, damping: 45, mass: 0.6 } satisfies Transition,
  snappy: { type: "spring", stiffness: 550, damping: 42 } satisfies Transition,
  gentle: { type: "spring", stiffness: 320, damping: 36 } satisfies Transition,
  layout: { type: "spring", stiffness: 450, damping: 44 } satisfies Transition,
};

export const distance = { xs: 4, sm: 6, md: 12, lg: 20 } as const;
export const stagger = { list: 0.025, hero: 0.05 } as const;

/** Push slides in from the right; pop reverses; tab switches cross-fade. */
export const screenVariants: Variants = {
  initial: (dir: number) => (dir === 0 ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? 40 : -24 }),
  animate: { opacity: 1, x: 0, transition: { duration: duration.base, ease: ease.emphasized } },
  exit: (dir: number) =>
    dir === 0
      ? { opacity: 0, transition: { duration: 0.12, ease: ease.exit } }
      : { opacity: 0, x: dir > 0 ? -24 : 40, transition: { duration: duration.quick, ease: ease.exit } },
};

export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: stagger.list } },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: distance.sm },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.emphasized } },
};

export const fadeUp = listItem;
