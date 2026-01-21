
export enum GamePhase {
  DISCLAIMER = 'DISCLAIMER',
  SELECTION = 'SELECTION',
  ANSWERING = 'ANSWERING',
  MEASURING = 'MEASURING',
  RESULTS = 'RESULTS'
}

export interface PlayerState {
  bpm: number;
  answer: string | null;
  history: number[];
}

export interface GameState {
  phase: GamePhase;
  p1: PlayerState;
  p2: PlayerState;
  timer: number;
}

export interface LogEntry {
  id: string;
  msg: string;
  timestamp: string;
}
