"use client";

import { motion, MotionProps } from "framer-motion";
import { ReactNode } from "react";

// Define the props for the component
interface FadeInWhenVisibleProps<T extends keyof JSX.IntrinsicElements = "div">
  extends MotionProps {
  children: ReactNode;
  className?: string;
  as?: T;
}

// Create the FadeInWhenVisible component with a generic type
export default function FadeInWhenVisible<
  T extends keyof JSX.IntrinsicElements = "div",
>({
  children,
  className,
  as = "div" as T, // Default to 'div' if 'as' is not provided
  initial = { opacity: 0.0, y: 40 },
  whileInView = { opacity: 1, y: 0 },
  transition = {
    delay: 0.3,
    duration: 0.8,
    ease: "easeInOut",
  },
  viewport = { once: true },
  ...motionProps // This includes 'variants' and any other MotionProps
}: FadeInWhenVisibleProps<T>) {
  // Use 'as' directly since it's now constrained to valid HTML elements
  const Component = motion.create(as) as React.ElementType;

  return (
    <Component
      initial={initial}
      whileInView={whileInView}
      transition={transition}
      viewport={viewport}
      className={className}
      {...motionProps} // Spread any additional motion props, including 'variants'
    >
      {children}
    </Component>
  );
}
