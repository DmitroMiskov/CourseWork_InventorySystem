import { useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import axios from 'axios';
import api from '../api/axiosConfig';
import { Box, Button, TextField, Typography, Paper, Alert } from '@mui/material';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

interface LoginResponse {
  token: string;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [userName, setUserName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
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
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: 350, textAlign: 'center' }}>
        <Typography variant="h5" mb={3} fontWeight="bold" color="primary">
          Складський облік
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
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            autoComplete="current-password"
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