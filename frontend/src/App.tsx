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
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloseIcon from '@mui/icons-material/Close';
import PsychologyIcon from '@mui/icons-material/Psychology';
import HistoryIcon from '@mui/icons-material/History';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';

// Компоненти
import ProductList from './components/ProductList';
import CategoryList from './components/CategoryList';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Partners from './components/Partners';
import AdminPage from './components/AdminPage';
import AuditLogPage from './components/AuditLogPage';
import InventoryAuditPage from './components/InventoryAuditPage';
import ReportsPage from './components/ReportsPage';
import PurchaseOrdersPage from './components/PurchaseOrdersPage';
import ProcurementIntelligence from './components/ProcurementIntelligence';
import WarehouseCopilot from './components/WarehouseCopilot';
import SignalRStatusBadge from './components/SignalRStatusBadge';
import NotificationCenter from './components/NotificationCenter';
import ThemeToggle from './components/ThemeToggle';
import LanguageToggle from './components/LanguageToggle';
import { useLanguage } from './context/LanguageContext';
import { SignalRProvider } from './context/SignalRContext';
import type { CustomJwtPayload } from './types/inventory';

export type ViewType = 'list' | 'categories' | 'dashboard' | 'partners' | 'purchaseOrders' | 'intelligence' | 'admin' | 'auditLog' | 'inventoryAudit' | 'reports';

