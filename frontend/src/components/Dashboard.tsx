import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import api from '../api/axiosConfig';
import { Box, CircularProgress, Typography, Alert, Button, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DashboardStats from './DashboardStats';
import AnalyticsCharts from './AnalyticsCharts';
import type { Product, Category, StockMovement } from '../types/inventory';

export type { Product };

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Ви не авторизовані. Будь ласка, увійдіть.');
        setLoading(false);
        return;
      }

      const [prodRes, catRes, movRes] = await Promise.all([
        api.get<Product[] | { items: Product[] }>('/products'),
        api.get<Category[] | { items: Category[] }>('/categories'),
        api.get<StockMovement[]>('/stockmovements?limit=100').catch(() => ({ data: [] }))
      ]);

      const productList = Array.isArray(prodRes.data)
        ? prodRes.data
        : (Array.isArray(prodRes.data?.items) ? prodRes.data.items : []);
      const categoryList = Array.isArray(catRes.data)
        ? catRes.data
        : (Array.isArray(catRes.data?.items) ? catRes.data.items : []);
      const movementList = Array.isArray(movRes.data) ? movRes.data : [];

      setProducts(productList);
      setCategories(categoryList);
      setMovements(movementList);
      setLastUpdated(new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && products.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12 }}>
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          Завантаження статистики та показників складу...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Аналітика та статистика складу
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Огляд ключових показників, розподілу активів та динаміки руху запасів
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary">
              Оновлено: {lastUpdated}
            </Typography>
          )}
          <Tooltip title="Оновити статистику">
            <IconButton onClick={fetchData} color="primary" disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} action={
          <Button color="inherit" size="small" onClick={fetchData}>
            Повторити
          </Button>
        }>
          {error}
        </Alert>
      )}

      {/* КАРТКИ МЕТРИК ТА KPI */}
      <DashboardStats products={products} categories={categories} movements={movements} />

      {/* ІНТЕРАКТИВНІ ГРАФІКИ ТА АНАЛІТИКА */}
      <AnalyticsCharts products={products} categories={categories} movements={movements} />
    </Box>
  );
}