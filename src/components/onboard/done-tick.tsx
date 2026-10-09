/**
 * A looping "done" tick: the ring draws itself, the tick follows, it holds,
 * then fades out. The reset to empty happens while it is invisible, so each
 * cycle starts clean. Pure CSS in an SVG, so it needs no client code. Stops
 * for members who ask their device for reduced motion.
 */
export function DoneTick({ size = 56 }: { size?: number }) {
  return (
    <>
      <style>{`
        @keyframes mdpva-done-cycle {
          0% { opacity: 1; }
          84% { opacity: 1; }
          92%, 100% { opacity: 0; }
        }
        @keyframes mdpva-done-ring {
          0% { stroke-dashoffset: 110; }
          30%, 92% { stroke-dashoffset: 0; }
          94%, 100% { stroke-dashoffset: 110; }
        }
        @keyframes mdpva-done-check {
          0%, 30% { stroke-dashoffset: 110; }
          50%, 92% { stroke-dashoffset: 0; }
          94%, 100% { stroke-dashoffset: 110; }
        }
        .mdpva-done { animation: mdpva-done-cycle 2.8s ease-in-out infinite; }
        .mdpva-done-ring { animation: mdpva-done-ring 2.8s ease-in-out infinite; }
        .mdpva-done-check { animation: mdpva-done-check 2.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mdpva-done, .mdpva-done-ring, .mdpva-done-check { animation: none; }
          .mdpva-done-ring, .mdpva-done-check { stroke-dashoffset: 0; }
        }
      `}</style>
      <svg
        className="mdpva-done mx-auto"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="mdpva-done-ring"
          cx="32"
          cy="32"
          r="28"
          pathLength={100}
          stroke="#059669"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="100 200"
          strokeDashoffset="0"
        />
        <path
          className="mdpva-done-check"
          d="M20 33 L28 41 L44 24"
          pathLength={100}
          stroke="#059669"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="100 200"
          strokeDashoffset="0"
        />
      </svg>
    </>
  );
}
