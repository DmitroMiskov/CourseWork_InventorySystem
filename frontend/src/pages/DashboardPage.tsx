import { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import DashboardStats from '../components/DashboardStats';
import AnalyticsCharts from '../components/AnalyticsCharts';

export default function DashboardPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const AZURE_API_URL = "https://inventory-api-miskov-dtcyece6dme4hme8.polandcentral-01.azurewebsites.net";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
            window.location.href = '/login'; 
            return;
        }

        console.log("Завантажую товари з:", `${AZURE_API_URL}/api/products`);

        const response = await axios.get(`${AZURE_API_URL}/api/products`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        setProducts(response.data);
      } catch (err) {
        console.error("Помилка завантаження:", err);
        setError('Не вдалося завантажити дані. Можливо, сплив термін дії входу.');
        
        if (axios.isAxiosError(err)) {
            if (err.response && err.response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
            setError(`Помилка: ${err.response?.data?.message || err.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Аналітика складу</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Загальний огляд стану запасів та фінансова статистика.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Якщо товарів немає, але й помилки немає — показуємо порожню статистику */}
      {!loading && !error && (
          <>
            <DashboardStats products={products} />
            <AnalyticsCharts products={products} />
          </>
      )}
    </Box>
  );
}