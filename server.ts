import express from "express";
import * as googleTTS from "google-tts-api";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  console.log("Server starting. GEMINI_API_KEY presence:", !!process.env.GEMINI_API_KEY);

  // Gemini API client
  const getGeminiClient = (userApiKey?: string) => {
    // If userApiKey is an empty string or explicitly 'undefined'/'null' string from client
    const cleanUserKey = (userApiKey && userApiKey !== "null" && userApiKey !== "undefined") ? userApiKey : null;
    const apiKey = cleanUserKey || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please provide it in the app Settings or ensure the environment variable is configured.");
    }
    return new GoogleGenAI({ apiKey });
  };

  // COOP/COEP Headers for ffmpeg.wasm
  app.use((req, res, next) => {
    res.header("Cross-Origin-Embedder-Policy", "require-corp");
    res.header("Cross-Origin-Opener-Policy", "same-origin");
    next();
  });

  // API to detect emotions using Gemini
  app.post("/api/detect-emotions", async (req, res) => {
    try {
      const { batch, emotionList, userApiKey } = req.body;
      const activeAi = getGeminiClient(userApiKey);
      
      const prompt = `Analyze the following Khmer subtitle lines and detect the most appropriate emotion, tone, and speaking style for each.
Valid emotions: ${emotionList}.
Return the result as a JSON array of objects, each with exactly: 'id' (number), 'emotions' (string[]), 'tone' (string), 'energy' (0-1), 'speed' (0-1).
Do not include any prose, ONLY the JSON array.

Subtitles:
${batch.map((s: any) => `ID: ${s.id}\nText: ${s.text}`).join('\n\n')}`;

      const result = await activeAi.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      res.json({ text: result.text || "" });
    } catch (error: any) {
      console.error("Emotion detection error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // API to generate audio using Gemini TTS
  app.post("/api/generate-gemini-audio", async (req, res) => {
    try {
      const { prompt, voiceName, userApiKey } = req.body;
      const activeAi = getGeminiClient(userApiKey);

      const response = await activeAi.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('No audio data received from Gemini');
      }

      res.json({ base64Audio });
    } catch (error: any) {
      console.error("Gemini TTS error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // API to generate free TTS via Google Translate API
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, lang = "km" } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      // Convert the text to audio base64 parts using google-tts-api
      // It handles texts longer than 200 characters natively by splitting
      const results = await googleTTS.getAllAudioBase64(text, {
        lang: lang,
        slow: false,
        host: "https://translate.google.com",
        timeout: 10000,
      });

      // return array of base64 chunks
      res.json({ results });
    } catch (error: any) {
      console.error("TTS generation error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
