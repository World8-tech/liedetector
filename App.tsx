
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GamePhase, GameState, LogEntry } from './types';
import { DebugLog } from './components/DebugLog';
import { PulseMonitor } from './components/PulseMonitor';

const QUESTIONS = [
  "Hast du heute schon einmal gelogen?",
  "Hast du KI für deine Hausaufgaben genutzt?",
  "Warst du gestern pünktlich?",
  "Denkst du, dein Teampartner lügt gerade?",
  "Bist du bereit für die Wahrheit?"
];

const App: React.FC = () => {
  // --- Global State ---
  const [phase, setPhase] = useState<GamePhase>(GamePhase.DISCLAIMER);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [p1Bpm, setP1Bpm] = useState<number>(0);
  const [p2Bpm, setP2Bpm] = useState<number>(0);
  const [p1Ans, setP1Ans] = useState<string | null>(null);
  const [p2Ans, setP2Ans] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(15);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState(QUESTIONS[0]);

  // Fix: Replaced NodeJS.Timeout with ReturnType<typeof setInterval> to avoid namespace issues in browser environment.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Helper: Add Log ---
  const addLog = useCallback((msg: string) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      msg,
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  // --- Navigation ---
  const navigatePhase = (dir: number) => {
    const phases = Object.values(GamePhase);
    const currentIndex = phases.indexOf(phase);
    let nextIndex = currentIndex + dir;
    if (nextIndex < 0) nextIndex = phases.length - 1;
    if (nextIndex >= phases.length) nextIndex = 0;
    
    const nextPhase = phases[nextIndex];
    setPhase(nextPhase);
    addLog(`Phase gewechselt zu: ${nextPhase}`);
  };

  // --- Simulation: Arduino Values ---
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulating slight fluctuations in BPM
      setP1Bpm(prev => {
        const base = prev === 0 ? 70 : prev;
        const change = Math.floor(Math.random() * 3) - 1;
        return Math.max(60, Math.min(130, base + change));
      });
      setP2Bpm(prev => {
        const base = prev === 0 ? 75 : prev;
        const change = Math.floor(Math.random() * 3) - 1;
        return Math.max(60, Math.min(130, base + change));
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Game Logic: Answer Handling ---
  const handleAnswer = (player: number, val: string) => {
    addLog(`P${player} drückt: ${val}`);
    if (player === 1) setP1Ans(val);
    if (player === 2) setP2Ans(val);
  };

  // Trigger Phase Change when both answered
  useEffect(() => {
    if (p1Ans && p2Ans && phase === GamePhase.ANSWERING) {
      addLog("Beide Antworten erhalten! Starte Messung...");
      setPhase(GamePhase.MEASURING);
    }
  }, [p1Ans, p2Ans, phase, addLog]);

  // --- Measuring Timer ---
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
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') setShowPreview(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const resetGame = () => {
    setPhase(GamePhase.DISCLAIMER);
    setP1Ans(null);
    setP2Ans(null);
    setTimer(15);
    setCurrentQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
    addLog("System Neustart...");
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex flex-col items-center justify-center p-8 bg-[#050505]">
      
      {/* Debug Monitor */}
      <DebugLog logs={logs} />

      {/* Main Container */}
      <div className="max-w-4xl w-full border-4 border-green-500 rounded-3xl p-10 bg-green-500/5 backdrop-blur-sm z-10 flex flex-col items-center text-center shadow-[0_0_50px_rgba(0,255,0,0.1)] relative overflow-hidden">
        
        {/* Phase Header */}
        <div className="absolute top-4 left-0 right-0 text-[10px] opacity-30 flex justify-center space-x-8 uppercase tracking-widest">
           {Object.values(GamePhase).map(p => (
             <span key={p} className={p === phase ? "text-green-500 font-bold opacity-100 glow" : ""}>{p}</span>
           ))}
        </div>

        {/* --- DISCLAIMER --- */}
        {phase === GamePhase.DISCLAIMER && (
          <div className="animate-in fade-in zoom-in duration-500 space-y-8">
            <i className="fa-solid fa-microchip text-6xl text-green-500 mb-4 glow"></i>
            <h1 className="text-5xl font-bold glow tracking-tighter">LÜGENDETEKTOR V2.1</h1>
            <div className="space-y-2 text-green-600 opacity-80">
              <p>SYSTEMSTATUS: BEREIT</p>
              <p>ANALYSE: HOCHSCHUL-KONTEXT</p>
              <p>DATENSPEICHERUNG: INAKTIV</p>
            </div>
            
            <div className="pt-8 border-t border-green-500/20">
              <PulseMonitor label="Eingangssignal Spieler 1" bpm={p1Bpm} />
            </div>

            <button 
              onClick={() => navigatePhase(1)}
              className="mt-8 px-12 py-4 bg-green-500 text-black font-bold text-xl rounded-full hover:bg-green-400 transition-all shadow-lg active:scale-95 uppercase"
            >
              System Starten
            </button>
          </div>
        )}

        {/* --- SELECTION --- */}
        {phase === GamePhase.SELECTION && (
          <div className="animate-in slide-in-from-right duration-500 w-full">
            <h2 className="text-2xl text-green-500/50 mb-10">AKTUELLES SZENARIO:</h2>
            <div className="bg-green-500 text-black p-8 text-3xl font-bold rounded-lg shadow-xl glow mb-8">
              "{currentQuestion}"
            </div>
            <p className="text-green-600">Verwenden Sie die Hardware-Tasten oder die Vorschau-Steuerung.</p>
            <div className="flex justify-center mt-10">
              <button 
                onClick={() => navigatePhase(1)}
                className="px-8 py-3 border border-green-500 text-green-500 rounded hover:bg-green-500/20"
              >
                WEITER ZU ANTWORTEN <i className="fa-solid fa-arrow-right ml-2"></i>
              </button>
            </div>
          </div>
        )}

        {/* --- ANSWERING --- */}
        {phase === GamePhase.ANSWERING && (
          <div className="animate-in fade-in duration-500 w-full space-y-12">
            <h2 className="text-3xl font-bold">WARTE AUF EINGABE...</h2>
            
            <div className="grid grid-cols-2 gap-10">
              <div className={`p-6 border-2 transition-all ${p1Ans ? 'border-green-500 bg-green-500/20' : 'border-green-900'}`}>
                <h3 className="text-xl mb-4">SPIELER 1</h3>
                {p1Ans ? (
                  <div className="text-4xl text-green-400 font-bold uppercase">{p1Ans}</div>
                ) : (
                  <div className="flex flex-col space-y-2 opacity-30 italic">
                    <p>Warte auf Signal...</p>
                    <div className="h-2 w-full bg-green-900 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 animate-[loading_2s_infinite]" style={{width: '30%'}}></div>
                    </div>
                  </div>
                )}
              </div>

              <div className={`p-6 border-2 transition-all ${p2Ans ? 'border-green-500 bg-green-500/20' : 'border-green-900'}`}>
                <h3 className="text-xl mb-4">SPIELER 2</h3>
                {p2Ans ? (
                  <div className="text-4xl text-green-400 font-bold uppercase">{p2Ans}</div>
                ) : (
                  <div className="flex flex-col space-y-2 opacity-30 italic">
                    <p>Warte auf Signal...</p>
                    <div className="h-2 w-full bg-green-900 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 animate-[loading_1.5s_infinite]" style={{width: '30%'}}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="text-green-800 text-xs">HINWEIS: ANALYSE STARTET AUTOMATISCH NACH BEIDEN ANTWORTEN</p>
          </div>
        )}

        {/* --- MEASURING --- */}
        {phase === GamePhase.MEASURING && (
          <div className="animate-in zoom-in duration-700 w-full space-y-8">
            <h1 className="text-4xl font-black text-red-600 pulse-red tracking-widest">BIOMETRISCHE ANALYSE...</h1>
            
            <div className="text-9xl font-mono text-green-500 font-bold">
              {timer.toString().padStart(2, '0')}
            </div>

            <div className="grid grid-cols-2 gap-8 w-full">
              <PulseMonitor label="Bio-Sensor S1" bpm={p1Bpm} color="text-red-500" />
              <PulseMonitor label="Bio-Sensor S2" bpm={p2Bpm} color="text-red-500" />
            </div>

            <div className="w-full bg-green-900 h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-1000" 
                style={{ width: `${(15 - timer) / 15 * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* --- RESULTS --- */}
        {phase === GamePhase.RESULTS && (
          <div className="animate-in fade-in zoom-in duration-500 space-y-10 w-full">
            <h1 className="text-5xl font-bold bg-green-500 text-black py-4">ERGEBNIS</h1>
            
            <div className="grid grid-cols-2 gap-8 text-left">
              <div className="p-6 border border-green-500 rounded bg-green-500/10">
                <p className="text-xs uppercase text-green-700 mb-2">Spieler 1</p>
                <p className="text-xl mb-4 font-bold">Antwort: {p1Ans}</p>
                <div className="text-sm space-y-1 text-green-600">
                  <p>Max BPM: {p1Bpm + 5}</p>
                  <p>Min BPM: {p1Bpm - 3}</p>
                  <p className="pt-2 font-bold text-green-500">FAZIT: WAHRSCHEINLICH WAHR</p>
                </div>
              </div>
              <div className="p-6 border border-green-500 rounded bg-green-500/10">
                <p className="text-xs uppercase text-green-700 mb-2">Spieler 2</p>
                <p className="text-xl mb-4 font-bold">Antwort: {p2Ans}</p>
                <div className="text-sm space-y-1 text-green-600">
                  <p>Max BPM: {p2Bpm + 12}</p>
                  <p>Min BPM: {p2Bpm - 2}</p>
                  <p className="pt-2 font-bold text-red-500 animate-pulse">FAZIT: ANOMALIE ERKANNT!</p>
                </div>
              </div>
            </div>

            <button 
              onClick={resetGame}
              className="mt-8 px-10 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 transition-colors flex items-center mx-auto"
            >
              <i className="fa-solid fa-power-off mr-2"></i> SYSTEM REBOOT
            </button>
          </div>
        )}

      </div>

      {/* --- Preview Control Panel (Toggled with 'P') --- */}
      {showPreview && (
        <div className="fixed bottom-0 right-0 m-4 p-6 bg-zinc-900 border-t-4 border-green-500 shadow-2xl z-50 rounded-lg w-80 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center mb-4 border-b border-green-900 pb-2">
            <h3 className="font-bold text-green-500 text-sm">PREVIEW CONTROLLER</h3>
            <button onClick={() => setShowPreview(false)} className="text-zinc-500 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-black/50 p-2 rounded">
              <span className="text-[10px] text-zinc-400">PHASEN-NAV:</span>
              <div className="flex space-x-2">
                <button onClick={() => navigatePhase(-1)} className="bg-green-500 text-black px-3 py-1 rounded text-sm hover:bg-green-400">◀</button>
                <button onClick={() => navigatePhase(1)} className="bg-green-500 text-black px-3 py-1 rounded text-sm hover:bg-green-400">▶</button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-zinc-400 uppercase">Input Simulation:</span>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleAnswer(1, 'Ja')} className="bg-zinc-800 text-[10px] p-1 border border-green-900 hover:border-green-500">P1 JA</button>
                <button onClick={() => handleAnswer(1, 'Nein')} className="bg-zinc-800 text-[10px] p-1 border border-green-900 hover:border-green-500">P1 NEIN</button>
                <button onClick={() => handleAnswer(2, 'Ja')} className="bg-zinc-800 text-[10px] p-1 border border-green-900 hover:border-green-500">P2 JA</button>
                <button onClick={() => handleAnswer(2, 'Nein')} className="bg-zinc-800 text-[10px] p-1 border border-green-900 hover:border-green-500">P2 NEIN</button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-zinc-400 uppercase">BPM Stress Sim:</span>
              <input 
                type="range" 
                min="60" 
                max="160" 
                value={p1Bpm}
                onChange={(e) => setP1Bpm(parseInt(e.target.value))}
                className="w-full accent-green-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>P1 VAL: {p1Bpm}</span>
                <span>P2 VAL: {p2Bpm}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-2 border-t border-green-900 text-[8px] text-zinc-600 text-center">
            DRÜCKE 'P' ZUM AUSBLENDEN
          </div>
        </div>
      )}

      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-10 right-10 flex flex-col items-end font-mono text-[8px] text-green-900">
          <p>CORE_TEMPERATURE: 42°C</p>
          <p>USB_SERIAL: /dev/ttyACM0 (ACTIVE)</p>
          <p>GPIO_PINS: 17, 27, 22, 23 (LISTEN)</p>
        </div>
        <div className="absolute bottom-10 left-10 opacity-30">
          <svg width="200" height="200" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="5 5" className="animate-[spin_20s_linear_infinite]" />
            <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.2" className="animate-[pulse_4s_ease_infinite]" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default App;
