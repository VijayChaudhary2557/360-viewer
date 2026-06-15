import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, X, ExternalLink } from "lucide-react";

type Props = {
  tourId: string;
  onClose: () => void;
};

export function PublishModal({ tourId, onClose }: Props) {
  const url = `${window.location.origin}${window.location.pathname}?tour=${tourId}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="glass w-full max-w-md rounded-2xl p-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground mb-1">Virtual Tour</div>
            <h2 className="text-xl font-light tracking-tight">Tour saved!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your tour is permanently saved. Share this link to let anyone view it.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* URL row */}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 mb-4">
          <span className="flex-1 truncate text-xs text-muted-foreground font-mono">{url}</span>
          <button
            onClick={copy}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs transition"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Open in new tab */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/10 py-2.5 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-white hover:bg-white/08 transition"
        >
          <ExternalLink size={13} /> Open tour preview
        </a>
      </motion.div>
    </motion.div>
  );
}
