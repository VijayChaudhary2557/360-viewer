import { motion } from "framer-motion";

export function LoadingScreen({ visible }: { visible: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      style={{ pointerEvents: visible ? "auto" : "none" }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    >
      <div className="relative h-20 w-20">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.08)" strokeWidth="2" fill="none" />
          <motion.circle
            cx="50"
            cy="50"
            r="46"
            stroke="white"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="289"
            initial={{ strokeDashoffset: 289 }}
            animate={{ strokeDashoffset: [289, 72, 289] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-xl font-light tracking-[0.3em] text-foreground">M</div>
        </div>
      </div>
      <div className="mt-8 text-xs uppercase tracking-[0.4em] text-muted-foreground">
        Loading Virtual Environment
      </div>
    </motion.div>
  );
}
