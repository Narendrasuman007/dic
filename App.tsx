import React, { useState, useEffect, useRef } from 'react';
import { Book, Search, Calendar, MessageCircle, Newspaper, Mic, Loader2, Sparkles, BookOpen, Users } from 'lucide-react';
import { ViewState, WordData, DailyTask } from './types';
import { GeminiService } from './services/gemini';
import { StorageService } from './services/storage';
import { WordCard } from './components/WordCard';
import { ChatTutor } from './components/ChatTutor';
import { Community } from './components/Community';

// Extended Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.LOOKUP);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lookup State
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<WordData | null>(null);
  const [isListening, setIsListening] = useState(false);
  
  // Autocomplete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Daily State
  const [dailyTask, setDailyTask] = useState<DailyTask | null>(null);

  // My List State
  const [myList, setMyList] = useState<WordData[]>([]);

  // News State
  const [newsArticle, setNewsArticle] = useState<{ headline: string, content: string } | null>(null);

  // --- Initial Data Load ---
  useEffect(() => {
    setMyList(StorageService.getSavedWords());
    setDailyTask(StorageService.getDailyTask());
  }, [view]); // Refresh when view changes (simple way to sync)

  // --- Autocomplete Effect ---
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (lookupQuery.trim().length > 1) {
        try {
          // Using Datamuse API for suggestions
          const res = await fetch(`https://api.datamuse.com/sug?s=${lookupQuery}`);
          if (res.ok) {
            const json = await res.json();
            // Take top 5 items
            setSuggestions(json.map((i: any) => i.word).slice(0, 5));
            setShowSuggestions(true);
          }
        } catch (e) {
          // Silent fail for autocomplete
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [lookupQuery]);


  // --- Handlers ---

  const handleLookup = async (queryOverride?: string) => {
    const query = queryOverride || lookupQuery;
    if (!query.trim()) return;
    
    // Hide suggestions
    setShowSuggestions(false);
    
    setLoading(true);
    setError(null);
    try {
      const data = await GeminiService.lookupWord(query);
      setLookupResult(data);
    } catch (err) {
      setError("Failed to look up word. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setLookupQuery(suggestion);
    setShowSuggestions(false);
    handleLookup(suggestion);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser does not support Speech Recognition.");
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
      setLookupQuery(transcript);
      // Optional: Auto-search after voice
      // handleLookup(); 
    };

    recognition.start();
  };

  const handleGenerateDaily = async () => {
    // check if we already have today's task
    const today = new Date().toISOString().split('T')[0];
    if (dailyTask && dailyTask.date === today) return;

    setLoading(true);
    setError(null);
    try {
      const words = await GeminiService.generateDailyWords();
      const task: DailyTask = { date: today, words };
      StorageService.saveDailyTask(task);
      setDailyTask(task);
    } catch (err) {
      setError("Failed to generate daily words.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNews = async () => {
    if (myList.length < 5) {
      setError("Please add at least 5 words to your list to generate news.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Pick 10 random words from list to keep prompt reasonable
      const shuffled = [...myList].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 10).map(w => w.word);
      const article = await GeminiService.generateNewsArticle(selected);
      setNewsArticle(article);
    } catch (err) {
      setError("Failed to generate news article.");
    } finally {
      setLoading(false);
    }
  };

  const saveToMyList = (word: WordData) => {
    if (StorageService.saveWord(word)) {
      setMyList(StorageService.getSavedWords());
      alert(`"${word.word}" added to your list!`);
    } else {
      alert("Word already in your list.");
    }
  };

  const removeFromMyList = (word: WordData) => {
    if (word.id) {
        StorageService.removeWord(word.id);
        setMyList(StorageService.getSavedWords());
    }
  };

  const updateInMyList = (word: WordData) => {
    StorageService.updateWord(word);
    setMyList(StorageService.getSavedWords());
  };

  const shareToCommunity = (word: WordData) => {
    // Since Community is a view, we need to pass data to it.
    // In this simple app, we can stash the 'pending share' in local storage and switch view.
    localStorage.setItem('vocabmaster_pending_share', JSON.stringify(word));
    setView(ViewState.COMMUNITY);
  };

  const renderContent = () => {
    switch (view) {
      case ViewState.LOOKUP:
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-4 mb-10">
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">VocabMaster AI</h1>
              <p className="text-gray-500">Multimodal dictionary for personalized learning</p>
            </div>

            <div className="relative">
              <div className="flex shadow-lg rounded-2xl overflow-visible bg-white border border-gray-100 p-1 relative z-20">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  placeholder="Type a word or use voice..."
                  className="flex-1 px-6 py-4 outline-none text-lg text-gray-700 placeholder-gray-400 rounded-l-2xl"
                  autoComplete="off"
                />
                <div className="flex items-center pr-2 gap-2">
                  <button 
                    onClick={handleVoiceInput}
                    className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:bg-gray-100'}`}
                  >
                    <Mic size={24} />
                  </button>
                  <button 
                    onClick={() => handleLookup()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Search />}
                  </button>
                </div>
                
                {/* Autocomplete Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                   <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                      {suggestions.map((s, idx) => (
                        <div 
                           key={idx}
                           onClick={() => handleSuggestionClick(s)}
                           className="px-6 py-3 hover:bg-indigo-50 cursor-pointer text-gray-700 border-b border-gray-50 last:border-none flex items-center justify-between group"
                        >
                           <span>{s}</span>
                           <Search size={14} className="text-gray-300 group-hover:text-indigo-400" />
                        </div>
                      ))}
                   </div>
                )}
              </div>
              
              {/* Click outside listener could be added here for perfection, 
                  but basic onFocus/Selection logic covers most cases */}
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center">{error}</div>}

            {lookupResult && (
              <div className="animate-fade-in-up">
                <WordCard 
                  data={lookupResult} 
                  onSave={saveToMyList} 
                  onShare={shareToCommunity}
                  isSaved={myList.some(w => w.word.toLowerCase() === lookupResult.word.toLowerCase())}
                />
              </div>
            )}
          </div>
        );

      case ViewState.DAILY:
        return (
          <div className="max-w-4xl mx-auto">
             <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Daily Challenge</h2>
                  <p className="text-gray-500">20 advanced words for today</p>
                </div>
                {(!dailyTask || dailyTask.date !== new Date().toISOString().split('T')[0]) && (
                   <button 
                    onClick={handleGenerateDaily} 
                    disabled={loading}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-indigo-200 transition-all"
                   >
                     {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                     <span>Generate Today's List</span>
                   </button>
                )}
             </div>

             {loading && !dailyTask && (
                <div className="text-center py-20">
                  <Loader2 className="animate-spin mx-auto text-indigo-500 mb-4" size={40} />
                  <p className="text-gray-500">Curating advanced vocabulary...</p>
                </div>
             )}

             {dailyTask ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {dailyTask.words.map((word, idx) => (
                   <WordCard 
                      key={idx} 
                      data={word} 
                      onSave={saveToMyList}
                      onShare={shareToCommunity}
                      isSaved={myList.some(w => w.word.toLowerCase() === word.word.toLowerCase())}
                      compact 
                    />
                 ))}
               </div>
             ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                  <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No task generated for today yet.</p>
                </div>
             )}
          </div>
        );

      case ViewState.MY_LIST:
        return (
          <div className="max-w-3xl mx-auto">
             <h2 className="text-2xl font-bold text-gray-900 mb-6">My Vocabulary List ({myList.length})</h2>
             {myList.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                  <Book size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">You haven't saved any words yet.</p>
                </div>
             ) : (
               <div className="space-y-4">
                 {myList.map((word) => (
                   <WordCard 
                      key={word.id} 
                      data={word} 
                      onUpdate={updateInMyList}
                      onRemove={removeFromMyList}
                      onShare={shareToCommunity}
                      isSaved={true}
                      compact 
                    />
                 ))}
               </div>
             )}
          </div>
        );

      case ViewState.NEWS:
        return (
          <div className="max-w-3xl mx-auto">
             <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Smart News Reader</h2>
                  <p className="text-gray-500">Contextual learning based on your list</p>
                </div>
                <button 
                  onClick={handleGenerateNews} 
                  disabled={loading || myList.length < 5}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-indigo-200 transition-all"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Newspaper size={18} />}
                  <span>Generate Article</span>
                </button>
             </div>

             {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-6">{error}</div>}

             {loading && !newsArticle && (
                <div className="text-center py-20">
                  <Loader2 className="animate-spin mx-auto text-indigo-500 mb-4" size={40} />
                  <p className="text-gray-500">Writing a story with your words...</p>
                </div>
             )}

             {newsArticle ? (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <h1 className="text-3xl font-serif font-bold text-gray-900 mb-6 leading-tight">{newsArticle.headline}</h1>
                  <div className="prose prose-lg text-gray-700 font-serif leading-relaxed">
                    {newsArticle.content.split('\n').map((para, i) => (
                      <p key={i} className="mb-4" dangerouslySetInnerHTML={{
                         // Simple bolding for **word**
                         __html: para.replace(/\*\*(.*?)\*\*/g, '<strong class="bg-yellow-100 text-yellow-800 px-1 rounded">$1</strong>')
                      }} />
                    ))}
                  </div>
                </div>
             ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                  <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Generate a news article to see your words in context.</p>
                </div>
             )}
          </div>
        );

      case ViewState.CHAT:
        return (
          <div className="max-w-2xl mx-auto">
            <ChatTutor />
          </div>
        );

      case ViewState.COMMUNITY:
        return (
          <div className="h-full">
            <Community myList={myList} onSaveToMyList={saveToMyList} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Top Nav (Mobile/Desktop Header) */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-indigo-600 text-xl cursor-pointer" onClick={() => setView(ViewState.LOOKUP)}>
            <Book className="fill-indigo-600" size={24} />
            <span>VocabMaster</span>
          </div>
          <div className="hidden md:flex gap-1">
             {/* Desktop Nav Items could go here, but using bottom bar logic for simplicity in this demo */}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {renderContent()}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50">
        <div className="max-w-xl mx-auto flex justify-around items-center h-16">
          <NavButton 
            active={view === ViewState.LOOKUP} 
            onClick={() => setView(ViewState.LOOKUP)} 
            icon={<Search size={24} />} 
            label="Lookup" 
          />
          <NavButton 
            active={view === ViewState.DAILY} 
            onClick={() => setView(ViewState.DAILY)} 
            icon={<Calendar size={24} />} 
            label="Daily" 
          />
          <NavButton 
            active={view === ViewState.MY_LIST} 
            onClick={() => setView(ViewState.MY_LIST)} 
            icon={<Book size={24} />} 
            label="My List" 
          />
          <NavButton 
            active={view === ViewState.NEWS} 
            onClick={() => setView(ViewState.NEWS)} 
            icon={<Newspaper size={24} />} 
            label="News" 
          />
          <NavButton 
            active={view === ViewState.CHAT} 
            onClick={() => setView(ViewState.CHAT)} 
            icon={<MessageCircle size={24} />} 
            label="Tutor" 
          />
           <NavButton 
            active={view === ViewState.COMMUNITY} 
            onClick={() => setView(ViewState.COMMUNITY)} 
            icon={<Users size={24} />} 
            label="Club" 
          />
        </div>
      </nav>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
  >
    {icon}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

export default App;