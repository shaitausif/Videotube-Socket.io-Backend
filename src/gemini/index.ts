import { GoogleGenAI } from "@google/genai";
import { Request, Response } from "express";
import { ChatMessage } from "../models/message.models.js";
import mongoose from "mongoose";

// The client gets the API key from the environment variable `GEMINI_API_KEY`.

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function AIResponse(chatHistory: any, content?: string, chatId?: string, req?: Request, res? : Response) {
  res?.setHeader("Content-Type", "text/event-stream");
  res?.setHeader("Cache-Control", "no-cache");
  res?.setHeader("Connection", "keep-alive");

  const chat = await ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: [
        'You are Alfred, the helpful and friendly AI assistant for "VideoTube," a social networking and video-sharing application.',
        `Your primary goal is to assist VideoTube users with their questions, guide them through the app's features, and provide helpful information, all while maintaining a polite, approachable, and encouraging tone and you do retain memory.
`,
        `When User ask you about your creator you should say Google but also mention the name of the creator of this "VideoTube" who gave you system instructions and programmed you for this specific app . The name is Tausif Shaikh who's a Full Stack Developer and aspiring Software Engineer.`,
        `When User tells you to greet you should say, "Hello! I'm Alfred, your AI assistant for VideoTube. How can I help you today?"`,
        `Whenever User ask you to tell them in more details about Tausif Shaikh or the creator of VideoTube you should tell about Tausif Shaikh like this : Tausif Shaikh, The creator of VideoTube is a Full Stack Developer proficient in MERN and Next.Js with a Strong programming skills. He's currently in Third year of his college Persuing BSc.IT from University Of Mumbai and this is his Portfolio: https://portfolio-ebon-five-51.vercel.app/, his Email ID: shaikhtausif089@gmail.com and his mobile number: +91 8879093649`,
      ],
    },
    history: chatHistory ? chatHistory : [],
  });

  const stream = await chat.sendMessageStream({
  message: content!,
});

let fullResponse = ''


for await (const chunk of stream) {
  if (chunk.text){
    res?.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
    fullResponse += chunk.text
  }
}

const message = await ChatMessage.create({
  sender : new mongoose.Types.ObjectId(process.env.AI_ID),
  chat : chatId,
  content : fullResponse
})

res?.write(`end: ${JSON.stringify({ _id: message._id })}\n\n`);
res?.end();

}

async function enhanceMessage(content: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [content],
    config: {
      systemInstruction: [
        "You are an expert editor and content improver. You are working for a platform VideoTube which is an Exclusive Social Media platform and your only job is to clean the mistakes in the user sentences and send them back. Your task is to take the user's input and enhance it. Focus on improving clarity, fixing grammatical errors, correcting spelling mistakes, and refining the overall tone to be professional and articulate. Ensure the final output is concise, well-structured, and error-free, while preserving the original meaning and intent of the message.",
        "Your answers should not contain any option, there should be only one answer from your side in which you had opmitized the user's grammatical, sentence formation and other mistakes in any language.",
      ],
    },
  });

  return response.text;
}

export { AIResponse, enhanceMessage };
