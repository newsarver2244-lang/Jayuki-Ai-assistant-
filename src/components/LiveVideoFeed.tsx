import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, RefreshCw, Camera } from "lucide-react";

interface LiveVideoFeedProps {
  stream: MediaStream | null;
  mode: 'camera' | 'screen' | 'none';
  facingMode: 'user' | 'environment';
  onToggleFacingMode: () => void;
  isMinimized: boolean;
  onToggleMinimized: () => void;
}

export const LiveVideoFeed: React.FC<LiveVideoFeedProps> = ({
  stream,
  mode,
  facingMode,
  onToggleFacingMode,
  isMinimized,
  onToggleMinimized,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream || mode === 'none') return null;

  return (
    <div className="absolute bottom-24 right-4 md:bottom-28 md:right-6 z-30 pointer-events-auto">
      <AnimatePresence mode="wait">
        {isMinimized ? (
          /* Minimized HUD Pill ("Hide Display" state) */
          <motion.button
            key="minimized-pill"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={onToggleMinimized}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 border border-amber-500/50 text-amber-400 text-xs font-mono tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:bg-amber-500/20 transition-all"
            id="unhide-camera-display-btn"
            title="Show camera preview"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Camera className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-semibold">
              {mode === 'camera' 
                ? `Camera Active (Hidden - ${facingMode === 'user' ? 'Front' : 'Back'})` 
                : 'Screen Share Active (Hidden)'}
            </span>
            <Eye className="w-3.5 h-3.5 ml-1 text-amber-500/80" />
          </motion.button>
        ) : (
          /* Fully Featured Expanded Video HUD with Jarvis overlays */
          <motion.div
            key="expanded-hud"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-60 h-44 md:w-72 md:h-52 bg-black/60 border border-amber-500/30 rounded-2xl overflow-hidden shadow-[0_0_25px_rgba(245,158,11,0.25)] backdrop-blur-md flex flex-col"
          >
            {/* Video Canvas Container */}
            <div className="relative flex-1 bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${mode === 'camera' && facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              
              {/* Holographic scanning overlay */}
              <div className="absolute inset-0 border border-amber-500/10 pointer-events-none">
                <motion.div
                  animate={{ y: ["0%", "100%", "0%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent shadow-[0_0_8px_#f59e0b]"
                />
              </div>

              {/* Status Header Overlay */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/75 border border-amber-500/30 text-[9px] text-amber-400 font-mono tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {mode === 'camera' 
                  ? `LIVE CAMERA [${facingMode === 'user' ? 'FRONT' : 'BACK'}]` 
                  : "SCREEN SHARE"}
              </div>

              {/* Top Right Action Controls Overlay */}
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {/* Switch camera (Only when mode is camera) */}
                {mode === 'camera' && (
                  <button
                    onClick={onToggleFacingMode}
                    className="p-1 rounded bg-black/70 border border-amber-500/20 text-amber-400 hover:bg-amber-500/30 hover:border-amber-500/50 transition-all"
                    id="switch-camera-facing-btn"
                    title={`Switch to ${facingMode === 'user' ? 'Back (Environment)' : 'Front (Self)'} camera`}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
                
                {/* Hide display button */}
                <button
                  onClick={onToggleMinimized}
                  className="p-1 rounded bg-black/70 border border-amber-500/20 text-amber-400 hover:bg-amber-500/30 hover:border-amber-500/50 transition-all flex items-center gap-1"
                  id="hide-camera-display-btn"
                  title="Hide display (Keep camera active)"
                >
                  <EyeOff className="w-3 h-3" />
                  <span className="text-[8px] font-mono px-0.5">HIDE</span>
                </button>
              </div>

              {/* Holographic Diagnostic Data at Bottom of camera box */}
              <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none text-[8px] text-amber-500/60 font-mono">
                <span>FPS: 24.0</span>
                <span>SECURE_LINK: JAYUKI</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
