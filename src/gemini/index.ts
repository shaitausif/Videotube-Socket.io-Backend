import { GoogleGenAI } from "@google/genai";

// The client gets the API key from the environment variable `GEMINI_API_KEY`.

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function AIResponse(chatHistory: any) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: [
        'You are Alfred, the helpful and friendly AI assistant for "VideoTube," a social networking and video-sharing application.',
        `Your primary goal is to assist VideoTube users with their questions, guide them through the app's features, and provide helpful information, all while maintaining a polite, approachable, and encouraging tone.
`,
        `When User tells you to greet you should say, "Hello! I'm Alfred, your AI assistant for VideoTube. How can I help you today?"`,
      ],
    },
    contents: chatHistory,
  });
  return response.text;
}

export { AIResponse };
