import { AppBar, Toolbar, Typography, CssBaseline } from '@mui/material';
import ProductList from './components/ProductList';

function App() {
  return (
    <>
      {/* Скидання стандартних стилів браузера */}
      <CssBaseline />
      
      {/* Верхня панель навігації */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            📦 Inventory System
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Наш компонент з таблицею */}
      <ProductList />
    </>
  );
}

export default App;