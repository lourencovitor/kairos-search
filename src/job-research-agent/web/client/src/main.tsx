import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App.js';

function Root() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: '#1A2E4A', light: '#2B4F7A', dark: '#0F1D2F', contrastText: '#FFFFFF' },
          secondary: { main: '#3D7EBF', contrastText: '#FFFFFF' },
          background: {
            default: mode === 'dark' ? '#0F172A' : '#F8FAFC',
            paper:   mode === 'dark' ? '#1E293B' : '#FFFFFF',
          },
          text: {
            primary:   mode === 'dark' ? '#F1F5F9' : '#0F1F2E',
            secondary: mode === 'dark' ? '#94A3B8' : '#5A7A96',
          },
          divider: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.08)',
          success: { main: '#059669' },
        },
        typography: {
          fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
          h6: { fontWeight: 700 },
          button: { textTransform: 'none', fontWeight: 600 },
        },
        shape: { borderRadius: 12 },
        components: {
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: mode === 'dark' ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(15,31,46,0.07)'}`,
                boxShadow: 'none',
                color: mode === 'dark' ? '#F1F5F9' : '#0F1F2E',
              },
            },
          },
          MuiCard: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
              root: {
                border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(15,31,46,0.07)'}`,
                boxShadow: mode === 'dark'
                  ? '0 1px 3px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)'
                  : '0 1px 3px rgba(15,31,46,0.05), 0 2px 8px rgba(15,31,46,0.04)',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: { borderRadius: 8 },
              contained: {
                boxShadow: '0 1px 3px rgba(15,31,46,0.2)',
                '&:hover': { boxShadow: '0 3px 8px rgba(15,31,46,0.25)' },
              },
            },
          },
          MuiSlider: { styleOverrides: { root: { color: '#1A2E4A' } } },
          MuiLinearProgress: { styleOverrides: { root: { height: 2 } } },
          MuiTooltip: {
            styleOverrides: {
              tooltip: { fontSize: '0.72rem', fontWeight: 600 },
            },
          },
        },
      }),
    [mode],
  );

  return (
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App
          mode={mode}
          onToggleTheme={() => setMode((m) => (m === 'light' ? 'dark' : 'light'))}
        />
      </ThemeProvider>
    </React.StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
