import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip as MuiTooltip
} from '@mui/material';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

// Іконки
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';

import api from '../api/axiosConfig';
import type {
  ProcurementRadarResponse,
  ProcurementRadarItem,
  ForecastResponse,
  AbcXyzResponse
} from '../types/inventory';

const ProcurementIntelligence: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);

  // Стан даних
  const [radarData, setRadarData] = useState<ProcurementRadarResponse | null>(null);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [abcXyzData, setAbcXyzData] = useState<AbcXyzResponse | null>(null);

  // Стан фільтрів прогнозу
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [forecastHorizon, setForecastHorizon] = useState<number>(14);
  const [selectedModel, setSelectedModel] = useState<string>('best');

  // Індикатори завантаження та стану ML-сервісу
  const [loadingRadar, setLoadingRadar] = useState<boolean>(true);
  const [loadingForecast, setLoadingForecast] = useState<boolean>(false);
  const [loadingAbc, setLoadingAbc] = useState<boolean>(false);
  const [isMlOnline, setIsMlOnline] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Перевірка статусу та первинне завантаження
  const checkHealthAndLoadRadar = async () => {
    setLoadingRadar(true);
    setErrorMsg(null);
    try {
      const healthRes = await api.get('/procurementintelligence/health');
      setIsMlOnline(healthRes.data?.mlServiceAvailable ?? true);

      const radarRes = await api.get<ProcurementRadarResponse>('/procurementintelligence/radar');
      setRadarData(radarRes.data);
      if (radarRes.data.items && radarRes.data.items.length > 0) {
        const firstId = String(radarRes.data.items[0].product_id);
        setSelectedProductId(firstId);
        loadForecast(firstId, forecastHorizon, selectedModel);
      }
    } catch (err) {
      console.error('Помилка завантаження Радару закупівель:', err);
      setErrorMsg('Не вдалося завантажити дані Радару. Перевірте з’єднання з сервером.');
    } finally {
      setLoadingRadar(false);
    }
  };

  // Завантаження прогнозу для обраного товару
  const loadForecast = async (prodId: string, horizon: number, model: string) => {
    if (!prodId) return;
    setLoadingForecast(true);
    try {
      const res = await api.get<ForecastResponse>(
        `/procurementintelligence/forecast/${prodId}?horizonDays=${horizon}&modelType=${model}`
      );
      setForecastData(res.data);
    } catch (err) {
      console.error('Помилка завантаження ML-прогнозу:', err);
    } finally {
      setLoadingForecast(false);
    }
  };

  // Завантаження матриці ABC-XYZ
  const loadAbcXyz = async () => {
    setLoadingAbc(true);
    try {
      const res = await api.get<AbcXyzResponse>('/procurementintelligence/abc-xyz?periodDays=180');
      setAbcXyzData(res.data);
    } catch (err) {
      console.error('Помилка завантаження ABC-XYZ аналізу:', err);
    } finally {
      setLoadingAbc(false);
    }
  };

  useEffect(() => {
    checkHealthAndLoadRadar();
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    if (newValue === 1 && !forecastData) {
      loadForecast(selectedProductId, forecastHorizon, selectedModel);
    } else if (newValue === 2 && !abcXyzData) {
      loadAbcXyz();
    }
  };

  const getStatusChip = (status: string, code: string) => {
    switch (code) {
      case 'urgent':
        return <Chip icon={<ErrorOutlineIcon />} label={status} color="error" size="small" sx={{ fontWeight: 'bold' }} />;
      case 'critical':
        return <Chip icon={<WarningAmberIcon />} label={status} color="warning" size="small" sx={{ fontWeight: 'bold' }} />;
      case 'warning':
        return <Chip label={status} color="warning" variant="outlined" size="small" />;
      default:
        return <Chip icon={<CheckCircleOutlineIcon />} label={status} color="success" size="small" />;
    }
  };

  // Підготовка точок для графіку Recharts (об'єднання історії та прогнозу)
  const chartPoints = React.useMemo(() => {
    if (!forecastData) return [];

    const historyMapped = forecastData.historical_points.map((p) => ({
      date: p.date.substring(5), // MM-DD
      actual: p.actual_quantity,
      forecast: null,
      lowerBound: null,
      upperBound: null,
    }));

    const lastHist = forecastData.historical_points[forecastData.historical_points.length - 1];

    const forecastMapped = forecastData.forecast_points.map((p, idx) => ({
      date: p.date.substring(5),
      actual: idx === 0 && lastHist ? lastHist.actual_quantity : null,
      forecast: p.predicted_demand,
      lowerBound: p.lower_bound_95,
      upperBound: p.upper_bound_95,
    }));

    return [...historyMapped, ...forecastMapped];
  }, [forecastData]);

  return (
    <Box sx={{ pb: 6 }}>
      {/* Верхня панель заголовка */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PsychologyIcon color="primary" sx={{ fontSize: 36 }} />
            <Typography variant="h4" fontWeight="bold">
              Інтелектуальне планування запасів
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Система підтримки прийняття рішень (DSS): ML-прогнозування на базі реального комерційного датасету <strong>UCI Machine Learning (Online Retail II — 541 909 транзакцій)</strong>
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            label={isMlOnline ? 'ML Inference Engine: Онлайн' : 'ML Сервіс: Автономний / Резервний'}
            color={isMlOnline ? 'success' : 'warning'}
            variant="outlined"
            size="medium"
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              checkHealthAndLoadRadar();
              loadForecast(selectedProductId, forecastHorizon, selectedModel);
              if (activeTab === 2) loadAbcXyz();
            }}
          >
            Оновити
          </Button>
        </Box>
      </Box>

      {errorMsg && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {errorMsg}
        </Alert>
      )}

      {/* KPI картки стану закупівель */}
      {radarData && (
        <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ bgcolor: 'error.main', color: 'error.contrastText', borderRadius: 2 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="overline" sx={{ opacity: 0.9 }}>
                  Термінові замовлення
                </Typography>
                <Typography variant="h3" fontWeight="bold">
                  {radarData.urgent_count}
                </Typography>
                <Typography variant="caption">Вичерпання запасу &lt; 2 днів</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ bgcolor: 'warning.main', color: 'warning.contrastText', borderRadius: 2 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="overline" sx={{ opacity: 0.9 }}>
                  Критичні залишки (нижче ROP)
                </Typography>
                <Typography variant="h3" fontWeight="bold">
                  {radarData.critical_count + radarData.warning_count}
                </Typography>
                <Typography variant="caption">Потрібне формування замовлення</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ bgcolor: 'success.main', color: 'success.contrastText', borderRadius: 2 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="overline" sx={{ opacity: 0.9 }}>
                  Оптимальний рівень
                </Typography>
                <Typography variant="h3" fontWeight="bold">
                  {radarData.norm_count}
                </Typography>
                <Typography variant="caption">Запас перевищує точку ROP</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ bgcolor: 'primary.dark', color: 'primary.contrastText', borderRadius: 2 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="overline" sx={{ opacity: 0.9 }}>
                  Сума рекоменд. замовлень
                </Typography>
                <Typography variant="h4" fontWeight="bold" sx={{ mt: 0.5 }}>
                  {radarData.total_recommended_procurement_cost.toLocaleString()} ₴
                </Typography>
                <Typography variant="caption">На основі оптимальної партії EOQ</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Вкладки навігації розділу */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} textColor="primary" indicatorColor="primary">
          <Tab icon={<ShoppingCartCheckoutIcon />} iconPosition="start" label="Радар закупівель (SS / ROP / EOQ)" />
          <Tab icon={<TrendingUpIcon />} iconPosition="start" label="Прогнозування попиту (ML Time-Series)" />
          <Tab icon={<PsychologyIcon />} iconPosition="start" label="Матриця портфельного аналізу ABC-XYZ" />
        </Tabs>
      </Box>

      {/* ======================================================== */}
      {/* ВКЛАДКА 1: РАДАР ЗАКУПІВЕЛЬ */}
      {/* ======================================================== */}
      {activeTab === 0 && (
        <Card elevation={2} sx={{ borderRadius: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                Зведена аналітична відомість стану складських запасів
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Квантиль надійності: Z = 1.65 (95% рівень обслуговування)
              </Typography>
            </Box>

            {loadingRadar ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <Table size="small" aria-label="procurement radar table">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Артикул</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Назва товару</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Категорія</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Залишок</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Попит D</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Буфер SS</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Поріг ROP</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Партія EOQ</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Днів до 0</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Статус</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Дозамовлення</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Постачальник</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Дія</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {radarData?.items.map((item: ProcurementRadarItem) => (
                      <TableRow
                        key={item.sku}
                        hover
                        sx={{
                          bgcolor:
                            item.status_code === 'urgent'
                              ? 'rgba(239, 68, 68, 0.08)'
                              : item.status_code === 'critical'
                              ? 'rgba(245, 158, 11, 0.08)'
                              : 'inherit',
                        }}
                      >
                        <TableCell sx={{ fontWeight: 'medium' }}>{item.sku}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{item.current_stock} шт</TableCell>
                        <TableCell align="right">{item.daily_demand} /дн</TableCell>
                        <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                          {item.safety_stock} шт
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{item.reorder_point} шт</TableCell>
                        <TableCell align="right">{item.eoq} шт</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: item.days_to_depletion <= 3 ? 'error.main' : 'inherit' }}>
                          {item.days_to_depletion} дн
                        </TableCell>
                        <TableCell align="center">{getStatusChip(item.status, item.status_code)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: item.recommended_order_qty > 0 ? 'error.main' : 'text.secondary' }}>
                          {item.recommended_order_qty > 0 ? `+${item.recommended_order_qty} шт (${item.estimated_order_cost.toLocaleString()} ₴)` : '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.85rem' }}>{item.supplier_name}</TableCell>
                        <TableCell align="center">
                          <MuiTooltip title="Переглянути прогноз попиту для цього товару">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setSelectedProductId(String(item.product_id));
                                loadForecast(String(item.product_id), forecastHorizon, selectedModel);
                                setActiveTab(1);
                              }}
                            >
                              ML Прогноз
                            </Button>
                          </MuiTooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ======================================================== */}
      {/* ВКЛАДКА 2: ML ПРОГНОЗУВАННЯ ПОПИТУ */}
      {/* ======================================================== */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Панель параметрів прогнозу */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2.5 }}>
                  Параметри прогнозу
                </Typography>

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Вибір товару</InputLabel>
                  <Select
                    value={selectedProductId}
                    label="Вибір товару"
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedProductId(newId);
                      loadForecast(newId, forecastHorizon, selectedModel);
                    }}
                  >
                    {radarData?.items.map((it) => (
                      <MenuItem key={it.sku} value={String(it.product_id)}>
                        {it.sku} — {it.name}
                      </MenuItem>
                    )) || (
                      <MenuItem value="1">EL-001 — Ноутбук Pro 15.6"</MenuItem>
                    )}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Горизонт прогнозу</InputLabel>
                  <Select
                    value={forecastHorizon}
                    label="Горизонт прогнозу"
                    onChange={(e) => {
                      const h = Number(e.target.value);
                      setForecastHorizon(h);
                      loadForecast(selectedProductId, h, selectedModel);
                    }}
                  >
                    <MenuItem value={14}>14 днів (2 тижні)</MenuItem>
                    <MenuItem value={30}>30 днів (1 місяць)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                  <InputLabel>Математична модель</InputLabel>
                  <Select
                    value={selectedModel}
                    label="Математична модель"
                    onChange={(e) => {
                      const m = e.target.value;
                      setSelectedModel(m);
                      loadForecast(selectedProductId, forecastHorizon, m);
                    }}
                  >
                    <MenuItem value="best">Автоматичний вибір (Найменша похибка)</MenuItem>
                    <MenuItem value="lightgbm">LightGBM (Градієнтний бустінг)</MenuItem>
                    <MenuItem value="holt_winters">Holt-Winters (Експоненційне згладжування)</MenuItem>
                    <MenuItem value="ridge">Ridge Regression (Лагові ознаки)</MenuItem>
                  </Select>
                </FormControl>

                {forecastData && (
                  <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
                      Метрики точності навчання:
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      • <strong>Модель:</strong> {forecastData.metrics.model_name}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      • <strong>MAPE (похибка):</strong> {forecastData.metrics.mape}%
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      • <strong>MAE:</strong> {forecastData.metrics.mae} од.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      • <strong>RMSE:</strong> {forecastData.metrics.rmse} од.
                    </Typography>
                    <Typography variant="body2">
                      • <strong>Тренд:</strong>{' '}
                      <Chip
                        size="small"
                        label={forecastData.trend}
                        color={
                          forecastData.trend === 'Зростаючий'
                            ? 'success'
                            : forecastData.trend === 'Спадний'
                            ? 'warning'
                            : 'default'
                        }
                      />
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Графік прогнозу Recharts */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card elevation={2} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">
                    Часовий ряд попиту: Історія + Прогноз із довірчим інтервалом (95%)
                  </Typography>
                  {forecastData && (
                    <Typography variant="body2" color="text.secondary">
                      Сумарний прогноз на період:{' '}
                      <strong>{forecastData.summary_forecast_qty} шт</strong> (~
                      {forecastData.avg_daily_demand} шт/день)
                    </Typography>
                  )}
                </Box>

                {loadingForecast ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 14 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Box sx={{ width: '100%', height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartPoints} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend verticalAlign="top" height={36} />

                        {/* Довірчий інтервал 95% */}
                        <Area
                          type="monotone"
                          dataKey="upperBound"
                          stroke="none"
                          fill="#8884d8"
                          fillOpacity={0.15}
                          name="Довірчий інтервал 95%"
                        />

                        {/* Фактичний історичний попит */}
                        <Line
                          type="monotone"
                          dataKey="actual"
                          stroke="#1976d2"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          name="Історичний попит (факт)"
                        />

                        {/* ML прогноз */}
                        <Line
                          type="monotone"
                          dataKey="forecast"
                          stroke="#9c27b0"
                          strokeWidth={3}
                          strokeDasharray="5 5"
                          dot={{ r: 4 }}
                          name="ML Прогноз попиту"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ======================================================== */}
      {/* ВКЛАДКА 3: МАТРИЦЯ ABC-XYZ */}
      {/* ======================================================== */}
      {activeTab === 2 && (
        <Card elevation={2} sx={{ borderRadius: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  Портфельна матриця класифікації асортименту 3×3 (ABC-XYZ)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ABC — частка у загальній виручці (Парето 80/15/5), XYZ — коефіцієнт варіації попиту (стабільність)
                </Typography>
              </Box>
              {abcXyzData && (
                <Typography variant="subtitle2" fontWeight="bold">
                  Загальний оборот: {abcXyzData.total_revenue.toLocaleString()} ₴
                </Typography>
              )}
            </Box>

            {loadingAbc ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Матриця 3х3 плиток */}
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  {['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ'].map((cell) => {
                    const count = abcXyzData?.matrix_counts[cell] || 0;
                    const isHigh = cell.startsWith('A');
                    return (
                      <Grid size={{ xs: 12, sm: 4 }} key={cell}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            border: '1px solid',
                            borderColor: count > 0 ? (isHigh ? 'primary.main' : 'divider') : 'divider',
                            bgcolor: count > 0 ? (isHigh ? 'action.selected' : 'background.paper') : 'action.hover',
                            borderRadius: 2,
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Chip
                              label={`Група ${cell}`}
                              color={cell === 'AX' ? 'success' : isHigh ? 'primary' : 'default'}
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                            <Typography variant="h6" fontWeight="bold">
                              {count} тов.
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {cell === 'AX' && 'Висока виручка, стабільний попит (Just-in-Time)'}
                            {cell === 'AY' && 'Висока виручка, сезонні коливання попиту'}
                            {cell === 'AZ' && 'Висока виручка, нерегулярний попит (під замовлення)'}
                            {cell === 'BX' && 'Середня виручка, стабільний попит (ROP/EOQ)'}
                            {cell === 'BY' && 'Середня виручка, сезонні коливання'}
                            {cell === 'BZ' && 'Середня виручка, нестабільний попит'}
                            {cell === 'CX' && 'Низька виручка, стабільний попит (оптові партії)'}
                            {cell === 'CY' && 'Низька виручка, сезонний попит'}
                            {cell === 'CZ' && 'Низька виручка, рідкісний попит (кандидат на виведення)'}
                          </Typography>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>

                {/* Таблиця товарів із призначеними стратегіями */}
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Артикул</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Назва товару</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Категорія</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Виручка (180 дн)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Частка %</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>ABC</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Варіація CV</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>XYZ</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Матриця</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Рекомендована стратегія закупівлі</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {abcXyzData?.items.map((it) => (
                        <TableRow key={it.sku} hover>
                          <TableCell sx={{ fontWeight: 'medium' }}>{it.sku}</TableCell>
                          <TableCell>{it.name}</TableCell>
                          <TableCell>{it.category}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {it.revenue.toLocaleString()} ₴
                          </TableCell>
                          <TableCell align="right">{it.share_percent}%</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={it.abc_class}
                              color={it.abc_class === 'A' ? 'primary' : it.abc_class === 'B' ? 'secondary' : 'default'}
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell align="right">{it.cv_percent}%</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={it.xyz_class}
                              color={it.xyz_class === 'X' ? 'success' : it.xyz_class === 'Y' ? 'warning' : 'default'}
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={it.matrix_cell} variant="outlined" size="small" sx={{ fontWeight: 'bold' }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.85rem' }}>{it.strategy_recommendation}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ProcurementIntelligence;
