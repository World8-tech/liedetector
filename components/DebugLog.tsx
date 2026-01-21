
import React from 'react';
import { LogEntry } from '../types';

interface DebugLogProps {
  logs: LogEntry[];
}

export const DebugLog = React.memo<DebugLogProps>(({ logs }) => {
  return (
    <div className="fixed top-2 left-2 w-48 h-32 bg-black border border-green-900 rounded overflow-hidden z-50 flex flex-col text-[9px]">
      <div className="bg-green-900 text-black px-2 py-0.5 font-bold flex justify-between items-center text-[8px]">
        <span>LOG_MONITOR</span>
        <span className="animate-pulse">_</span>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 flex flex-col-reverse">
        {logs.map((log) => (
          <div key={log.id} className="mb-0.5 leading-tight">
            <span className="text-green-900">[{log.timestamp.split(':')[2]}]</span> {log.msg}
          </div>
        ))}
      </div>
    </div>
  );
});
