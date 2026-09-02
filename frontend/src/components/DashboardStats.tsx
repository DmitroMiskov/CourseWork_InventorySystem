import type { ReactNode } from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CategoryIcon from '@mui/icons-material/Category';
import type { Product } from './Dashboard';

interface DashboardStatsProps {
  products: Product[];
}

interface StatItemProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color: string;
}

const StatCard = ({ title, value, icon, color }: StatItemProps) => (
  <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', borderRadius: 2 }}>
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: 2,
        bgcolor: `${color}.light`,
        color: `${color}.main`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mr: 2,
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h5" fontWeight="bold">
        {value}
      </Typography>
    </Box>
  </Paper>
);

export default function DashboardStats({ products }: DashboardStatsProps) {
  const totalCost = products.reduce((acc, p) => acc + p.price * p.quantity, 0);
  const lowStockCount = products.filter((p) => p.quantity <= p.minStock).length;
  const uniqueCategoriesCount = new Set(
    products.map((p) => p.categoryId).filter(Boolean)
  ).size;

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title="Всього товарів"
          value={products.length}
          icon={<Inventory2Icon fontSize="large" />}
          color="primary"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title="Загальна вартість"
          value={`${totalCost.toLocaleString('uk-UA')} ₴`}
          icon={<AttachMoneyIcon fontSize="large" />}
          color="success"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title="Критичний залишок"
          value={lowStockCount}
          icon={<WarningAmberIcon fontSize="large" />}
          color="error"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title="Категорій з товарами"
          value={uniqueCategoriesCount}
          icon={<CategoryIcon fontSize="large" />}
          color="info"
        />
      </Grid>
    </Grid>
  );
}