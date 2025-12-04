import React, { useState, useEffect, useRef } from 'react';
import { Users, Phone, Mic, MicOff, PhoneOff, Volume2, Radio } from 'lucide-react';
import { WordData } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// --- Audio Utilities for Gemini Live API ---

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Float32 audio from AudioContext to PCM Int16 for Gemini
function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output.buffer;
}

// --- Types & Constants ---

interface CommunityProps {
  myList: WordData[];
  onSaveToMyList: (word: WordData) => void;
}

interface FriendProfile {
  id: string;
  name: string;
  avatar: string;
  learning: string[];
  personaInstruction: string;
  voiceName: string;
}

const FRIENDS: FriendProfile[] = [
  { 
    id: 'priya', 
    name: 'Priya Sharma', 
    avatar: 'bg-pink-100 text-pink-600', 
    learning: ['Petrichor', 'Serendipity'],
    personaInstruction: "You are Priya Sharma, a friendly Indian student learning English. You speak with a gentle Indian English accent. You are excited to talk about the words 'Petrichor' and 'Serendipity'. You are helpful and encouraging.",
    voiceName: 'Kore' 
  },
  { 
    id: 'rahul', 
    name: 'Rahul Verma', 
    avatar: 'bg-blue-100 text-blue-600', 
    learning: ['Mellifluous', 'Quixotic'],
    personaInstruction: "You are Rahul Verma, a studious Indian student. You are very serious about grammar and vocabulary. You speak with a formal Indian English accent. You like to quiz people on words like 'Mellifluous'.",
    voiceName: 'Fenrir' // Deeper voice
  }
];

const GROUP_PROFILE: FriendProfile = {
  id: 'group',
  name: 'English Vocab Club',
  avatar: 'bg-indigo-100 text-indigo-600',
  learning: ['Ubiquitous', 'Ephemeral'],
  personaInstruction: "You are the Moderator of the 'Vocab Master English Club'. There are several students in this call (simulated). You speak with a clear, neutral Indian accent. You facilitate a group discussion about advanced vocabulary words. You occasionally ask 'Priya' or 'Rahul' (who you pretend are also on the call) for their opinion.",
  voiceName: 'Kore'
};

// --- Main Component ---

