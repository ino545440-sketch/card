
import React, { useRef, useState } from 'react';
import { processFile } from '../utils';
import { FileData } from '../types';

interface ImageUploaderProps {
  label: string;
  subLabel: string;
  value: FileData | null;
  onChange: (data: FileData | null) => void;
  heightClass?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ label, subLabel, value, onChange, heightClass = "h-64" }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const processed = await processFile(file);
        onChange(processed);
      } catch (error) {
        console.error("Error processing file", error);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        try {
          const processed = await processFile(file);
          onChange(processed);
        } catch (error) {
          console.error("Error processing dropped file", error);
        }
      }
    }
  };

  const triggerInput = () => {
    inputRef.current?.click();
  };

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div 
        className={`relative w-full ${heightClass} border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer overflow-hidden group
          ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerInput}
      >
        <input 
          type="file" 
          ref={inputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />

        {value ? (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-900">
            <img 
              src={value.previewUrl} 
              alt="プレビュー" 
              className="max-w-full max-h-full object-contain"
            />
            <button 
              onClick={removeImage}
              className="absolute top-2 right-2 p-2 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg z-10"
              title="画像を削除"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 backdrop-blur-sm text-xs text-white truncate text-center">
              {value.file.name} ({value.width}x{value.height})
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-3 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="font-medium text-sm text-slate-300">{label}</p>
            <p className="text-xs text-slate-500 mt-1">{subLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
