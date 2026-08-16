import { GoogleGenAI, Modality, type Part } from "@google/genai";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

export function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GERMINI_APIKEY;
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

export async function generateStructuredJson<T>(args: {
  systemInstruction: string;
  prompt: string;
  parts?: Part[];
  schema: unknown;
}): Promise<T> {
  const ai = getGenAI();
  if (!ai) throw new Error("Gemini is not configured");
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [...(args.parts ?? []), { text: args.prompt }],
    config: {
      systemInstruction: args.systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: args.schema,
      temperature: 0.15,
    },
  });
  if (!response.text) throw new Error("Gemini returned an empty response");
  return JSON.parse(response.text) as T;
}

export async function generateImage(prompt: string) {
  const ai = getGenAI();
  if (!ai) return null;
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
  });
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((part) => part.inlineData?.data && part.inlineData.mimeType?.startsWith("image/"));
  if (!image?.inlineData?.data) return null;
  return {
    bytes: Buffer.from(image.inlineData.data, "base64"),
    mimeType: image.inlineData.mimeType ?? "image/png",
    model: IMAGE_MODEL,
  };
}

export function geminiModels() {
  return { text: TEXT_MODEL, image: IMAGE_MODEL };
}
