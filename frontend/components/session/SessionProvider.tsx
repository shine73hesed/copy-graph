'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSession, type SessionState } from '@/hooks/useSession';
import type { SessionPhase, SessionMode, TestResponse, TestItem } from '@/lib/types';

interface SessionContextValue {
  state: SessionState;
  startSession: (nodeId: string, mode: SessionMode) => Promise<string | null>;
  restoreSession: (sid: string, nodeId: string, mode: SessionMode) => Promise<void>;
  submitTest: (phase: string, responses: TestResponse[]) => Promise<void>;
  sendMessage: (answer: string) => Promise<void>;
  completeReading: () => Promise<void>;
  setPhase: (phase: SessionPhase) => void;
  setPostTestItems: (items: TestItem[]) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessionContext() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionContext must be inside SessionProvider');
  return ctx;
}

export default function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSession();

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
