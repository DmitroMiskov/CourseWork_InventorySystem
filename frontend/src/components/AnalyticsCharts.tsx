import { useMemo } from 'react';
import {
  Paper, Typography, Box, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import type { Product, Category, StockMovement } from '../types/inventory';
import { useLanguage } from '../context/LanguageContext';

interface AnalyticsChartsProps {
  products: Product[];
  categories: Category[];
  movements: StockMovement[];
}

const PALETTE = [
  '#1976d2', '#2e7d32', '#ed6c02', '#9c27b0',
  '#0288d1', '#e91e63', '#00897b', '#f57c00'
];

export default function AnalyticsCharts({ products, categories, movements }: AnalyticsChartsProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const chartTooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  };
  const axisStroke = isDark ? '#94a3b8' : '#64748b';
  const gridStroke = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';

  const safeProducts = useMemo(() => Array.isArray(products) ? products : [], [products]);
  const safeCategories = useMemo(() => Array.isArray(categories) ? categories : [], [categories]);
  const safeMovements = useMemo(() => Array.isArray(movements) ? movements : [], [movements]);

  // 1. Розподіл вартості за категоріями
  const categoryChartData = useMemo(() => {
    const categoryMap: Record<string, { name: string; value: number; count: number }> = {};

    safeCategories.forEach((cat) => {
      categoryMap[cat.id] = { name: cat.name, value: 0, count: 0 };
    });

    safeProducts.forEach((p) => {
      const catId = p.categoryId || 'unknown';
      const catName = p.category?.name || categoryMap[catId]?.name || 'Other';
      if (!categoryMap[catId]) {
        categoryMap[catId] = { name: catName, value: 0, count: 0 };
      }
      categoryMap[catId].value += (p.price || 0) * (p.quantity || 0);
      categoryMap[catId].count += p.quantity || 0;
    });

    return Object.values(categoryMap)
      .filter((item) => item.value > 0 || item.count > 0)
      .map((item) => ({
        ...item,
        value: Math.round(item.value)
      }))
      .sort((a, b) => b.value - a.value);
  }, [safeProducts, safeCategories]);

  // 2. Стан запасів (Здоров'я складу)
  const stockHealthData = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    safeProducts.forEach((p) => {
      const qty = p.quantity || 0;
      const min = p.minStock || 0;
      if (qty === 0) {
        outOfStock++;
      } else if (qty <= min) {
        lowStock++;
      } else {
        inStock++;
      }
    });

    return [
      { name: t('dashboard.inStock'), value: inStock, color: '#2e7d32' },
      { name: t('dashboard.lowStock'), value: lowStock, color: '#ed6c02' },
      { name: t('dashboard.outOfStockStatus'), value: outOfStock, color: '#d32f2f' }
    ].filter((item) => item.value > 0);
  }, [safeProducts, t]);

  // 3. Топ найцінніших товарів на складі
  const topValuedProducts = useMemo(() => {
    return safeProducts
      .map((p) => ({
        name: p.name.length > 18 ? `${p.name.substring(0, 18)}...` : p.name,
        fullName: p.name,
        totalValue: Math.round((p.price || 0) * (p.quantity || 0)),
        quantity: p.quantity,
        price: p.price,
        unit: p.unit || t('common.pcs')
      }))
      .filter((p) => p.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 6);
  }, [safeProducts, t]);

  // 4. Динаміка руху складських залишків
  const movementTrendData = useMemo(() => {
    if (safeMovements.length === 0) return [];

    const dateMap: Record<string, { date: string; incoming: number; outgoing: number }> = {};

    safeMovements.forEach((m) => {
      const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' }) : '—';
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = { date: dateStr, incoming: 0, outgoing: 0 };
      }
      if (m.type === 1) {
        dateMap[dateStr].incoming += m.quantity || 0;
      } else if (m.type === 2) {
        dateMap[dateStr].outgoing += m.quantity || 0;
      }
    });

    return Object.values(dateMap).slice(-10);
  }, [safeMovements]);

  // 5. Список товарів, що потребують поповнення
  const alertProducts = useMemo(() => {
    return safeProducts
      .filter((p) => (p.quantity || 0) <= (p.minStock || 0))
      .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
      .slice(0, 5);
  }, [safeProducts]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* РЯД 1: ДВА КРУГОВИХ ГРАФІКИ */}
      <Grid container spacing={3}>
        {/* Графік 1: Розподіл вартості за категоріями */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, borderRadius: 2, height: '100%', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              {t('dashboard.costDistribution')}
            </Typography>

            {categoryChartData.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                {t('common.emptyData')}
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={55}
                      paddingAngle={2}
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell key={`cat-cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(val: number | string | undefined) =>
                        typeof val === 'number'
                          ? [`${val.toLocaleString()} ${t('common.uah')}`, t('dashboard.sumValue')]
                          : [val ?? '', t('dashboard.sumValue')]
                      }
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Графік 2: Стан запасів */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, borderRadius: 2, height: '100%', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              {t('dashboard.stockHealth')}
            </Typography>

            {stockHealthData.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                {t('common.emptyData')}
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stockHealthData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      innerRadius={50}
                      paddingAngle={3}
                    >
                      {stockHealthData.map((entry, index) => (
                        <Cell key={`health-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(val: number | string | undefined) =>
                        typeof val === 'number'
                          ? [`${val} ${t('common.pcs')}`, t('products.quantity')]
                          : [val ?? '', t('products.quantity')]
                      }
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* РЯД 2: СТОВПЧАСТІ ТА ДИНАМІЧНІ ГРАФІКИ */}
      <Grid container spacing={3}>
        {/* Графік 3: Топ найцінніших товарів */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 2, height: '100%', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              {t('dashboard.topProducts')}
            </Typography>

            {topValuedProducts.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                {t('common.emptyData')}
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topValuedProducts} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                    <XAxis dataKey="name" angle={-15} textAnchor="end" interval={0} fontSize={12} stroke={axisStroke} />
                    <YAxis stroke={axisStroke} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(val: number | string | undefined) =>
                        typeof val === 'number'
                          ? [`${val.toLocaleString()} ${t('common.uah')}`, t('dashboard.sumValue')]
                          : [val ?? '', t('dashboard.sumValue')]
                      }
                    />
                    <Bar dataKey="totalValue" fill={isDark ? "#38bdf8" : "#1976d2"} radius={[4, 4, 0, 0]} name={`${t('dashboard.sumValue')} (${t('common.uah')})`} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Графік 4: Динаміка операцій */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 2, height: '100%', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              {t('dashboard.operationsDynamics')}
            </Typography>

            {movementTrendData.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                {t('common.emptyData')}
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={movementTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                    <XAxis dataKey="date" fontSize={12} stroke={axisStroke} />
                    <YAxis stroke={axisStroke} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    <Area type="monotone" dataKey="incoming" stroke="#2e7d32" fill={isDark ? "rgba(46, 125, 50, 0.4)" : "#a5d6a7"} name={t('operations.receipt')} />
                    <Area type="monotone" dataKey="outgoing" stroke="#d32f2f" fill={isDark ? "rgba(211, 47, 47, 0.4)" : "#ffcdd2"} name={t('operations.writeOff')} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* РЯД 3: ТЕРМІНОВЕ ПОПОВНЕННЯ СКЛАДУ */}
      <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <WarningAmberIcon color="warning" />
          <Typography variant="h6" fontWeight="bold">
            {t('dashboard.reorderAlerts')}
          </Typography>
        </Box>

        {alertProducts.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: isDark ? 'rgba(46, 125, 50, 0.15)' : '#f1f8e9', borderRadius: 1, color: isDark ? '#81c784' : '#2e7d32' }}>
            <CheckCircleOutlineIcon />
            <Typography variant="body2" fontWeight="500">
              {t('dashboard.allGood')}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table size="small" sx={{ minWidth: 480 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>{t('products.name')}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{t('products.sku')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('intelligence.currentStock')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('products.minStock')}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>{t('intelligence.urgencyStatus')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alertProducts.map((p) => {
                  const isZero = (p.quantity || 0) === 0;
                  return (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                      <TableCell>{p.sku || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: isZero ? 'error.main' : 'warning.dark' }}>
                        {p.quantity} {p.unit || t('common.pcs')}
                      </TableCell>
                      <TableCell align="right">
                        {p.minStock} {p.unit || t('common.pcs')}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={isZero ? t('dashboard.outOfStockStatus') : t('dashboard.lowStock')}
                          color={isZero ? 'error' : 'warning'}
                          variant="filled"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}