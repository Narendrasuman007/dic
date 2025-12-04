export interface ExampleSentence {
  type: 'Easy' | 'Moderate' | 'Advanced';
  sentence: string;
}

export interface WordData {
  id?: string;
  word: string;
  partOfSpeech: string; // e.g. "Noun", "Verb"
  hindiMeaning: string;
  ipa: string;
  simplePhonetics: string;
  morphology?: string; // e.g. "bio (life) + logy (study of)"
  synonyms?: string[];
  antonyms?: string[];
  examples: ExampleSentence[];
  userCustomSentence?: string;
  dateAdded?: number;
}

export interface ChatMessage {
  id?: string;
  sender?: string;
  role: 'user' | 'model' | 'system';
  text: string;
  isWordShare?: boolean;
  sharedWord?: WordData;
  timestamp?: number;
}

export enum ViewState {
  LOOKUP = 'LOOKUP',
  DAILY = 'DAILY',
  MY_LIST = 'MY_LIST',
  NEWS = 'NEWS',
  CHAT = 'CHAT',
  COMMUNITY = 'COMMUNITY'
}

export interface DailyTask {
  date: string; // YYYY-MM-DD
  words: WordData[];
}