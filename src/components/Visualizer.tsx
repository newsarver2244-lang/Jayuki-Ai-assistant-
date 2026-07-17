import { motion } from "motion/react";
import { AppState as VisualizerState, JayukiMood } from "../types";

interface VisualizerProps {
  state: VisualizerState;
  mood?: JayukiMood;
  isKissing?: boolean;
}

export default function Visualizer({ state, mood = "neutral", isKissing = false }: VisualizerProps) {
  const getRingAnimation = (index: number, reverse: boolean = false) => {
    let baseSpeed = state === "listening" ? 3 : state === "processing" ? 1.5 : state === "speaking" ? 2 : 15;
    if (isKissing) baseSpeed = 0.5;
    
    // Adjust speed based on mood
    if (state === "speaking") {
      switch (mood) {
        case "sassy": baseSpeed *= 0.5; break; // Fast
        case "dramatic": baseSpeed *= 2; break; // Slow
        case "happy": baseSpeed *= 0.8; break; // Bubbly
      }
    }

    return {
      rotate: reverse ? [-360, 0] : [0, 360],
      transition: { duration: baseSpeed + index * 2, repeat: Infinity, ease: "linear" }
    };
  };

  const getPulseAnimation = () => {
    if (state === "speaking") {
      let duration = 0.5;
      let scale = [1, 1.1, 0.95, 1.05, 1];
      
      if (mood === "sassy") {
        duration = 0.2;
        scale = [1, 1.2, 0.8, 1.1, 1];
      } else if (mood === "dramatic") {
        duration = 1.5;
        scale = [1, 1.05, 0.98, 1.02, 1];
      } else if (mood === "happy") {
        duration = 0.4;
        scale = [1, 1.15, 1, 1.15, 1];
      }

      return {
        scale,
        opacity: [0.8, 1, 0.8, 1, 0.8],
        transition: { duration, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "listening") {
      return {
        scale: [1, 1.02, 1],
        opacity: [0.7, 1, 0.7],
        transition: { duration: 1, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "processing") {
      return {
        scale: [0.98, 1.02, 0.98],
        opacity: [0.6, 0.9, 0.6],
        transition: { duration: 0.8, repeat: Infinity, ease: "linear" }
      };
    }
    return {
      scale: [1, 1.01, 1],
      opacity: [0.4, 0.6, 0.4],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    };
  };

  // Nexa color palette (Golden/Amber/Orange)
  const getTheme = () => {
    switch (state) {
      case "listening": return { color: "rgba(245, 158, 11, 1)", glow: "shadow-amber-500/60", border: "border-amber-400" };
      case "processing": return { color: "rgba(16, 185, 129, 1)", glow: "shadow-emerald-400/80", border: "border-emerald-400" };
      case "speaking": return { color: "rgba(249, 115, 22, 1)", glow: "shadow-orange-500/80", border: "border-orange-400" };
      default: return { color: "rgba(251, 191, 36, 0.8)", glow: "shadow-yellow-500/40", border: "border-yellow-500/50" }; // Golden for idle
    }
  };

  const theme = getTheme();

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      {/* Ambient Glow */}
      <motion.div
        animate={getPulseAnimation()}
        className={`absolute w-[60%] h-[60%] rounded-full blur-[80px] ${theme.glow}`}
        style={{ backgroundColor: theme.color, opacity: 0.15 }}
      />

      {/* Ring 1: Massive Outer Dashed */}
      <motion.div
        animate={getRingAnimation(4, false)}
        className={`absolute w-[100%] h-[100%] rounded-full border-[1px] border-dashed ${theme.border} opacity-20`}
      />

      {/* Ring 2: Segmented Thick Ring */}
      <motion.div
        animate={getRingAnimation(3, true)}
        className={`absolute w-[85%] h-[85%] rounded-full border-[2px] border-dotted ${theme.border} opacity-30`}
      />

      {/* Ring 3: Scanner Ring (Solid with gaps) */}
      <motion.div
        animate={getRingAnimation(2, false)}
        className={`absolute w-[70%] h-[70%] rounded-full border-[1px] ${theme.border} border-t-transparent border-b-transparent opacity-40`}
      />

      {/* Ring 4: Inner Dashed */}
      <motion.div
        animate={getRingAnimation(1, true)}
        className={`absolute w-[55%] h-[55%] rounded-full border-[2px] border-dashed ${theme.border} opacity-50`}
      />
      
      {/* Ring 5: Core HUD Ring */}
      <motion.div
        animate={getRingAnimation(0, false)}
        className={`absolute w-[40%] h-[40%] rounded-full border-[4px] border-dotted ${theme.border} opacity-70`}
      />

      {/* Core Circle */}
      <motion.div
        animate={getPulseAnimation()}
        className={`absolute w-[25%] h-[25%] rounded-full border-[1px] ${theme.border} bg-black/40 backdrop-blur-md flex items-center justify-center shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]`}
        style={{ boxShadow: `0 0 40px ${theme.color}, inset 0 0 30px ${theme.color}` }}
      >
        {/* Core Energy Pulse Lines */}
        <div className="absolute inset-[-40%] pointer-events-none opacity-40">
          <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible">
            {[...Array(3)].map((_, i) => (
              <motion.circle
                key={i}
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={theme.color}
                strokeWidth="0.5"
                strokeDasharray="10 20"
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 1.1 + i * 0.1, 1],
                  opacity: [0.2, 0.6, 0.2]
                }}
                transition={{ 
                  duration: 4 + i * 2, 
                  repeat: Infinity, 
                  ease: "linear",
                  delay: i * 0.5 
                }}
              />
            ))}
          </svg>
        </div>

        {/* Center Text */}
        <div 
          className="font-bold tracking-[0.3em] text-xl md:text-3xl lg:text-4xl text-white"
          style={{ textShadow: `0 0 15px ${theme.color}, 0 0 30px ${theme.color}` }}
        >
          NEXA
        </div>
      </motion.div>
    </div>
  );
}
