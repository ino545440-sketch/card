import { AspectRatio, FileData } from './types';

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const getImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = url;
  });
};

export const processFile = async (file: File): Promise<FileData> => {
  const dataUrl = await readFileAsDataURL(file);
  const { width, height } = await getImageDimensions(dataUrl);
  // Extract base64 data (remove "data:image/xxx;base64," prefix)
  const base64 = dataUrl.split(',')[1];
  
  return {
    file,
    previewUrl: dataUrl,
    base64,
    width,
    height,
    mimeType: file.type,
  };
};

export const calculateClosestAspectRatio = (width: number, height: number): AspectRatio => {
  const ratio = width / height;
  
  const supportedRatios: { key: AspectRatio; value: number }[] = [
    { key: "1:1", value: 1 },
    { key: "3:4", value: 3 / 4 },
    { key: "4:3", value: 4 / 3 },
    { key: "9:16", value: 9 / 16 },
    { key: "16:9", value: 16 / 9 },
  ];

  // Find the ratio with the smallest difference
  const closest = supportedRatios.reduce((prev, curr) => {
    return Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev;
  });

  return closest.key;
};
