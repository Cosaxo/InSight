// Global keyframes used across the app (FAB reveal, toast, habit bounce).

export function AnimationStyles() {
  return (
    <style>{`
      @keyframes fabUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
      @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(12px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
      @keyframes toastOut { from { opacity:1 } to { opacity:0; transform:translateX(-50%) translateY(8px) } }
      @keyframes habitBounce { 0% { transform:scale(1) } 40% { transform:scale(1.25) } 70% { transform:scale(0.9) } 100% { transform:scale(1) } }
      @keyframes skeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
    `}</style>
  );
}
