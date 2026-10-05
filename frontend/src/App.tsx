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
import LanguageToggle from './components/LanguageToggle';
import { useLanguage } from './context/LanguageContext';
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
  
  const { t } = useLanguage();
  const roleNormalized = (userRole || '').toLowerCase();
  const isAdmin = roleNormalized === 'admin';
  const isManager = roleNormalized === 'manager';
  const canAccessML = isAdmin || isManager;
  const canAccessAdmin = isAdmin;

  const getRoleDisplay = () => {
    if (isAdmin) return { label: t('roles.admin'), color: 'warning' as const, icon: <SupervisorAccountIcon /> };
    if (isManager) return { label: t('roles.manager'), color: 'secondary' as const, icon: <PsychologyIcon /> };
    return { label: t('roles.worker'), color: 'info' as const, icon: <InventoryIcon /> };
  };

  const roleInfo = getRoleDisplay();

  const navItems = [
    { id: 'list' as const, label: t('nav.inventory'), icon: <TableChartIcon /> },
    { id: 'categories' as const, label: t('nav.categories'), icon: <CategoryIcon /> },
    { id: 'partners' as const, label: t('nav.partners'), icon: <PeopleIcon /> },
    { id: 'dashboard' as const, label: t('nav.dashboard'), icon: <BarChartIcon /> },
    ...(canAccessML ? [{ id: 'intelligence' as const, label: t('nav.intelligence'), icon: <PsychologyIcon /> }] : []),
    ...(canAccessAdmin ? [{ id: 'admin' as const, label: t('nav.staff'), icon: <SupervisorAccountIcon /> }] : [])
  ];

  const handleNavClick = (view: 'list' | 'categories' | 'dashboard' | 'partners' | 'intelligence' | 'admin') => {
    if (view === 'intelligence' && !canAccessML) {
      setCurrentView('list');
    } else if (view === 'admin' && !canAccessAdmin) {
      setCurrentView('list');
    } else {
      setCurrentView(view);
    }
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
            aria-label="menu"
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
            {t('common.appName')}
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

          {/* ПЕРЕМИКАЧ МОВИ (UA/EN) */}
          <LanguageToggle />

          {/* ПЕРЕМИКАЧ ТЕМИ */}
          <ThemeToggle />

          {/* ІНФО ПРО ЮЗЕРА (Сховано на маленьких екранах xs) */}
          <Chip 
            icon={roleInfo.icon} 
            label={`${username} (${roleInfo.label})`} 
            color={roleInfo.color}
            variant="filled"
            size="small"
            sx={{ 
              mr: 1, 
              color: 'white', 
              fontWeight: 600,
              '& .MuiChip-icon': { color: 'white' },
              display: { xs: 'none', sm: 'inline-flex' }
            }} 
          />

          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title={t('common.logout')}>
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
                {t('common.appName')}
              </Typography>
            </Box>
            <IconButton onClick={() => setMobileOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider />

          {/* Профіль користувача в Drawer (без зайвих текстових ярликів) */}
          <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Typography variant="body1" fontWeight="bold">
              {username}
            </Typography>
            <Chip 
              size="small" 
              icon={roleInfo.icon}
              label={roleInfo.label} 
              color={roleInfo.color} 
              sx={{ mt: 0.8, fontWeight: 'bold' }} 
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
        {currentView === 'list' && <ProductList isAdmin={isAdmin} isManager={isManager} />}

        {currentView === 'categories' && <CategoryList isAdmin={isAdmin} isManager={isManager} />}
        
        {currentView === 'partners' && <Partners isAdmin={isAdmin} isManager={isManager} />}
        
        {currentView === 'dashboard' && <Dashboard />}

        {currentView === 'intelligence' && canAccessML && <ProcurementIntelligence />}
        
        {currentView === 'admin' && canAccessAdmin && (<AdminPage onBack={() => setCurrentView('list')} />)}
      </Container>

      {/* ІНТЕЛЕКТУАЛЬНИЙ AI-КОПІЛОТ СКЛАДУ (DRAWER + FAB) */}
      <WarehouseCopilot 
        onNavigateToTab={(tab) => {
          if (tab === 'intelligence' && !canAccessML) return;
          if (tab === 'admin' && !canAccessAdmin) return;
          setCurrentView(tab);
        }} 
      />
    </SignalRProvider>
  );
}

export default App;