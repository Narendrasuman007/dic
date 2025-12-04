import React, { useState } from 'react';
import { WordData } from '../types';
import { Volume2, Plus, Check, Edit2, Save, Trash2, Mic, MicOff, Share2, GitBranch, ArrowRightLeft } from 'lucide-react';

interface WordCardProps {
  data: WordData;
  isSaved?: boolean;
  onSave?: (word: WordData) => void;
  onUpdate?: (word: WordData) => void;
  onRemove?: (word: WordData) => void;
  onShare?: (word: WordData) => void;
  compact?: boolean; // If true, starts collapsed
}

export const WordCard: React.FC<WordCardProps> = ({ data, isSaved = false, onSave, onUpdate, onRemove, onShare, compact = false }) => {
  const [expanded, setExpanded] = useState(!compact);
  const [saved, setSaved] = useState(isSaved);
  const [customSentence, setCustomSentence] = useState(data.userCustomSentence || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const playAudio = (text: string) => {
    // Cancel any playing audio
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // Priority: 
    // 1. English/Hindi India + Female
    // 2. English/Hindi India + Google (Google English India is typically female)
    // 3. Any English India
    // 4. Any Hindi India
    const indianVoice = voices.find(v => 
      (v.lang === 'en-IN' || v.lang === 'hi-IN') && v.name.toLowerCase().includes('female')
    ) || voices.find(v => 
      (v.lang === 'en-IN' || v.lang === 'hi-IN') && v.name.includes('Google')
    ) || voices.find(v => 
      v.lang === 'en-IN'
    ) || voices.find(v => 
      v.lang === 'hi-IN'
    );

    if (indianVoice) {
      utterance.voice = indianVoice;
      utterance.lang = indianVoice.lang;
    } else {
      // Fallback: let browser try to match the locale
      utterance.lang = 'en-IN';
    }

    window.speechSynthesis.speak(utterance);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSave) {
      onSave(data);
      setSaved(true);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(data);
      setSaved(false);
    }
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShare) {
      onShare(data);
    }
  }

  const handleSaveCustom = () => {
    if (onUpdate) {
      onUpdate({ ...data, userCustomSentence: customSentence });
    }
    setIsEditing(false);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser does not support Speech Recognition.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

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
      setCustomSentence(transcript);
    };

    recognition.start();
  };

  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${compact && !expanded ? 'hover:shadow-md cursor-pointer' : ''}`}
      onClick={() => compact && !expanded && setExpanded(true)}
    >
      {/* Header */}
      <div className="p-5 flex items-start justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h3 className="text-2xl font-bold text-gray-900 capitalize">{data.word}</h3>
            <span className="text-sm italic font-medium text-gray-500 bg-white/60 px-2 py-0.5 rounded border border-gray-100">{data.partOfSpeech}</span>
            <span className="text-sm font-mono text-gray-400">/{data.ipa}/</span>
          </div>
          <p className="text-indigo-600 font-medium text-lg mt-1">{data.hindiMeaning}</p>
          <p className="text-xs text-gray-400 mt-1">Pronunciation: {data.simplePhonetics}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); playAudio(data.word); }}
            className="p-2 rounded-full bg-white text-indigo-600 hover:bg-indigo-100 transition-colors shadow-sm"
            title="Listen (Indian Accent)"
          >
            <Volume2 size={20} />
          </button>
          
          {onShare && (
            <button 
              onClick={handleShare}
              className="p-2 rounded-full bg-white text-blue-500 hover:bg-blue-100 transition-colors shadow-sm"
              title="Share to Community"
            >
              <Share2 size={20} />
            </button>
          )}

          {/* Action Buttons */}
          {!saved && onSave && (
            <button 
              onClick={handleSave}
              className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
              title="Add to My List"
            >
              <Plus size={20} />
            </button>
          )}
          
          {saved && onRemove && (
            <button 
              onClick={handleRemove}
              className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors shadow-sm"
              title="Remove from My List"
            >
              <Trash2 size={20} />
            </button>
          )}

          {saved && !onRemove && (
             <div className="p-2 rounded-full bg-green-100 text-green-600 shadow-sm cursor-default">
              <Check size={20} />
             </div>
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-5 space-y-5">
          
          {/* Morphology & Linguistic Data */}
          {(data.morphology || (data.synonyms && data.synonyms.length > 0) || (data.antonyms && data.antonyms.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
               {data.morphology && (
                 <div className="col-span-full">
                   <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                     <GitBranch size={12} /> Morphology (Word Structure)
                   </div>
                   <p className="text-sm text-gray-700 font-medium">{data.morphology}</p>
                 </div>
               )}
               
               {data.synonyms && data.synonyms.length > 0 && (
                 <div>
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                     <ArrowRightLeft size={12} /> Synonyms
                   </div>
                   <div className="flex flex-wrap gap-2">
                     {data.synonyms.map((syn, i) => (
                       <span key={i} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md border border-green-100">
                         {syn}
                       </span>
                     ))}
                   </div>
                 </div>
               )}

              {data.antonyms && data.antonyms.length > 0 && (
                 <div>
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                     <ArrowRightLeft size={12} /> Antonyms
                   </div>
                   <div className="flex flex-wrap gap-2">
                     {data.antonyms.map((ant, i) => (
                       <span key={i} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-md border border-red-100">
                         {ant}
                       </span>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Example Sentences</h4>
            {data.examples.map((ex, idx) => (
              <div key={idx} className="group">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 ${
                  ex.type === 'Easy' ? 'bg-green-100 text-green-700' :
                  ex.type === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {ex.type}
                </span>
                <p className="text-gray-700 leading-relaxed italic">"{ex.sentence}"</p>
              </div>
            ))}
          </div>

          {/* Custom Sentence Section */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">My Custom Sentence</h4>
              {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-indigo-500 hover:text-indigo-700">
                  <Edit2 size={14} />
                </button>
              )}
            </div>
            
            {isEditing ? (
              <div className="flex gap-2">
                 <button 
                  onClick={handleVoiceInput}
                  className={`p-2 rounded-lg border ${isListening ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-indigo-600'}`}
                  title="Speak sentence"
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <input
                  type="text"
                  value={customSentence}
                  onChange={(e) => setCustomSentence(e.target.value)}
                  placeholder="Write or speak your own sentence..."
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-200 outline-none"
                />
                <button 
                  onClick={handleSaveCustom}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Save size={16} />
                </button>
              </div>
            ) : (
              <p className="text-gray-600 text-sm">
                {customSentence || <span className="text-gray-400 italic">No custom sentence added yet.</span>}
              </p>
            )}
          </div>
          
          {compact && (
             <button 
                onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                className="w-full text-center text-xs text-gray-400 hover:text-indigo-500 mt-2"
             >
               Collapse
             </button>
          )}
        </div>
      )}
    </div>
  );
};