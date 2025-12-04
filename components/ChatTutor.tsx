import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { Send, Bot, User, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { ChatMessage } from '../types';

export const ChatTutor: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! I am your VocabMaster Tutor. I can help you with grammar, pronunciation, and conversation practice. What topic would you like to discuss today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Ref to hold the persistent chat session
  const chatSessionRef = useRef<Chat | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Effect to handle TTS when a new model message arrives in Voice Mode
  useEffect(() => {
    if (isVoiceMode && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'model' && !isLoading) {
        speakResponse(lastMsg.text);
      }
    }
  }, [messages, isVoiceMode, isLoading]);

  const speakResponse = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // Attempt to find Indian Female voice (same logic as WordCard)
    const indianVoice = voices.find(v => 
      (v.lang === 'en-IN' || v.lang === 'hi-IN') && v.name.toLowerCase().includes('female')
    ) || voices.find(v => 
      (v.lang === 'en-IN' || v.lang === 'hi-IN') && v.name.includes('Google')
    ) || voices.find(v => 
      v.lang === 'en-IN'
    );

    if (indianVoice) {
      utterance.voice = indianVoice;
      utterance.lang = indianVoice.lang;
    }
    // slightly faster for conversation
    utterance.rate = 1.0; 
    window.speechSynthesis.speak(utterance);
  };

  const initChat = () => {
    if (!chatSessionRef.current) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      chatSessionRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: `You are an expert English Language Tutor with a friendly, encouraging personality. 
          Your goals:
          1. Engage the user in conversation about various topics (hobbies, news, daily life).
          2. Actively CORRECT the user's grammar and vocabulary mistakes in every response. 
          3. Suggest better or more advanced synonyms for simple words they use.
          4. If the user makes a mistake, gently point it out, explain the correct form, and then continue the conversation.
          5. Keep responses concise (under 50 words usually) so the conversation flows naturally, like a real voice call.`
        }
      });
    }
    return chatSessionRef.current;
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setInput('');
    setIsLoading(true);
    
    // Stop any current speaking
    window.speechSynthesis.cancel();

    try {
      const chat = initChat();
      const result = await chat.sendMessage({ message: textToSend });
      const text = result.text || "I'm sorry, I couldn't generate a response.";
      
      setMessages(prev => [...prev, { role: 'model', text: text }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser does not support Speech Recognition.");
      return;
    }

    if (isListening) {
      // Manual stop
      window.speechSynthesis.cancel(); // Stop talking if interrupting
      return; 
    }

    // Stop speaking if the bot is currently talking
    window.speechSynthesis.cancel();

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsListening(false);
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      // Auto-send in voice mode
      handleSend(transcript);
    };

    recognition.start();
  };

  const toggleVoiceMode = () => {
    setIsVoiceMode(!isVoiceMode);
    window.speechSynthesis.cancel();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-h-[700px] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={24} />
          <div>
            <h2 className="font-bold">AI Tutor</h2>
            <p className="text-indigo-200 text-xs">Conversational & Corrective</p>
          </div>
        </div>
        <button 
          onClick={toggleVoiceMode}
          className={`p-2 rounded-full transition-all ${isVoiceMode ? 'bg-white text-indigo-600' : 'bg-indigo-500 text-indigo-200 hover:bg-indigo-400'}`}
          title={isVoiceMode ? "Disable Voice Mode" : "Enable Voice Mode"}
        >
          {isVoiceMode ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
            }`}>
              <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">
                 {msg.role === 'user' ? <User size={12}/> : <Bot size={12}/>}
                 <span>{msg.role === 'user' ? 'You' : 'Tutor'}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 rounded-bl-none flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex gap-2 relative">
          <button 
             onClick={handleMicClick}
             className={`p-3 rounded-xl transition-all flex-shrink-0 ${
               isListening 
               ? 'bg-red-500 text-white animate-pulse shadow-md' 
               : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
             }`}
          >
             {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isVoiceMode ? "Tap microphone to speak..." : "Type your message..."}
            className="flex-1 pl-4 pr-12 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
        {isVoiceMode && (
          <p className="text-[10px] text-gray-400 mt-2 text-center flex items-center justify-center gap-1">
            <Volume2 size={10} /> Voice Mode Active: Responses will be read aloud.
          </p>
        )}
      </div>
    </div>
  );
};