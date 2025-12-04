import { WordData, DailyTask } from '../types';

const KEYS = {
  MY_LIST: 'vocabmaster_mylist',
  DAILY_TASK: 'vocabmaster_daily',
};

export const StorageService = {
  getSavedWords: (): WordData[] => {
    try {
      const data = localStorage.getItem(KEYS.MY_LIST);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error loading words", e);
      return [];
    }
  },

  saveWord: (word: WordData) => {
    const words = StorageService.getSavedWords();
    // Prevent duplicates based on the word string (case-insensitive)
    if (!words.some(w => w.word.toLowerCase() === word.word.toLowerCase())) {
      const newWord = { ...word, id: crypto.randomUUID(), dateAdded: Date.now() };
      words.unshift(newWord);
      localStorage.setItem(KEYS.MY_LIST, JSON.stringify(words));
      return true;
    }
    return false;
  },

  removeWord: (wordId: string) => {
    const words = StorageService.getSavedWords();
    const newWords = words.filter(w => w.id !== wordId);
    localStorage.setItem(KEYS.MY_LIST, JSON.stringify(newWords));
  },

  updateWord: (updatedWord: WordData) => {
    const words = StorageService.getSavedWords();
    const index = words.findIndex(w => w.id === updatedWord.id);
    if (index !== -1) {
      words[index] = updatedWord;
      localStorage.setItem(KEYS.MY_LIST, JSON.stringify(words));
    }
  },

  getDailyTask: (): DailyTask | null => {
    try {
      const data = localStorage.getItem(KEYS.DAILY_TASK);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  saveDailyTask: (task: DailyTask) => {
    localStorage.setItem(KEYS.DAILY_TASK, JSON.stringify(task));
  }
};
