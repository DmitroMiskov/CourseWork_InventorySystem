import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Typography, Container, CircularProgress 
} from '@mui/material';

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  minStockLevel: number;
  unitOfMeasurement: string;
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
    return <Container sx={{ mt: 5, textAlign: 'center' }}><CircularProgress /></Container>;
  }

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Складські запаси</Typography>
      <TableContainer component={Paper}>
        <Table aria-label="simple table">
          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
            <TableRow>
              <TableCell><strong>Артикул</strong></TableCell>
              <TableCell><strong>Назва</strong></TableCell>
              <TableCell><strong>Категорія</strong></TableCell>
              <TableCell align="right"><strong>Ціна</strong></TableCell>
              <TableCell align="center"><strong>Статус</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.sku || '-'}</TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.category?.name || '-'}</TableCell>
                <TableCell align="right">{product.price}</TableCell>
                <TableCell align="center">В наявності</TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
               <TableRow><TableCell colSpan={5} align="center">Немає даних</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}