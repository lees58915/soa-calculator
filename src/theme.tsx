import { createContext, useContext, type ReactNode } from 'react';

type ThemeCtx = { theme: 'light' };

const ThemeContext = createContext<ThemeCtx>({ theme: 'light' });

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
