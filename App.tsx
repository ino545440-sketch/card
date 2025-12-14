
import React, { useState, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import { generateSwappedCard, refineCard } from './services/geminiService';
import { FileData, AspectRatio } from './types';
import { calculateClosestAspectRatio } from './utils';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>("");
  const [hasKey, setHasKey] = useState<boolean>(false);
  
  const [referenceCard, setReferenceCard] = useState<FileData | null>(null);
  const [characterImage, setCharacterImage] = useState<FileData | null>(null);
  const [characterName, setCharacterName] = useState<string>("");
  const [userInstructions, setUserInstructions] = useState<string>("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [targetAspectRatio, setTargetAspectRatio] = useState<AspectRatio>("3:4");
  
  const [refinementPrompt, setRefinementPrompt] = useState<string>("");

  // WordPress site URL (Replace with your actual WordPress URL)
  const WORDPRESS_SITE_URL = "https://gcxxblog.com/";

  // Cost estimation constants
  const COST_PER_IMAGE_USD = 0.04; // Estimated cost for Gemini 3 Pro Image
  const EXCHANGE_RATE = 150; // JPY per USD
  const costInYen = Math.ceil(COST_PER_IMAGE_USD * EXCHANGE_RATE);

  useEffect(() => {
    checkApiKey();
  }, []);

  // Update target aspect ratio when reference card changes
  useEffect(() => {
    if (referenceCard) {
      const closest = calculateClosestAspectRatio(referenceCard.width, referenceCard.height);
      setTargetAspectRatio(closest);
    }
  }, [referenceCard]);

  const checkApiKey = async () => {
    const win = window as any;
    
    // 1. Check if running in AI Studio environment
    if (win.aistudio && win.aistudio.hasSelectedApiKey) {
      const has = await win.aistudio.hasSelectedApiKey();
      if (has) {
        setHasKey(true);
        if (process.env.API_KEY) {
          setApiKey(process.env.API_KEY);
        }
        return;
      }
    } 

    // 2. Check LocalStorage for manually saved key (Deployed environment)
    const storedKey = localStorage.getItem("gemini_api_key");
    if (storedKey) {
      setApiKey(storedKey);
      setHasKey(true);
      return;
    }

    // 3. Fallback: No key found
    setHasKey(false);
  };

  const handleSelectKeyAIStudio = async () => {
    const win = window as any;
    if (win.aistudio && win.aistudio.openSelectKey) {
      await win.aistudio.openSelectKey();
      setHasKey(true);
      if (process.env.API_KEY) {
        setApiKey(process.env.API_KEY);
      }
    }
  };

  const handleManualKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple validation: check if not empty.
    if (apiKey.trim().length > 0) {
      localStorage.setItem("gemini_api_key", apiKey.trim());
      setHasKey(true);
    } else {
      setError("有効なAPIキーを入力してください。");
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem("gemini_api_key");
    setApiKey("");
    setHasKey(false);
  };

  const handleGenerate = async () => {
    if (!referenceCard || !characterImage) return;

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    setRefinementPrompt(""); 

    // Determine which key to use. 
    // In AI Studio: process.env.API_KEY might be set. 
    // In deployed app: apiKey state is set.
    const effectiveKey = apiKey || process.env.API_KEY;

    if (!effectiveKey) {
        setError("APIキーが見つかりません。");
        setIsLoading(false);
        setHasKey(false);
        return;
    }

    try {
      const resultImageUrl = await generateSwappedCard(effectiveKey, {
        referenceImage: referenceCard,
        characterImage: characterImage,
        characterName: characterName,
        userInstructions: userInstructions,
        aspectRatio: targetAspectRatio,
      });
      setGeneratedImage(resultImageUrl);
    } catch (err: any) {
      if (err.toString().includes("Requested entity was not found") || err.toString().includes("403") || err.toString().includes("401")) {
         // API Key issue
         // FIX: Use (window as any) to avoid TypeScript error about 'aistudio' property
         if (!(window as any).aistudio) {
            localStorage.removeItem("gemini_api_key");
            setHasKey(false);
            setError("APIキーが無効です。再度入力してください。");
         } else {
             // Even in AI Studio, allow retry if key fails
             setHasKey(false);
             setError("APIキーのセッションが期限切れか無効です。キーを再設定してください。");
         }
      } else {
        setError("画像の生成に失敗しました。もう一度お試しください。\n" + (err.message || ""));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!generatedImage || !refinementPrompt.trim()) return;

    setIsRefining(true);
    setError(null);

    const effectiveKey = apiKey || process.env.API_KEY;

    if (!effectiveKey) {
        setError("APIキーが見つかりません。");
        setIsRefining(false);
        return;
    }

    try {
      const refinedImageUrl = await refineCard(effectiveKey, generatedImage, refinementPrompt, targetAspectRatio);
      setGeneratedImage(refinedImageUrl);
      setRefinementPrompt(""); 
    } catch (err: any) {
        // Error handling similar to generate
        if (err.toString().includes("Requested entity was not found")) {
             localStorage.removeItem("gemini_api_key");
             setHasKey(false);
             setError("APIキーが無効です。");
        } else {
            setError("微調整に失敗しました。" + (err.message || ""));
        }
    } finally {
      setIsRefining(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `swapped-card-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isProcessing = isLoading || isRefining;
  const isAIStudio = !!(window as any).aistudio;

  // ----------------------------------------------------------------------
  // Render: API Key Selection / Input
  // ----------------------------------------------------------------------
  if (!hasKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">APIキー設定</h1>
          <p className="text-slate-400 mb-8">
            画像を生成するにはGemini APIキーが必要です。<br/>
            <span className="text-xs text-slate-500">※無料枠のAPIキーでもご利用いただけます。</span>
          </p>
          
          {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {error}
              </div>
          )}

          {/* 常に手動入力を表示する */}
          <form onSubmit={handleManualKeySubmit} className="flex flex-col gap-4">
              <input 
                  type="password" 
                  placeholder="Gemini API Key (例: AIza...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
              <button
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/25"
              >
                  利用を開始する
              </button>
              <div className="text-xs text-slate-500 mt-2">
                  入力されたキーはブラウザにのみ保存され、サーバーには送信されません。
              </div>
          </form>

          {/* AI Studio環境の場合の補助ボタン */}
          {isAIStudio && (
            <>
              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink-0 mx-4 text-slate-600 text-xs">または</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>
              <button
                  onClick={handleSelectKeyAIStudio}
                  className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium rounded-xl transition-all text-sm"
              >
                  AI Studioのキーを選択
              </button>
            </>
          )}

          <div className="mt-6 text-xs text-slate-500">
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-slate-300">
              APIキーを取得 (Google AI Studio)
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // Render: Main Application
  // ----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500/30 font-sans">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a 
              href={WORDPRESS_SITE_URL}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-slate-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              サイトに戻る
            </a>
            <div className="h-6 w-px bg-slate-700"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 block">
                CardSwap <span className="text-xs font-normal text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 ml-1 hidden sm:inline-block">NanoBananaPro</span>
              </h1>
            </div>
          </div>
          <button 
            onClick={handleClearKey}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            APIキー変更
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-140px)]">
          
          {/* LEFT PANEL: Inputs */}
          <div className="w-full lg:w-1/2 flex flex-col gap-6">
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
                参考カードデザイン
              </h2>
              <ImageUploader 
                label="参考カードをドロップ" 
                subLabel="スタイル、枠、背景の基準になります。"
                value={referenceCard} 
                onChange={setReferenceCard}
                heightClass="h-72"
              />
              {referenceCard && (
                <div className="mt-2 flex justify-between items-center text-xs text-slate-500 px-1">
                  <span>検出された縦横比: <span className="text-blue-400 font-mono">{targetAspectRatio}</span></span>
                  <span>{referenceCard.width} x {referenceCard.height}px</span>
                </div>
              )}
            </div>

            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold">2</span>
                挿入するキャラクター
              </h2>
              <ImageUploader 
                label="キャラクター画像をドロップ" 
                subLabel="カードに入れたいキャラクター画像です。"
                value={characterImage} 
                onChange={setCharacterImage}
                heightClass="h-48"
              />
            </div>

            <div className="flex gap-4">
              <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex-1">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-sm font-bold">3</span>
                  キャラクター名 (任意)
                </h2>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder="例: 勇者スライム"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
               <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                 <span className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center text-sm font-bold">4</span>
                 ポーズ・演出の指定 (任意)
               </h2>
               <textarea
                 value={userInstructions}
                 onChange={(e) => setUserInstructions(e.target.value)}
                 placeholder="例: 剣を振り上げているポーズ、背景に雷のエフェクトを追加してください。"
                 className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all h-24 resize-none"
               />
               <p className="text-xs text-slate-500 mt-2">
                 キャラクターのポーズや画面効果について具体的な指示があれば入力してください。
               </p>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm whitespace-pre-wrap">
                <strong>エラー:</strong> {error}
              </div>
            )}

            <div>
              <button
                onClick={handleGenerate}
                disabled={!referenceCard || !characterImage || isProcessing}
                className={`
                  w-full py-4 text-lg font-bold rounded-xl shadow-lg transition-all
                  flex items-center justify-center gap-3
                  ${!referenceCard || !characterImage || isProcessing
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-[0.98]'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>生成中... (約10-20秒)</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    カードを生成
                  </>
                )}
              </button>
              <div className="text-center mt-2 text-xs text-slate-500">
                  <span className="inline-block bg-slate-800/50 px-2 py-1 rounded border border-slate-700">
                    予想コスト: 約{costInYen}円 (${COST_PER_IMAGE_USD}) / 回
                  </span>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Output */}
          <div className="w-full lg:w-1/2 flex flex-col h-full min-h-[500px]">
            <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative flex flex-col">
               <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 backdrop-blur z-10">
                 <h2 className="text-lg font-semibold text-white">生成結果</h2>
                 {generatedImage && !isProcessing && (
                    <button 
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      ダウンロード
                    </button>
                 )}
               </div>

               <div className="flex-1 p-6 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] min-h-[300px]">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-4 animate-pulse">
                      <div className="w-64 h-80 bg-slate-800/50 rounded-xl"></div>
                      <p className="text-slate-500 text-sm">画像を処理中...</p>
                    </div>
                  ) : generatedImage ? (
                    <div className="relative group">
                      <img 
                        src={generatedImage} 
                        alt="Generated Card" 
                        className={`max-w-full max-h-[50vh] lg:max-h-[55vh] rounded-lg shadow-2xl border border-slate-700/50 object-contain transition-opacity ${isRefining ? 'opacity-50' : 'opacity-100'}`}
                      />
                      {isRefining && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2">
                             <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            微調整中...
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 max-w-sm">
                       <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                       </div>
                       <p className="font-medium">画像はまだ生成されていません</p>
                       <p className="text-sm mt-2 opacity-60">参考カードとキャラクターをアップロードして、生成ボタンを押してください。</p>
                    </div>
                  )}
               </div>

               {/* Refinement Area */}
               {generatedImage && (
                  <div className="p-4 border-t border-slate-800 bg-slate-900/90 z-10">
                    <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                       </svg>
                       さらに微調整 (任意)
                    </label>
                    <div className="flex gap-2 items-start">
                        <textarea
                            value={refinementPrompt}
                            onChange={(e) => setRefinementPrompt(e.target.value)}
                            placeholder="例: 背景をもう少し暗くして、青い炎のエフェクトを追加して"
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isProcessing}
                        />
                        <div className="flex flex-col gap-1 items-center">
                            <button
                                onClick={handleRefine}
                                disabled={!refinementPrompt.trim() || isProcessing}
                                className={`
                                  px-6 h-12 font-semibold rounded-xl transition-all flex items-center justify-center min-w-[100px]
                                  ${!refinementPrompt.trim() || isProcessing
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                  }
                                `}
                            >
                                {isRefining ? (
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    "適用"
                                )}
                            </button>
                            <span className="text-[10px] text-slate-500">
                                約{costInYen}円/回
                            </span>
                        </div>
                    </div>
                  </div>
               )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
};

export default App;
