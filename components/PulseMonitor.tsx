
import React, { useEffect, useRef } from 'react';

interface PulseMonitorProps {
  label: string;
  bpm: number;
  color?: string;
  active?: boolean;
}

export const PulseMonitor = React.memo<PulseMonitorProps>(({ label, bpm, color = "#ff0000", active = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const width = canvas.width;
      const height = canvas.height;
      const mid = height / 2;
      
      // Zeichne die Wellenform
      ctx.moveTo(0, mid);
      for (let x = 0; x < width; x++) {
        // Berechne eine EKG-ähnliche Zacke basierend auf dem BPM
        const speed = (bpm > 0 ? bpm : 60) / 60;
        const time = (offsetRef.current + x) * 0.1 * speed;
        
        // Grundlinie mit leichtem Rauschen
        let y = mid + Math.sin(time * 0.5) * 2;
        
        // Die "P-Q-R-S-T" Welle Simulation
        const cycle = time % (Math.PI * 2);
        if (cycle > 0 && cycle < 0.3) y -= Math.sin(cycle * 10) * 15; // R-Zacke
        if (cycle > 0.4 && cycle < 0.8) y += Math.sin((cycle - 0.4) * 5) * 5; // T-Welle

        ctx.lineTo(x, y);
      }
      ctx.stroke();

      offsetRef.current += 2;
      animationFrame = requestAnimationFrame(draw);
    };

    if (active) draw();
    return () => cancelAnimationFrame(animationFrame);
  }, [bpm, color, active]);

  return (
    <div className="flex flex-col items-center p-3 border border-green-500/20 rounded bg-black/80 backdrop-blur-sm w-full">
      <div className="w-full flex justify-between items-center mb-1">
        <span className="text-[8px] uppercase tracking-widest text-green-700 font-bold">{label}</span>
        <span className="text-[8px] text-green-900 font-mono">SCANNING_LIVE</span>
      </div>
      
      <div className="flex items-baseline space-x-2 mb-2">
        <span className="text-4xl font-black tabular-nums tracking-tighter" style={{ color }}>
          {bpm > 0 ? bpm : '--'}
        </span>
        <span className="text-[10px] text-green-900 font-black">BPM</span>
      </div>
      
      <canvas 
        ref={canvasRef} 
        width={150} 
        height={50} 
        className="w-full h-12 border-t border-green-900/30 pt-2"
      />
    </div>
  );
});
