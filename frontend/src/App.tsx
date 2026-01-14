import { useState } from 'react';
import axios from 'axios';
import { Container, CssBaseline, AppBar, Toolbar, Typography, Button, Box, IconButton, Tooltip } from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import LogoutIcon from '@mui/icons-material/Logout';

// Ваші компоненти
import ProductList from './components/ProductList';
import LoginPage from './components/LoginPage';
// 👇 ПЕРЕКОНАЙТЕСЯ, ЩО ЦЕЙ ІМПОРТ ПРАВИЛЬНИЙ (назва файлу вашого дашборда)
import Dashboard from './components/Dashboard';

function App() {
  // 1. Стан авторизації (Лінива ініціалізація)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return true;
    }
    return false;
  });

  // 2. Стан навігації: 'list' (Таблиця) або 'dashboard' (Графіки)
  const [currentView, setCurrentView] = useState<'list' | 'dashboard'>('list');

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
  };

  // Якщо не авторизовані — показуємо Логін
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
    }} />;
  }

  // Якщо авторизовані — показуємо Меню і Контент
  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <InventoryIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}>
            Складський Облік
          </Typography>

          {/* 👇 КНОПКИ НАВІГАЦІЇ */}
          <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
            <Button 
              color="inherit" 
              startIcon={<TableChartIcon />}
              variant={currentView === 'list' ? "outlined" : "text"}
              onClick={() => setCurrentView('list')}
              sx={{ backgroundColor: currentView === 'list' ? 'rgba(255,255,255,0.2)' : 'transparent' }}
            >
              Склад
            </Button>
            
            <Button 
              color="inherit" 
              startIcon={<BarChartIcon />}
              variant={currentView === 'dashboard' ? "outlined" : "text"}
              onClick={() => setCurrentView('dashboard')}
              sx={{ backgroundColor: currentView === 'dashboard' ? 'rgba(255,255,255,0.2)' : 'transparent' }}
            >
              Дашборд
            </Button>
          </Box>

          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Вийти">
                <IconButton color="inherit" onClick={handleLogout}>
                    <LogoutIcon />
                </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {/* 👇 ПЕРЕМИКАННЯ КОНТЕНТУ */}
        {currentView === 'list' ? (
          <ProductList />
        ) : (
          // Якщо у вас компонент називається інакше, змініть назву тут
          <Dashboard/>
        )}
      </Container>
    </>
  );
}

export default App;