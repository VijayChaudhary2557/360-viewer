import { motion } from "framer-motion";
import { Share2, Info } from "lucide-react";

type Props = {
  onShare: () => void;
  onInfo: () => void;
};

export function TopRightControls({ onShare, onInfo }: Props) {
  const items = [
    { icon: Share2, label: "Share", onClick: onShare },
    { icon: Info, label: "Info", onClick: onInfo },
  ];
  return (
    <div className="fixed right-4 top-4 z-30 flex flex-col gap-2">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <motion.button
            key={it.label}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.05, type: "spring", stiffness: 240, damping: 22 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={it.onClick}
            className="glass group relative grid h-11 w-11 place-items-center rounded-full"
            aria-label={it.label}
          >
            <Icon size={16} />
            <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[10px] uppercase tracking-[0.15em] opacity-0 backdrop-blur transition group-hover:opacity-100">
              {it.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
