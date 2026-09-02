import { useEffect, useState } from 'react';
import axios from 'axios';
import api from '../api/axiosConfig';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import DashboardStats from './DashboardStats';
import AnalyticsCharts from './AnalyticsCharts';

interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  unit: string;
  categoryId: string;
  category?: Category;
  minStock: number;
  imageUrl?: string;
}

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          setError('Ви не авторизовані. Будь ласка, увійдіть.');
          setLoading(false);
          return;
        }

        const res = await api.get<Product[]>('/products');
        setProducts(res.data);
      } catch (err: unknown) {
        console.error(err);
        setError("Не вдалося завантажити дані для аналітики. Перевірте з'єднання.");

        if (axios.isAxiosError(err) && err.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Аналітика складу
      </Typography>

      <DashboardStats products={products} />

      <Box sx={{ mt: 4 }}>
        <AnalyticsCharts products={products} />
      </Box>
    </Box>
  );
}