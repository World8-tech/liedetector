
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GamePhase, LogEntry } from './types';
import { DebugLog } from './components/DebugLog';
import { PulseMonitor } from './components/PulseMonitor';

const QUESTIONS = ["Heute gelogen?", "KI genutzt?", "Pünktlich gewesen?", "Partner belogen?", "Angst?"];

declare global { interface Window { io: any; } }

const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.DISCLAIMER);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [p1Bpm, setP1Bpm] = useState(0);
  const [p2Bpm, setP2Bpm] = useState(0);
  const [p1Ans, setP1Ans] = useState<string | null>(null);
  const [p2Ans, setP2Ans] = useState<string | null>(null);
  const [timer, setTimer] = useState(15);
  const [currentQ, setCurrentQ] = useState(QUESTIONS[0]);
  const [connected, setConnected] = useState(false);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [{ id: Math.random().toString(36).substr(2,4), msg, timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  }, []);

  useEffect(() => {
    const socket = window.io ? window.io(`http://${window.location.hostname}:5000`) : null;
    if (socket) {
      socket.on('connect', () => { setConnected(true); addLog("CON_OK"); });
      socket.on('status', (d: any) => addLog(d.msg));
      socket.on('live_pulse', (d: any) => { setP1Bpm(d.p1); setP2Bpm(d.p2); });
      socket.on('hardware_input', (d: any) => {
        addLog(`P${d.player}:${d.val}`);
        if (d.player === 1) setP1Ans(d.val); else setP2Ans(d.val);
      });
      socket.on('disconnect', () => setConnected(false));
    }
    return () => socket?.disconnect();
  }, [addLog]);

  useEffect(() => {
    if (p1Ans && p2Ans && phase === GamePhase.ANSWERING) setPhase(GamePhase.MEASURING);
  }, [p1Ans, p2Ans, phase]);

  useEffect(() => {
    if (phase === GamePhase.MEASURING) {
      const i = setInterval(() => setTimer(t => { 
        if (t <= 1) { setPhase(GamePhase.RESULTS); return 0; }
        return t - 1;
      }), 1000);
      return () => clearInterval(i);
    }
  }, [phase]);

  const reset = () => { setPhase(GamePhase.DISCLAIMER); setP1Ans(null); setP2Ans(null); setTimer(15); };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-4 flex flex-col items-center justify-center">
      <DebugLog logs={logs} />
      
      <div className="w-full max-w-xl border border-green-900 p-6 flex flex-col items-center space-y-8">
        <div className="w-full flex justify-between text-[10px] opacity-50 border-b border-green-900 pb-2">
          <span>STATUS: {connected ? 'ONLINE' : 'OFFLINE'}</span>
          <span>PHASE: {phase}</span>
        </div>

        {phase === GamePhase.DISCLAIMER && (
          <div className="text-center space-y-6">
            <h1 className="text-3xl font-bold tracking-tighter">LIE_DETECTOR_V1</h1>
            <div className="grid grid-cols-2 gap-4">
              <PulseMonitor label="P1" bpm={p1Bpm} color="#00ff00" />
              <PulseMonitor label="P2" bpm={p2Bpm} color="#00ff00" />
            </div>
            <button onClick={() => setPhase(GamePhase.SELECTION)} className="border border-green-500 px-8 py-2 hover:bg-green-500 hover:text-black">INITIALIZE</button>
          </div>
        )}

        {phase === GamePhase.SELECTION && (
          <div className="text-center space-y-6">
            <div className="text-xl p-4 border border-green-900 bg-green-900/10">"{currentQ}"</div>
            <div className="flex space-x-2">
              <button onClick={() => setCurrentQ(QUESTIONS[Math.floor(Math.random()*QUESTIONS.length)])} className="text-xs border border-green-900 px-4 py-1">NEXT_Q</button>
              <button onClick={() => setPhase(GamePhase.ANSWERING)} className="bg-green-700 text-black px-6 py-1 font-bold">START</button>
            </div>
          </div>
        )}

        {phase === GamePhase.ANSWERING && (
          <div className="w-full grid grid-cols-2 gap-4 text-center">
            <div className={`p-4 border ${p1Ans ? 'bg-green-900 text-black' : 'border-green-900'}`}>{p1Ans || 'WAITING_P1'}</div>
            <div className={`p-4 border ${p2Ans ? 'bg-green-900 text-black' : 'border-green-900'}`}>{p2Ans || 'WAITING_P2'}</div>
          </div>
        )}

        {phase === GamePhase.MEASURING && (
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold">{timer}</div>
            <div className="text-xs animate-pulse">ANALYZING_BIOMETRICS...</div>
            <div className="grid grid-cols-2 gap-2">
              <PulseMonitor label="P1" bpm={p1Bpm} color="#ff0000" />
              <PulseMonitor label="P2" bpm={p2Bpm} color="#ff0000" />
            </div>
          </div>
        )}

        {phase === GamePhase.RESULTS && (
          <div className="w-full space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="border border-green-900 p-2">
                P1: {p1Ans} <br/> 
                RESULT: {Math.abs(p1Bpm-80)>15 ? 'DECEPTIVE' : 'TRUTHFUL'}
              </div>
              <div className="border border-green-900 p-2">
                P2: {p2Ans} <br/> 
                RESULT: {Math.abs(p2Bpm-85)>15 ? 'DECEPTIVE' : 'TRUTHFUL'}
              </div>
            </div>
            <button onClick={reset} className="w-full border border-red-900 text-red-900 py-2 hover:bg-red-900 hover:text-black">REBOOT</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
