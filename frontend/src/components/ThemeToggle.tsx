import React, { useEffect } from 'react';
import { IconButton, Tooltip, Box } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useAppTheme } from '../context/ThemeContext';

export const ThemeToggle: React.FC<{ sx?: object }> = ({ sx }) => {
  const { toggleTheme, isDark } = useAppTheme();

  // Гаряча клавіша Alt+T для швидкого перемикання теми
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е')) {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheme]);

  const title = isDark 
    ? 'Перемкнути на світлу тему (Alt+T)' 
    : 'Перемкнути на темну тему (Alt+T)';

  return (
    <Tooltip title={title} arrow>
      <IconButton
        onClick={toggleTheme}
        color="inherit"
        aria-label="перемикач теми"
        sx={{
          ml: 0.5,
          mr: 1,
          p: 1,
          borderRadius: 2,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.15)',
          '&:hover': {
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.25)',
            transform: 'rotate(15deg) scale(1.05)',
          },
          ...sx
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.4s ease',
            transform: isDark ? 'rotate(360deg)' : 'rotate(0deg)',
          }}
        >
          {isDark ? (
            <LightModeIcon sx={{ color: '#facc15', fontSize: '1.25rem' }} />
          ) : (
            <DarkModeIcon sx={{ color: '#ffffff', fontSize: '1.25rem' }} />
          )}
        </Box>
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
