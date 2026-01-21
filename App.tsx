
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GamePhase, LogEntry } from './types';
import { DebugLog } from './components/DebugLog';
import { PulseMonitor } from './components/PulseMonitor';

const QUESTIONS = [
  "Heute schon gelogen?",
  "KI für Hausarbeit genutzt?",
  "Gestern pünktlich gewesen?",
  "Lügt dein Partner gerade?",
  "Bereit für die Wahrheit?"
];

declare global {
  interface Window {
    io: any;
  }
}

const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.DISCLAIMER);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [p1Bpm, setP1Bpm] = useState<number>(0);
  const [p2Bpm, setP2Bpm] = useState<number>(0);
  const [p1Ans, setP1Ans] = useState<string | null>(null);
  const [p2Ans, setP2Ans] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(15);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState(QUESTIONS[0]);
  const [isHardwareConnected, setIsHardwareConnected] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<any>(null);

  const addLog = useCallback((msg: string) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 4),
      msg,
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setLogs(prev => [newLog, ...prev].slice(0, 10));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') setShowPreview(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    const socket = window.io ? window.io(`http://${host}:5000`) : null;
    socketRef.current = socket;

    if (socket) {
      socket.on('connect', () => { setIsHardwareConnected(true); addLog("SVR_OK"); });
      socket.on('hardware_input', (data: {player: number, val: string}) => { handleAnswer(data.player, data.val); });
      socket.on('live_pulse', (data: {p1: number, p2: number}) => { setP1Bpm(data.p1); setP2Bpm(data.p2); });
      socket.on('disconnect', () => { setIsHardwareConnected(false); addLog("SVR_LOST"); });
    }
    return () => { if (socket) socket.disconnect(); };
  }, [addLog]);

  const navigatePhase = (dir: number) => {
    const phases = Object.values(GamePhase);
    const currentIndex = phases.indexOf(phase);
    setPhase(phases[(currentIndex + dir + phases.length) % phases.length]);
  };

  const handleAnswer = (player: number, val: string) => {
    addLog(`P${player}:${val.charAt(0)}`);
    if (player === 1) setP1Ans(val);
    else setP2Ans(val);
  };

  useEffect(() => {
    if (p1Ans && p2Ans && phase === GamePhase.ANSWERING) {
      const t = setTimeout(() => setPhase(GamePhase.MEASURING), 500);
      return () => clearTimeout(t);
    }
  }, [p1Ans, p2Ans, phase]);

  useEffect(() => {
    if (phase === GamePhase.MEASURING) {
      setTimer(15);
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); setPhase(GamePhase.RESULTS); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const resetGame = () => {
    setPhase(GamePhase.DISCLAIMER);
    setP1Ans(null); setP2Ans(null); setTimer(15);
    setCurrentQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 bg-[#050505]">
      <DebugLog logs={logs} />

      <button 
        onClick={() => setShowHelp(true)}
        className="fixed top-2 right-2 z-50 bg-black text-green-700 border border-green-900 w-6 h-6 flex items-center justify-center text-[10px] hover:text-green-500"
      >
        [?]
      </button>

      <div className="max-w-3xl w-full border border-green-900 p-6 bg-black z-10 flex flex-col items-center text-center shadow-md relative">
        
        <div className="absolute top-1.5 right-2 flex items-center space-x-1">
           <span className={`w-1 h-1 ${isHardwareConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
           <span className="text-[6px] text-green-900 font-bold">{isHardwareConnected ? 'LINK' : 'LOST'}</span>
        </div>

        {phase === GamePhase.DISCLAIMER && (
          <div className="space-y-4 py-2">
            <div className="text-2xl text-green-900 font-bold">[ BIO_DATA ]</div>
            <h1 className="text-3xl font-black glow-text uppercase italic tracking-tighter">Lie Detector</h1>
            
            <div className="grid grid-cols-2 gap-4 pt-2 w-full">
              <PulseMonitor label="PROB_01" bpm={p1Bpm} />
              <PulseMonitor label="PROB_02" bpm={p2Bpm} />
            </div>

            <button 
              onClick={() => navigatePhase(1)}
              className="mt-4 px-8 py-2 bg-green-900 text-black font-black rounded hover:bg-green-500 transition-colors uppercase italic text-sm"
            >
              INITIALISIEREN
            </button>
          </div>
        )}

        {phase === GamePhase.SELECTION && (
          <div className="w-full space-y-4 py-2">
            <h2 className="text-[8px] text-green-900 uppercase font-bold tracking-widest">AKTIVE_FRAGE:</h2>
            <div className="bg-green-900 text-black p-4 text-xl font-bold rounded">
              "{currentQuestion}"
            </div>
            <button onClick={() => navigatePhase(1)} className="px-6 py-2 border border-green-900 text-green-700 font-bold uppercase hover:bg-green-900 hover:text-black transition-colors text-xs">SCAN STARTEN</button>
          </div>
        )}

        {phase === GamePhase.ANSWERING && (
          <div className="w-full space-y-6 py-2">
            <h2 className="text-lg font-bold uppercase text-green-700">INPUT ERWARTET</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-3 border transition-all ${p1Ans ? 'border-green-500 bg-green-900/10' : 'border-green-900/20 opacity-30'}`}>
                <div className="text-[6px] text-green-900 mb-1 uppercase">S01</div>
                <div className="text-xl text-green-500 font-bold uppercase italic">{p1Ans || '---'}</div>
              </div>
              <div className={`p-3 border transition-all ${p2Ans ? 'border-green-500 bg-green-900/10' : 'border-green-900/20 opacity-30'}`}>
                <div className="text-[6px] text-green-900 mb-1 uppercase">S02</div>
                <div className="text-xl text-green-500 font-bold uppercase italic">{p2Ans || '---'}</div>
              </div>
            </div>
          </div>
        )}

        {phase === GamePhase.MEASURING && (
          <div className="w-full space-y-4 py-1">
            <h1 className="text-xl font-bold text-red-700 pulse-red uppercase italic">SCANNING...</h1>
            <div className="text-8xl font-black text-green-500 leading-none">{timer}</div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <PulseMonitor label="BIOMET_01" bpm={p1Bpm} color="text-red-800" />
              <PulseMonitor label="BIOMET_02" bpm={p2Bpm} color="text-red-800" />
            </div>
          </div>
        )}

        {phase === GamePhase.RESULTS && (
          <div className="space-y-4 w-full py-1">
            <h1 className="text-xl font-bold bg-green-900 text-black py-1 uppercase italic tracking-widest">PROTOKOLL</h1>
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="p-3 border border-green-900/30 rounded">
                <p className="text-[6px] text-green-900 uppercase mb-1">P1_RESULT:</p>
                <p className="text-sm font-bold mb-2 italic">"{p1Ans}"</p>
                <div className={`text-sm font-black p-1 border text-center ${Math.abs(p1Bpm - 80) > 12 ? 'text-red-700 border-red-900' : 'text-green-600 border-green-900'}`}>
                  {Math.abs(p1Bpm - 80) > 12 ? 'POSITIVE' : 'NEGATIVE'}
                </div>
              </div>
              <div className="p-3 border border-green-900/30 rounded">
                <p className="text-[6px] text-green-900 uppercase mb-1">P2_RESULT:</p>
                <p className="text-sm font-bold mb-2 italic">"{p2Ans}"</p>
                <div className={`text-sm font-black p-1 border text-center ${Math.abs(p2Bpm - 85) > 15 ? 'text-red-700 border-red-900' : 'text-green-600 border-green-900'}`}>
                  {Math.abs(p2Bpm - 85) > 15 ? 'POSITIVE' : 'NEGATIVE'}
                </div>
              </div>
            </div>
            <button onClick={resetGame} className="w-full py-2 bg-red-900 text-black font-black uppercase text-xs hover:bg-red-700">REBOOT</button>
          </div>
        )}
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95">
          <div className="bg-black border border-green-900 p-4 rounded max-w-sm w-full text-[10px]">
             <div className="flex justify-between items-center mb-4 border-b border-green-900 pb-1">
                <h3 className="font-bold text-green-700 uppercase">SYS_HELP</h3>
                <button onClick={() => setShowHelp(false)}>[X]</button>
             </div>
             <div className="space-y-2 text-green-800">
                <p>1. sudo apt update && sudo apt install nodejs npm -y</p>
                <p>2. npm install && npm run dev</p>
                <p>3. python3 app.py</p>
             </div>
             <button onClick={() => setShowHelp(false)} className="w-full mt-4 py-2 bg-green-900 text-black font-bold uppercase">CLOSE</button>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed bottom-2 right-2 p-2 bg-black border border-green-900 z-50 w-32 text-[8px]">
          <div className="flex justify-between items-center mb-1 border-b border-green-900 text-green-900 font-bold">
            <span>SIM</span>
            <button onClick={() => setShowPreview(false)}>X</button>
          </div>
          <div className="grid grid-cols-2 gap-1 mb-2">
            <button onClick={() => handleAnswer(1, 'Ja')} className="border border-green-900 p-0.5">P1_J</button>
            <button onClick={() => handleAnswer(1, 'Nein')} className="border border-green-900 p-0.5">P1_N</button>
            <button onClick={() => handleAnswer(2, 'Ja')} className="border border-green-900 p-0.5">P2_J</button>
            <button onClick={() => handleAnswer(2, 'Nein')} className="border border-green-900 p-0.5">P2_N</button>
          </div>
          <div className="flex space-x-1">
            <button onClick={() => navigatePhase(-1)} className="flex-1 border border-green-900">REV</button>
            <button onClick={() => navigatePhase(1)} className="flex-1 border border-green-900">FWD</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
