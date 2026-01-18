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
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';

// Компоненти
import ProductList from './components/ProductList';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Partners from './components/Partners';
import AdminPage from './components/AdminPage';

// Тип для нашого Токена
interface CustomJwtPayload {
  unique_name: string; // Логін
  role: string;        // Роль (Admin/User)
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"?: string;
}

function App() {
  // 👇 КРОК 1: Функція для отримання початкового стану (працює синхронно)
  const getInitialState = () => {
    const token = localStorage.getItem('token');
    if (!token) return { auth: false, role: '', name: '' };

    try {
      const decoded = jwtDecode<CustomJwtPayload>(token);
      const role = decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || decoded.role || "User";
      
      // Налаштовуємо axios одразу, якщо токен є
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      return { 
        auth: true, 
        role: role, 
        name: decoded.unique_name || "Користувач" 
      };
    } catch (error) {
      console.error("Invalid token on startup", error);
      localStorage.removeItem('token');
      return { auth: false, role: '', name: '' };
    }
  };

  // 👇 КРОК 2: Ініціалізуємо змінні ОДРАЗУ правильними значеннями
  const [initialState] = useState(getInitialState);

  const [isAuthenticated, setIsAuthenticated] = useState(initialState.auth);
  const [userRole, setUserRole] = useState(initialState.role);
  const [username, setUsername] = useState(initialState.name);
  
  const [currentView, setCurrentView] = useState<'list' | 'dashboard' | 'partners' | 'admin'>('list');

  // Функція для оновлення стану після успішного входу
  const handleLoginSuccess = () => {
    const newState = getInitialState();
    setIsAuthenticated(newState.auth);
    setUserRole(newState.role);
    setUsername(newState.name);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUserRole('');
    setUsername('');
    setCurrentView('list');
  };

  // Якщо не залогінений — показуємо форму входу
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 👇 Перевірка: чи є користувач адміном (незалежно від регістру: Admin, admin, ADMIN)
  const isAdmin = userRole.toLowerCase() === 'admin';

  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <InventoryIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}>
            Складський Облік
          </Typography>

          {/* МЕНЮ НАВІГАЦІЇ */}
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

            {/* Кнопка Адмінки (Тільки для Адміна, ігноруючи регістр) */}
            {isAdmin && (
                <Button 
                  color="warning" 
                  startIcon={<SupervisorAccountIcon />}
                  variant={currentView === 'admin' ? "outlined" : "text"}
                  onClick={() => setCurrentView('admin')}
                  sx={{ backgroundColor: currentView === 'admin' ? 'rgba(255,255,255,0.2)' : 'transparent' }}
                >
                  Персонал
                </Button>
            )}
          </Box>

          {/* ІНФО ПРО ЮЗЕРА */}
          <Chip 
            icon={<PersonIcon />} 
            label={`${username} (${userRole})`} 
            color={isAdmin ? "warning" : "default"}
            variant="outlined"
            sx={{ mr: 2, color: 'white', borderColor: 'rgba(255,255,255,0.5)', '& .MuiChip-icon': { color: 'white' } }} 
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

      {/* ОСНОВНИЙ КОНТЕНТ */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Передаємо isAdmin (true/false) у список товарів */}
        {currentView === 'list' && <ProductList isAdmin={isAdmin} />}
        
        {currentView === 'partners' && <Partners />}
        
        {currentView === 'dashboard' && <Dashboard />}
        
        {currentView === 'admin' && isAdmin && (<AdminPage onBack={() => setCurrentView('list')} />)}
      </Container>
    </>
  );
}

export default App;