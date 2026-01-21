
import React, { useEffect, useRef } from 'react';

export const PulseMonitor = React.memo<{label: string, bpm: number, color?: string}>(({ label, bpm, color = "#00ff00" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const xRef = useRef(0);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    let frame: number;
    const draw = () => {
      const { width, height } = ctx.canvas;
      const mid = height / 2;

      // "Scroll"-Effekt ohne Clear
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(xRef.current, 0, 5, height);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xRef.current, mid);
      
      const speed = bpm > 0 ? bpm / 60 : 1;
      const y = mid + (Math.random() - 0.5) * 5 + (xRef.current % 20 < 2 ? -15 : 0);
      
      ctx.lineTo(xRef.current + 1, y);
      ctx.stroke();

      xRef.current = (xRef.current + 1) % width;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [bpm, color]);

  return (
    <div className="border border-green-900/30 p-2 bg-black w-full">
      <div className="flex justify-between text-[8px] mb-1">
        <span>{label}</span>
        <span>{bpm || '--'} BPM</span>
      </div>
      <canvas ref={canvasRef} width={100} height={30} className="w-full h-8" />
    </div>
  );
});
