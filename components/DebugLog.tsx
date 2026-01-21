
import React from 'react';
import { LogEntry } from '../types';

interface DebugLogProps {
  logs: LogEntry[];
}

export const DebugLog: React.FC<DebugLogProps> = ({ logs }) => {
  return (
    <div className="fixed top-4 left-4 w-64 h-48 bg-black/80 border border-green-500 rounded overflow-hidden z-50 flex flex-col font-mono text-[10px]">
      <div className="bg-green-500 text-black px-2 py-1 font-bold flex justify-between items-center">
        <span>LIVE INPUT MONITOR</span>
        <span className="animate-pulse">●</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide flex flex-col-reverse">
        {logs.map((log) => (
          <div key={log.id} className="mb-1">
            <span className="opacity-50">[{log.timestamp}]</span> {log.msg}
          </div>
        ))}
        {logs.length === 0 && <div className="text-green-800 italic">SYSTEM READY...</div>}
      </div>
    </div>
  );
};
