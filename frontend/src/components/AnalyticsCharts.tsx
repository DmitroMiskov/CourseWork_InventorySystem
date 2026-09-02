import { useMemo } from 'react';
import { Paper, Typography, Box, LinearProgress, Divider } from '@mui/material';
import type { Product } from './Dashboard';

interface AnalyticsChartsProps {
  products: Product[];
}

interface CategorySummary {
  name: string;
  totalQuantity: number;
  percentage: number;
}

export default function AnalyticsCharts({ products }: AnalyticsChartsProps) {
  const data = useMemo<CategorySummary[]>(() => {
    const totalItems = products.reduce((acc, p) => acc + p.quantity, 0);
    if (totalItems === 0) return [];

    const categoryMap = new Map<string, number>();

    products.forEach((p) => {
      const catName = p.category?.name || 'Без категорії';
      const current = categoryMap.get(catName) || 0;
      categoryMap.set(catName, current + p.quantity);
    });

    return Array.from(categoryMap.entries()).map(([name, totalQuantity]) => ({
      name,
      totalQuantity,
      percentage: Math.round((totalQuantity / totalItems) * 100),
    }));
  }, [products]);

  return (
    <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Розподіл товарів за категоріями
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Дані для графіків відсутні
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {data.map((item) => (
            <Box key={item.name}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" fontWeight="500">
                  {item.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.totalQuantity} од. ({item.percentage}%)
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={item.percentage}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}