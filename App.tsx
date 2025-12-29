
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateAIResponse, generateImage } from './services/gemini';
import { ChatMessage, Role } from './types';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Audio & Speech References
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  // Load History
  useEffect(() => {
    const saved = localStorage.getItem('mk_ai_history');
    if (saved) {
      setMessages(JSON.parse(saved));
    }
    
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSendMessage(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }

    synthesisRef.current = window.speechSynthesis;
  }, []);

  // Save History
  useEffect(() => {
    localStorage.setItem('mk_ai_history', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const speak = (text: string) => {
    if (!synthesisRef.current) return;
    synthesisRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Find a good voice or default
    const voices = synthesisRef.current.getVoices();
    utterance.voice = voices.find(v => v.name.includes('Google') || v.lang.startsWith('en')) || null;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    synthesisRef.current.speak(utterance);
  };

  const applyWatermark = async (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);

        ctx.drawImage(img, 0, 0);

        // Styling Watermark
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        
        // Top Left
        ctx.font = `${Math.floor(canvas.width * 0.05)}px sans-serif`;
        ctx.fillText('MK', 40, 60 + Math.floor(canvas.width * 0.05));

        // Bottom Right
        ctx.font = `${Math.floor(canvas.width * 0.03)}px sans-serif`;
        const text = 'Created with MK';
        const metrics = ctx.measureText(text);
        ctx.fillText(text, canvas.width - metrics.width - 40, canvas.height - 40);

        resolve(canvas.toDataURL('image/png'));
      };
    });
  };

  const handleSendMessage = async (text?: string) => {
    const content = text || input;
    if (!content.trim() && !uploadedImage) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
      image: uploadedImage || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setUploadedImage(null);
    setIsTyping(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const response = await generateAIResponse(content, history, userMessage.image);

      if (response && response.includes("GENERATING_IMAGE:")) {
        const imagePrompt = response.split("GENERATING_IMAGE:")[1].trim();
        const rawImg = await generateImage(imagePrompt);
        if (rawImg) {
          const watermarked = await applyWatermark(rawImg);
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Master, here is the image for: "${imagePrompt}"`,
            timestamp: Date.now(),
            generatedImage: watermarked
          };
          setMessages(prev => [...prev, aiMessage]);
          speak(aiMessage.content);
        }
      } else {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response || "Something went wrong, but I'm still the strongest.",
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMessage]);
        speak(aiMessage.content);
      }
    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I faced a temporary glitch, but my power remains absolute. Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem('mk_ai_history');
  };

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `MK_AI_Generated_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-50 relative overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20">
            MK
          </div>
          <h1 className="text-xl font-bold tracking-tight">MK AI</h1>
        </div>
        <button 
          onClick={clearHistory}
          className="text-xs font-medium text-slate-400 hover:text-red-400 transition-colors bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800"
        >
          Clear Memory
        </button>
      </header>

      {/* Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 md:px-12 lg:px-24 space-y-6"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-2">
              <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">The Ultimate AI Experience</h2>
            <p className="max-w-md text-slate-400">Ask me anything, upload images, or speak your mind. I understand Hindi, English, and complex logic.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
              {['"Generate a lion with a crown"', '"Explain quantum physics in Hinglish"', '"Analyze this image for me"', '"What is your source code?"'].map((p, i) => (
                <button 
                  key={i} 
                  onClick={() => setInput(p.replace(/"/g, ''))}
                  className="p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all text-left text-slate-300"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
          >
            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' 
                : 'bg-slate-900 border border-slate-800 text-slate-200'
            }`}>
              {msg.image && (
                <img src={msg.image} alt="Upload" className="rounded-lg mb-3 max-h-60 w-full object-cover border border-white/10" />
              )}
              {msg.generatedImage && (
                <div className="relative group mb-3">
                  <img src={msg.generatedImage} alt="Generated" className="rounded-lg w-full border border-white/10" />
                  <button 
                    onClick={() => downloadImage(msg.generatedImage!)}
                    className="absolute top-2 right-2 p-2 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-slate-900 border border-slate-800 text-slate-400 px-4 py-2 rounded-full text-xs font-medium">
              MK AI is thinking...
            </div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-4 md:px-12 lg:px-24 bg-slate-950 border-t border-slate-800">
        <div className="relative max-w-4xl mx-auto flex items-end gap-3">
          {/* Action Buttons Group */}
          <div className="flex flex-col gap-2 pb-1">
            <label className="cursor-pointer p-3 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all text-slate-400 hover:text-white shadow-xl shadow-black/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <button 
              onClick={toggleListening}
              className={`p-3 rounded-full transition-all shadow-xl shadow-black/20 ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>

          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-2 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all shadow-2xl shadow-black/40">
            {uploadedImage && (
              <div className="mb-2 relative inline-block pl-2 pt-2">
                <img src={uploadedImage} alt="Preview" className="w-16 h-16 object-cover rounded-xl border border-white/10" />
                <button 
                  onClick={() => setUploadedImage(null)}
                  className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1 text-white shadow-lg shadow-red-500/30"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            )}
            <div className="flex items-center">
              <textarea 
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={isListening ? "Listening..." : "Message MK AI..."}
                className="flex-1 bg-transparent border-none focus:ring-0 text-slate-100 px-4 py-2 resize-none max-h-32 text-sm md:text-base placeholder-slate-500"
              />
              <button 
                onClick={() => handleSendMessage()}
                disabled={isTyping || (!input.trim() && !uploadedImage)}
                className="p-2 mr-1 rounded-2xl bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-white transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-center mt-3 text-slate-600 font-medium tracking-wide">
          Powered by Mohtashim Khan • AI may generate images with watermarks.
        </p>
      </footer>

      {/* Overlay for Voice Pulse */}
      {isListening && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className="w-64 h-64 rounded-full bg-indigo-500/10 animate-pulse-slow flex items-center justify-center">
            <div className="w-48 h-48 rounded-full bg-indigo-500/20 animate-pulse flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-indigo-500/30 flex items-center justify-center">
                <svg className="w-16 h-16 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
