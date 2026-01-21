
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') setShowPreview(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    const socket = window.io ? window.io(`http://${host}:5000`, {
        transports: ['websocket', 'polling']
    }) : null;
    socketRef.current = socket;

    if (socket) {
      socket.on('connect', () => { 
        setIsHardwareConnected(true); 
        addLog("WS_CONNECTED");
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
        addLog("WS_DISCONNECTED"); 
      });
    }
    return () => { if (socket) socket.disconnect(); };
  }, [addLog]);

  const handleAnswer = (player: number, val: string) => {
    addLog(`P${player}_BTN: ${val.toUpperCase()}`);
    if (player === 1) setP1Ans(val);
    else setP2Ans(val);
  };

  useEffect(() => {
    if (p1Ans && p2Ans && phase === GamePhase.ANSWERING) {
      addLog("SEQ_START_MEASURE");
      const t = setTimeout(() => setPhase(GamePhase.MEASURING), 1000);
      return () => clearTimeout(t);
    }
  }, [p1Ans, p2Ans, phase, addLog]);

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
    addLog("REBOOT_INIT");
    setPhase(GamePhase.DISCLAIMER);
    setP1Ans(null); 
    setP2Ans(null); 
    setTimer(15);
    setCurrentQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 bg-[#050505] overflow-hidden">
      <DebugLog logs={logs} />

      {/* Grid Background Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-10 bg-[linear-gradient(to_right,#00ff0011_1px,transparent_1px),linear-gradient(to_bottom,#00ff0011_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      <div className="max-w-3xl w-full border-2 border-green-900/50 p-10 bg-black/90 z-10 flex flex-col items-center text-center shadow-[0_0_50px_rgba(0,255,0,0.1)] relative rounded-lg">
        
        {/* Hardware Status Indicator */}
        <div className="absolute top-4 right-6 flex items-center space-x-3 bg-black/50 px-3 py-1 rounded-full border border-green-900/30">
           <div className="flex flex-col items-end">
             <span className="text-[7px] text-green-900 font-bold tracking-tighter uppercase leading-none">Uplink Status</span>
             <span className="text-[9px] text-green-500 font-mono leading-none">{isHardwareConnected ? 'STABLE' : 'SEARCHING...'}</span>
           </div>
           <div className={`w-2.5 h-2.5 rounded-full ${isHardwareConnected ? 'bg-green-500 shadow-[0_0_8px_#00ff00]' : 'bg-red-600 animate-ping'}`}></div>
        </div>

        {phase === GamePhase.DISCLAIMER && (
          <div className="space-y-10 py-6 animate-in fade-in zoom-in duration-700">
            <div className="space-y-2">
              <div className="text-[10px] text-green-800 font-black tracking-[0.5em] uppercase">Security Level 4 Authorization</div>
              <h1 className="text-6xl font-black glow-text uppercase italic tracking-tighter leading-none">
                Lügen<span className="text-green-800">detektor</span>
              </h1>
              <div className="text-xs text-green-900 font-bold uppercase tracking-widest">Biometrisches Erfassungs-System</div>
            </div>
            
            <div className="grid grid-cols-2 gap-10 w-full max-w-lg mx-auto">
              <PulseMonitor label="Subject_Alpha" bpm={p1Bpm} color="#00ff00" />
              <PulseMonitor label="Subject_Beta" bpm={p2Bpm} color="#00ff00" />
            </div>

            <button 
              onClick={() => navigatePhase(1)}
              className="group relative px-16 py-4 bg-green-900 text-black font-black rounded-sm hover:bg-green-400 transition-all hover:scale-105 active:scale-95 uppercase italic text-xl shadow-[0_0_20px_rgba(0,255,0,0.2)]"
            >
              Starten
              <span className="absolute -bottom-6 left-0 w-full text-[8px] text-green-900 opacity-0 group-hover:opacity-100 transition-opacity">Confirm System Access</span>
            </button>
          </div>
        )}

        {phase === GamePhase.SELECTION && (
          <div className="w-full space-y-10 py-6 animate-in slide-in-from-bottom duration-500">
            <h2 className="text-xs text-green-700 uppercase font-black tracking-[0.4em] animate-pulse">Konfiguration der Test-Matrix</h2>
            <div className="relative group">
                <div className="absolute -inset-1 bg-green-500/10 blur rounded"></div>
                <div className="relative bg-black border-2 border-green-900/50 text-green-400 p-12 text-3xl font-black rounded italic shadow-2xl">
                  "{currentQuestion}"
                </div>
            </div>
            <div className="flex space-x-6 justify-center">
                <button 
                    onClick={() => {
                        const next = QUESTIONS[(QUESTIONS.indexOf(currentQuestion) + 1) % QUESTIONS.length];
                        setCurrentQuestion(next);
                        addLog("Q_ROTATED");
                    }}
                    className="px-6 py-3 border border-green-900 text-green-900 text-[10px] font-black hover:border-green-500 hover:text-green-500 transition-all tracking-widest uppercase"
                >
                    Nächste Frage
                </button>
                <button 
                    onClick={() => navigatePhase(1)} 
                    className="px-12 py-3 bg-green-900 text-black font-black uppercase hover:bg-green-400 transition-colors text-sm shadow-lg shadow-green-900/20"
                >
                    Bestätigen
                </button>
            </div>
          </div>
        )}

        {phase === GamePhase.ANSWERING && (
          <div className="w-full space-y-12 py-6">
            <div className="space-y-2">
                <h2 className="text-3xl font-black uppercase text-green-500 italic tracking-widest">Input-Phase</h2>
                <div className="text-[10px] text-green-900 uppercase font-bold tracking-[0.2em]">Warten auf Probanden-Rückmeldung</div>
            </div>
            <div className="grid grid-cols-2 gap-10 w-full">
              <div className={`p-10 border-4 transition-all duration-500 ${p1Ans ? 'border-green-500 bg-green-500/10 scale-105' : 'border-green-900/20 opacity-30 grayscale'}`}>
                <div className="text-[8px] text-green-900 mb-4 uppercase font-black tracking-widest">Alpha_State</div>
                <div className="text-4xl text-green-500 font-black uppercase italic tracking-tighter">{p1Ans || 'Waiting'}</div>
              </div>
              <div className={`p-10 border-4 transition-all duration-500 ${p2Ans ? 'border-green-500 bg-green-500/10 scale-105' : 'border-green-900/20 opacity-30 grayscale'}`}>
                <div className="text-[8px] text-green-900 mb-4 uppercase font-black tracking-widest">Beta_State</div>
                <div className="text-4xl text-green-500 font-black uppercase italic tracking-tighter">{p2Ans || 'Waiting'}</div>
              </div>
            </div>
          </div>
        )}

        {phase === GamePhase.MEASURING && (
          <div className="w-full space-y-8 py-2 animate-in fade-in duration-1000">
            <h1 className="text-3xl font-black text-red-600 pulse-red uppercase italic tracking-[0.3em]">Analyse läuft</h1>
            <div className="relative py-4">
                <div className="text-[140px] font-black text-green-500 leading-none tabular-nums shadow-text italic tracking-tighter">
                {timer}
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-red-900/20 rounded-full animate-ping pointer-events-none"></div>
            </div>
            <div className="grid grid-cols-2 gap-10 w-full mt-4 bg-red-900/5 p-4 rounded border border-red-900/20">
              <PulseMonitor label="Realtime_S_01" bpm={p1Bpm} color="#ff0000" />
              <PulseMonitor label="Realtime_S_02" bpm={p2Bpm} color="#ff0000" />
            </div>
          </div>
        )}

        {phase === GamePhase.RESULTS && (
          <div className="space-y-8 w-full py-4 animate-in zoom-in-95 duration-700">
            <h1 className="text-3xl font-black bg-green-900 text-black py-3 px-12 uppercase italic tracking-tighter inline-block shadow-xl">Ergebnisanalyse</h1>
            
            <div className="grid grid-cols-2 gap-8 text-left">
              {[
                { label: 'Alpha', ans: p1Ans, bpm: p1Bpm, base: 80 },
                { label: 'Beta', ans: p2Ans, bpm: p2Bpm, base: 85 }
              ].map((p, i) => (
                <div key={i} className="p-6 border-2 border-green-900/30 bg-black shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-1 bg-green-900 text-[6px] font-bold text-black uppercase">Data_Node_{i+1}</div>
                  <p className="text-[9px] text-green-900 uppercase mb-3 font-black tracking-widest">Proband {p.label}</p>
                  <p className="text-2xl font-black mb-6 italic text-green-400 group-hover:text-green-200 transition-colors">"{p.ans}"</p>
                  <div className={`text-sm font-black p-4 border-2 text-center uppercase tracking-widest transition-all ${Math.abs(p.bpm - p.base) > 15 ? 'text-red-500 border-red-900 bg-red-900/20 animate-pulse' : 'text-green-500 border-green-900 bg-green-500/10'}`}>
                    {Math.abs(p.bpm - p.base) > 15 ? 'Lüge Detektiert' : 'Glaubwürdig'}
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={resetGame} 
              className="mt-10 px-16 py-4 bg-red-900 text-black font-black uppercase text-lg hover:bg-red-500 transition-all hover:scale-105 shadow-2xl shadow-red-900/40 italic"
            >
              System Reset
            </button>
          </div>
        )}
      </div>

      {showPreview && (
        <div className="fixed bottom-6 right-6 p-6 bg-black/95 border-2 border-green-900 z-50 w-56 shadow-[0_0_50px_rgba(0,0,0,1)] rounded-sm">
          <div className="flex justify-between items-center mb-6 border-b border-green-900 pb-2 text-green-500 font-black text-[10px] tracking-widest uppercase">
            <span>Simulation</span>
            <button onClick={() => setShowPreview(false)} className="hover:text-red-500 transition-colors px-2">X</button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => handleAnswer(1, 'Ja')} className="border border-green-900/50 p-2 text-[10px] font-bold hover:bg-green-900 hover:text-black transition-all">P1_JA</button>
            <button onClick={() => handleAnswer(1, 'Nein')} className="border border-green-900/50 p-2 text-[10px] font-bold hover:bg-green-900 hover:text-black transition-all">P1_NEIN</button>
            <button onClick={() => handleAnswer(2, 'Ja')} className="border border-green-900/50 p-2 text-[10px] font-bold hover:bg-green-900 hover:text-black transition-all">P2_JA</button>
            <button onClick={() => handleAnswer(2, 'Nein')} className="border border-green-900/50 p-2 text-[10px] font-bold hover:bg-green-900 hover:text-black transition-all">P2_NEIN</button>
          </div>
          <div className="flex space-x-3">
            <button onClick={() => navigatePhase(-1)} className="flex-1 border border-green-900/30 p-2 text-[8px] font-black hover:border-green-500">BACK</button>
            <button onClick={() => navigatePhase(1)} className="flex-1 border border-green-900/30 p-2 text-[8px] font-black hover:border-green-500">NEXT</button>
          </div>
        </div>
      )}

      {/* CRT Scanline Effect */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%]"></div>
    </div>
  );
};

export default App;
