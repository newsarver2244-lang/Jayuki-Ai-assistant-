import React, { useEffect, useRef, useState, useCallback } from "react";

// @ts-ignore
import jayukiIdle from "../assets/videos/jayuki_idle.mp4";
// @ts-ignore
import jayukiTalking from "../assets/videos/jayuki_talking.mp4";

interface VideoAvatarProps {
  isSessionActive: boolean;
  appState: "idle" | "listening" | "processing" | "speaking";
  currentMood: "sassy" | "dramatic" | "happy" | "neutral" | "caring" | "firm" | "excited" | "thoughtful";
  audioEnergy: number; // 0 to 1
}

type VideoState = "idle" | "talking";

export default function VideoAvatar({
  isSessionActive,
  appState,
  currentMood,
  audioEnergy,
}: VideoAvatarProps) {
  // Start with 'idle' state to immediately display and loop jayuki_idle.mp4
  const [activeState, setActiveState] = useState<VideoState>("idle");
  const [previousState, setPreviousState] = useState<VideoState | "off">("off");
  
  // Refs for each video element
  const videoRefs = {
    idle: useRef<HTMLVideoElement>(null),
    talking: useRef<HTMLVideoElement>(null),
  };

  // Preload and trigger initial load of both videos
  useEffect(() => {
    Object.values(videoRefs).forEach((ref) => {
      const video = ref.current;
      if (video) {
        video.load();
      }
    });
  }, []);

  // Determine target video state based on live connection and model state
  const getTargetState = useCallback((): VideoState => {
    if (appState === "speaking") {
      return "talking";
    }
    return "idle";
  }, [appState]);

  // Handle activeState and previousState transitions
  const updateStates = useCallback(() => {
    const target = getTargetState();
    if (target !== activeState) {
      setPreviousState(activeState);
      setActiveState(target);
    }
  }, [getTargetState, activeState]);

  // Run update whenever target state dependencies change
  useEffect(() => {
    updateStates();
  }, [updateStates]);

  // Clear previousState after transition crossfade duration (300ms) to clean up layout
  useEffect(() => {
    if (previousState !== "off") {
      const timer = setTimeout(() => {
        setPreviousState("off");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [previousState]);

  // Play and Pause videos programmatically based on activeState
  useEffect(() => {
    Object.entries(videoRefs).forEach(([stateKey, ref]) => {
      const video = ref.current;
      if (!video) return;

      if (stateKey === activeState) {
        // Seek to 0 and play when becoming active to ensure synchronized playback and instant switch
        if (video.paused || video.currentTime === 0) {
          video.currentTime = 0;
          video.play().catch((err) => {
            console.log(`Video play promise for activeState "${stateKey}" paused or pending interaction:`, err);
          });
        }
      } else if (stateKey !== previousState) {
        // Pause immediately if it's neither active nor in the middle of a crossfade
        video.pause();
      }
    });
  }, [activeState]); // Depend ONLY on activeState to prevent stuttering when previousState clears

  // Clean pause the previous state once the crossfade finishes
  useEffect(() => {
    if (previousState === "off") {
      Object.entries(videoRefs).forEach(([stateKey, ref]) => {
        if (stateKey !== activeState) {
          ref.current?.pause();
        }
      });
    }
  }, [previousState, activeState]);

  // Robust touch/click page interaction listener to guarantee muted autoplay resume
  useEffect(() => {
    const resumeAutoplay = () => {
      const activeVideo = videoRefs[activeState]?.current;
      if (activeVideo && activeVideo.paused) {
        activeVideo.play().catch(() => {});
      }
    };

    window.addEventListener("click", resumeAutoplay, { passive: true });
    window.addEventListener("touchstart", resumeAutoplay, { passive: true });
    return () => {
      window.removeEventListener("click", resumeAutoplay);
      window.removeEventListener("touchstart", resumeAutoplay);
    };
  }, [activeState]);

  return (
    <div 
      id="video-avatar-container"
      className="absolute inset-0 w-full h-full bg-black overflow-hidden select-none pointer-events-none"
      style={{ isolation: "isolate" }}
    >
      {/* 1. CSS Keyframe Cinematic Camera Drift */}
      <style>{`
        @keyframes cinematicCamera {
          0% {
            transform: scale(1.0) translate(0px, 0px);
          }
          50% {
            transform: scale(1.03) translate(2px, -1px);
          }
          100% {
            transform: scale(1.0) translate(0px, 0px);
          }
        }
        .cinematic-camera {
          animation: cinematicCamera 18s ease-in-out infinite;
          transform-origin: center center;
        }
        .video-edge-to-edge {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          inset: 0;
        }
      `}</style>

      {/* 2. Responsive, Edge-to-Edge Video Layers with Absolute Centering & 300ms Opacity Blending */}
      <div className="absolute inset-0 w-full h-full z-0 flex items-center justify-center">
        <div className="absolute inset-0 w-full h-full cinematic-camera">
          {/* 1. IDLE VIDEO (Looping) */}
          <video
            ref={videoRefs.idle}
            src={jayukiIdle}
            className={`video-edge-to-edge transition-opacity duration-300 ease-in-out ${
              activeState === "idle" 
                ? "opacity-100 z-10" 
                : previousState === "idle" 
                ? "opacity-100 z-5" 
                : "opacity-0 z-0 pointer-events-none"
            }`}
            preload="auto"
            loop
            playsInline
            muted
            autoPlay
          />

          {/* 2. TALKING VIDEO (Looping) */}
          <video
            ref={videoRefs.talking}
            src={jayukiTalking}
            className={`video-edge-to-edge transition-opacity duration-300 ease-in-out ${
              activeState === "talking" 
                ? "opacity-100 z-10" 
                : previousState === "talking" 
                ? "opacity-100 z-5" 
                : "opacity-0 z-0 pointer-events-none"
            }`}
            preload="auto"
            loop
            playsInline
            muted
          />
        </div>
      </div>

      {/* Scanline overlay effect to enhance futuristic digital look */}
      <div className="absolute inset-0 pointer-events-none z-30 opacity-15 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[size:100%_4px] mix-blend-overlay" />
    </div>
  );
}
