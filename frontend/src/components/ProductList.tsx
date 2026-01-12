import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { 
  Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Typography, Box, CircularProgress, Button 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CreateProductModal from './CreateProductModal';

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  minStock: number;
  unit: string;
  category?: {
    name: string;
  };
}

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  // 1. Починаємо з true, щоб при першому запуску спінер вже крутився
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 2. Ця функція тепер просто тягне дані і вимикає спінер в кінці
  const fetchProducts = useCallback(() => {
    // Ми ПРИБРАЛИ звідси setLoading(true), щоб не було конфлікту з useEffect
    
    axios.get('/api/products')
      .then(response => {
        setProducts(response.data);
      })
      .catch(error => {
        console.error("Помилка:", error);
      })
      .finally(() => {
        // Вимикаємо спінер незалежно від результату
        setLoading(false);
      });
  }, []);

  // 3. useEffect викликається один раз при старті
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // 4. Спеціальна функція для оновлення після створення товару
  const handleRefresh = () => {
    setLoading(true); // Тут ми вручну вмикаємо спінер
    fetchProducts();  // І запускаємо завантаження
  };

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Складські запаси
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => setIsModalOpen(true)}
          sx={{ height: 40 }}
        >
          Додати товар
        </Button>
      </Box>
      
      {loading ? (
         <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ width: '100%', mb: 4 }}>
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead sx={{ backgroundColor: '#1976d2' }}>
              <TableRow>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Артикул</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Назва</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Категорія</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Ціна</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Статус</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} hover>
                  <TableCell>{product.sku || '-'}</TableCell>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>{product.name}</TableCell>
                  <TableCell>{product.category?.name || 'Без категорії'}</TableCell>
                  <TableCell align="right">{product.price} грн</TableCell>
                  <TableCell align="center">
                    <Box sx={{ 
                      color: product.minStock === 0 ? 'green' : 'green', 
                      fontWeight: 'bold', p: 1, borderRadius: 1, bgcolor: '#e8f5e9'
                    }}>
                      В наявності
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">Даних немає</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CreateProductModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onProductCreated={handleRefresh} // <-- Використовуємо нову функцію refresh
      />
    </Box>
  );
}