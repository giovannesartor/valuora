import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('qv-theme');
    if (stored) return stored;
    // Detect system preference
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light'; // respect system light preference
  });

  // On mount, try to load from server (if authenticated)
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    import('../lib/api').then(({ default: api }) => {
      api.get('/auth/me/theme')
        .then(({ data }) => {
          if (data.theme && data.theme !== theme) {
            setTheme(data.theme);
          }
        })
        .catch(() => {}); // silent fail
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem('qv-theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      // Persist to server (fire-and-forget)
      const token = localStorage.getItem('access_token');
      if (token) {
        import('../lib/api').then(({ default: api }) => {
          api.put('/auth/me/theme', { theme: next }).catch(() => {});
        });
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
