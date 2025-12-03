
export interface FileData {
  file: File;
  previewUrl: string;
  base64: string;
  width: number;
  height: number;
  mimeType: string;
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export interface GenerationConfig {
  referenceImage: FileData;
  characterImage: FileData;
  characterName: string;
  userInstructions?: string;
  aspectRatio: AspectRatio;
}