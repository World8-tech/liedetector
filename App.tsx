
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GamePhase, LogEntry } from './types';
import { DebugLog } from './components/DebugLog';
import { PulseMonitor } from './components/PulseMonitor';

const QUESTIONS = [
  "Heute schon gelogen?",
  "KI für Hausarbeit genutzt?",
  "Gestern pünktlich gewesen?",
  "Lügt dein Partner gerade?",
  "Hast du heute schon geflunkert?",
  "Prüfungsangst vorhanden?"
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

  // Hotkey 'P' für das Preview-Panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') setShowPreview(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Socket.io Verbindung
  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    // Nutze window.io (geladen via CDN in index.html)
    const socket = window.io ? window.io(`http://${host}:5000`) : null;
    socketRef.current = socket;

    if (socket) {
      socket.on('connect', () => { 
        setIsHardwareConnected(true); 
        addLog("LINK_ESTABLISHED");
      });
      
      socket.on('status', (data: {msg: string}) => {
        addLog(data.msg);
      });

      socket.on('hardware_input', (data: {player: number, val: string}) => { 
        handleAnswer(data.player, data.val); 
      });

      socket.on('live_pulse', (data: {p1: number, p2: number}) => { 
        setP1Bpm(data.p1); 
        setP2Bpm(data.p2); 
      });

      socket.on('disconnect', () => { 
        setIsHardwareConnected(false); 
        addLog("LINK_LOST"); 
      });
    }
    return () => { if (socket) socket.disconnect(); };
  }, [addLog]);

  const handleAnswer = (player: number, val: string) => {
    addLog(`P${player}_INPUT: ${val}`);
    if (player === 1) setP1Ans(val);
    else setP2Ans(val);
  };

  // Automatischer Übergang zur Messung
  useEffect(() => {
    if (p1Ans && p2Ans && phase === GamePhase.ANSWERING) {
      addLog("START_ANALYSIS");
      const t = setTimeout(() => setPhase(GamePhase.MEASURING), 1000);
      return () => clearTimeout(t);
    }
  }, [p1Ans, p2Ans, phase, addLog]);

  // Mess-Timer Logik
  useEffect(() => {
    if (phase === GamePhase.MEASURING) {
      setTimer(15);
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) { 
            if (timerRef.current) clearInterval(timerRef.current);
            setPhase(GamePhase.RESULTS); 
            return 0; 
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const navigatePhase = (dir: number) => {
    const phases = Object.values(GamePhase);
    const currentIndex = phases.indexOf(phase);
    setPhase(phases[(currentIndex + dir + phases.length) % phases.length]);
  };

  const resetGame = () => {
    addLog("SYS_REBOOT");
    setPhase(GamePhase.DISCLAIMER);
    setP1Ans(null); 
    setP2Ans(null); 
    setTimer(15);
    setCurrentQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 bg-[#050505] selection:bg-green-500 selection:text-black">
      <DebugLog logs={logs} />

      {/* Haupt-Interface */}
      <div className="max-w-3xl w-full border border-green-900 p-8 bg-black z-10 flex flex-col items-center text-center shadow-[0_0_30px_rgba(0,50,0,0.3)] relative">
        
        {/* Status-Bar */}
        <div className="absolute top-2 right-4 flex items-center space-x-2">
           <span className={`w-2 h-2 rounded-full ${isHardwareConnected ? 'bg-green-500 shadow-[0_0_5px_#00ff00]' : 'bg-red-500 animate-pulse'}`}></span>
           <span className="text-[8px] text-green-900 font-bold tracking-widest">{isHardwareConnected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        {phase === GamePhase.DISCLAIMER && (
          <div className="space-y-6 py-4 animate-in fade-in duration-500">
            <div className="text-sm text-green-900 font-bold tracking-[0.3em] uppercase opacity-50">Biometrisches Labor</div>
            <h1 className="text-5xl font-black glow-text uppercase italic tracking-tighter leading-none mb-8">
              Lügendetektor <span className="text-green-700">v1.2</span>
            </h1>
            
            <div className="grid grid-cols-2 gap-8 w-full max-w-md mx-auto">
              <PulseMonitor label="PROBAND_01" bpm={p1Bpm} />
              <PulseMonitor label="PROBAND_02" bpm={p2Bpm} />
            </div>

            <button 
              onClick={() => navigatePhase(1)}
              className="mt-12 px-12 py-3 bg-green-900 text-black font-black rounded-sm hover:bg-green-400 transition-all hover:scale-105 active:scale-95 uppercase italic text-lg shadow-lg"
            >
              System Initialisieren
            </button>
          </div>
        )}

        {phase === GamePhase.SELECTION && (
          <div className="w-full space-y-8 py-6">
            <h2 className="text-xs text-green-700 uppercase font-bold tracking-widest animate-pulse">Wähle eine Testfrage</h2>
            <div className="bg-green-900/10 border border-green-900/30 text-green-400 p-8 text-2xl font-bold rounded shadow-inner">
              "{currentQuestion}"
            </div>
            <div className="flex space-x-4 justify-center">
                <button 
                    onClick={() => setCurrentQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)])}
                    className="px-4 py-2 border border-green-900 text-green-900 text-[10px] hover:text-green-500"
                >
                    NÄCHSTE FRAGE
                </button>
                <button 
                    onClick={() => navigatePhase(1)} 
                    className="px-8 py-3 bg-green-900 text-black font-black uppercase hover:bg-green-400 transition-colors text-sm"
                >
                    Frage bestätigen
                </button>
            </div>
          </div>
        )}

        {phase === GamePhase.ANSWERING && (
          <div className="w-full space-y-10 py-6">
            <h2 className="text-xl font-bold uppercase text-green-700 tracking-widest">Warte auf Antworten...</h2>
            <div className="grid grid-cols-2 gap-8">
              <div className={`p-6 border-2 transition-all duration-300 ${p1Ans ? 'border-green-500 bg-green-900/20 scale-105' : 'border-green-900/10 opacity-40'}`}>
                <div className="text-[10px] text-green-900 mb-2 uppercase font-bold">P1_STATUS</div>
                <div className="text-3xl text-green-500 font-black uppercase italic">{p1Ans || 'HOLDING'}</div>
              </div>
              <div className={`p-6 border-2 transition-all duration-300 ${p2Ans ? 'border-green-500 bg-green-900/20 scale-105' : 'border-green-900/10 opacity-40'}`}>
                <div className="text-[10px] text-green-900 mb-2 uppercase font-bold">P2_STATUS</div>
                <div className="text-3xl text-green-500 font-black uppercase italic">{p2Ans || 'HOLDING'}</div>
              </div>
            </div>
          </div>
        )}

        {phase === GamePhase.MEASURING && (
          <div className="w-full space-y-6 py-2">
            <h1 className="text-2xl font-black text-red-600 pulse-red uppercase italic tracking-[0.2em]">Bio-Analyse läuft</h1>
            <div className="text-[120px] font-black text-green-500 leading-none tabular-nums shadow-text">
              {timer}
            </div>
            <div className="grid grid-cols-2 gap-6 w-full mt-4">
              <PulseMonitor label="SENSOR_DATA_01" bpm={p1Bpm} color="text-red-700" />
              <PulseMonitor label="SENSOR_DATA_02" bpm={p2Bpm} color="text-red-700" />
            </div>
          </div>
        )}

        {phase === GamePhase.RESULTS && (
          <div className="space-y-6 w-full py-4 animate-in zoom-in duration-500">
            <h1 className="text-2xl font-black bg-green-900 text-black py-2 px-8 uppercase italic tracking-widest inline-block mb-4">Ergebnisprotokoll</h1>
            
            <div className="grid grid-cols-2 gap-6 text-left">
              <div className="p-5 border border-green-900/50 bg-black rounded shadow-lg">
                <p className="text-[9px] text-green-900 uppercase mb-2 font-bold tracking-widest">Analyse Proband 01</p>
                <p className="text-xl font-bold mb-4 italic text-green-400">"{p1Ans}"</p>
                <div className={`text-sm font-black p-2 border-2 text-center ${Math.abs(p1Bpm - 80) > 15 ? 'text-red-600 border-red-900 bg-red-900/10' : 'text-green-500 border-green-900 bg-green-900/10'}`}>
                  {Math.abs(p1Bpm - 80) > 15 ? 'VERDÄCHTIG (LÜGE)' : 'GLAUBWÜRDIG'}
                </div>
              </div>
              <div className="p-5 border border-green-900/50 bg-black rounded shadow-lg">
                <p className="text-[9px] text-green-900 uppercase mb-2 font-bold tracking-widest">Analyse Proband 02</p>
                <p className="text-xl font-bold mb-4 italic text-green-400">"{p2Ans}"</p>
                <div className={`text-sm font-black p-2 border-2 text-center ${Math.abs(p2Bpm - 85) > 15 ? 'text-red-600 border-red-900 bg-red-900/10' : 'text-green-500 border-green-900 bg-green-900/10'}`}>
                  {Math.abs(p2Bpm - 85) > 15 ? 'VERDÄCHTIG (LÜGE)' : 'GLAUBWÜRDIG'}
                </div>
              </div>
            </div>

            <button 
              onClick={resetGame} 
              className="mt-8 px-12 py-3 bg-red-900 text-black font-black uppercase text-sm hover:bg-red-600 transition-all active:scale-95"
            >
              System Neustart
            </button>
          </div>
        )}
      </div>

      {/* Preview Simulation Panel (Taste P) */}
      {showPreview && (
        <div className="fixed bottom-4 right-4 p-4 bg-black/90 border-2 border-green-900 z-50 w-48 shadow-2xl backdrop-blur-sm">
          <div className="flex justify-between items-center mb-4 border-b border-green-900 pb-2 text-green-500 font-black text-[10px] tracking-widest">
            <span>SIMULATION</span>
            <button onClick={() => setShowPreview(false)} className="hover:text-red-500">X</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => handleAnswer(1, 'Ja')} className="border border-green-900 p-2 text-[10px] hover:bg-green-900/20">P1_JA</button>
            <button onClick={() => handleAnswer(1, 'Nein')} className="border border-green-900 p-2 text-[10px] hover:bg-green-900/20">P1_NEIN</button>
            <button onClick={() => handleAnswer(2, 'Ja')} className="border border-green-900 p-2 text-[10px] hover:bg-green-900/20">P2_JA</button>
            <button onClick={() => handleAnswer(2, 'Nein')} className="border border-green-900 p-2 text-[10px] hover:bg-green-900/20">P2_NEIN</button>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => navigatePhase(-1)} className="flex-1 border border-green-900 p-1 text-[8px] hover:bg-green-900/20">ZURÜCK</button>
            <button onClick={() => navigatePhase(1)} className="flex-1 border border-green-900 p-1 text-[8px] hover:bg-green-900/20">VOR</button>
          </div>
        </div>
      )}

      {/* Hintergrund-Effekt */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent"></div>
      </div>
    </div>
  );
};

export default App;
