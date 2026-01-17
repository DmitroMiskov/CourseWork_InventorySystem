import { useState } from 'react';
import axios from 'axios';
import { jwtDecode } from "jwt-decode";
import { Container, CssBaseline, AppBar, Toolbar, Typography, Button, Box, IconButton, Tooltip, Chip } from '@mui/material';

// Іконки
import InventoryIcon from '@mui/icons-material/Inventory';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';

// Компоненти
import ProductList from './components/ProductList';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Partners from './components/Partners';

// Тип для нашого Токена
interface CustomJwtPayload {
  unique_name: string; // Логін
  role: string;        // Роль (Admin/User)
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"?: string;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // 👇 Розширили тип state, щоб додати 'partners'
  const [currentView, setCurrentView] = useState<'list' | 'dashboard' | 'partners'>('list');
  
  const [userRole, setUserRole] = useState<string>('');
  const [username, setUsername] = useState<string>('');

  // Функція для перевірки токена і ролі
  const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const decoded = jwtDecode<CustomJwtPayload>(token);
        const role = decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || decoded.role || "User";
        
        setUserRole(role);
        setUsername(decoded.unique_name || "Користувач");
        setIsAuthenticated(true);
        return true;
      } catch (error) {
        console.error("Invalid token", error);
        localStorage.removeItem('token');
        return false;
      }
    }
    return false;
  };

  useState(() => {
    checkAuth();
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUserRole('');
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={checkAuth} />;
  }

  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <InventoryIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}>
            Складський Облік
          </Typography>

          {/* Меню навігації */}
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
            
            {/* 👇 НОВА КНОПКА КОНТРАГЕНТИ */}
            <Button 
              color="inherit" 
              startIcon={<PeopleIcon />}
              variant={currentView === 'partners' ? "outlined" : "text"}
              onClick={() => setCurrentView('partners')}
              sx={{ backgroundColor: currentView === 'partners' ? 'rgba(255,255,255,0.2)' : 'transparent' }}
            >
              Контрагенти
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

          {/* Інфо про юзера */}
          <Chip 
            icon={<PersonIcon />} 
            label={`${username} (${userRole})`} 
            color={userRole === 'Admin' ? "warning" : "default"}
            variant="outlined"
            sx={{ mr: 2, color: 'white', borderColor: 'rgba(255,255,255,0.5)' }} 
          />

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
        {currentView === 'list' && <ProductList isAdmin={userRole === 'Admin'} />}
        {currentView === 'partners' && <Partners />}
        {currentView === 'dashboard' && <Dashboard />}
      </Container>
    </>
  );
}

export default App;