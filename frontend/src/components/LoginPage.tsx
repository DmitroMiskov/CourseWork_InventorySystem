import { useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import axios from 'axios';
import api from '../api/axiosConfig';
import { Box, Button, TextField, Typography, Paper, Alert, IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from '../context/LanguageContext';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

interface LoginResponse {
  token: string;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { t } = useLanguage();
  const [userName, setUserName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post<LoginResponse>('/Auth/login', {
        userName,
        password,
      });

      const { token } = response.data;
      localStorage.setItem('token', token);
      onLoginSuccess();
    } catch (err: unknown) {
      console.error(err);

      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError(t('auth.loginError'));
          return;
        }
      }

      setError(t('auth.connectionError'));
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'background.default',
      }}
    >
      <Box sx={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LanguageToggle sx={{ bgcolor: 'background.paper', boxShadow: 1, color: 'text.primary' }} />
        <ThemeToggle sx={{ bgcolor: 'background.paper', boxShadow: 1 }} />
      </Box>

      <Paper elevation={3} sx={{ p: 4, width: 350, textAlign: 'center', borderRadius: 2 }}>
        <Typography variant="h5" mb={3} fontWeight="bold" color="primary">
          {t('auth.loginTitle')}
        </Typography>

        <form onSubmit={handleLogin}>
          <TextField
            label={t('auth.username')}
            fullWidth
            margin="normal"
            value={userName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUserName(e.target.value)}
            autoComplete="username"
          />
          <TextField
            label={t('auth.password')}
            type={showPassword ? 'text' : 'password'}
            fullWidth
            margin="normal"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={t('auth.togglePassword')}
                    onClick={() => setShowPassword(prev => !prev)}
                    onMouseDown={(e) => e.preventDefault()}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            sx={{ mt: 3 }}
          >
            {t('auth.loginButton')}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}