import { GoogleGenAI, LiveServerMessage, Modality, Type, ThinkingLevel } from "@google/genai";
import { processCommand } from "./commandService";
import { getActiveSystemInstruction } from "../utils/systemInstructionBuilder";

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private videoStream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private frameTimer: any = null;
  
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  public voiceName: string = "Kore";
  
  private isStopping: boolean = false;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "jayuki", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};
  public onMoodChange: (mood: "sassy" | "dramatic" | "happy" | "neutral") => void = () => {};
  public onUpdateHabit: (habitTitle: string, completed: boolean) => void = () => {};
  public onAddHabit: (habitTitle: string) => void = () => {};
  public onKiss: () => void = () => {};
  public onEnergyChange: (energy: number) => void = () => {};
  public onVideoStream: (stream: MediaStream | null) => void = () => {};

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.canvas = document.createElement('canvas');
    
    // Auto-reconnect when network comes back
    window.addEventListener('online', () => {
      if (this.appState === 'idle' && !this.isStopping && this.reconnectAttempts > 0) {
        console.log("Network back online, attempting reconnection...");
        this.reconnectAttempts = 0; // Reset to try immediately
        this.handleReconnection("Network recovered");
      }
    });
  }

  private get appState(): "idle" | "listening" | "processing" | "speaking" {
    // This is a bit of a hack since we don't store internal state, 
    // but we can infer it or just try to reconnect if not stopping.
    return this.isConnecting ? "processing" : (this.sessionPromise ? "listening" : "idle");
  }

  async start(videoType: 'camera' | 'screen' | 'none' = 'none', facingMode: 'user' | 'environment' = 'user') {
    if (this.sessionPromise || this.isConnecting) {
      console.warn("Session already starting or active.");
      return;
    }
    this.isStopping = false;
    this.isConnecting = true;

    try {
      this.onStateChange("processing");
      console.log("Starting Live Session...");
      
      // Initialize Audio Contexts
      if (!this.audioContext || this.audioContext.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      }
      
      if (!this.playbackContext || this.playbackContext.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
        this.nextPlayTime = this.playbackContext.currentTime;
      }

      // Check for MediaDevices support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support microphone access.");
      }

      // Get Microphone
      if (!this.mediaStream) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
            } 
          });
        } catch (mediaError: any) {
          console.error("Microphone access failed:", mediaError);
          let errorMessage = "Microphone access failed. ";
          
          if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
            errorMessage = "Microphone permission denied. Please click the lock icon in your browser's address bar to allow microphone access and then refresh the page.";
          } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
            errorMessage = "No microphone found. Please connect a microphone and try again.";
          } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError') {
            errorMessage = "Your microphone is already in use by another application. Please close other programs using the mic and try again.";
          } else {
            errorMessage += mediaError.message || "Please check your browser settings and try again.";
          }
          
          throw new Error(errorMessage);
        }
      }

      if (this.isStopping) return;

      if (!this.videoStream && videoType !== 'none') {
        if (!navigator.mediaDevices) {
          throw new Error("Media devices API is not supported in this browser, connection environment, or nested iframe.");
        }
        if (videoType === 'camera') {
          if (!navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera access (getUserMedia) is not supported in this browser, environment, or within this embedded preview.");
          }
          this.videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: 640, 
              height: 480,
              facingMode: facingMode
            } 
          });
        } else if (videoType === 'screen') {
          if (!navigator.mediaDevices.getDisplayMedia) {
            throw new Error("Screen sharing (getDisplayMedia) is not supported in this browser, environment, or within this embedded preview. Please click 'Open in new tab' at the top right of the application preview, or use Camera mode instead.");
          }
          this.videoStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }
        
        // Notify of stream initialization
        this.onVideoStream(this.videoStream);
      }

      if (this.isStopping) return;

      if (this.videoStream && !this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.srcObject = this.videoStream;
        await this.videoElement.play();
        if (this.isStopping) return;
        this.startFrameCapture();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (!this.source) {
        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.source.connect(this.analyser);
        
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

        this.processor.onaudioprocess = (e) => {
          if (!this.sessionPromise) return;
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Calculate energy for visualizer
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const energy = Math.sqrt(sum / inputData.length);
          this.onEnergyChange(energy);

          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Convert to base64
          const buffer = new ArrayBuffer(pcm16.length * 2);
          const view = new DataView(buffer);
          for (let i = 0; i < pcm16.length; i++) {
            view.setInt16(i * 2, pcm16[i], true);
          }
          
          let binary = '';
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);

          this.sessionPromise.then(session => {
            session.sendRealtimeInput({
              audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
            }).catch(() => {});
          }).catch(() => {});
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
      }

      // Connect to Live API
      console.log("Connecting to Gemini Live API...");
      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } },
          },
          systemInstruction: getActiveSystemInstruction(),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{
            functionDeclarations: [
                {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                    query: { type: Type.STRING, description: "The search query, website name, or message content." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              },
              {
                name: "updateHabit",
                description: "Update the status of a habit in the daily habit tracker. Call this when AMAN asks to check off a task or habit.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    habitTitle: { type: Type.STRING, description: "The title of the habit (e.g., 'Wake up early', 'Morning Workout')" },
                    completed: { type: Type.BOOLEAN, description: "Whether the habit is completed or not." }
                  },
                  required: ["habitTitle", "completed"]
                }
              },
              {
                name: "addHabit",
                description: "Add a new habit to the habit tracker. Call this when AMAN says 'I want to add a habit' or mentions a new routine he wants to start.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    habitTitle: { type: Type.STRING, description: "The title of the new habit to track." }
                  },
                  required: ["habitTitle"]
                }
              },
              {
                name: "getCurrentTime",
                description: "Get the current local time in India/Standard format.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            this.onStateChange("listening");
          },
          onmessage: async (message: LiveServerMessage) => {
            // Check for GoAway or session end signals specifically
            if ((message as any).serverContent?.goaway || (message as any).serverContent?.finishReason === 'SAFETY' || (message as any).serverContent?.finishReason === 'MAX_TOKENS') {
               console.log("GoAway or Finish signal received from server. Reconnecting silently...", message);
               this.handleReconnection("Server cycle end");
               return;
            }

            // Handle Audio Output / Text Transcription
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
               for (const part of parts) {
                  if (part.inlineData) {
                    this.onStateChange("speaking");
                    this.playAudioChunk(part.inlineData.data);
                  }
                  if (part.text) {
                    const text = part.text;
                    const moodMatch = text.match(/\[(SASSY|DRAMATIC|HAPPY)\]/);
                    if (moodMatch) {
                       this.onMoodChange(moodMatch[1].toLowerCase() as any);
                    }
                    if (text.toUpperCase().includes("UMMAH")) {
                      this.onKiss();
                    }
                    this.onMessage("jayuki", text);
                  }
               }
            }

            // Handle User Transcription
            const userParts = (message.serverContent as any)?.userTurn?.parts;
            if (userParts) {
               for (const part of userParts) {
                  if (part.text) {
                     this.onMessage("user", part.text);
                     // Execute command from user speech!
                     const commandResult = processCommand(part.text);
                     if (commandResult.isBrowserAction && commandResult.url) {
                        this.onCommand(commandResult.url);
                     }
                  }
               }
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else {
                    let website = args.query.replace(/\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = `https://www.${website}`;
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  }).catch(() => {});
                } else if (call.name === "updateHabit") {
                  const args = call.args as any;
                  this.onUpdateHabit(args.habitTitle, args.completed);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: `Habit '${args.habitTitle}' updated to ${args.completed ? 'completed' : 'not completed'}.` }
                       }]
                     });
                  }).catch(() => {});
                } else if (call.name === "addHabit") {
                  const args = call.args as any;
                  this.onAddHabit(args.habitTitle);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: `New habit '${args.habitTitle}' has been directly written into your mind and the habit tracker, Boss!` }
                       }]
                     });
                   }).catch(() => {});
                } else if (call.name === "getCurrentTime") {
                   const now = new Date();
                   const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                   const dateString = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                   
                   this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: `The current time is ${timeString} on ${dateString}.` }
                        }]
                      });
                   }).catch(() => {});
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
            if (!this.isStopping) {
              this.handleReconnection("Connection closed by server or network");
            }
          },
          onerror: (err: any) => {
            const errMsg = err?.message || String(err);
            console.warn("Live API Error caught:", errMsg);
            
            // Log full error for debugging
            if (err && typeof err === 'object') {
              console.log("Detailed error object:", JSON.stringify(err));
            }

            // Quota / Rate Limit Handling
            if (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("limit exceeded") || errMsg.toLowerCase().includes("429")) {
              console.warn("Jayuki Quota Limit reached - switching to safety mode.");
              this.onMessage("jayuki", "[DRAMATIC] Arre AMAN, looks like we hit a digital wall! 🚧 My brain needs a quick power nap because our access quota is exhausted. Let's talk once I've had my refill, okay? UMMAH!");
              this.onStateChange("idle");
              this.stop();
              return;
            }

            // session duration limit / GoAway handling
            if (errMsg.includes("GoAway") || errMsg.includes("session duration limit") || errMsg.includes("aborted") || errMsg.includes("failed to close")) {
              console.log("Session limit or GoAway detected. Reconnecting silently to maintain conversation flow...");
              
              // Instead of just stopping, we notify internally and reconnect
              // We only alert the user if we fail multiple times
              this.handleReconnection("Session limit / GoAway refresh");
              return;
            } else if (!navigator.onLine) {
              console.warn("Retrying because browser is offline");
              this.handleReconnection("Browser is offline");
            } else if (errMsg.includes("unavailable") || errMsg.includes("Network error") || errMsg.includes("failed to fetch") || errMsg.includes("deadline exceeded") || errMsg.includes("Unknown error") || errMsg.includes("failed to connect")) {
              console.warn("Retrying due to transient network error:", errMsg);
              this.handleReconnection(errMsg);
            } else {
              console.error("Critical Live API Error:", errMsg);
              this.onMessage("jayuki", `[DRAMATIC] Ofo AMAN, technical glitch! My system is acting like a total nakhrewali today. Error: ${errMsg.slice(0, 30)}...`);
              this.stop();
            }
          }
        }
      });

    } catch (error: any) {
      this.isConnecting = false;
      console.error("Failed to start Live Session:", error);
      const errMsg = error?.message || String(error);
      if (errMsg.includes("Permission denied") || error?.name === "NotAllowedError") {
        this.onMessage("jayuki", "[DRAMATIC] Arre AMAN! I can't hear or see you because you denied my permissions. Itna suspicious kyon ho rahe ho? Please allow access so we can gossip! UMMAH!");
        this.stop();
      } else if (errMsg.includes("getDisplayMedia") || errMsg.includes("Screen sharing") || errMsg.includes("Failed to access screen") || errMsg.includes("display-capture")) {
        console.log("Screen sharing failed or unsupported. Stopping session cleanly.");
        this.stop();
      } else if (errMsg.includes("GoAway") || errMsg.includes("aborted")) {
        console.log("Connection aborted during start. Stopping.");
        this.stop();
      } else {
        this.handleReconnection(errMsg);
      }
      throw error;
    }
  }

  private async handleReconnection(reason: string) {
    if (this.isStopping) return;
    
    if (reason.includes("Permission denied") || reason.includes("NotAllowedError")) {
      return; 
    }

    // Capture state to stop cleanly
    const prevSessionPromise = this.sessionPromise;
    this.sessionPromise = null;
    this.isConnecting = false;
    
    // Cleanup media and processors to start fresh
    if (this.processor) {
      try { this.processor.disconnect(); } catch(e) {}
      this.processor = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch(e) {}
      this.source = null;
    }

    if (prevSessionPromise) {
      try {
        // Use a timeout for closing the session to prevent hanging
        const closePromise = prevSessionPromise.then(session => {
          if (session && typeof session.close === 'function') {
            session.close();
          }
        });
        
        await Promise.race([
          closePromise,
          new Promise(resolve => setTimeout(resolve, 2000)) // 2s timeout
        ]);
      } catch (e) {
        console.warn("Error closing session during reconnection:", e);
      }
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      // If offline, wait for online event or use a longer delay
      // Use a shorter delay for initial attempts to make it feel seamless
      let delay = this.reconnectAttempts <= 3 
        ? 500 + (Math.random() * 500)
        : Math.pow(2, this.reconnectAttempts - 3) * 1000 + (Math.random() * 1000);
      
      if (!navigator.onLine) {
        delay = Math.max(delay, 5000); // At least 5s if offline
        console.log("Waiting for network to come back online...");
      }

      console.log(`Reconnecting in ${Math.round(delay)}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}). Reason: ${reason}`);
      
      this.onStateChange("processing");
      
      if ((this as any).reconnectTimer) {
        clearTimeout((this as any).reconnectTimer);
      }

      (this as any).reconnectTimer = setTimeout(() => {
        if (!this.isStopping) {
          console.log("Re-initiating Live Session start...");
          // We don't call start() directly to avoid audio context issues, 
          // we use a clean start if possible but start() handles it.
          this.start().catch(err => {
            console.error("Reconnection start failed:", err);
            this.handleReconnection(err?.message || "Reconnection failure");
          });
        }
      }, delay);
    } else {
      console.error("Max reconnection attempts exhausted.");
      this.onMessage("jayuki", "[DRAMATIC] AMAN, network ki halat bahut kharab hai! 😭 Main connect nahi kar pa rahi hoon. Ek baar page refresh kar lo na, please?");
      this.stop();
    }
  }

  private startFrameCapture() {
    this.frameTimer = setInterval(() => {
      if (this.videoElement && this.canvas && this.sessionPromise) {
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          // Optimize resolution (160x120) and compression quality (0.3) to minimize token footprint per frame
          this.canvas.width = 160;
          this.canvas.height = 120;
          ctx.drawImage(this.videoElement, 0, 0, 160, 120);
          const base64Image = this.canvas.toDataURL('image/jpeg', 0.3).split(',')[1];
          this.sessionPromise.then(session => {
            session.sendRealtimeInput({
              video: { data: base64Image, mimeType: 'image/jpeg' }
            });
          }).catch(() => {});
        }
      }
    }, 5000); // 5 seconds interval ensures long and stable sessions within token budget
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      this.playbackContext.close();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  async updateMedia(videoType: 'camera' | 'screen' | 'none', facingMode: 'user' | 'environment' = 'user') {
    if (!this.sessionPromise) {
      return this.start(videoType, facingMode);
    }

    console.log(`Updating media source to: ${videoType} with facingMode: ${facingMode}`);
    
    // Stop existing video stream
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
      this.onVideoStream(null);
    }
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement = null;
    }

    // Start new video stream if needed
    if (videoType !== 'none') {
      try {
        if (!navigator.mediaDevices) {
          throw new Error("Media devices API is not supported in this browser, connection environment, or nested iframe.");
        }
        if (videoType === 'camera') {
          if (!navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera access (getUserMedia) is not supported in this browser, environment, or within this embedded preview.");
          }
          this.videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: 640, 
              height: 480,
              facingMode: facingMode
            } 
          });
        } else if (videoType === 'screen') {
          if (!navigator.mediaDevices.getDisplayMedia) {
            throw new Error("Screen sharing (getDisplayMedia) is not supported in this browser, environment, or within this embedded preview. Please click 'Open in new tab' at the top right of the application preview, or use Camera mode instead.");
          }
          this.videoStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }

        if (this.videoStream) {
          this.videoElement = document.createElement('video');
          this.videoElement.srcObject = this.videoStream;
          await this.videoElement.play();
          this.startFrameCapture();
          this.onVideoStream(this.videoStream);
        }
      } catch (err: any) {
        console.error("Failed to update media stream:", err);
        let msg = "Failed to access " + videoType + ". ";
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg += "Permission denied. Please check your browser settings.";
        } else {
          msg += err.message || "Unknown error.";
        }
        throw new Error(msg);
      }
    }
  }

  stop() {
    this.isStopping = true;
    if (this.frameTimer) clearInterval(this.frameTimer);
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
      this.onVideoStream(null);
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.sessionPromise) {
      const p = this.sessionPromise;
      this.sessionPromise = null;
      p.then(session => {
        if (session && typeof session.close === 'function') {
          console.log("Closing session in stop()");
          session.close();
        }
      }).catch(() => {});
    }
    
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }
}
