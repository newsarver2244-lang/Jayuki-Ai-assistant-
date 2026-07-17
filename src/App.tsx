import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, Camera, Monitor, Heart, Calendar, CheckSquare, X, Globe, Flame, Download, FolderArchive, Wand2, Zap, Sliders, MapPin } from "lucide-react";
import { getJayukiResponse, getJayukiAudio, resetJayukiSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import VideoAvatar from "./components/VideoAvatar";
import MapPanel from "./components/MapPanel";
import PermissionModal from "./components/PermissionModal";
import HabitTracker from "./components/HabitTracker";
import { LiveVideoFeed } from "./components/LiveVideoFeed";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";
import { AppState, ChatMessage, JayukiMood, VoiceSettingsData } from "./types";
import BehaviorStudio from "./components/BehaviorStudio";
import VoiceStudio from "./components/VoiceStudio";
import { BehaviorProfile, DEVELOPER_DEFAULT_PROFILE } from "./utils/systemInstructionBuilder";

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [currentMood, setCurrentMood] = useState<JayukiMood>("neutral");
  const [isKissing, setIsKissing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("jayuki_chat_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const seen = new Set();
        return parsed.map((m: any) => {
          const newId = (!m.id || seen.has(m.id)) ? crypto.randomUUID() : m.id;
          seen.add(newId);
          return { ...m, id: newId };
        });
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("jayuki_chat_history", JSON.stringify(messages));
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showHabits, setShowHabits] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showBehaviorStudio, setShowBehaviorStudio] = useState(false);
  const [activeBehaviorProfile, setActiveBehaviorProfile] = useState<BehaviorProfile>(() => {
    const saved = localStorage.getItem("jayuki_active_behavior_profile");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse active behavior profile", e);
      }
    }
    return DEVELOPER_DEFAULT_PROFILE;
  });

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsData>(() => {
    const saved = localStorage.getItem("jayuki_voice_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse voice settings", e);
      }
    }
    return {
      mode: 'gemini',
      browserVoiceName: "",
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0,
      geminiVoiceName: "Kore"
    };
  });

  useEffect(() => {
    localStorage.setItem("jayuki_voice_settings", JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  useEffect(() => {
    if (!voiceSettings.browserVoiceName && typeof window !== "undefined" && window.speechSynthesis) {
      const initDefaultVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const preferred = voices.find(v => v.lang.startsWith("en-IN") || v.lang.startsWith("hi-IN") || v.lang.startsWith("en"));
          setVoiceSettings(prev => ({
            ...prev,
            browserVoiceName: preferred ? preferred.name : voices[0].name
          }));
        }
      };
      initDefaultVoice();
      window.speechSynthesis.onvoiceschanged = initDefaultVoice;
      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, [voiceSettings.browserVoiceName]);

  const [showChat, setShowChat] = useState(false);
  const [visionMode, setVisionMode] = useState<'camera' | 'screen' | 'none'>('none');
  const [activeVideoStream, setActiveVideoStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraMinimized, setCameraMinimized] = useState<boolean>(false);

  const handleToggleFacingMode = async () => {
    const nextFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextFacingMode);
    
    if (isSessionActive && liveSessionRef.current && visionMode === 'camera') {
      try {
        await liveSessionRef.current.updateMedia('camera', nextFacingMode);
      } catch (e: any) {
        console.error("Failed to switch camera", e);
        setPermissionError(e.message);
        setShowPermissionModal(true);
        setCameraFacingMode(cameraFacingMode); // Revert
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [audioEnergy, setAudioEnergy] = useState(0);

  // Maps / Location intelligence state
  const [showMap, setShowMap] = useState(false);
  const [mapInitialQuery, setMapInitialQuery] = useState("");

  useEffect(() => {
    const handleMapAction = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setMapInitialQuery(detail.query || "");
        setShowMap(true);
      }
    };
    window.addEventListener("jayuki-map-action", handleMapAction);
    return () => {
      window.removeEventListener("jayuki-map-action", handleMapAction);
    };
  }, []);

  // Background glow color based on state
  const getGlowColor = () => {
    if (isKissing) return "rgba(255, 215, 0, 0.4)"; // Golden glow for kissing
    switch (appState) {
      case "processing": return "rgba(255, 180, 0, 0.3)"; // Deep GOLD for starting connection
      case "listening": return "rgba(255, 215, 0, 0.2)"; // Soft GOLD for talking to her
      case "speaking": return "rgba(255, 255, 150, 0.25)"; // Bright GOLD for replying
      case "idle": return "rgba(20, 20, 20, 0.3)"; // Subtle Dark for idle
      default: return "rgba(255, 215, 0, 0.1)";
    }
  };

  const wakeUpStreamRef = useRef<MediaStream | null>(null);

  // Sound Wake-up Logic (Clap/Shout/Nexa detection)
  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let analyzer: AnalyserNode | null = null;
    let microphone: MediaStreamAudioSourceNode | null = null;
    let animationId: number;
    let recognition: any = null;

    const startListeningForWakeWord = async () => {
      try {
        // Speech Recognition for "Next" command
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
              .map((result: any) => result[0])
              .map((result: any) => result.transcript)
              .join('')
              .toLowerCase();

            // Specifically looking for "next" to activate the button/session
            if (transcript.includes('next')) {
              console.log("Wake command 'next' detected:", transcript);
              recognition.stop();
              toggleListening('none');
            }
          };

          recognition.onerror = () => { /* Background errors ignored */ };
          recognition.onend = () => {
            if (appState === "idle" && !isSessionActive && hasInteracted && recognition) {
              try { recognition.start(); } catch(e) {}
            }
          };

          recognition.start();
        }
      } catch (err) {
        console.warn("Wake-up listener failed:", err);
      }
    };

    if (appState === "idle" && !isSessionActive && hasInteracted) {
      startListeningForWakeWord();
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (audioContext) audioContext.close();
      if (recognition) {
        recognition.onend = null;
        recognition.stop();
      }
      if (wakeUpStreamRef.current) {
        wakeUpStreamRef.current.getTracks().forEach(t => t.stop());
        wakeUpStreamRef.current = null;
      }
    };
  }, [appState, isSessionActive, hasInteracted]);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleKiss = useCallback(() => {
    setIsKissing(true);
    setCurrentMood("happy");
    // Play a sweet kiss sound (synthesized or system alert)
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch(e) { console.warn("Audio kiss failed", e) }

    setTimeout(() => setIsKissing(false), 3000);
  }, []);

  const handleProfileChange = useCallback((profile: BehaviorProfile) => {
    setActiveBehaviorProfile(profile);
    
    // Sync with voice settings
    const updatedVoiceSettings: VoiceSettingsData = {
      mode: profile.selectedVoice === "browser" ? "browser" : "gemini",
      browserVoiceName: profile.selectedVoice === "browser" ? profile.voiceSettings.browserVoiceName || "" : "",
      speed: profile.voiceSettings.speed || 1.0,
      pitch: profile.voiceSettings.pitch || 1.0,
      volume: 1.0,
      geminiVoiceName: profile.selectedVoice === "browser" ? "Kore" : profile.selectedVoice,
      emotion: profile.voiceSettings.emotion,
      warmth: profile.voiceSettings.warmth,
      energy: profile.voiceSettings.energy,
      confidence: profile.voiceSettings.confidence,
      expressiveness: profile.voiceSettings.expressiveness,
      naturalPause: profile.voiceSettings.naturalPause
    };
    setVoiceSettings(updatedVoiceSettings);
    
    // Force reset of current chat session to fetch new system instructions on next message
    resetJayukiSession();
    
    // If live session is active, trigger immediate restart with new instruction & voice config
    if (isSessionActive && liveSessionRef.current) {
      console.log("Restarting live session with new custom profile settings...");
      // Store current mode
      const currentVision = visionMode;
      liveSessionRef.current.stop();
      liveSessionRef.current = null;
      
      setTimeout(() => {
        toggleListening(currentVision);
      }, 300);
    }
  }, [isSessionActive, visionMode]);

  const handleVoiceSettingsChange = useCallback((newVoiceSettings: any) => {
    // 1. Map to VoiceSettingsData
    const updatedSettings: VoiceSettingsData = {
      mode: newVoiceSettings.useBrowserSpeech ? "browser" : "gemini",
      browserVoiceName: newVoiceSettings.browserVoiceName,
      speed: newVoiceSettings.speakingSpeed,
      pitch: newVoiceSettings.pitch,
      volume: 1.0,
      geminiVoiceName: newVoiceSettings.geminiVoiceName,
      emotion: newVoiceSettings.emotion,
      warmth: newVoiceSettings.warmth,
      energy: newVoiceSettings.energy,
      confidence: newVoiceSettings.confidence,
      expressiveness: newVoiceSettings.expressiveness,
      naturalPause: newVoiceSettings.naturalPause
    };
    setVoiceSettings(updatedSettings);

    // 2. Map back into our active profile so that it persists perfectly
    const updatedProfile: BehaviorProfile = {
      ...activeBehaviorProfile,
      selectedVoice: newVoiceSettings.useBrowserSpeech ? "browser" : newVoiceSettings.geminiVoiceName,
      voiceSettings: {
        speed: newVoiceSettings.speakingSpeed,
        pitch: newVoiceSettings.pitch,
        emotion: newVoiceSettings.emotion,
        warmth: newVoiceSettings.warmth,
        energy: newVoiceSettings.energy,
        confidence: newVoiceSettings.confidence,
        expressiveness: newVoiceSettings.expressiveness,
        naturalPause: newVoiceSettings.naturalPause
      }
    };
    
    setActiveBehaviorProfile(updatedProfile);
    localStorage.setItem("jayuki_active_behavior_profile", JSON.stringify(updatedProfile));
    
    // Force refresh the system instruction for the text chat session
    resetJayukiSession();

    // Re-initialize active LiveSession with the updated voice name
    if (isSessionActive && liveSessionRef.current) {
      const currentVision = visionMode;
      liveSessionRef.current.stop();
      liveSessionRef.current = null;
      setTimeout(() => {
        toggleListening(currentVision);
      }, 300);
    }
  }, [activeBehaviorProfile, isSessionActive, visionMode]);

  const handlePreviewVoice = useCallback(async (text: string, voiceName: string, isBrowser: boolean) => {
    if (isBrowser) {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.name === voiceName);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = voiceSettings.speed;
      utterance.pitch = voiceSettings.pitch;
      window.speechSynthesis.speak(utterance);
    } else {
      try {
        const base64 = await getJayukiAudio(text, voiceName);
        if (base64) {
          await playPCM(base64);
        }
      } catch (e) {
        console.error("Preview speaking failed", e);
      }
    }
  }, [voiceSettings]);

  const speakText = useCallback(async (text: string) => {
    if (isMuted) return;
    
    setAppState("speaking");
    
    if (voiceSettings.mode === 'browser') {
      const browserSpeechSuccess = await new Promise<boolean>((resolve) => {
        if (!window.speechSynthesis) {
          resolve(false);
          return;
        }
        window.speechSynthesis.cancel();
        
        const cleanedText = text.replace(/\[[A-Z]+\]/gi, "").trim();
        if (!cleanedText) {
          resolve(true);
          return;
        }
        
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.name === voiceSettings.browserVoiceName);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        
        utterance.rate = voiceSettings.speed;
        utterance.pitch = voiceSettings.pitch;
        utterance.volume = voiceSettings.volume;
        
        utterance.onend = () => {
          resolve(true);
        };
        utterance.onerror = (e) => {
          console.warn("Browser speech error - will attempt Gemini TTS fallback:", e);
          resolve(false);
        };
        
        window.speechSynthesis.speak(utterance);
      });

      if (!browserSpeechSuccess) {
        try {
          const audioBase64 = await getJayukiAudio(text, voiceSettings.geminiVoiceName);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
        } catch (e) {
          console.error("Gemini TTS speaking fallback failed", e);
        }
      }
    } else {
      try {
        const audioBase64 = await getJayukiAudio(text, voiceSettings.geminiVoiceName);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      } catch (e) {
        console.error("Gemini TTS speaking failed", e);
      }
    }
    setAppState("idle");
  }, [isMuted, voiceSettings]);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: "user", text: finalTranscript }]);
    
    // Check for build commands
    const lowerTranscript = finalTranscript.toLowerCase();
    const isBuildRequest = lowerTranscript.includes("make a website") || 
                          lowerTranscript.includes("build a website") || 
                          lowerTranscript.includes("create a website") ||
                          lowerTranscript.includes("make a 3d website");

    if (isBuildRequest) {
      const context = finalTranscript
        .replace(/make a (3d )?website|build a website|create a website/gi, "")
        .replace(/on|for|about/i, "")
        .trim() || "modern website";
      handleJayukiAutoBuild(context);
      return;
    }

    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }
    setAppState("processing");

    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: "jayuki", text: responseText }]);
      
      await speakText(responseText);

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      responseText = await getJayukiResponse(finalTranscript, messagesRef.current);
      
      // Extract mood
      const moodMatch = responseText.match(/\[(SASSY|DRAMATIC|HAPPY)\]/);
      if (moodMatch) {
        setCurrentMood(moodMatch[1].toLowerCase() as JayukiMood);
      } else {
        setCurrentMood("neutral");
      }

      if (responseText.toUpperCase().includes("UMMAH")) {
        handleKiss();
      }

      setMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: "jayuki", text: responseText }]);
      
      await speakText(responseText);
    }
  }, [isMuted, isSessionActive, handleKiss, speakText]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const [showPreview, setShowPreview] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [masterPrompt, setMasterPrompt] = useState("");
  const [showMasterPromptModal, setShowMasterPromptModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenInNewTab = (html: string) => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleJayukiAutoBuild = async (context: string, imageData?: string) => {
    setAppState("processing");
    setShowChat(true);

    // STEP 1: PROMPT ENGINEERING PHASE
    const engineerPrompt = `Act as an Elite Prompt Engineer. Analyze this request: "${context}".
    Construct a MASTER PROMPT using this EXACT structure:
    ---
    Act as an expert web developer and UI designer.
    Build a professional website with the following specifications:
    ### OBJECTIVE: [Clear goal]
    ### FEATURES: [List of 5+ features including a functional 'Heart Button' image upload]
    ### DESIGN REQUIREMENTS: [Elite style, Color, Grid]
    ### TECH STACK: Suggest best modern stack for standalone HTML (Three.js/Tailwind)
    ### STRUCTURE: [Detailed page list]
    ### OUTPUT: Production-ready code, responsive.
    ---
    IMPORTANT: Wrap it inside [MASTER_PROMPT_START] and [MASTER_PROMPT_END] tags.`;

    try {
      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        sender: "jayuki", 
        text: `[HAPPY] Uff, understood AMAN! Stage 1: Engineering your Master Prompt... don't expect me to make it boring! UMMAH!` 
      }]);
      
      const promptResponse = await getJayukiResponse(engineerPrompt, [], imageData);
      const promptMatch = promptResponse.match(/\[MASTER_PROMPT_START\]([\s\S]*?)\[MASTER_PROMPT_END\]/);
      
      if (!promptMatch) {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), sender: "jayuki", text: promptResponse }]);
        setAppState("idle");
        return;
      }

      const finalMasterPrompt = promptMatch[1].trim();
      setMasterPrompt(finalMasterPrompt);
      setShowMasterPromptModal(true);

      // STEP 2: AUTOMATIC BUILD PHASE
      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        sender: "jayuki", 
        text: `[HAPPY] Master Prompt Generated! Stage 2: Building your elite 3D website now... You owe me a treat, AMAN! UMMAH!` 
      }]);

      const builderPrompt = `${finalMasterPrompt}
      
      CRITICAL INSTRUCTION: Return ONLY the code inside \`\`\`html blocks.
      Ensure the website has a functional button with id 'jayuki-heart-upload'. When clicked, it opens a file picker and replaces the hero image or a 3D texture with the uploaded file automatically. Use standard browser FileReader API.`;

      const codeResponse = await getJayukiResponse(builderPrompt, [], imageData);
      const htmlMatch = codeResponse.match(/```html\n([\s\S]*?)\n```/) || 
                       codeResponse.match(/```([\s\S]*?)```/) || 
                       codeResponse.match(/<html>[\s\S]*?<\/html>/i);
                       
      const code = htmlMatch ? (htmlMatch[1] || htmlMatch[0]) : codeResponse;
      
      setGeneratedHtml(code);
      setShowPreview(true);
      handleOpenInNewTab(code);
      
      const successMsg = `[HAPPY] AMAN, automation complete! Your creation is live. Try not to break it, okay? UMMAH!`;
      setMessages(prev => [...prev, { id: crypto.randomUUID(), sender: "jayuki", text: successMsg }]);

      await speakText("AMAN, automation complete! Your creation is live. Try not to break it, okay? UMMAH!");
    } catch (err) {
      console.error("Auto Build Error", err);
      setMessages(prev => [...prev, { id: crypto.randomUUID(), sender: "jayuki", text: "[DRAMATIC] Ugh AMAN, the automation engine hit a speed bump. Such a drama queen! Can we try again?" }]);
    } finally {
      setAppState("idle");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      handleJayukiAutoBuild("Visual identity based on this image", base64);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = (type: 'html' | 'zip' = 'html') => {
    if (!generatedHtml) return;
    
    if (type === 'html') {
      const blob = new Blob([generatedHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jayuki_project_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const zip = new JSZip();
      zip.file("index.html", generatedHtml);
      // We could split CSS/JS if we parsed them out, but for now we'll zip the standalone file for cleaner structure
      zip.generateAsync({ type: "blob" }).then((content) => {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jayuki_project_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

      const responseText = `[HAPPY] Published as ${type.toUpperCase()}! Your creation is saved, AMAN. Don't say I never do anything for you!`;
      setMessages(prev => [...prev, { id: crypto.randomUUID(), sender: "jayuki", text: responseText }]);
      setShowChat(true);
      
      speakText(responseText);
  };

  const toggleListening = async (mode: 'camera' | 'screen' | 'none' = 'none') => {
    // If clicking the same mode, handle toggling
    if (isSessionActive && visionMode === mode) {
      if (mode !== 'none') {
        // Just turn off the camera/screen but keep the audio session alive
        setVisionMode('none');
        setActiveVideoStream(null);
        if (liveSessionRef.current) {
          liveSessionRef.current.updateMedia('none');
        }
        return;
      }
      
      // If clicking 'none' and already in 'none', stop the whole session
      setIsSessionActive(false);
      setVisionMode('none');
      setActiveVideoStream(null);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetJayukiSession();
      return;
    }

    // If active and just changing mode (e.g. from Mic only to Camera), update media source
    if (isSessionActive && liveSessionRef.current) {
      const prevMode = visionMode;
      setVisionMode(mode);
      try {
        await liveSessionRef.current.updateMedia(mode, cameraFacingMode);
      } catch (e: any) {
        console.error("Failed to update media", e);
        setPermissionError(e.message);
        setShowPermissionModal(true);
        setVisionMode(prevMode);
      }
      return;
    }

    // Explicitly stop wake-up listener to free up mic
    if (wakeUpStreamRef.current) {
      wakeUpStreamRef.current.getTracks().forEach(t => t.stop());
      wakeUpStreamRef.current = null;
    }

    try {
      setIsSessionActive(true);
      setVisionMode(mode);
      resetJayukiSession();
      
      const session = new LiveSessionManager();
      session.isMuted = isMuted;
      session.voiceName = voiceSettings.geminiVoiceName;
      liveSessionRef.current = session;
      
      session.onStateChange = (state) => {
        setAppState(state);
        if (state === "idle") {
          setIsSessionActive(false);
          setVisionMode('none');
          setActiveVideoStream(null);
        }
      };
      
      session.onMessage = (sender, text) => {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), sender, text }]);
      };

      (session as any).onKiss = () => {
        handleKiss();
      };
      
      session.onMoodChange = (mood) => {
        setCurrentMood(mood);
      };

      session.onEnergyChange = (energy) => {
        setAudioEnergy(energy);
      };

      session.onVideoStream = (stream) => {
        setActiveVideoStream(stream);
      };

      (session as any).onUpdateHabit = (habitTitle: string, completed: boolean) => {
        window.dispatchEvent(new CustomEvent('jayuki-update-habit', { detail: { habitTitle, completed } }));
        setShowHabits(true); // Auto-open modal when Jayuki updates a habit
      };

      (session as any).onAddHabit = (habitTitle: string) => {
        window.dispatchEvent(new CustomEvent('jayuki-add-habit', { detail: { habitTitle } }));
        setShowHabits(true);
      };
      
      session.onCommand = (url) => {
        setTimeout(() => {
          window.open(url, "_blank");
        }, 1000);
      };

      await session.start(mode, cameraFacingMode);
    } catch (e: any) {
      console.error("Failed to start session", e);
      setPermissionError(e.message || "An unknown error occurred while trying to access the microphone.");
      setShowPermissionModal(true);
      setIsSessionActive(false);
      setVisionMode('none');
      setActiveVideoStream(null);
      setAppState("idle");
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#030303] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0">
      {/* Full-Screen Premium Cinematic Video Avatar Backdrop */}
      <VideoAvatar 
        isSessionActive={isSessionActive}
        appState={appState}
        currentMood={currentMood}
        audioEnergy={audioEnergy}
      />

      {/* Amazing Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.05),transparent_70%)]" />
        
        {/* Animated Grid */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(245,158,11,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.2) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(60deg) translateY(-100px)',
            maskImage: 'linear-gradient(to bottom, transparent, black)'
          }}
        />

        {/* Floating Particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={`particle-main-${i}`}
              className="absolute w-1 h-1 bg-amber-500/20 rounded-full"
              initial={{ 
                x: Math.random() * 100 + "%", 
                y: Math.random() * 100 + "%",
                opacity: 0 
              }}
              animate={{ 
                y: [null, "-20%"],
                opacity: [0, 1, 0]
              }}
              transition={{ 
                duration: 5 + Math.random() * 10, 
                repeat: Infinity, 
                delay: Math.random() * 5 
              }}
            />
          ))}
        </div>

        {/* Amazing Aura Blobs */}
        <div className="absolute inset-0 overflow-hidden opacity-30">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              x: [0, 50, 0],
              y: [0, -30, 0],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/20 blur-[120px]"
          />
          <motion.div
            animate={{
              scale: [1.3, 1, 1.3],
              x: [0, -50, 0],
              y: [0, 30, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-orange-600/20 blur-[150px]"
          />
          <motion.div
            animate={{
              opacity: [0.1, 0.3, 0.1],
              scale: [0.8, 1.1, 0.8],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-yellow-500/10 blur-[100px]"
          />
        </div>
      </div>

      {showPermissionModal && (
        <PermissionModal 
          errorMessage={permissionError || undefined}
          onClose={() => {
            setShowPermissionModal(false);
            setPermissionError(null);
          }} 
        />
      )}

      {/* Cinematic Background Layer */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        {/* Animated Mesh Gradient */}
        <motion.div 
          animate={{
            background: [
              "radial-gradient(circle at 20% 30%, rgba(245, 158, 11, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(180, 83, 9, 0.08) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.08) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(180, 83, 9, 0.08) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 30%, rgba(245, 158, 11, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(180, 83, 9, 0.08) 0%, transparent 50%)",
            ]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 opacity-40 bg-[#050505]"
        />

        {/* Dynamic State Glow Overlay */}
        <motion.div 
          animate={{ 
            backgroundColor: getGlowColor(),
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 z-0"
        />

        {/* Cinematic Bokeh Particles */}
        <div className="absolute inset-0 z-0">
          {[...Array(25)].map((_, i) => (
            <motion.div
              key={`bokeh-${i}`}
              className="absolute rounded-full blur-xl bg-amber-500/10"
              initial={{ 
                width: Math.random() * 200 + 100,
                height: Math.random() * 200 + 100,
                x: Math.random() * 100 + "%", 
                y: Math.random() * 100 + "%",
                opacity: 0
              }}
              animate={{ 
                x: [null, (Math.random() - 0.5) * 20 + "%", (Math.random() - 0.5) * 20 + "%"],
                y: [null, (Math.random() - 0.5) * 20 + "%", (Math.random() - 0.5) * 20 + "%"],
                opacity: [0, Math.random() * 0.2 + 0.1, 0],
                scale: [0.8, 1.2, 0.8]
              }}
              transition={{ 
                duration: Math.random() * 15 + 15, 
                repeat: Infinity, 
                ease: "easeInOut",
                delay: Math.random() * 10
              }}
            />
          ))}
        </div>

        {/* Drifting Cinematic Dust */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <svg width="100%" height="100%" className="opacity-40">
            {[...Array(50)].map((_, i) => (
              <motion.circle
                key={`dust-${i}`}
                r={Math.random() * 1.2 + 0.3}
                fill="#f59e0b"
                initial={{ 
                  x: Math.random() * 100 + "%", 
                  y: Math.random() * 100 + "%",
                  opacity: 0
                }}
                animate={{ 
                  y: [null, "-20%"],
                  x: [null, (Math.random() - 0.5) * 10 + "%"],
                  opacity: [0, 0.6, 0],
                }}
                transition={{ 
                  duration: Math.random() * 20 + 20, 
                  repeat: Infinity, 
                  ease: "linear",
                  delay: Math.random() * 30
                }}
              />
            ))}
          </svg>
        </div>
        
        {/* Film Grain Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay">
          <svg width="100%" height="100%">
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#grain)" />
          </svg>
        </div>

        {/* Subtle Horizontal Energy Flux */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" className="overflow-visible">
            <defs>
              <linearGradient id="energyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            {[...Array(3)].map((_, i) => (
              <motion.path
                key={`line-${i}`}
                d={`M-100,${20 + i * 30} Q250,${(i % 2 === 0 ? -20 : 120)} 500,${20 + i * 30} T1100,${20 + i * 30}`}
                fill="none"
                stroke="url(#energyGradient)"
                strokeWidth={0.5}
                animate={{ 
                  opacity: [0.05, 0.2, 0.05],
                  strokeWidth: [0.5, 1, 0.5],
                  translateX: ["-10%", "10%", "-10%"]
                }}
                transition={{ 
                  duration: 15 + i * 5, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  delay: i * 2 
                }}
              />
            ))}
          </svg>
        </div>
      </div>


      {/* Header */}
      <header 
        onClick={() => setHasInteracted(true)}
        className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6 bg-transparent"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center font-bold text-lg shadow-[0_0_15px_rgba(245,158,11,0.5)] text-black">
            J
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-wider text-amber-400">JAYUKI</h1>
            <span className="text-[10px] text-amber-500/60 font-mono tracking-tighter">FOR AMAN</span>
          </div>
        </div>

        {/* Real-time Clock */}
        <div className="hidden md:flex flex-col items-center">
            <span className="text-2xl font-mono font-bold text-amber-400 tracking-widest">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[10px] font-mono text-amber-500/40 uppercase tracking-[0.3em]">
                {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowMap(!showMap);
              setMapInitialQuery("");
              setShowHabits(false);
              setShowVoiceSettings(false);
              setShowBehaviorStudio(false);
            }}
            className={`p-2 rounded-full transition-all border border-amber-500/20 ${showMap ? 'bg-amber-500 text-black animate-pulse' : 'bg-white/5 hover:bg-amber-500/20 text-amber-400'}`}
            title="Jayuki Maps & Navigation"
          >
            <MapPin size={18} />
          </button>

          <button
            onClick={() => {
              setShowBehaviorStudio(!showBehaviorStudio);
              setShowVoiceSettings(false);
              setShowHabits(false);
              setShowMap(false);
            }}
            className={`p-2 rounded-full transition-all border border-amber-500/20 ${showBehaviorStudio ? 'bg-amber-500 text-black' : 'bg-white/5 hover:bg-amber-500/20 text-amber-400'}`}
            title="Behavior Studio"
          >
            <span className="text-sm">🎭</span>
          </button>

          <button
            onClick={() => {
              setShowVoiceSettings(!showVoiceSettings);
              setShowBehaviorStudio(false);
              setShowHabits(false);
              setShowMap(false);
            }}
            className={`p-2 rounded-full transition-all border border-amber-500/20 ${showVoiceSettings ? 'bg-amber-500 text-black' : 'bg-white/5 hover:bg-amber-500/20 text-amber-400'}`}
            title="Voice Studio"
          >
            <Sliders size={18} />
          </button>

          <button
            onClick={() => {
              setShowHabits(!showHabits);
              setShowVoiceSettings(false);
              setShowBehaviorStudio(false);
              setShowMap(false);
            }}
            className={`p-2 rounded-full transition-all border border-amber-500/20 ${showHabits ? 'bg-amber-500 text-black' : 'bg-white/5 hover:bg-amber-500/20 text-amber-400'}`}
            title="Habit Tracker"
          >
            <CheckSquare size={18} />
          </button>
          
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={18} className="opacity-70 text-red-400" />
            ) : (
              <Volume2 size={18} className="opacity-70 text-amber-400" />
            )}
          </button>

          {messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear the chat history?")) {
                  setMessages([]);
                  resetJayukiSession();
                }
              }}
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
              title="Clear Chat History"
            >
              <Trash2 size={18} className="opacity-70" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content - Visualizer & Chat */}
      <main className="absolute inset-0 flex flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-20 pb-24 px-4 md:px-12 pointer-events-none">
        
        {/* Left Column: Jayuki Status & Chat Toggle */}
        <div className="flex w-[35%] lg:w-[30%] h-full flex-col justify-end gap-4 z-10 pb-10">
          <div className="flex-1 overflow-hidden flex flex-col justify-end pointer-events-auto">
            {showChat && (
              <div className="space-y-4 h-full overflow-y-auto px-4 flex flex-col pt-4 scrollbar-hide">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: msg.sender === "user" ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm backdrop-blur-md border ${
                      msg.sender === "user" 
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-200" 
                        : "bg-white/5 border-white/10 text-white/90"
                    }`}>
                      {msg.text.replace(/\[(SASSY|DRAMATIC|HAPPY)\]/, "").trim()}
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          <div className="h-6">
            <AnimatePresence>
              {appState === "processing" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col gap-1 px-4"
                >
                  <div className="flex items-center gap-2 text-amber-400 text-sm md:text-base font-bold tracking-widest uppercase">
                    <Loader2 size={16} className="animate-spin" />
                    {isSessionActive ? "Syncing Systems..." : "Thinking..."}
                  </div>
                  <div className="text-[10px] text-amber-500/40 font-mono animate-pulse">
                    Jayuki is gathering data layers...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Spacer - Video Avatar is rendered in full-screen background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0" />

        {/* Right Column: User Status */}
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6 flex justify-end">
            <AnimatePresence>
              {appState === "listening" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-orange-400/80 text-sm md:text-base italic"
                >
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  Jayuki is listening...
                </motion.div>
              )}
              {!isSessionActive && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-amber-500/40 text-xs md:text-sm font-mono tracking-widest uppercase"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500/30" />
                  Say "Jayuki" to Connect
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Live Multimodal Feed Preview overlay */}
        <AnimatePresence>
          {activeVideoStream && (
            <LiveVideoFeed 
              stream={activeVideoStream} 
              mode={visionMode} 
              facingMode={cameraFacingMode}
              onToggleFacingMode={handleToggleFacingMode}
              isMinimized={cameraMinimized}
              onToggleMinimized={() => setCameraMinimized(prev => !prev)}
            />
          )}
        </AnimatePresence>

      </main>

      {/* Habit Tracker Overlay */}
      <AnimatePresence>
        {showHabits && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 flex items-center justify-center z-50 p-6 pointer-events-auto"
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHabits(false)} />
                <div className="relative z-10 w-full max-w-md">
                    <HabitTracker />
                    <button 
                        onClick={() => setShowHabits(false)}
                        className="absolute -top-4 -right-4 p-2 bg-amber-500 text-black rounded-full shadow-xl"
                    >
                        <X size={20} />
                    </button>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Studio Overlay */}
      <AnimatePresence>
        {showVoiceSettings && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 flex items-center justify-center z-50 p-6 pointer-events-auto"
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowVoiceSettings(false)} />
                <div className="relative z-10 w-full max-w-4xl max-h-[95vh] flex justify-center">
                    <VoiceStudio 
                        onClose={() => setShowVoiceSettings(false)}
                        onOpenBehaviorStudio={() => {
                          setShowVoiceSettings(false);
                          setShowBehaviorStudio(true);
                        }}
                        voiceSettings={{
                          useBrowserSpeech: voiceSettings.mode === 'browser',
                          browserVoiceName: voiceSettings.browserVoiceName,
                          geminiVoiceName: voiceSettings.geminiVoiceName,
                          speakingSpeed: voiceSettings.speed,
                          pitch: voiceSettings.pitch,
                          emotion: voiceSettings.emotion || 80,
                          warmth: voiceSettings.warmth || 70,
                          energy: voiceSettings.energy || 85,
                          confidence: voiceSettings.confidence || 90,
                          expressiveness: voiceSettings.expressiveness || 80,
                          naturalPause: voiceSettings.naturalPause || 50
                        }}
                        onVoiceSettingsChange={handleVoiceSettingsChange}
                        onPreviewVoice={handlePreviewVoice}
                    />
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Behavior Studio Overlay */}
      <AnimatePresence>
        {showBehaviorStudio && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 flex items-center justify-center z-50 p-6 pointer-events-auto"
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBehaviorStudio(false)} />
                <div className="relative z-10 w-full max-w-4xl max-h-[95vh] flex justify-center">
                    <BehaviorStudio 
                        onClose={() => setShowBehaviorStudio(false)}
                        onOpenVoiceStudio={() => {
                          setShowBehaviorStudio(false);
                          setShowVoiceSettings(true);
                        }}
                        activeProfile={activeBehaviorProfile}
                        onProfileChange={handleProfileChange}
                    />
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Map Panel Overlay */}
      <AnimatePresence>
        {showMap && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="absolute inset-0 z-50 pointer-events-auto"
          >
            <MapPanel 
              initialQuery={mapInitialQuery} 
              onClose={() => {
                setShowMap(false);
                setMapInitialQuery("");
              }} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-md flex items-center gap-2 bg-white/5 border border-amber-500/20 rounded-full p-1 pl-4 backdrop-blur-md shadow-2xl"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="What's on your mind, AMAN?"
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className="p-2 rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors text-black"
              >
                <Send size={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div 
          onClick={() => setHasInteracted(true)}
          className="flex items-center gap-3"
        >
          <button
            onClick={() => {
              setHasInteracted(true);
              toggleListening('none');
            }}
            className={`
              group relative flex items-center gap-3 px-8 py-4 rounded-full font-bold tracking-widest transition-all duration-300 shadow-2xl
              ${
                isSessionActive
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 hover:scale-105"
              }
            `}
          >
            {isSessionActive ? (
              <>
                <div className="relative">
                  <MicOff size={20} />
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-amber-400/20"
                  />
                </div>
                <span>END SESSION</span>
              </>
            ) : (
              <>
                <Mic size={20} className="group-hover:animate-pulse" />
                <span>START CONNECTION</span>
              </>
            )}
          </button>
          
          <button
            onClick={() => toggleListening('camera')}
            className={`p-4 rounded-full transition-all border shadow-2xl ${visionMode === 'camera' ? 'bg-amber-500 text-black border-amber-500' : 'bg-white/5 border-white/10 hover:bg-amber-500/20 text-amber-400/70'}`}
            title="Start Conversation (Camera)"
          >
            <Camera size={20} />
          </button>

          <button
            onClick={() => toggleListening('screen')}
            className={`p-4 rounded-full transition-all border shadow-2xl ${visionMode === 'screen' ? 'bg-amber-500 text-black border-amber-500' : 'bg-white/5 border-white/10 hover:bg-amber-500/20 text-amber-400/70'}`}
            title="Start Screen Conversation"
          >
            <Monitor size={20} />
          </button>


          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileUpload}
          />
        </div>
      </footer>

      {/* Master Prompt Modal */}
      <AnimatePresence>
        {showMasterPromptModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowMasterPromptModal(false)} />
            <div className="relative bg-[#111] border border-amber-500/30 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.2)]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                  <Wand2 className="text-amber-500" size={18} />
                  <h3 className="font-bold text-amber-100 tracking-wider text-[10px] md:text-sm">JAYUKI MASTER PROMPT</h3>
                </div>
                <button onClick={() => setShowMasterPromptModal(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <div className="bg-black/50 rounded-xl p-4 border border-white/5 font-mono text-[10px] md:text-sm text-white/80 h-[300px] overflow-y-auto scrollbar-hide whitespace-pre-wrap">
                  {masterPrompt}
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                        navigator.clipboard.writeText(masterPrompt);
                        alert("Prompt copied to clipboard, AMAN!");
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-all shadow-lg active:scale-95 text-xs"
                  >
                    <Download size={18} /> COPY PROMPT
                  </button>
                  <button
                    onClick={() => setShowMasterPromptModal(false)}
                    className="flex-1 py-3 bg-white/5 text-white/70 font-bold rounded-xl hover:bg-white/10 transition-all border border-white/10 text-xs"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Website Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col pt-16"
          >
            <div className="absolute top-4 right-6 flex items-center gap-4 z-[110]">
              <span className="text-amber-400 font-mono text-sm tracking-widest">JAYUKI CANVAS: 3D PREVIEW</span>
              <button 
                onClick={() => handleOpenInNewTab(generatedHtml)}
                className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-500 text-white rounded-full font-bold text-[10px] md:text-xs hover:bg-blue-400 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              >
                OPEN IN NEW TAB
              </button>
              <div className="flex bg-amber-500 rounded-full overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                <button 
                    onClick={() => handlePublish('html')}
                    className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 text-black font-bold text-[10px] md:text-xs hover:bg-amber-400 transition-colors border-r border-black/10"
                    title="Export as HTML"
                >
                    <Download size={14} /> HTML
                </button>
                <button 
                    onClick={() => handlePublish('zip')}
                    className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 text-black font-bold text-[10px] md:text-xs hover:bg-amber-400 transition-colors"
                    title="Export as ZIP"
                >
                    <FolderArchive size={14} /> ZIP
                </button>
              </div>
              <button 
                onClick={() => setShowPreview(false)}
                className="p-2 bg-white/10 text-white rounded-full hover:bg-red-500/50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <iframe 
              srcDoc={generatedHtml} 
              className="w-full h-full border-none bg-white"
              title="3D Website Preview"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
