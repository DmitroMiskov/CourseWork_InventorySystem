import { useEffect, useState } from 'react';
import axios from 'axios'; // 
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import DashboardStats from './DashboardStats';
import AnalyticsCharts from './AnalyticsCharts';

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const AZURE_API_URL = "https://inventory-api-miskov-dtcyece6dme4hme8.polandcentral-01.azurewebsites.net";

  // Завантажуємо дані при відкритті дашборда
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');

        // Якщо токена немає - користувач не залогінений
        if (!token) {
            setError('Ви не авторизовані. Будь ласка, увійдіть.');
            setLoading(false);
            return;
        }

        console.log("Завантаження дашборда з:", `${AZURE_API_URL}/api/products`);

        const res = await axios.get(`${AZURE_API_URL}/api/products`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        setProducts(res.data);
      } catch (err) {
        console.error(err);
        setError('Не вдалося завантажити дані для аналітики. Перевірте з\'єднання.');
        
        // Якщо токен прострочений (401)
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

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Аналітика складу
      </Typography>
      {/* Виводимо ваші картки статистики */}
      <DashboardStats products={products} />
      
      <Box sx={{ mt: 4 }}>
          {/* ВИКОРИСТОВУЄМО ВАШ КОМПОНЕНТ */}
          <AnalyticsCharts products={products} />
      </Box>
    </Box>
  );
}