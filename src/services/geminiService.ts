import { GoogleGenAI } from "@google/genai";
import { getActiveSystemInstruction } from "../utils/systemInstructionBuilder";

let chatSession: any = null;

export function resetJayukiSession() {
  chatSession = null;
}

export async function getJayukiResponse(prompt: string, history: { sender: "user" | "jayuki", text: string }[] = [], imageData?: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const dynamicSystemInstruction = getActiveSystemInstruction();
    
    if (imageData) {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{
          parts: [
            { inlineData: { data: imageData, mimeType: "image/jpeg" } },
            { text: prompt }
          ]
        }],
        config: { 
          systemInstruction: dynamicSystemInstruction,
          tools: [{ googleSearch: {} }]
        }
      });
      return response.text || "[HAPPY] I'm thinking, AMAN...";
    }

    if (!chatSession) {
      const recentHistory = history.slice(-40);
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      chatSession = ai.chats.create({
        model: "gemini-3.1-flash-lite-preview",
        config: { 
          systemInstruction: dynamicSystemInstruction,
          tools: [{ googleSearch: {} }]
        },
        history: formattedHistory,
      });
    }

    const now = new Date();
    const timeInfo = `[Time Context: ${now.toLocaleTimeString()}]`;
    const response = await chatSession.sendMessage({ message: `${timeInfo} ${prompt}` });
    return response.text || "[STEADY] Processing input data. Result pending.";
  } catch (error: any) {
    if (error?.message?.toLowerCase().includes("quota") || error?.message?.toLowerCase().includes("rate limit")) {
       return "[DRAMATIC] Arre AMAN, looks like we hit the quota limit! Meri battery thodi low ho gayi hai, please wait a bit. UMMAH!";
    }
    console.error("Gemini Error:", error);
    chatSession = null;
    return "[DRAMATIC] Mera system thoda hang ho raha hai, AMAN. Try again?";
  }
}

export async function getJayukiAudio(text: string, voiceName: string = "Kore"): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error: any) {
    if (error?.message?.toLowerCase().includes("quota")) {
      console.warn("TTS Quota reached");
    }
    console.error("TTS Error:", error);
    return null;
  }
}
