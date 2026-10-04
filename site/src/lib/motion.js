import { useEffect, useRef, useState } from "react";

const mq = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)");

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => Boolean(mq()?.matches));
  useEffect(() => {
    const m = mq();
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Returns [ref, inView]. Fires once. */
export function useInView({ threshold = 0.15, rootMargin = "0px 0px -8% 0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (!("IntersectionObserver" in window)) return setInView(true);
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && (setInView(true), io.disconnect()),
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold, rootMargin]);
  return [ref, inView];
}

/** Eased count-up from 0 to `to` once `start` is true. */
export function useCountUp(to, start, duration = 1400) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (!start) return;
    if (reduced) return setV(to);
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      setV(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, start, duration, reduced]);
  return v;
}
