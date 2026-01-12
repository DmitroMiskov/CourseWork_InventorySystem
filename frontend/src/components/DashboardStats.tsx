import React from 'react';
import { Paper, Grid as Grid, Typography, Box } from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningIcon from '@mui/icons-material/Warning';

// --- ТИПИ ---
interface Product {
  id: string;
  price: number;
  minStock: number;
  quantity: number;
}

interface DashboardStatsProps {
  products: Product[];
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

// --- КОМПОНЕНТ StatCard (ВИНЕСЕНИЙ НАЗОВНІ) ---
// Тепер він живе окремо і не перестворюється при кожному рендері
const StatCard = ({ title, value, icon, color, bgColor }: StatCardProps) => (
  <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
    <Box>
      <Typography variant="subtitle2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 'bold', color: color }}>
        {value}
      </Typography>
    </Box>
    <Box sx={{ 
      bgcolor: bgColor, 
      p: 1.5, 
      borderRadius: '50%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      {icon}
    </Box>
  </Paper>
);

// --- ГОЛОВНИЙ КОМПОНЕНТ ---
export default function DashboardStats({ products }: DashboardStatsProps) {
  
  // Логіка підрахунків
  const totalProducts = products.length;

  const totalValue = products.reduce((sum, product) => {
    return sum + (product.price * product.quantity);
  }, 0);

  const lowStockCount = products.filter(p => p.quantity <= p.minStock).length;

  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {/* Картка 1: Всього товарів */}
      <Grid size={{ xs: 12, sm: 4 }}>
        <StatCard 
          title="Всього позицій" 
          value={totalProducts} 
          icon={<InventoryIcon sx={{ color: '#1976d2' }} />} 
          color="#1976d2"
          bgColor="#e3f2fd"
        />
      </Grid>

      {/* Картка 2: Загальна вартість */}
      <Grid size={{ xs: 12, sm: 4 }}>
        <StatCard 
          title="Вартість складу" 
          value={`${totalValue.toLocaleString()} грн`} 
          icon={<AttachMoneyIcon sx={{ color: '#2e7d32' }} />} 
          color="#2e7d32"
          bgColor="#e8f5e9"
        />
      </Grid>

      {/* Картка 3: Проблемні товари */}
      <Grid size={{ xs: 12, sm: 4 }}>
        <StatCard 
          title="Закінчуються" 
          value={lowStockCount} 
          icon={<WarningIcon sx={{ color: '#d32f2f' }} />} 
          color="#d32f2f"
          bgColor="#ffebee"
        />
      </Grid>
    </Grid>
  );
}