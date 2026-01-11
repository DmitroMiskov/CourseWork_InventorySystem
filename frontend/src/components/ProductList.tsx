import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Typography, Box, CircularProgress 
} from '@mui/material';

// Інтерфейс (перевірте, щоб поля збігалися з вашим Swagger)
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/products')
      .then(response => {
        setProducts(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error("Помилка завантаження:", error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box>;
  }

  return (
    // Використовуємо Box замість Container для повної ширини
    <Box sx={{ p: 3, width: '100%' }}> 
      <Typography variant="h4" gutterBottom>
        Складські запаси
      </Typography>
      
      <TableContainer component={Paper} sx={{ width: '100%', mb: 4 }}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead sx={{ backgroundColor: '#1976d2' }}> {/* Синій заголовок */}
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
                <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                  {product.name}
                </TableCell>
                <TableCell>{product.category?.name || 'Без категорії'}</TableCell>
                <TableCell align="right">{product.price} грн</TableCell>
                <TableCell align="center">
                  <Box sx={{ 
                    color: product.minStock === 0 ? 'green' : (products.length > 0 ? 'green' : 'red'),
                    fontWeight: 'bold',
                    p: 1,
                    borderRadius: 1,
                    bgcolor: '#e8f5e9' // Світло-зелений фон для тесту
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
    </Box>
  );
}