import React, { useState, useEffect } from "react";
import { 
  X, Volume2, Play, Sliders, ArrowLeft, RotateCcw, 
  Sparkles, Check, Info, Music, AudioLines, Power
} from "lucide-react";
import { getJayukiAudio } from "../services/geminiService";

interface VoiceStudioProps {
  onClose: () => void;
  onOpenBehaviorStudio: () => void;
  voiceSettings: {
    useBrowserSpeech: boolean;
    browserVoiceName: string;
    geminiVoiceName: string;
    speakingSpeed: number;
    pitch: number;
    emotion: number;
    warmth: number;
    energy: number;
    confidence: number;
    expressiveness: number;
    naturalPause: number;
  };
  onVoiceSettingsChange: (settings: any) => void;
  onPreviewVoice: (text: string, voice: string, isBrowser: boolean) => void;
}

export default function VoiceStudio({
  onClose,
  onOpenBehaviorStudio,
  voiceSettings,
  onVoiceSettingsChange,
  onPreviewVoice
}: VoiceStudioProps) {
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewText, setPreviewText] = useState("Hey there AMAN, how does my current voice sounding to you? Sweet and sassy, right? Hehe!");

  // Available Gemini Prebuilt Voices
  const GEMINI_VOICES = [
    { id: "Kore", label: "Kore (Aman's Default)", gender: "Female", description: "Standard, smart, and playful Hinglish female voice." },
    { id: "Aoede", label: "Aoede (Bubbly / Kawaii)", gender: "Female", description: "Bubbly, cute, and sweet voice. Perfect for cute styles." },
    { id: "Puck", label: "Puck (Energetic)", gender: "Male", description: "Energetic and friendly male voice." },
    { id: "Charon", label: "Charon (Deep / Wise)", gender: "Male", description: "Calm, deep, and steady male voice." },
    { id: "Fenrir", label: "Fenrir (Crisp / Sharp)", gender: "Male", description: "Crisp and sharp masculine voice." },
    { id: "Zephyr", label: "Zephyr (Serene)", gender: "Female", description: "Serene, gentle, and peaceful female voice." }
  ];

  // Fetch Browser Voices
  useEffect(() => {
    const fetchVoices = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();
        setBrowserVoices(voices);
      }
    };
    
    fetchVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = fetchVoices;
    }
  }, []);

  const handleToggleSynthesisMode = () => {
    const useBrowser = !voiceSettings.useBrowserSpeech;
    onVoiceSettingsChange({
      ...voiceSettings,
      useBrowserSpeech: useBrowser
    });
  };

  const handleSelectGeminiVoice = (voiceId: string) => {
    onVoiceSettingsChange({
      ...voiceSettings,
      geminiVoiceName: voiceId
    });
  };

  const handleSelectBrowserVoice = (name: string) => {
    onVoiceSettingsChange({
      ...voiceSettings,
      browserVoiceName: name
    });
  };

  const handleSliderChange = (key: string, value: number) => {
    onVoiceSettingsChange({
      ...voiceSettings,
      [key]: value
    });
  };

  // Restore Developer Default
  const handleRestoreDeveloperDefault = () => {
    onVoiceSettingsChange({
      useBrowserSpeech: false,
      browserVoiceName: "",
      geminiVoiceName: "Kore",
      speakingSpeed: 1.0,
      pitch: 1.0,
      emotion: 80,
      warmth: 70,
      energy: 85,
      confidence: 90,
      expressiveness: 80,
      naturalPause: 50
    });
  };

  // Play Live Audio Preview
  const handlePreview = async () => {
    setIsPlayingPreview(true);
    try {
      if (voiceSettings.useBrowserSpeech) {
        onPreviewVoice(previewText, voiceSettings.browserVoiceName, true);
        setIsPlayingPreview(false);
      } else {
        // Generate TTS chunk via Gemini API and play it
        const base64Data = await getJayukiAudio(previewText, voiceSettings.geminiVoiceName);
        if (base64Data) {
          const audioUrl = `data:audio/mp3;base64,${base64Data}`;
          const audio = new Audio(audioUrl);
          audio.onended = () => setIsPlayingPreview(false);
          await audio.play();
        } else {
          setIsPlayingPreview(false);
          alert("Could not generate Gemini Voice preview. Please ensure your API key is correctly configured.");
        }
      }
    } catch (e) {
      console.error("Preview failed", e);
      setIsPlayingPreview(false);
    }
  };

  return (
    <div className="w-full max-w-4xl bg-[#02090d]/90 backdrop-blur-3xl border border-amber-500/30 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden font-sans text-white h-[90vh] flex flex-col pointer-events-auto border-double border-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-amber-500/10 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/30">
            <Volume2 className="text-amber-400 w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-amber-400 tracking-wider">🎙 VOICE STUDIO</h2>
            <p className="text-[11px] text-amber-500/60 font-mono tracking-widest uppercase">Adaptive Speech Synthesis • Creator: Aman</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-full text-white/50 hover:text-white transition-colors border border-white/10"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
        {/* Synthesis Mode Selection */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold flex items-center gap-1.5 text-amber-400">
              <Sparkles size={16} /> Synthesis Mode
            </h3>
            <p className="text-xs text-white/50">
              Choose between ultra-realistic Gemini Server Voices or high-performance Offline Browser TTS.
            </p>
          </div>

          <button
            onClick={handleToggleSynthesisMode}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              voiceSettings.useBrowserSpeech
                ? "bg-amber-500/10 border-amber-500/50 text-amber-300"
                : "bg-gradient-to-r from-amber-500 to-orange-500 text-black border-amber-400"
            }`}
          >
            <Power size={14} />
            <span>{voiceSettings.useBrowserSpeech ? "SWITCH TO GEMINI LIVE VOICES" : "SWITCH TO BROWSER TTS (OFFLINE)"}</span>
          </button>
        </div>

        {/* Voice Selection Panel */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
          <h3 className="text-xs font-mono text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Music size={12} /> Available Speech Profiles
          </h3>

          {!voiceSettings.useBrowserSpeech ? (
            /* Gemini Server Voices */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {GEMINI_VOICES.map((voice) => {
                const isSelected = voiceSettings.geminiVoiceName === voice.id;
                return (
                  <div
                    key={voice.id}
                    onClick={() => handleSelectGeminiVoice(voice.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                        : "bg-white/5 border-white/10 hover:border-amber-500/30"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-white/90">{voice.label}</span>
                      {isSelected && <Check size={14} className="text-amber-400" />}
                    </div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-amber-500/60 block mb-2">
                      {voice.gender} Voice
                    </span>
                    <p className="text-xs text-white/50 leading-relaxed">
                      {voice.description}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Browser Speech Synthesis Voices */
            <div className="space-y-2">
              {browserVoices.length === 0 ? (
                <div className="p-4 text-center text-xs text-white/40">
                  No Speech Synthesis voices found on this browser. Fallback Gemini mode will be used.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[160px] overflow-y-auto p-1 bg-black/20 rounded-xl border border-white/5">
                  {browserVoices.map((voice) => {
                    const isSelected = voiceSettings.browserVoiceName === voice.name;
                    return (
                      <button
                        key={voice.name}
                        onClick={() => handleSelectBrowserVoice(voice.name)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-400 text-amber-300"
                            : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        <div className="font-bold truncate">{voice.name}</div>
                        <div className="text-[10px] opacity-60 font-mono mt-0.5">{voice.lang}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Parameter Settings with Auto-Hiding of Unsupported Fields */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-mono text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <Sliders size={12} /> Dynamic Voice Modifiers
            </h3>
            <span className="text-[10px] font-mono text-white/40">
              * Unsupported parameters auto-hidden based on active mode
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Speed Modifier (Supported in Both Modes) */}
            <div className="space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex justify-between text-xs">
                <span className="text-white/70 font-medium tracking-wide uppercase text-[11px]">Speaking Speed</span>
                <span className="text-amber-400 font-bold font-mono">
                  {voiceSettings.speakingSpeed.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={voiceSettings.speakingSpeed}
                onChange={(e) => handleSliderChange("speakingSpeed", parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Pitch Modifier (Supported ONLY in Browser TTS Mode, Auto-Hidden in Gemini mode) */}
            {voiceSettings.useBrowserSpeech && (
              <div className="space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/70 font-medium tracking-wide uppercase text-[11px]">Vocal Pitch</span>
                  <span className="text-amber-400 font-bold font-mono">
                    {voiceSettings.pitch.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={voiceSettings.pitch}
                  onChange={(e) => handleSliderChange("pitch", parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            )}

            {/* Emotional Modifiers (Supported ONLY in Gemini Mode, Auto-Hidden in Browser Synthesis mode) */}
            {!voiceSettings.useBrowserSpeech && (
              <>
                <div className="space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70 font-medium tracking-wide uppercase text-[11px]">Vocal Emotion</span>
                    <span className="text-amber-400 font-bold font-mono">{voiceSettings.emotion}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceSettings.emotion}
                    onChange={(e) => handleSliderChange("emotion", parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70 font-medium tracking-wide uppercase text-[11px]">Vocal Warmth</span>
                    <span className="text-amber-400 font-bold font-mono">{voiceSettings.warmth}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceSettings.warmth}
                    onChange={(e) => handleSliderChange("warmth", parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70 font-medium tracking-wide uppercase text-[11px]">Sound Energy</span>
                    <span className="text-amber-400 font-bold font-mono">{voiceSettings.energy}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceSettings.energy}
                    onChange={(e) => handleSliderChange("energy", parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70 font-medium tracking-wide uppercase text-[11px]">Confidence Accent</span>
                    <span className="text-amber-400 font-bold font-mono">{voiceSettings.confidence}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceSettings.confidence}
                    onChange={(e) => handleSliderChange("confidence", parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70 font-medium tracking-wide uppercase text-[11px]">Vocal Expressiveness</span>
                    <span className="text-amber-400 font-bold font-mono">{voiceSettings.expressiveness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceSettings.expressiveness}
                    onChange={(e) => handleSliderChange("expressiveness", parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70 font-medium tracking-wide uppercase text-[11px]">Natural Pause</span>
                    <span className="text-amber-400 font-bold font-mono">{voiceSettings.naturalPause}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceSettings.naturalPause}
                    onChange={(e) => handleSliderChange("naturalPause", parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Live Audio Preview Input and Trigger */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
          <h3 className="text-xs font-mono text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <AudioLines size={12} /> Test Vocal Engine Preview
          </h3>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Enter text to preview Jayuki's voice..."
            />
            <button
              onClick={handlePreview}
              disabled={isPlayingPreview || !previewText.trim()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all text-sm disabled:opacity-50 shrink-0"
            >
              <Play size={16} fill="currentColor" />
              <span>{isPlayingPreview ? "PLAYING..." : "PLAY PREVIEW"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer controls */}
      <div className="mt-6 border-t border-amber-500/10 pt-4 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0 bg-black/10">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <Info size={14} className="text-amber-500" />
          <span>Active: <strong className="text-white/85">{voiceSettings.useBrowserSpeech ? `Browser synthesis (${voiceSettings.browserVoiceName || "Default"})` : `Gemini Voice (${voiceSettings.geminiVoiceName})`}</strong></span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleRestoreDeveloperDefault}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 text-xs font-bold border border-white/10 transition-all"
            title="Restore back to Aman's default configuration"
          >
            <RotateCcw size={14} />
            <span>Developer Default</span>
          </button>

          <button
            onClick={onOpenBehaviorStudio}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-amber-500/30 rounded-xl font-bold text-amber-400 text-sm tracking-wide"
          >
            <ArrowLeft size={16} />
            <span>🎭 BEHAVIOR STUDIO</span>
          </button>

          <button
            onClick={onClose}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-all text-sm tracking-wider shadow-lg shadow-amber-500/10"
          >
            <Check size={16} />
            <span>SAVE & APPLY</span>
          </button>
        </div>
      </div>
    </div>
  );
}
