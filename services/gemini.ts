import { GoogleGenAI, Type } from "@google/genai";
import { WordData } from "../types";

// NOTE: In a real production app, this should be proxied through a backend to hide the key.
// The prompt instructions specify utilizing process.env.API_KEY directly.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_FAST = 'gemini-2.5-flash';

// Schema for a single word detail
const wordSchema = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING },
    partOfSpeech: { type: Type.STRING, description: "Part of speech (e.g. Noun, Verb, Adjective)." },
    hindiMeaning: { type: Type.STRING, description: "The most accurate Hindi meaning in Devanagari script." },
    ipa: { type: Type.STRING, description: "International Phonetic Alphabet pronunciation." },
    simplePhonetics: { type: Type.STRING, description: "Simple phonetic spelling for beginners (e.g. 'sim-pul')." },
    morphology: { type: Type.STRING, description: "Etymology or morphological breakdown (e.g. 'Root: Bene (good) + Fit (make)')." },
    synonyms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3-4 synonyms." },
    antonyms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3-4 antonyms." },
    examples: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["Easy", "Moderate", "Advanced"] },
          sentence: { type: Type.STRING }
        }
      }
    }
  },
  required: ["word", "partOfSpeech", "hindiMeaning", "ipa", "simplePhonetics", "morphology", "synonyms", "antonyms", "examples"]
};

export const GeminiService = {
  /**
   * Look up a single word to get details.
   */
  lookupWord: async (word: string): Promise<WordData> => {
    const ai = getAI();
    const prompt = `Analyze the English word '${word}' for a Hindi-speaking user.
    Provide the part of speech, Hindi meaning, IPA, simple phonetics, morphological breakdown, synonyms, antonyms, and 3 example sentences (Easy, Moderate, Advanced).
    Ensure the Hindi meaning is accurate and commonly used.`;

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: wordSchema,
        temperature: 0.3,
      }
    });

    if (!response.text) throw new Error("No response from AI");
    return JSON.parse(response.text) as WordData;
  },

  /**
   * Generate a list of 20 modern/advanced words.
   */
  generateDailyWords: async (): Promise<WordData[]> => {
    const ai = getAI();
    const prompt = `Generate a list of 20 distinct, modern, and advanced English vocabulary words (CEFR Level B2-C2) that are useful for professional or academic contexts.
    For each word, provide the full detailed breakdown (part of speech, Hindi meaning, IPA, phonetics, morphology, synonyms, antonyms, examples).`;

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: wordSchema
        },
        temperature: 0.7,
      }
    });

    if (!response.text) throw new Error("No response from AI");
    return JSON.parse(response.text) as WordData[];
  },

  /**
   * Generate a news article using specific words.
   */
  generateNewsArticle: async (words: string[]): Promise<{ headline: string, content: string }> => {
    const ai = getAI();
    const wordListStr = words.join(", ");
    const prompt = `Write a short, engaging news article (approx 200-250 words) about a current topic in Technology, Science, or Environment.
    You MUST naturally incorporate the following vocabulary words into the story: [${wordListStr}].
    
    IMPORTANT: When you use one of the requested words in the text, wrap it in double asterisks, e.g. **word**.
    
    Return JSON with 'headline' and 'content' fields.`;

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            content: { type: Type.STRING }
          }
        }
      }
    });

    if (!response.text) throw new Error("No response from AI");
    return JSON.parse(response.text);
  }
};