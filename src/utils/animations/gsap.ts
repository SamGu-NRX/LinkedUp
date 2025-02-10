// src/animations/gsap.ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface FadeUpOptions extends gsap.TweenVars {
  delay?: number;
  start?: string;
  ease?: string;
}

export const fadeUp = (
  targets: gsap.TweenTarget,
  trigger: gsap.DOMTarget,
  options?: FadeUpOptions
) => {
  const { start = "top 92%", ease = "power3.out", ...rest } = options || {};

  gsap.fromTo(
    targets,
    { opacity: 0, y: 50 },
    {
      opacity: 1,
      y: 0,
      stagger: 0.2,
      duration: 1,
      ease: ease,
      scrollTrigger: {
        trigger: trigger,
        start: start, // start the animation when the top of the section hits 80% of the viewport height
        toggleActions: "play reset restart reverse",
      },
      ...rest,
    }
  );
};
