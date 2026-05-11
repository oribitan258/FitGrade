import confetti from 'canvas-confetti';

/** FitGrade brand colour palette for confetti particles. */
const BRAND_COLOURS = ['#6366f1', '#8b5cf6', '#a855f7', '#34d399', '#f9fafb'];

/**
 * Fires a celebratory confetti burst from the centre of the viewport.
 * Used on onboarding completion.
 */
export function fireConfetti(): void {
  void confetti({
    particleCount: 140,
    spread: 80,
    startVelocity: 45,
    origin: { y: 0.55 },
    colors: BRAND_COLOURS,
    gravity: 0.9,
    ticks: 200,
  });

  // Second burst slightly offset for depth
  setTimeout(() => {
    void confetti({
      particleCount: 60,
      spread: 50,
      origin: { x: 0.3, y: 0.5 },
      colors: BRAND_COLOURS,
      gravity: 0.85,
    });
  }, 150);

  setTimeout(() => {
    void confetti({
      particleCount: 60,
      spread: 50,
      origin: { x: 0.7, y: 0.5 },
      colors: BRAND_COLOURS,
      gravity: 0.85,
    });
  }, 280);
}