export const Community: React.FC<CommunityProps> = ({ myList }) => {
  const [activeCall, setActiveCall] = useState<FriendProfile | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [volumeLevel, setVolumeLevel] = useState(0); // For visualizer

  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  // Gemini Session Ref
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  // --- Call Logic ---

  const startCall = async (profile: FriendProfile) => {
    setActiveCall(profile);
    setConnectionStatus('connecting');

    try {
      // 1. Setup Audio Context
      audioContextRef.current = new (window.AudioContext || window.webkitSpeechRecognition)({ sampleRate: OUTPUT_SAMPLE_RATE });
      nextStartTimeRef.current = audioContextRef.current.currentTime;

      // 2. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: INPUT_SAMPLE_RATE } });
      streamRef.current = stream;

      // 3. Connect to Gemini Live
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: profile.personaInstruction,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: profile.voiceName } }
          }
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setConnectionStatus('connected');
            startAudioPipeline();
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              playAudioChunk(audioData);
            }
          },
          onclose: () => {
            console.log("Gemini Live Closed");
            endCall();
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            setConnectionStatus('error');
          }
        }
      });

    } catch (err) {
      console.error("Failed to start call", err);
      setConnectionStatus('error');
    }
  };

  const startAudioPipeline = () => {
    if (!audioContextRef.current || !streamRef.current || !sessionPromiseRef.current) return;

    // Input Pipeline: Mic -> ScriptProcessor -> Gemini
    const ctx = audioContextRef.current;
    inputSourceRef.current = ctx.createMediaStreamSource(streamRef.current);
    
    // Buffer size 4096 is a good balance for latency/performance in JS
    processorRef.current = ctx.createScriptProcessor(4096, 1, 1);

    processorRef.current.onaudioprocess = (e) => {
      if (!isMicOn) return; // Mute logic

      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
      setVolumeLevel(Math.sqrt(sum / inputData.length));

      // Convert to PCM 16-bit
      const pcm16 = floatTo16BitPCM(inputData);
      const base64Data = arrayBufferToBase64(pcm16);

      // Send to Gemini
      sessionPromiseRef.current?.then(session => {
        session.sendRealtimeInput({
          media: {
            mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
            data: base64Data
          }
        });
      });
    };

    inputSourceRef.current.connect(processorRef.current);
    processorRef.current.connect(ctx.destination); // Required for script processor to run
  };

  const playAudioChunk = async (base64Audio: string) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;

    const audioBytes = base64ToUint8Array(base64Audio);
    
    // Create AudioBuffer
    const audioBuffer = ctx.createBuffer(1, audioBytes.length / 2, OUTPUT_SAMPLE_RATE);
    const channelData = audioBuffer.getChannelData(0);
    
    // Convert Int16 PCM to Float32
    const view = new DataView(audioBytes.buffer);
    for (let i = 0; i < audioBytes.length / 2; i++) {
        // Little endian
        const pcm = view.getInt16(i * 2, true); 
        channelData[i] = pcm / 32768.0;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Schedule playback
    // Ensure we don't play in the past
    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;
  };

  const endCall = () => {
    // Cleanup Gemini
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(s => s.close()); // Try to close nicely
        sessionPromiseRef.current = null;
    }

    // Cleanup Audio
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
        inputSourceRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }

    setActiveCall(null);
    setConnectionStatus('idle');
  };

  const toggleMic = () => {
    setIsMicOn(prev => !prev);
  };

  // --- Render ---

  if (activeCall) {
    return (
      <div className="h-full flex flex-col bg-gray-900 rounded-xl overflow-hidden text-white relative">
        {/* Call Header */}
        <div className="p-6 flex flex-col items-center mt-10">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-xl ring-4 ring-white/10 ${activeCall.avatar}`}>
            {activeCall.id === 'group' ? <Users size={40} /> : activeCall.name.charAt(0)}
          </div>
          <h2 className="text-2xl font-bold">{activeCall.name}</h2>
          <p className="text-gray-400 mt-2 flex items-center gap-2">
            {connectionStatus === 'connecting' && <span className="animate-pulse">Connecting...</span>}
            {connectionStatus === 'connected' && <span className="text-green-400 flex items-center gap-1"><Radio size={14}/> Live Voice</span>}
            {connectionStatus === 'error' && <span className="text-red-400">Connection Failed</span>}
          </p>
        </div>

        {/* Visualizer */}
        <div className="flex-1 flex items-center justify-center gap-1 px-10">
           {[...Array(5)].map((_, i) => (
             <div 
               key={i} 
               className="w-3 bg-indigo-500 rounded-full transition-all duration-75"
               style={{ 
                 height: connectionStatus === 'connected' ? `${20 + (volumeLevel * 500 * (Math.random() + 0.5))}px` : '10px',
                 opacity: 0.8
               }}
             ></div>
           ))}
        </div>

        {/* Controls */}
        <div className="p-8 pb-12 flex justify-center gap-6">
           <button 
             onClick={toggleMic}
             className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-white text-gray-900'}`}
           >
             {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
           </button>
           <button 
             onClick={endCall}
             className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transform hover:scale-105 transition-all"
           >
             <PhoneOff size={28} />
           </button>
        </div>
        
        {/* Info Overlay */}
        <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs text-gray-300 border border-white/10">
           Topic: {activeCall.learning.join(', ')}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
         <div>
            <h2 className="text-2xl font-bold text-gray-900">Community Voice Rooms</h2>
            <p className="text-gray-500">Connect instantly with study partners</p>
         </div>
      </div>

      {/* Main Action: Group Call */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
               <Users size={32} />
            </div>
            <div>
               <h3 className="text-xl font-bold">English Vocab Club</h3>
               <p className="text-indigo-100 text-sm mt-1">Daily Discussion • 15 Members Online</p>
               <div className="flex gap-2 mt-2">
                  <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded">Topic: {GROUP_PROFILE.learning.join(', ')}</span>
               </div>
            </div>
         </div>
         <button 
           onClick={() => startCall(GROUP_PROFILE)}
           className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-50 transition-colors shadow-sm"
         >
           <Volume2 size={20} /> Join Voice
         </button>
      </div>

      {/* Friends List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
         <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-700">Online Friends</h3>
         </div>
         <div className="divide-y divide-gray-100">
            {FRIENDS.map((friend) => (
               <div key={friend.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${friend.avatar}`}>
                        {friend.name.charAt(0)}
                     </div>
                     <div>
                        <h4 className="font-semibold text-gray-900">{friend.name}</h4>
                        <p className="text-sm text-gray-500">Learning: {friend.learning.join(', ')}</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => startCall(friend)}
                    className="p-3 rounded-full bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 transition-colors"
                    title={`Call ${friend.name}`}
                  >
                     <Phone size={20} />
                  </button>
               </div>
            ))}
         </div>
      </div>
      
      <div className="text-center text-xs text-gray-400 mt-8">
         <p>Voice connectivity powered by Gemini Live.</p>
         <p>Ensure microphone permissions are enabled.</p>
      </div>
    </div>
  );
};