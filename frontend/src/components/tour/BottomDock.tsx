import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize2,
  Glasses,
  Settings,
  RotateCcw,
  RotateCw,
} from "lucide-react";

type Props = {
  onPrev: () => void;
  onNext: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  autoWalk: boolean;
  onToggleAutoWalk: () => void;
  onFullscreen: () => void;
  onVR: () => void;
  onSettings: () => void;
};

export function BottomDock({
  onPrev,
  onNext,
  onRotateLeft,
  onRotateRight,
  autoWalk,
  onToggleAutoWalk,
  onFullscreen,
  onVR,
  onSettings,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 26 }}
      className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 flex items-center gap-3"
    >
      {/* Utility buttons — left cluster */}
      <div className="glass flex items-center gap-1 rounded-2xl p-1.5">
        <DockBtn icon={autoWalk ? Pause : Play} label={autoWalk ? "Pause" : "Auto Walk"} onClick={onToggleAutoWalk} accent={autoWalk} />
        <DockBtn icon={Glasses} label="VR Mode" onClick={onVR} />
        <DockBtn icon={Maximize2} label="Fullscreen" onClick={onFullscreen} />
        <DockBtn icon={Settings} label="Settings" onClick={onSettings} />
      </div>

      {/* Directional navigation — center cluster */}
      <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
        {/* Rotate left */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          onClick={onRotateLeft}
          className="dock-btn dock-btn-rotate"
          aria-label="Rotate left"
          title="Look left"
        >
          <RotateCcw size={16} />
        </motion.button>

        {/* Prev scene */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.88 }}
          onClick={onPrev}
          className="dock-btn-nav"
          aria-label="Previous scene"
          title="Previous scene"
        >
          <ChevronLeft size={22} />
        </motion.button>

        {/* Next scene */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.88 }}
          onClick={onNext}
          className="dock-btn-nav"
          aria-label="Next scene"
          title="Next scene"
        >
          <ChevronRight size={22} />
        </motion.button>

        {/* Rotate right */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          onClick={onRotateRight}
          className="dock-btn dock-btn-rotate"
          aria-label="Rotate right"
          title="Look right"
        >
          <RotateCw size={16} />
        </motion.button>
      </div>
    </motion.div>
  );
}

function DockBtn({
  icon: Icon,
  label,
  onClick,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={`dock-btn group relative ${accent ? "dock-btn-active" : ""}`}
      aria-label={label}
    >
      <Icon size={18} />
      <span className="dock-tooltip">{label}</span>
    </motion.button>
  );
}
