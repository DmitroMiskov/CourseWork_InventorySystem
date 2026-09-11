import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { 
  ThemeProvider as MuiThemeProvider, 
  createTheme, 
  CssBaseline, 
  type Theme 
} from '@mui/material';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('app_theme_mode');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('app_theme_mode', newMode);
  };

  const toggleTheme = () => {
    setMode(mode === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const theme: Theme = useMemo(() => {
    const isDark = mode === 'dark';

    return createTheme({
      palette: {
        mode,
        primary: {
          main: isDark ? '#38bdf8' : '#1976d2',
          light: isDark ? '#7dd3fc' : '#42a5f5',
          dark: isDark ? '#0284c7' : '#1565c0',
          contrastText: isDark ? '#0f172a' : '#ffffff',
        },
        secondary: {
          main: isDark ? '#a78bfa' : '#7c3aed',
        },
        background: {
          default: isDark ? '#0b1120' : '#f8fafc',
          paper: isDark ? '#161f33' : '#ffffff',
        },
        text: {
          primary: isDark ? '#f8fafc' : '#0f172a',
          secondary: isDark ? '#94a3b8' : '#64748b',
        },
        divider: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        action: {
          hover: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
          selected: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(25, 118, 210, 0.08)',
        }
      },
      shape: {
        borderRadius: 8,
      },
      typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        button: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundColor: isDark ? '#0b1120' : '#f8fafc',
              color: isDark ? '#f8fafc' : '#0f172a',
              transition: 'background-color 0.25s ease, color 0.25s ease',
              scrollbarColor: isDark ? '#334155 #0b1120' : '#cbd5e1 #f8fafc',
              '&::-webkit-scrollbar': {
                width: 8,
                height: 8,
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: isDark ? '#0b1120' : '#f8fafc',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: isDark ? '#334155' : '#cbd5e1',
                borderRadius: 4,
              },
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: isDark ? '#161f33' : '#1976d2',
              backgroundImage: 'none',
              borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
              boxShadow: isDark ? 'none' : '0 2px 4px rgba(0,0,0,0.08)',
              transition: 'background-color 0.25s ease',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              transition: 'background-color 0.25s ease, border-color 0.25s ease',
            },
          },
        },
        MuiTableHead: {
          styleOverrides: {
            root: {
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              '& .MuiTableCell-head': {
                backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                color: isDark ? '#f8fafc' : '#334155',
                fontWeight: 600,
                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
              },
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              backgroundColor: isDark ? '#161f33' : '#ffffff',
              backgroundImage: 'none',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            },
          },
        },
      },
    });
  }, [mode]);

  const isDark = mode === 'dark';

  return (
    <ThemeContext.Provider value={{ mode, isDark, toggleTheme, setMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useAppTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
};

export default ThemeContext;
