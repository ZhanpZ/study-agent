import { createContext, useContext, useState, useEffect } from "react";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(() => {
    const stored = sessionStorage.getItem("activeSessionId");
    return stored ? parseInt(stored, 10) : null;
  });
  const [sessionTopic, setSessionTopic] = useState(() => {
    return sessionStorage.getItem("activeSessionTopic") || "";
  });
  const [sessionMode, setSessionMode] = useState(() => {
    return sessionStorage.getItem("activeSessionMode") || "concept";
  });

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem("activeSessionId", String(sessionId));
    } else {
      sessionStorage.removeItem("activeSessionId");
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionTopic) {
      sessionStorage.setItem("activeSessionTopic", sessionTopic);
    } else {
      sessionStorage.removeItem("activeSessionTopic");
    }
  }, [sessionTopic]);

  useEffect(() => {
    sessionStorage.setItem("activeSessionMode", sessionMode);
  }, [sessionMode]);

  const clearSession = () => {
    setSessionId(null);
    setSessionTopic("");
    setSessionMode("concept");
  };

  return (
    <SessionContext.Provider
      value={{
        sessionId, setSessionId,
        sessionTopic, setSessionTopic,
        sessionMode, setSessionMode,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