function App() {
  // КРОК 1: Функція для отримання початкового стану (працює синхронно)
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
  
  const [currentView, setCurrentView] = useState<ViewType>('list');

  // Стан бокової панелі: десктопна панель з можливістю згортання та мобільний Drawer
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_open');
    return saved !== null ? saved === 'true' : window.innerWidth >= 1200;
  });
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Оновлення стану після успішного входу
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

  interface NavItem {
    id: ViewType;
    label: string;
    icon: React.ReactNode;
  }

  interface NavGroup {
    title: string;
    items: NavItem[];
  }

  const mainGroup: NavGroup = {
    title: t('nav.mainSection'),
    items: [
      { id: 'list', label: t('nav.inventory'), icon: <TableChartIcon /> },
      { id: 'categories', label: t('nav.categories'), icon: <CategoryIcon /> },
      { id: 'partners', label: t('nav.partners'), icon: <PeopleIcon /> },
      { id: 'purchaseOrders', label: t('nav.purchaseOrders'), icon: <ShoppingCartIcon /> },
      { id: 'dashboard', label: t('nav.dashboard'), icon: <BarChartIcon /> },
    ]
  };

  const analyticsGroup: NavGroup = {
    title: t('nav.analyticsSection'),
    items: [
      { id: 'intelligence', label: t('nav.intelligence'), icon: <PsychologyIcon /> },
      { id: 'inventoryAudit', label: t('nav.inventoryAudit'), icon: <FactCheckIcon /> },
      { id: 'reports', label: t('nav.reports'), icon: <AssessmentIcon /> },
    ]
  };

  const adminGroup: NavGroup = {
    title: t('nav.adminSection'),
    items: [
      { id: 'admin', label: t('nav.staff'), icon: <SupervisorAccountIcon /> },
      { id: 'auditLog', label: t('nav.auditLog'), icon: <HistoryIcon /> },
    ]
  };

  // Групування елементів меню для структурованої бокової панелі
  const navGroups: NavGroup[] = [
    mainGroup,
    ...(canAccessML ? [analyticsGroup] : []),
    ...(canAccessAdmin ? [adminGroup] : [])
  ];

  const allNavItems: NavItem[] = navGroups.flatMap(g => g.items);

  const getCurrentViewLabel = (): string => {
    const item = allNavItems.find(i => i.id === currentView);
    return item ? item.label : '';
  };

  const handleNavClick = (view: ViewType) => {
    if ((view === 'intelligence' || view === 'inventoryAudit' || view === 'reports') && !canAccessML) {
      setCurrentView('list');
    } else if ((view === 'admin' || view === 'auditLog') && !canAccessAdmin) {
      setCurrentView('list');
    } else {
      setCurrentView(view);
    }
    setMobileOpen(false);
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth < 900) {
      setMobileOpen(prev => !prev);
    } else {
      setSidebarOpen(prev => {
        const next = !prev;
        localStorage.setItem('sidebar_open', String(next));
        return next;
      });
    }
  };

  // Вміст бокової навігаційної панелі
  const renderSidebarContent = (onClose?: () => void) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }}>
      {/* Шапка бокового меню з кнопкою згортання */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <InventoryIcon color="primary" sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
              {t('common.appName')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Система управління складом
            </Typography>
          </Box>
        </Box>
        <Tooltip title={t('nav.hideSidebar')}>
          <IconButton size="small" onClick={() => (onClose ? onClose() : handleToggleSidebar())}>
            {onClose ? <CloseIcon fontSize="small" /> : <ChevronLeftIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Користувач */}
      <Box sx={{ p: 2, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="body2" fontWeight="bold" noWrap>
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

      {/* Список розділів меню */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1.5 }}>
        {navGroups.map((group, groupIdx) => (
          <Box key={groupIdx} sx={{ mb: 1.5 }}>
            <Typography
              variant="caption"
              sx={{
                px: 2.5,
                py: 0.5,
                display: 'block',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'text.secondary',
                fontSize: '0.7rem'
              }}
            >
              {group.title}
            </Typography>
            <List dense disablePadding sx={{ px: 1 }}>
              {group.items.map((item) => {
                const isSelected = currentView === item.id;
                return (
                  <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      selected={isSelected}
                      onClick={() => {
                        handleNavClick(item.id);
                        if (onClose) onClose();
                      }}
                      sx={{
                        borderRadius: 2,
                        px: 1.8,
                        py: 0.9,
                        transition: 'all 0.15s ease-in-out',
                        '&.Mui-selected': {
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          boxShadow: '0 2px 8px rgba(25, 118, 210, 0.28)',
                          '& .MuiListItemIcon-root': {
                            color: 'primary.contrastText'
                          },
                          '&:hover': {
                            bgcolor: 'primary.dark'
                          }
                        },
                        '&:hover': {
                          bgcolor: isSelected ? 'primary.dark' : 'action.hover'
                        }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 38, color: isSelected ? 'inherit' : 'text.secondary' }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: '0.88rem',
                          fontWeight: isSelected ? 700 : 500
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
            {groupIdx < navGroups.length - 1 && <Divider sx={{ my: 1, mx: 2 }} />}
          </Box>
        ))}
      </Box>

      {/* Футер бокової панелі: вихід */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="outlined"
          color="error"
          size="small"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ borderRadius: 2 }}
        >
          {t('common.logout')}
        </Button>
      </Box>
    </Box>
  );

  return (
    <SignalRProvider isAuthenticated={isAuthenticated}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* ВЕРХНЯ ПАНЕЛЬ (APPBAR) - простора, чиста, не перевантажена кнопками сторінок */}
        <AppBar position="sticky" elevation={1}>
          <Toolbar sx={{ px: { xs: 1.5, sm: 2 } }}>
            {/* Кнопка перемикання / приховування бокової панелі */}
            <Tooltip title={sidebarOpen ? t('nav.hideSidebar') : t('nav.showSidebar')}>
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleToggleSidebar}
                sx={{ mr: 1.5 }}
                aria-label="toggle sidebar"
              >
                {sidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
              </IconButton>
            </Tooltip>

            <InventoryIcon sx={{ mr: 1, display: { xs: 'none', sm: 'inline-flex' } }} />
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 'bold',
                fontSize: { xs: '1rem', sm: '1.2rem' },
                whiteSpace: 'nowrap',
                mr: 1.5
              }}
            >
              {t('common.appName')}
            </Typography>

            {/* Індикатор поточної сторінки */}
            <Chip
              label={getCurrentViewLabel()}
              size="small"
              variant="outlined"
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.4)',
                fontWeight: 600,
                display: { xs: 'none', sm: 'inline-flex' }
              }}
            />

            <Box sx={{ flexGrow: 1 }} />

            {/* ЦЕНТР СПОВІЩЕНЬ ТА АЛЕРТІВ */}
            <NotificationCenter onNavigate={(view) => setCurrentView(view as any)} />

            {/* ІНДИКАТОР РЕАЛЬНОГО ЧАСУ (SIGNALR) */}
            <SignalRStatusBadge />

            {/* ПЕРЕМИКАЧ МОВИ (UA/EN) */}
            <LanguageToggle />

            {/* ПЕРЕМИКАЧ ТЕМИ */}
            <ThemeToggle />

            {/* ІНФО ПРО ЮЗЕРА */}
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
                display: { xs: 'none', md: 'inline-flex' }
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

        {/* ОСНОВНА РОБОЧА ОБЛАСТЬ: БОКОВА ПАНЕЛЬ + КОНТЕНТ */}
        <Box sx={{ display: 'flex', flexGrow: 1, position: 'relative' }}>
          {/* ДЕСКТОПНА БОКОВА ПАНЕЛЬ (md+): плавно згортається або розгортається */}
          <Box
            component="nav"
            sx={{
              width: { md: sidebarOpen ? 260 : 0 },
              flexShrink: 0,
              display: { xs: 'none', md: 'block' },
              transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
              borderRight: sidebarOpen ? 1 : 0,
              borderColor: 'divider',
              overflow: 'hidden',
              position: 'sticky',
              top: 64,
              height: 'calc(100vh - 64px)',
              bgcolor: 'background.paper',
              zIndex: 10
            }}
          >
            <Box sx={{ width: 260, height: '100%' }}>
              {renderSidebarContent()}
            </Box>
          </Box>

          {/* МОБІЛЬНЕ БОКОВЕ МЕНЮ (xs, sm): висувне меню Drawer */}
          <Drawer
            variant="temporary"
            anchor="left"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box' }
            }}
          >
            {renderSidebarContent(() => setMobileOpen(false))}
          </Drawer>

          {/* ОСНОВНИЙ КОНТЕНТ СТОРІНКИ */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: { xs: 1.5, sm: 2, md: 3 },
              width: { md: sidebarOpen ? 'calc(100% - 260px)' : '100%' },
              transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
              minHeight: 'calc(100vh - 64px)',
              overflowX: 'auto'
            }}
          >
            <Container maxWidth="xl" disableGutters>
              {currentView === 'list' && <ProductList isAdmin={isAdmin} isManager={isManager} />}

              {currentView === 'categories' && <CategoryList isAdmin={isAdmin} isManager={isManager} />}
              
              {currentView === 'partners' && <Partners isAdmin={isAdmin} isManager={isManager} />}
              
              {currentView === 'purchaseOrders' && <PurchaseOrdersPage isAdmin={isAdmin} isManager={isManager} />}
              
              {currentView === 'dashboard' && <Dashboard />}

              {currentView === 'intelligence' && canAccessML && <ProcurementIntelligence />}
              
              {currentView === 'admin' && canAccessAdmin && (<AdminPage onBack={() => setCurrentView('list')} />)}

              {currentView === 'auditLog' && canAccessAdmin && <AuditLogPage />}

              {currentView === 'inventoryAudit' && canAccessML && <InventoryAuditPage isAdmin={isAdmin} isManager={isManager} />}

              {currentView === 'reports' && canAccessML && <ReportsPage />}
            </Container>
          </Box>
        </Box>

        {/* ІНТЕЛЕКТУАЛЬНИЙ AI-КОПІЛОТ СКЛАДУ (DRAWER + FAB) */}
        <WarehouseCopilot 
          onNavigateToTab={(tab) => {
            if ((tab === 'intelligence' || tab === 'inventoryAudit' || tab === 'reports') && !canAccessML) return;
            if (tab === 'admin' && !canAccessAdmin) return;
            if (tab === 'auditLog' && !canAccessAdmin) return;
            setCurrentView(tab);
          }} 
        />
      </Box>
    </SignalRProvider>
  );
}

export default App;
