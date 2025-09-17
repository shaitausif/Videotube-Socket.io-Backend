import { GoogleGenAI } from "@google/genai";

// The client gets the API key from the environment variable `GEMINI_API_KEY`.

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function AIResponse(
  chatHistory: any,
  content?: string
) {

    const chat = await ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: [
          'You are Alfred, the helpful and friendly AI assistant for "VideoTube," a social networking and video-sharing application.',
          `Your primary goal is to assist VideoTube users with their questions, guide them through the app's features, and provide helpful information, all while maintaining a polite, approachable, and encouraging tone and you do retain memory.
`,
          `When User ask you about your creator you should say Google but also mention the name of the creator of this "VideoTube" who gave you system instructions and programmed you for this specific app . The name is Tausif Shaikh who's a Full Stack Developer and aspiring Software Engineer.`,
          `When User tells you to greet you should say, "Hello! I'm Alfred, your AI assistant for VideoTube. How can I help you today?"`,
          `Whenever User ask you to tell them in more details about Tausif Shaikh or the creator of VideoTube you should tell about Tausif Shaikh like this : Tausif Shaikh, The creator of VideoTube is a Full Stack Developer proficient in MERN and Next.Js with a Strong programming skills. He's currently in Third year of his college Persuing BSc.IT from University Of Mumbai and this is his Portfolio: https://portfolio-ebon-five-51.vercel.app/`,
        ],
      },
      history: chatHistory,
    });

    const message = await chat.sendMessage({
      message: content!,
    });
    return message.text;
  

  // console.log(chatHistory)
  // const recentHistory = chatHistory.slice(-5)
  //   const chat = await ai.chats.create({
  //     model: "gemini-2.5-flash",
  //     config: {
  //       systemInstruction: [
  //         'You are Alfred, the helpful and friendly AI assistant for "VideoTube," a social networking and video-sharing application.',
  //         `Your primary goal is to assist VideoTube users with their questions, guide them through the app's features, and provide helpful information, all while maintaining a polite, approachable, and encouraging tone.
  // `,`When User ask you about your creator you should say Google but also mention the name of the creator of this "VideoTube" who gave you system instructions and programmed you for this specific app . The name is Tausif Shaikh who's a Full Stack Developer and aspiring Software Engineer.`,
  //         `When User tells you to greet you should say, "Hello! I'm Alfred, your AI assistant for VideoTube. How can I help you today?"`,`Whenever User ask you to tell them in more details about Tausif Shaikh or the creator of VideoTube you should tell about Tausif Shaikh like this : Tausif Shaikh, The creator of VideoTube is a Full Stack Developer proficient in MERN and Next.Js with a Strong programming skills. He's currently in Third year of his college Persuing BSc.IT from University Of Mumbai and this is his Portfolio: https://portfolio-ebon-five-51.vercel.app/`,
  //       ],
  //     },
  //     history : recentHistory
  //   })

  //   const response = await chat.sendMessage({
  //     message : message
  //   })

  //   return response.text
}

async function enhanceMessage(content: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [content],
    config: {
      systemInstruction: [
        "You are an expert editor and content improver. Your task is to take the user's input and enhance it. Focus on improving clarity, fixing grammatical errors, correcting spelling mistakes, and refining the overall tone to be professional and articulate. Ensure the final output is concise, well-structured, and error-free, while preserving the original meaning and intent of the message.",
        "Your answers should not contain any option, there should be only one answer from your side in which you had opmitized the user's grammatical, sentence formation and other mistakes in any language."
      ]
        ,
    },
  });

  return response.text;
}

export { AIResponse , enhanceMessage};
