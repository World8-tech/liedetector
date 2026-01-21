
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GamePhase, LogEntry } from './types';
import { DebugLog } from './components/DebugLog';
import { PulseMonitor } from './components/PulseMonitor';

const QUESTIONS = [
  "Hast du heute schon einmal gelogen?",
  "Hast du KI für deine Hausarbeit genutzt?",
  "Warst du gestern pünktlich?",
  "Denkst du, dein Teampartner lügt gerade?",
  "Bist du bereit für die Wahrheit?"
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
      id: Math.random().toString(36).substr(2, 9),
      msg,
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') {
        setShowPreview(prev => !prev);
        addLog(`Simulation Panel ${!showPreview ? 'aktiviert' : 'deaktiviert'}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPreview, addLog]);

  useEffect(() => {
    // Try to connect to Flask on port 5000 (Pi Backend)
    // We use window.location.hostname to make it work from other devices in the network too
    const host = window.location.hostname || 'localhost';
    const socket = window.io ? window.io(`http://${host}:5000`) : null;
    socketRef.current = socket;

    if (socket) {
      socket.on('connect', () => {
        setIsHardwareConnected(true);
        addLog("Hardware-Server (Pi) verbunden.");
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
        addLog("Hardware-Server getrennt.");
      });
    }

    return () => { if (socket) socket.disconnect(); };
  }, [addLog]);

  const navigatePhase = (dir: number) => {
    const phases = Object.values(GamePhase);
    const currentIndex = phases.indexOf(phase);
    let nextIndex = currentIndex + dir;
    if (nextIndex < 0) nextIndex = phases.length - 1;
    if (nextIndex >= phases.length) nextIndex = 0;
    
    setPhase(phases[nextIndex]);
    addLog(`Phase: ${phases[nextIndex]}`);
  };

  const handleAnswer = (player: number, val: string) => {
    addLog(`Spieler ${player} wählt: ${val}`);
    if (player === 1) setP1Ans(val);
    if (player === 2) setP2Ans(val);
  };

  useEffect(() => {
    if (p1Ans && p2Ans && phase === GamePhase.ANSWERING) {
      setTimeout(() => setPhase(GamePhase.MEASURING), 1000);
    }
  }, [p1Ans, p2Ans, phase]);

  useEffect(() => {
    if (phase === GamePhase.MEASURING) {
      setTimer(15);
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setPhase(GamePhase.RESULTS);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const resetGame = () => {
    setPhase(GamePhase.DISCLAIMER);
    setP1Ans(null);
    setP2Ans(null);
    setTimer(15);
    setCurrentQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
    addLog("System Neustart...");
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex flex-col items-center justify-center p-8 bg-[#050505] selection:bg-green-500 selection:text-black">
      <DebugLog logs={logs} />

      <div className="max-w-4xl w-full border-4 border-green-500 rounded-3xl p-10 bg-green-500/5 backdrop-blur-md z-10 flex flex-col items-center text-center shadow-[0_0_80px_rgba(0,255,0,0.15)] relative overflow-hidden">
        
        {/* Status Indicator */}
        <div className="absolute top-4 right-8 flex items-center space-x-3 bg-black/40 px-3 py-1 rounded-full border border-green-900">
           <span className={`w-2 h-2 rounded-full ${isHardwareConnected ? 'bg-green-500 shadow-[0_0_8px_#00ff00]' : 'bg-red-500'} animate-pulse`}></span>
           <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">{isHardwareConnected ? 'PI-Link Active' : 'No Hardware'}</span>
        </div>

        {phase === GamePhase.DISCLAIMER && (
          <div className="animate-in fade-in zoom-in duration-700 space-y-8 py-10">
            <div className="relative inline-block">
              <i className="fa-solid fa-microchip text-7xl text-green-500 mb-6 glow"></i>
              <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold animate-bounce uppercase">Live</div>
            </div>
            <h1 className="text-7xl font-black glow tracking-tighter uppercase italic leading-none">Lie Detector</h1>
            <p className="text-green-600 font-bold text-xs tracking-[0.4em] opacity-60">EXPERIMENTAL BIO-FEEDBACK INTERFACE</p>
            
            <div className="grid grid-cols-2 gap-8 pt-10 w-full">
              <PulseMonitor label="PROBAND 01" bpm={p1Bpm} />
              <PulseMonitor label="PROBAND 02" bpm={p2Bpm} />
            </div>

            <button 
              onClick={() => navigatePhase(1)}
              className="mt-12 px-20 py-6 bg-green-500 text-black font-black text-3xl rounded-full hover:bg-green-400 transition-all shadow-[0_0_40px_rgba(0,255,0,0.3)] uppercase italic active:scale-95 group"
            >
              Initialisieren <i className="fa-solid fa-chevron-right ml-4 group-hover:translate-x-2 transition-transform"></i>
            </button>
          </div>
        )}

        {phase === GamePhase.SELECTION && (
          <div className="animate-in slide-in-from-right duration-500 w-full space-y-12 py-10">
            <h2 className="text-sm text-green-500/40 uppercase tracking-[0.5em] font-bold">Zentrale Fragestellung:</h2>
            <div className="bg-green-500 text-black p-12 text-5xl font-black rounded-xl shadow-2xl glow transform -rotate-1 hover:rotate-0 transition-transform cursor-default">
              "{currentQuestion}"
            </div>
            <div className="flex flex-col items-center space-y-4">
              <p className="text-green-700 animate-pulse text-xs tracking-widest uppercase">System bereit für Datenerfassung</p>
              <button onClick={() => navigatePhase(1)} className="px-14 py-4 border-2 border-green-500 text-green-500 font-black uppercase hover:bg-green-500 hover:text-black transition-all tracking-widest italic">Start Analyse</button>
            </div>
          </div>
        )}

        {phase === GamePhase.ANSWERING && (
          <div className="animate-in fade-in duration-500 w-full space-y-16 py-10">
            <h2 className="text-4xl font-black uppercase tracking-tighter italic glow text-green-400">Dateneingabe Erwartet</h2>
            <div className="grid grid-cols-2 gap-12">
              <div className={`p-10 border-4 transition-all duration-500 rounded-2xl relative ${p1Ans ? 'border-green-500 bg-green-500/20 scale-105 shadow-[0_0_30px_rgba(0,255,0,0.3)]' : 'border-green-900/20 opacity-30 grayscale'}`}>
                <h3 className="text-xs font-black text-green-600 mb-8 uppercase tracking-[0.3em]">Hardware Slot 01</h3>
                <div className="text-6xl text-green-400 font-black uppercase italic tracking-tighter">{p1Ans || 'Waiting'}</div>
                {p1Ans && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-black text-[10px] px-3 py-1 font-black rounded">RECEIVED</div>}
              </div>
              <div className={`p-10 border-4 transition-all duration-500 rounded-2xl relative ${p2Ans ? 'border-green-500 bg-green-500/20 scale-105 shadow-[0_0_30px_rgba(0,255,0,0.3)]' : 'border-green-900/20 opacity-30 grayscale'}`}>
                <h3 className="text-xs font-black text-green-600 mb-8 uppercase tracking-[0.3em]">Hardware Slot 02</h3>
                <div className="text-6xl text-green-400 font-black uppercase italic tracking-tighter">{p2Ans || 'Waiting'}</div>
                {p2Ans && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-black text-[10px] px-3 py-1 font-black rounded">RECEIVED</div>}
              </div>
            </div>
          </div>
        )}

        {phase === GamePhase.MEASURING && (
          <div className="animate-in zoom-in duration-700 w-full space-y-10 py-6">
            <div className="flex flex-col items-center">
               <h1 className="text-5xl font-black text-red-600 pulse-red tracking-tight uppercase italic mb-2">Stress-Level Scan</h1>
               <div className="h-1 w-64 bg-red-900/30 rounded-full overflow-hidden">
                  <div className="h-full bg-red-600 animate-[loading_15s_linear]" style={{width: '100%'}}></div>
               </div>
            </div>
            <div className="text-[14rem] font-black text-green-500 leading-none glow tracking-tighter animate-pulse">{timer}</div>
            <div className="grid grid-cols-2 gap-10 w-full">
              <PulseMonitor label="BIO-DATA S01" bpm={p1Bpm} color="text-red-600" />
              <PulseMonitor label="BIO-DATA S02" bpm={p2Bpm} color="text-red-600" />
            </div>
          </div>
        )}

        {phase === GamePhase.RESULTS && (
          <div className="animate-in fade-in zoom-in duration-500 space-y-12 w-full py-6">
            <h1 className="text-5xl font-black bg-green-500 text-black py-6 uppercase italic tracking-widest rounded-lg">Analyse-Protokoll</h1>
            <div className="grid grid-cols-2 gap-10 text-left">
              <div className="p-10 border-2 border-green-500/30 rounded-2xl bg-black/60 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 text-[10px] font-bold text-green-900 group-hover:text-green-500 transition-colors uppercase">File: P1_DATA</div>
                <p className="text-[10px] text-green-700 uppercase font-black mb-4 tracking-widest">Aussage Proband 01:</p>
                <p className="text-3xl font-bold mb-8 italic text-white">"{p1Ans}"</p>
                <div className={`text-4xl font-black uppercase italic tracking-tighter p-4 border-2 rounded ${Math.abs(p1Bpm - 80) > 12 ? 'text-red-600 border-red-600/50 pulse-red bg-red-900/10' : 'text-green-500 border-green-500/50 bg-green-900/10'}`}>
                  {Math.abs(p1Bpm - 80) > 12 ? 'Lügendetektion Positiv' : 'Keine Anomalie'}
                </div>
              </div>
              <div className="p-10 border-2 border-green-500/30 rounded-2xl bg-black/60 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 text-[10px] font-bold text-green-900 group-hover:text-green-500 transition-colors uppercase">File: P2_DATA</div>
                <p className="text-[10px] text-green-700 uppercase font-black mb-4 tracking-widest">Aussage Proband 02:</p>
                <p className="text-3xl font-bold mb-8 italic text-white">"{p2Ans}"</p>
                <div className={`text-4xl font-black uppercase italic tracking-tighter p-4 border-2 rounded ${Math.abs(p2Bpm - 85) > 15 ? 'text-red-600 border-red-600/50 pulse-red bg-red-900/10' : 'text-green-500 border-green-500/50 bg-green-900/10'}`}>
                  {Math.abs(p2Bpm - 85) > 15 ? 'Lügendetektion Positiv' : 'Keine Anomalie'}
                </div>
              </div>
            </div>
            <button onClick={resetGame} className="px-20 py-5 bg-red-600 text-white font-black rounded-full uppercase italic hover:bg-red-500 transition-all shadow-[0_0_30px_rgba(255,0,0,0.3)] text-xl">System Reboot</button>
          </div>
        )}
      </div>

      {showPreview && (
        <div className="fixed bottom-8 right-8 p-8 bg-zinc-950 border-2 border-green-500 z-50 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,1)] w-96 font-mono text-xs animate-in slide-in-from-right duration-300">
          <div className="flex justify-between items-center mb-6 border-b border-green-900 pb-4">
            <div className="flex items-center space-x-2">
               <i className="fa-solid fa-terminal text-green-500"></i>
               <span className="font-black text-green-500 tracking-tighter uppercase">Hardware Simulation</span>
            </div>
            <button onClick={() => setShowPreview(false)} className="text-green-900 hover:text-red-500 transition-colors font-bold">ESC</button>
          </div>
          <div className="space-y-6">
            <div>
              <p className="text-green-800 text-[9px] uppercase font-bold mb-3 tracking-widest">Input Simulation</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleAnswer(1, 'Ja')} className="bg-green-900/10 p-3 border border-green-500/20 hover:bg-green-500 hover:text-black transition-all font-bold rounded">P1 JA</button>
                <button onClick={() => handleAnswer(1, 'Nein')} className="bg-green-900/10 p-3 border border-green-500/20 hover:bg-green-500 hover:text-black transition-all font-bold rounded">P1 NEIN</button>
                <button onClick={() => handleAnswer(2, 'Ja')} className="bg-green-900/10 p-3 border border-green-500/20 hover:bg-green-500 hover:text-black transition-all font-bold rounded">P2 JA</button>
                <button onClick={() => handleAnswer(2, 'Nein')} className="bg-green-900/10 p-3 border border-green-500/20 hover:bg-green-500 hover:text-black transition-all font-bold rounded">P2 NEIN</button>
              </div>
            </div>
            <div>
              <p className="text-green-800 text-[9px] uppercase font-bold mb-3 tracking-widest">Phase Control</p>
              <div className="flex space-x-2">
                <button onClick={() => navigatePhase(-1)} className="flex-1 p-2 border border-green-900 text-green-900 hover:border-green-500 hover:text-green-500 rounded font-bold uppercase tracking-tighter">Zurück</button>
                <button onClick={() => navigatePhase(1)} className="flex-1 p-2 border border-green-900 text-green-900 hover:border-green-500 hover:text-green-500 rounded font-bold uppercase tracking-tighter">Vorwärts</button>
              </div>
            </div>
            <p className="text-[9px] text-green-900 italic pt-2 border-t border-green-900/30">INFO: Drücke 'P' im Spielbetrieb zum Umschalten.</p>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes loading {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default App;
