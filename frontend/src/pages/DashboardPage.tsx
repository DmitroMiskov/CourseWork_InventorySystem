import { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, Typography, CircularProgress } from '@mui/material';
import DashboardStats from '../components/DashboardStats';
import AnalyticsCharts from '../components/AnalyticsCharts';

export default function DashboardPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/products')
      .then(res => setProducts(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Аналітика складу</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Загальний огляд стану запасів та фінансова статистика.
      </Typography>

      <DashboardStats products={products} />
      <AnalyticsCharts products={products} />
    </Box>
  );
}