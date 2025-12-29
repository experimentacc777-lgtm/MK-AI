
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const generateAIResponse = async (prompt: string, history: { role: string; content: string }[], uploadedImage?: string) => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const contents = history.map(h => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }]
  }));

  const userParts: any[] = [{ text: prompt }];
  if (uploadedImage) {
    userParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: uploadedImage.split(",")[1]
      }
    });
  }

  contents.push({
    role: "user",
    parts: userParts
  });

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: `You are MK AI, an ultra-advanced AI smarter than ChatGPT and Gemini. 
      You are witty, powerful, and intelligent. 
      You perfectly understand English, Hindi, and Hinglish. 
      Handle broken or casual language with ease. 
      If a user asks for an image, respond with "GENERATING_IMAGE: [improved prompt]". 
      Otherwise, provide a human-like, deep response. 
      Your creator is Mohtashim Khan.`,
      temperature: 0.9,
    },
  });

  return response.text;
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};
