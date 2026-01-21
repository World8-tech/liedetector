
import React from 'react';

interface PulseMonitorProps {
  label: string;
  bpm: number;
  color?: string;
}

export const PulseMonitor: React.FC<PulseMonitorProps> = ({ label, bpm, color = "text-red-600" }) => {
  return (
    <div className="flex flex-col items-center p-4 border border-green-500/30 rounded-lg bg-black/40">
      <div className="text-xs uppercase tracking-widest text-green-500 mb-2">{label}</div>
      <div className="flex items-baseline space-x-2">
        <span className={`text-5xl font-bold font-mono ${color} animate-pulse`}>
          {bpm > 0 ? bpm : '--'}
        </span>
        <span className="text-xs text-green-700">BPM</span>
      </div>
      <div className="mt-2 w-full h-8 flex items-end space-x-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div 
            key={i} 
            className="w-full bg-red-600/50" 
            style={{ height: `${Math.random() * 100}%`, transition: 'height 0.1s ease' }}
          />
        ))}
      </div>
    </div>
  );
};
