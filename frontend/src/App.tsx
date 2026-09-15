import { useState } from 'react';
import { jwtDecode } from "jwt-decode";
import { 
  Container, CssBaseline, AppBar, Toolbar, Typography, Button, Box, 
  IconButton, Tooltip, Chip, Drawer, List, ListItem, ListItemButton, 
  ListItemIcon, ListItemText, Divider 
} from '@mui/material';

// Іконки
import InventoryIcon from '@mui/icons-material/Inventory';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import CategoryIcon from '@mui/icons-material/Category';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import PsychologyIcon from '@mui/icons-material/Psychology';

// Компоненти
import ProductList from './components/ProductList';
import CategoryList from './components/CategoryList';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Partners from './components/Partners';
import AdminPage from './components/AdminPage';
import ProcurementIntelligence from './components/ProcurementIntelligence';
import WarehouseCopilot from './components/WarehouseCopilot';
import SignalRStatusBadge from './components/SignalRStatusBadge';
import ThemeToggle from './components/ThemeToggle';
import { SignalRProvider } from './context/SignalRContext';
import type { CustomJwtPayload } from './types/inventory';

function App() {
  // 👇 КРОК 1: Функція для отримання початкового стану (працює синхронно)
  const getInitialState = () => {
    const token = localStorage.getItem('token');
    if (!token) return { auth: false, role: '', name: '' };

    try {
      const decoded = jwtDecode<CustomJwtPayload>(token);
      const role = decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || decoded.role || "User";
      
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
  
  const [initialState] = useState(getInitialState);

  const [isAuthenticated, setIsAuthenticated] = useState(initialState.auth);
  const [userRole, setUserRole] = useState(initialState.role);
  const [username, setUsername] = useState(initialState.name);
  
  const [currentView, setCurrentView] = useState<'list' | 'categories' | 'dashboard' | 'partners' | 'intelligence' | 'admin'>('list');
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Функція для оновлення стану після успішного входу
  const handleLoginSuccess = () => {
    const newState = getInitialState();
    setIsAuthenticated(newState.auth);
    setUserRole(newState.role);
    setUsername(newState.name);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUserRole('');
    setUsername('');
    setCurrentView('list');
    setMobileOpen(false);
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }
  const isAdmin = userRole.toLowerCase() === 'admin';

  const navItems = [
    { id: 'list' as const, label: 'Склад', icon: <TableChartIcon /> },
    { id: 'categories' as const, label: 'Категорії', icon: <CategoryIcon /> },
    { id: 'partners' as const, label: 'Контрагенти', icon: <PeopleIcon /> },
    { id: 'dashboard' as const, label: 'Дашборд', icon: <BarChartIcon /> },
    { id: 'intelligence' as const, label: 'ML Планування', icon: <PsychologyIcon /> },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Персонал', icon: <SupervisorAccountIcon /> }] : [])
  ];

  const handleNavClick = (view: 'list' | 'categories' | 'dashboard' | 'partners' | 'intelligence' | 'admin') => {
    setCurrentView(view);
    setMobileOpen(false);
  };

  return (
    <SignalRProvider isAuthenticated={isAuthenticated}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar sx={{ px: { xs: 1.5, sm: 2 } }}>
          {/* Гамбургер-меню для смартфонів та планшетів (до md) */}
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 1, display: { xs: 'inline-flex', md: 'none' } }}
            aria-label="відкрити меню"
          >
            <MenuIcon />
          </IconButton>

          <InventoryIcon sx={{ mr: 1.5, display: { xs: 'none', sm: 'inline-flex' } }} />
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1, 
              fontWeight: 'bold',
              fontSize: { xs: '1rem', sm: '1.25rem' },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            Складський облік
          </Typography>

          {/* МЕНЮ НАВІГАЦІЇ ДЛЯ ДЕСКТОПУ (md+) */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, mr: 2 }}>
            {navItems.map((item) => (
              <Button
                key={item.id}
                color={item.id === 'admin' ? 'warning' : 'inherit'}
                startIcon={item.icon}
                variant={currentView === item.id ? 'outlined' : 'text'}
                onClick={() => setCurrentView(item.id)}
                sx={{
                  backgroundColor: currentView === item.id ? 'rgba(255,255,255,0.2)' : 'transparent',
                  fontWeight: currentView === item.id ? 700 : 500,
                  borderRadius: 1.5
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          {/* ІНДИКАТОР РЕАЛЬНОГО ЧАСУ (SIGNALR) */}
          <SignalRStatusBadge />

          {/* ПЕРЕМИКАЧ ТЕМИ */}
          <ThemeToggle />

          {/* ІНФО ПРО ЮЗЕРА (Сховано на маленьких екранах xs) */}
          <Chip 
            icon={<PersonIcon />} 
            label={`${username} (${userRole})`} 
            color={isAdmin ? "warning" : "default"}
            variant="outlined"
            size="small"
            sx={{ 
              mr: 1, 
              color: 'white', 
              borderColor: 'rgba(255,255,255,0.5)', 
              '& .MuiChip-icon': { color: 'white' },
              display: { xs: 'none', sm: 'inline-flex' }
            }} 
          />

          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Вийти">
              <IconButton color="inherit" onClick={handleLogout} size="small">
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* БОКОВЕ МЕНЮ (DRAWER) ДЛЯ МОБІЛЬНИХ ПРИСТРОЇВ */}
      <Drawer
        anchor="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }
        }}
      >
        <Box>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <InventoryIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">
                Складський облік
              </Typography>
            </Box>
            <IconButton onClick={() => setMobileOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider />

          {/* Профіль користувача в Drawer */}
          <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              Авторизований користувач:
            </Typography>
            <Typography variant="body1" fontWeight="bold" sx={{ mt: 0.5 }}>
              {username}
            </Typography>
            <Chip 
              size="small" 
              label={userRole} 
              color={isAdmin ? "warning" : "primary"} 
              sx={{ mt: 0.8 }} 
            />
          </Box>

          <Divider />

          <List sx={{ px: 1, py: 1.5 }}>
            {navItems.map((item) => (
              <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={currentView === item.id}
                  onClick={() => handleNavClick(item.id)}
                  sx={{
                    borderRadius: 1.5,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText'
                      },
                      '&:hover': {
                        bgcolor: 'primary.dark'
                      }
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: currentView === item.id ? 'inherit' : 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 500 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>

        {/* Футер Drawer: Кнопка виходу */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Вийти з акаунту
          </Button>
        </Box>
      </Drawer>

      {/* ОСНОВНИЙ КОНТЕНТ */}
      <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 3, md: 4 }, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
        {currentView === 'list' && <ProductList isAdmin={isAdmin} />}

        {currentView === 'categories' && <CategoryList isAdmin={isAdmin} />}
        
        {currentView === 'partners' && <Partners />}
        
        {currentView === 'dashboard' && <Dashboard />}

        {currentView === 'intelligence' && <ProcurementIntelligence />}
        
        {currentView === 'admin' && isAdmin && (<AdminPage onBack={() => setCurrentView('list')} />)}
      </Container>

      {/* ІНТЕЛЕКТУАЛЬНИЙ AI-КОПІЛОТ СКЛАДУ (DRAWER + FAB) */}
      <WarehouseCopilot onNavigateToTab={(tab) => setCurrentView(tab)} />
    </SignalRProvider>
  );
}

export default App;