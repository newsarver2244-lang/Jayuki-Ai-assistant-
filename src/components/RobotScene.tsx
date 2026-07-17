import React from 'react';
import { motion } from 'motion/react';

interface RobotSceneProps {
  className?: string;
  energy?: number;
}

export default function RobotScene({ className, energy = 0 }: RobotSceneProps) {
  // Map energy (0 to 1) to scales and rotations
  const coreScale = 1 + energy * 0.45;
  const pulseIntensity = 0.2 + energy * 0.8;

  // Generate a list of angles for custom orbital items
  const orbitalNodes = Array.from({ length: 8 }, (_, i) => i * 45);

  return (
    <div 
      className={`w-full h-full relative flex items-center justify-center overflow-hidden bg-radial from-[#15120c] via-black to-black ${className}`} 
      id="robot-scene-container"
    >
      {/* Background Holographic Coordinate Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(245,158,11,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      
      {/* Vignette & Ambient Radial Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* --- HIGH ADVANCED JAYUKI HOLO CORE SYSTEM --- */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        
        {/* Holographic Scanlines & Digital Grain */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(245,158,11,0.01),rgba(0,0,255,0.02))] bg-[size:100%_4px,3px_100%] opacity-50" />

        {/* 1. Deep Space Quantum Ring (Slowest spin) */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          style={{ scale: 1.35 * coreScale }}
          className="absolute w-[440px] h-[440px] rounded-full border border-dashed border-amber-500/5 flex items-center justify-center"
        >
          {/* Subtle orbital markers */}
          {orbitalNodes.map((angle) => (
            <div
              key={`orbit-marker-${angle}`}
              className="absolute w-1 h-1 bg-amber-500/20 rounded-full"
              style={{
                transform: `rotate(${angle}deg) translateY(-220px)`,
              }}
            />
          ))}
        </motion.div>

        {/* 2. Outer Tech Ring 1 (Dashed Clockwise) */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          style={{ scale: coreScale }}
          className="absolute w-72 h-72 md:w-96 md:h-96 rounded-full border border-dashed border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.05)]"
        />

        {/* 3. Tech Ring 2 (Dotted Counter-Clockwise) */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          style={{ scale: 1.12 * coreScale }}
          className="absolute w-80 h-80 md:w-[420px] md:h-[420px] rounded-full border-2 border-dotted border-amber-500/10"
        />

        {/* 4. Hexagonal Core Target Bracket */}
        <motion.div
          animate={{ rotate: 45 + energy * 90, scale: coreScale }}
          transition={{ type: "spring", stiffness: 100 }}
          className="absolute w-56 h-56 md:w-72 md:h-72 border border-amber-500/15 flex items-center justify-center"
        >
          {/* Target Corners */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-500/60" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-500/60" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-500/60" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-500/60" />
        </motion.div>

        {/* 5. Animated Soundwave Ring (Simulated speech frequency feedback) */}
        <div className="absolute w-44 h-44 md:w-56 md:h-56 flex items-center justify-center">
          {Array.from({ length: 32 }).map((_, i) => {
            const angle = (i * 360) / 32;
            const heightMultiplier = energy > 0 ? (0.3 + energy * 1.5) : (0.15 + Math.sin(i * 0.5) * 0.1);
            return (
              <motion.div
                key={`wave-bar-${i}`}
                className="absolute w-[2px] bg-amber-500/60 rounded-full origin-bottom"
                style={{
                  height: `${20 + heightMultiplier * 45}px`,
                  transform: `rotate(${angle}deg) translateY(-80px)`,
                  boxShadow: '0 0 10px rgba(245,158,11,0.5)'
                }}
                animate={{
                  scaleY: [1, 1.3, 0.8, 1],
                }}
                transition={{
                  duration: 1 + (i % 3) * 0.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            );
          })}
        </div>

        {/* 6. Glowing Pure Energy Core (Holographic Reactor) */}
        <motion.div
          animate={{ 
            scale: [1, 1.15, 0.95, 1],
            opacity: [pulseIntensity * 0.4, pulseIntensity * 1, pulseIntensity * 0.6, pulseIntensity * 0.4]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-tr from-amber-500/10 via-amber-400/5 to-transparent border border-amber-500/40 flex items-center justify-center shadow-[0_0_60px_rgba(245,158,11,0.25)]"
        >
          {/* Inner Quantum Core */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 rounded-full border-2 border-dashed border-amber-400/40 flex items-center justify-center"
          >
            <div className="w-8 h-8 rounded-full bg-amber-500/25 animate-pulse shadow-[0_0_20px_#f59e0b]" />
          </motion.div>
        </motion.div>

        {/* 7. Advanced Diagnostics & Floating Telemetry */}
        {/* TOP SYSTEM HEADS-UP DISPLAY */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 font-mono text-[9px] tracking-widest text-amber-500/60 bg-black/40 px-4 py-2 border border-amber-500/10 rounded-full backdrop-blur-sm shadow-[0_0_15px_rgba(245,158,11,0.05)]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-bold">JAYUKI QUANTUM LINK // ACTIVE</span>
          </div>
          <div className="text-[8px] text-amber-500/40 font-semibold uppercase tracking-widest">
            OPERATOR: AMAN | COGNITIVE CORE v3.5
          </div>
        </div>

        {/* LEFT COMPASS HUD */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-3 font-mono text-[8px] text-amber-500/50 bg-black/30 p-3 rounded-lg border border-amber-500/5 backdrop-blur-sm">
          <div className="text-amber-500/80 font-bold">[ SYSTEM FEED ]</div>
          <div>RANGE: NOMINAL</div>
          <div className="flex items-center gap-2">
            <span>ENER_SYS:</span>
            <span className="text-amber-400 font-bold">{(energy * 100).toFixed(0)}%</span>
          </div>
          <div className="w-24 bg-white/5 h-1.5 rounded overflow-hidden border border-white/5">
            <motion.div 
              style={{ width: `${Math.min(100, Math.max(10, energy * 100))}%` }}
              className="bg-amber-500 h-full shadow-[0_0_8px_#f59e0b]" 
            />
          </div>
          <div>COGNITION: JAYUKI</div>
          <div>TARGET: AMAN</div>
        </div>

        {/* RIGHT COMPASS HUD */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-3 font-mono text-[8px] text-amber-500/50 text-right bg-black/30 p-3 rounded-lg border border-amber-500/5 backdrop-blur-sm">
          <div className="text-amber-500/80 font-bold text-left">[ BIO-STATS ]</div>
          <div>CORE_SYS: STABLE</div>
          <div>SYNC_LINK: UTC</div>
          <div>SIG_FREQ: {(16000 + energy * 8000).toFixed(0)} Hz</div>
          <div>SECURE: 256_AES</div>
          <div>HOLO_SYS: ACTIVE</div>
        </div>

        {/* Rotating compass degrees */}
        <motion.div
          animate={{ rotate: 180 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="absolute w-[360px] h-[360px] md:w-[480px] md:h-[480px] rounded-full border border-amber-500/5 hidden md:flex items-center justify-center font-mono text-[8px] text-amber-500/20"
        >
          <div className="absolute top-1">000° N</div>
          <div className="absolute right-1">090° E</div>
          <div className="absolute bottom-1">180° S</div>
          <div className="absolute left-1">270° W</div>
        </motion.div>

        {/* Scanning horizontal laser beam */}
        <motion.div
          animate={{ y: ["-200px", "200px", "-200px"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-80 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent shadow-[0_0_12px_#f59e0b]"
        />
      </div>
    </div>
  );
}
