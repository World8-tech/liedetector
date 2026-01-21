
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GamePhase, LogEntry } from './types';
import { DebugLog } from './components/DebugLog';
import { PulseMonitor } from './components/PulseMonitor';

const QUESTIONS = [
  "Hast du heute schon einmal gelogen?",
  "Hast du KI für deine Hausaufgaben genutzt?",
  "Warst du gestern pünktlich?",
  "Denkst du, dein Teampartner lügt gerade?",
  "Bist du bereit für die Wahrheit?"
];

// Extend window for socket.io
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

  // --- Socket.io Integration ---
  useEffect(() => {
    // Connect to the local Flask server on the Pi
    const socket = window.io ? window.io() : null;
    socketRef.current = socket;

    if (socket) {
      socket.on('connect', () => {
        setIsHardwareConnected(true);
        addLog("Schnittstelle zum Pi aktiv.");
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
        addLog("Verbindung zum Pi verloren.");
      });
    } else {
      addLog("Socket.io nicht geladen. Simulation aktiv.");
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
    addLog(`Phase gewechselt zu: ${phases[nextIndex]}`);
  };

  const handleAnswer = (player: number, val: string) => {
    addLog(`P${player} drückt: ${val}`);
    if (player === 1) setP1Ans(val);
    if (player === 2) setP2Ans(val);
  };

  useEffect(() => {
    if (p1Ans && p2Ans && phase === GamePhase.ANSWERING) {
      setPhase(GamePhase.MEASURING);
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
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
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
    <div className="min-h-screen w-full relative overflow-hidden flex flex-col items-center justify-center p-8 bg-[#050505]">
      <DebugLog logs={logs} />

      <div className="max-w-4xl w-full border-4 border-green-500 rounded-3xl p-10 bg-green-500/5 backdrop-blur-sm z-10 flex flex-col items-center text-center shadow-[0_0_50px_rgba(0,255,0,0.1)] relative overflow-hidden">
        
        <div className="absolute top-4 right-6 flex items-center space-x-2">
           <span className={`w-2 h-2 rounded-full ${isHardwareConnected ? 'bg-green-500 shadow-[0_0_5px_#00ff00]' : 'bg-red-500'} animate-pulse`}></span>
           <span className="text-[10px] text-green-700 font-bold">{isHardwareConnected ? 'PI CONNECTED' : 'OFFLINE'}</span>
        </div>

        {/* --- Phase Renderers --- */}
        {phase === GamePhase.DISCLAIMER && (
          <div className="animate-in fade-in zoom-in duration-500 space-y-8">
            <i className="fa-solid fa-microchip text-6xl text-green-500 mb-4 glow"></i>
            <h1 className="text-5xl font-bold glow tracking-tighter uppercase">Lügendetektor</h1>
            <div className="space-y-2 text-green-600 opacity-80 text-sm">
              <p>HARDWARE: {isHardwareConnected ? 'BEREIT' : 'NICHT GEFUNDEN (SIMULATION)'}</p>
              <p>SENSOR_S1: {p1Bpm > 0 ? 'AKTIV' : 'WARTE...'}</p>
              <p>SENSOR_S2: {p2Bpm > 0 ? 'AKTIV' : 'WARTE...'}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-8 border-t border-green-500/20">
              <PulseMonitor label="Spieler 1" bpm={p1Bpm} />
              <PulseMonitor label="Spieler 2" bpm={p2Bpm} />
            </div>

            <button 
              onClick={() => navigatePhase(1)}
              className="mt-8 px-12 py-4 bg-green-500 text-black font-bold text-xl rounded-full hover:bg-green-400 transition-all shadow-lg uppercase"
            >
              Start
            </button>
          </div>
        )}

        {phase === GamePhase.SELECTION && (
          <div className="animate-in slide-in-from-right duration-500 w-full">
            <h2 className="text-2xl text-green-500/50 mb-10">AKTUELLE FRAGE:</h2>
            <div className="bg-green-500 text-black p-8 text-3xl font-bold rounded-lg shadow-xl glow mb-8">
              "{currentQuestion}"
            </div>
            <button onClick={() => navigatePhase(1)} className="px-8 py-3 bg-green-500 text-black rounded font-bold uppercase">Antworten</button>
          </div>
        )}

        {phase === GamePhase.ANSWERING && (
          <div className="animate-in fade-in duration-500 w-full space-y-12">
            <h2 className="text-3xl font-bold">DRÜCKE DEINEN BUTTON...</h2>
            <div className="grid grid-cols-2 gap-10">
              <div className={`p-6 border-2 ${p1Ans ? 'border-green-500 bg-green-500/20' : 'border-green-900 opacity-50'}`}>
                <h3 className="text-xl mb-4">SPIELER 1</h3>
                <div className="text-4xl text-green-400 font-bold uppercase">{p1Ans || '...'}</div>
              </div>
              <div className={`p-6 border-2 ${p2Ans ? 'border-green-500 bg-green-500/20' : 'border-green-900 opacity-50'}`}>
                <h3 className="text-xl mb-4">SPIELER 2</h3>
                <div className="text-4xl text-green-400 font-bold uppercase">{p2Ans || '...'}</div>
              </div>
            </div>
          </div>
        )}

        {phase === GamePhase.MEASURING && (
          <div className="animate-in zoom-in duration-700 w-full space-y-8">
            <h1 className="text-4xl font-black text-red-600 pulse-red tracking-widest uppercase">Analyse läuft</h1>
            <div className="text-9xl font-mono text-green-500 font-bold leading-none">{timer}</div>
            <div className="grid grid-cols-2 gap-8 w-full">
              <PulseMonitor label="BPM S1" bpm={p1Bpm} color="text-red-500" />
              <PulseMonitor label="BPM S2" bpm={p2Bpm} color="text-red-500" />
            </div>
          </div>
        )}

        {phase === GamePhase.RESULTS && (
          <div className="animate-in fade-in zoom-in duration-500 space-y-10 w-full">
            <h1 className="text-5xl font-bold bg-green-500 text-black py-4 uppercase">Ergebnis</h1>
            <div className="grid grid-cols-2 gap-8 text-left">
              <div className="p-6 border border-green-500 rounded bg-green-500/10">
                <p className="text-xl mb-2 font-bold">P1: {p1Ans}</p>
                <p className={`text-lg font-bold ${Math.abs(p1Bpm - 80) > 15 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
                  {Math.abs(p1Bpm - 80) > 15 ? 'LÜGE ERKANNT!' : 'WAHRHEIT'}
                </p>
              </div>
              <div className="p-6 border border-green-500 rounded bg-green-500/10">
                <p className="text-xl mb-2 font-bold">P2: {p2Ans}</p>
                <p className={`text-lg font-bold ${Math.abs(p2Bpm - 85) > 18 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
                  {Math.abs(p2Bpm - 85) > 18 ? 'LÜGE ERKANNT!' : 'WAHRHEIT'}
                </p>
              </div>
            </div>
            <button onClick={resetGame} className="px-10 py-3 bg-red-600 text-white font-bold rounded-lg uppercase">Reset</button>
          </div>
        )}
      </div>

      {/* Control Panel for Testing (Toggle with 'P') */}
      {showPreview && (
        <div className="fixed bottom-4 right-4 p-6 bg-zinc-900 border-t-4 border-green-500 z-50 rounded-lg w-80">
          <h3 className="font-bold text-green-500 text-sm mb-4">SIMULATION</h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleAnswer(1, 'Ja')} className="bg-zinc-800 p-2 text-[10px] border border-green-900">P1 JA</button>
            <button onClick={() => handleAnswer(1, 'Nein')} className="bg-zinc-800 p-2 text-[10px] border border-green-900">P1 NEIN</button>
            <button onClick={() => handleAnswer(2, 'Ja')} className="bg-zinc-800 p-2 text-[10px] border border-green-900">P2 JA</button>
            <button onClick={() => handleAnswer(2, 'Nein')} className="bg-zinc-800 p-2 text-[10px] border border-green-900">P2 NEIN</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
