
import { GoogleGenAI } from "@google/genai";
import { GenerationConfig } from "../types";

export const generateSwappedCard = async (apiKey: string, config: GenerationConfig): Promise<string> => {
  // Use the provided API key
  const ai = new GoogleGenAI({ apiKey: apiKey });

  const { referenceImage, characterImage, characterName, aspectRatio, userInstructions } = config;

  const prompt = `
    画像生成タスク: トレーディングカードのキャラクター完全入れ替え

    【入力ソース】
    1. **1枚目の画像（テンプレート）**: カードの枠、背景、UIデザイン、全体の雰囲気の基準です。ここに描かれている**元のキャラクターは完全に無視・消去**してください。
    2. **2枚目の画像（新キャラクター）**: 新しくカードに登場させるキャラクターです。このキャラクターのデザイン特徴を優先してください。

    【生成ルール】
    1. **元のキャラクターの影響を排除**: 
       - 1枚目の画像にあるキャラクターのポーズ、服装、シルエット、配置場所を**絶対に模倣しないでください**。
       - あたかも最初からそのキャラクターがいなかったかのように扱い、その空間に新しいキャラクターを配置してください。
    
    2. **新キャラクターの配置とポーズ**: 
       - 2枚目の画像のキャラクターを、その固有のデザイン（髪型、服装、顔立ち）を保ったまま描画してください。
       ${userInstructions 
         ? `- **ユーザー指示（最優先）**: 「${userInstructions}」に従ってポーズ、アクション、構図を決定してください。` 
         : `- ポーズは2枚目の画像に近いものか、カードの構図として自然な独自のものにしてください（元画像のポーズに引っ張られないこと）。`
       }

    3. **背景とスタイルの維持**: 
       - カードの枠線、背景のテクスチャ、エフェクト、照明効果、カラーパレットは、1枚目の画像を忠実に再現してください。
       - 新しいキャラクターがそのカードの世界観に違和感なく溶け込むように、画風（塗り方や陰影）を調整してください。

    4. **テキストの書き換え**: 
       - カード上のキャラクター名の部分を「${characterName}」に変更してください。
       - ${characterName ? `名前は「${characterName}」と明確に、読みやすくレンダリングしてください。` : '名前テキストエリアがある場合は、自然な文字列または空欄にしてください。'}

    出力は高解像度で、指定されたアスペクト比（${aspectRatio}）の完成されたカード画像として生成してください。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType: referenceImage.mimeType,
              data: referenceImage.base64,
            },
          },
          {
            inlineData: {
              mimeType: characterImage.mimeType,
              data: characterImage.base64,
            },
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "2K", 
        },
      },
    });

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }

    // Check for text refusal/explanation
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart?.text) {
       throw new Error(`モデルからの応答 (画像生成されず): ${textPart.text}`);
    }

    throw new Error("No image data found in response");

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export const refineCard = async (apiKey: string, currentImageBase64: string, instruction: string, aspectRatio: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: apiKey });
  // Remove data URL prefix if present for the API call
  const cleanBase64 = currentImageBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

  const prompt = `
    画像編集タスク:
    入力画像をベースに、以下のユーザー指示に従って修正を加えた新しい画像を生成してください。
    
    【ユーザー指示】
    ${instruction}
    
    【編集ルール】
    1. 入力画像の構図、キャラクターの基本デザイン、カード枠のスタイルは維持してください。
    2. 指示された変更点のみを的確に反映してください。
    3. **必ず画像データを生成して返してください**。テキストによる説明や会話は不要です。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: cleanBase64,
            },
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: "2K",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    // Check for text refusal/explanation if no image found
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart?.text) {
       throw new Error(`モデルからの応答 (画像生成されず): ${textPart.text}`);
    }

    throw new Error("画像データがレスポンスに含まれていません。");
  } catch (error) {
    console.error("Gemini Refinement Error:", error);
    throw error;
  }
};
