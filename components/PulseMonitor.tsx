
import React from 'react';

interface PulseMonitorProps {
  label: string;
  bpm: number;
  color?: string;
}

export const PulseMonitor = React.memo<PulseMonitorProps>(({ label, bpm, color = "text-red-600" }) => {
  return (
    <div className="flex flex-col items-center p-2 border border-green-500/20 rounded bg-black">
      <div className="text-[7px] uppercase tracking-widest text-green-700 mb-1">{label}</div>
      <div className="flex items-baseline space-x-1">
        <span className={`text-2xl font-bold ${color}`}>
          {bpm > 0 ? bpm : '--'}
        </span>
        <span className="text-[7px] text-green-900 font-bold">BPM</span>
      </div>
      
      <div className="mt-1 w-full h-4 flex items-end space-x-1 justify-center overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div 
            key={i} 
            className="w-2 bg-red-600/30" 
            style={{ 
              height: '40%',
              willChange: 'transform',
              animation: `wiggle ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes wiggle {
          from { transform: scaleY(0.5); opacity: 0.2; }
          to { transform: scaleY(1.5); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
});
