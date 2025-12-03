import React, { useState, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import { generateSwappedCard, refineCard } from './services/geminiService';
import { FileData, AspectRatio } from './types';
import { calculateClosestAspectRatio } from './utils';

const App: React.FC = () => {
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
  const WORDPRESS_SITE_URL = "https://your-wordpress-site.com";

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
    // Cast window to any to avoid type declaration conflicts if the environment already defines it
    const win = window as any;
    if (win.aistudio && win.aistudio.hasSelectedApiKey) {
      const has = await win.aistudio.hasSelectedApiKey();
      setHasKey(has);
    } else {
      // Fallback for dev environments without the special window object, 
      // or assume true if env var exists (though the instructions specify window.aistudio usage).
      // For this specific prompt requirement, we default to false if the API isn't present to force the UI flow if needed.
      setHasKey(!!process.env.API_KEY); 
    }
  };

  const handleSelectKey = async () => {
    const win = window as any;
    if (win.aistudio && win.aistudio.openSelectKey) {
      await win.aistudio.openSelectKey();
      // Assume success after closing dialog as per instructions
      setHasKey(true);
    }
  };

  const handleGenerate = async () => {
    if (!referenceCard || !characterImage) return;

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    setRefinementPrompt(""); // Reset refinement input on new generation

    try {
      const resultImageUrl = await generateSwappedCard({
        referenceImage: referenceCard,
        characterImage: characterImage,
        characterName: characterName,
        userInstructions: userInstructions,
        aspectRatio: targetAspectRatio,
      });
      setGeneratedImage(resultImageUrl);
    } catch (err: any) {
      if (err.toString().includes("Requested entity was not found")) {
         setHasKey(false);
         setError("APIキーのセッションが期限切れか無効です。キーを再選択してください。");
      } else {
        setError("画像の生成に失敗しました。もう一度お試しください。" + (err.message || ""));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!generatedImage || !refinementPrompt.trim()) return;

    setIsRefining(true);
    setError(null);

    try {
      const refinedImageUrl = await refineCard(generatedImage, refinementPrompt, targetAspectRatio);
      setGeneratedImage(refinedImageUrl);
      setRefinementPrompt(""); // Clear prompt after successful refinement
    } catch (err: any) {
      if (err.toString().includes("Requested entity was not found")) {
         setHasKey(false);
         setError("APIキーのセッションが期限切れか無効です。キーを再選択してください。");
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

  // ----------------------------------------------------------------------
  // Render: API Key Selection
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
          <h1 className="text-2xl font-bold text-white mb-3">APIキーが必要です</h1>
          <p className="text-slate-400 mb-8">
            高品質なNano Banana Pro (Gemini 3 Pro)モデルを使用して画像を生成するには、Google Cloud Projectの有効なAPIキーを接続する必要があります。
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/25"
          >
            APIキーを選択
          </button>
          <div className="mt-6 text-xs text-slate-500">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-slate-300">
              お支払い情報について
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
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">
                CardSwap <span className="text-xs font-normal text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 ml-1">NanoBananaPro</span>
              </h1>
            </div>
          </div>
          <button 
            onClick={handleSelectKey}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            アカウント切り替え
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
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <strong>エラー:</strong> {error}
              </div>
            )}

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
                    <div className="flex gap-2">
                        <textarea
                            value={refinementPrompt}
                            onChange={(e) => setRefinementPrompt(e.target.value)}
                            placeholder="例: 背景をもう少し暗くして、青い炎のエフェクトを追加して"
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isProcessing}
                        />
                        <button
                            onClick={handleRefine}
                            disabled={!refinementPrompt.trim() || isProcessing}
                            className={`
                              px-6 font-semibold rounded-xl transition-all flex flex-col items-center justify-center min-w-[100px]
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