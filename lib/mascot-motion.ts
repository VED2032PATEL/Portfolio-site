/** The baked GLB and DOM shutter share this clock. No CSS timing approximation. */
export const WEB_PULL = {
  duration: 4.2,
  shoot: 0.9,
  secondShotDelay: 0.16,
  attach: 1.18,
  pull: 1.4,
  land: 2.85,
  release: 3.12,
} as const;

export function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function webPullProgress(time: number) {
  return smoothstep((time - WEB_PULL.pull) / (WEB_PULL.land - WEB_PULL.pull));
}

/** Paused tabs resume in place; ordinary slow frames retain real-time playback. */
export function motionDelta(delta: number, hidden: boolean, resumed: boolean) {
  return hidden || resumed ? 0 : Math.min(delta, 0.1);
}
