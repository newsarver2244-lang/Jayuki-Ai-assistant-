export type AppState = "idle" | "listening" | "processing" | "speaking";
export type JayukiMood = "sassy" | "dramatic" | "happy" | "neutral";

export interface ChatMessage {
  id: string;
  sender: "user" | "jayuki";
  text: string;
}

export interface VoiceSettingsData {
  mode: 'browser' | 'gemini';
  browserVoiceName: string;
  speed: number;   // 0.5 to 2.0
  pitch: number;   // 0.5 to 2.0
  volume: number;  // 0.0 to 1.0
  geminiVoiceName: string; // e.g. "Kore", "Puck", "Charon", "Fenrir", "Aoede"
  emotion?: number;
  warmth?: number;
  energy?: number;
  confidence?: number;
  expressiveness?: number;
  naturalPause?: number;
}
