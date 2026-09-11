import type { ReactNode } from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CategoryIcon from '@mui/icons-material/Category';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import type { Product, Category, StockMovement } from '../types/inventory';

interface DashboardStatsProps {
  products: Product[];
  categories: Category[];
  movements: StockMovement[];
}

interface StatItemProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color: string;
  bgColor: string;
}

const StatCard = ({ title, value, subtitle, icon, color, bgColor }: StatItemProps) => (
  <Paper 
    elevation={1} 
    sx={{ 
      p: 2.5, 
      display: 'flex', 
      alignItems: 'center', 
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: 3
      }
    }}
  >
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: 2,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? `${color}25` : bgColor,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mr: 2,
        flexShrink: 0
      }}
    >
      {icon}
    </Box>
    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="h5" fontWeight="bold" sx={{ my: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </Box>
  </Paper>
);

export default function DashboardStats({ products, categories, movements }: DashboardStatsProps) {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeMovements = Array.isArray(movements) ? movements : [];

  const totalCost = safeProducts.reduce((acc, p) => acc + (p.price || 0) * (p.quantity || 0), 0);
  const totalQuantity = safeProducts.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const lowStockCount = safeProducts.filter((p) => (p.quantity || 0) <= (p.minStock || 0) && (p.quantity || 0) > 0).length;
  const outOfStockCount = safeProducts.filter((p) => (p.quantity || 0) === 0).length;

  return (
    <Grid container spacing={2.5} sx={{ mb: 4 }}>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title="Вартість складу"
          value={`${Math.round(totalCost).toLocaleString('uk-UA')} ₴`}
          subtitle="Сумарна оцінка активів"
          icon={<AttachMoneyIcon fontSize="medium" />}
          color="#2e7d32"
          bgColor="#e8f5e9"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title="Загальний залишок"
          value={totalQuantity.toLocaleString('uk-UA')}
          subtitle="Одиниць продукції на складі"
          icon={<Inventory2Icon fontSize="medium" />}
          color="#1976d2"
          bgColor="#e3f2fd"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title="Номенклатура (SKU)"
          value={safeProducts.length}
          subtitle={`У ${safeCategories.length} категоріях`}
          icon={<CategoryIcon fontSize="medium" />}
          color="#7b1fa2"
          bgColor="#f3e5f5"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title="Критичний залишок"
          value={lowStockCount}
          subtitle="Менше або рівне мін. ліміту"
          icon={<WarningAmberIcon fontSize="medium" />}
          color="#ed6c02"
          bgColor="#fff3e0"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title="Закінчились на складі"
          value={outOfStockCount}
          subtitle="Потребують термінового замовлення"
          icon={<ErrorOutlineIcon fontSize="medium" />}
          color="#d32f2f"
          bgColor="#ffebee"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title="Операції зі складом"
          value={safeMovements.length}
          subtitle="Зафіксовано рухів товарів"
          icon={<SyncAltIcon fontSize="medium" />}
          color="#00838f"
          bgColor="#e0f7fa"
        />
      </Grid>
    </Grid>
  );
}