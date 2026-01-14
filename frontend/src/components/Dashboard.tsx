import { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import DashboardStats from './DashboardStats';
import AnalyticsCharts from './AnalyticsCharts';

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Завантажуємо дані при відкритті дашборда
  useEffect(() => {
    axios.get('/api/products')
      .then(res => {
        setProducts(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Не вдалося завантажити дані для аналітики');
        setLoading(false);
      });
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Аналітика складу
      </Typography>

      {/* 👇 Виводимо ваші картки статистики */}
      <DashboardStats products={products} />
        <Box sx={{ mt: 4 }}>
            {/* 👇 ВИКОРИСТОВУЄМО ВАШ КОМПОНЕНТ */}
            <AnalyticsCharts products={products} />
        </Box>
    </Box>
  );
}