import { useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import axios from 'axios';
import api from '../api/axiosConfig';
import { Box, Button, TextField, Typography, Paper, Alert, IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ThemeToggle from './ThemeToggle';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

interface LoginResponse {
  token: string;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
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
          setError('Невірний логін або пароль');
          return;
        }
      }

      setError("Помилка з'єднання з сервером. Перевірте, чи працює API.");
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
      <ThemeToggle sx={{ position: 'absolute', top: 20, right: 20, bgcolor: 'background.paper', boxShadow: 1 }} />

      <Paper elevation={3} sx={{ p: 4, width: 350, textAlign: 'center', borderRadius: 2 }}>
        <Typography variant="h5" mb={1} fontWeight="bold" color="primary">
          Складський облік
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Система управління запасами та підтримки рішень
        </Typography>

        <form onSubmit={handleLogin}>
          <TextField
            label="Логін"
            fullWidth
            margin="normal"
            value={userName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUserName(e.target.value)}
            autoComplete="username"
          />
          <TextField
            label="Пароль"
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
                    aria-label="перемкнути видимість паролю"
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
            УВІЙТИ
          </Button>
        </form>
      </Paper>
    </Box>
  );
}