import { useState } from 'react';
import axios from 'axios';
import { Box, Button, TextField, Typography, Paper, Alert } from '@mui/material';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // 1. Відправляємо логін/пароль на сервер
      const response = await axios.post('/api/Auth/login', {
        username,
        password
      });

      // 2. Отримуємо токен
      const { token } = response.data;

      // 3. Зберігаємо токен у браузері (LocalStorage)
      localStorage.setItem('token', token);
      
      // 4. Повідомляємо App.tsx, що ми зайшли
      onLoginSuccess();
      
    } catch (err) {
      console.error(err);
      setError("Невірний логін або пароль");
    }
  };

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: '#f5f5f5' 
    }}>
      <Paper elevation={3} sx={{ p: 4, width: 350, textAlign: 'center' }}>
        <Typography variant="h5" mb={3} fontWeight="bold" color="primary">
          Складський Облік
        </Typography>
        
        <form onSubmit={handleLogin}>
          <TextField
            label="Логін"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="Пароль"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

          <Button 
            type="submit" 
            variant="contained" 
            fullWidth 
            size="large" 
            sx={{ mt: 3 }}
          >
            Увійти
          </Button>
        </form>
      </Paper>
    </Box>
  );
}