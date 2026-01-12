import { AppBar, Toolbar, Typography, Button, Container } from '@mui/material';
import { Link, Outlet, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory';

export default function Layout() {
  const location = useLocation();

  // Функція для підсвічування активної кнопки
  const isActive = (path: string) => location.pathname === path ? 'secondary' : 'inherit';

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            📦 InventorySystem
          </Typography>
          
          <Button 
            color={isActive('/')} 
            component={Link} 
            to="/" 
            startIcon={<DashboardIcon />}
          >
            Дашборд
          </Button>
          
          <Button 
            color={isActive('/inventory')} 
            component={Link} 
            to="/inventory" 
            startIcon={<InventoryIcon />}
          >
            Склад
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {/* Outlet — це місце, куди підставлятиметься сторінка */}
        <Outlet />
      </Container>
    </>
  );
}