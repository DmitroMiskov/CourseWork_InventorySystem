import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Tabs,
  Tab,
  Chip,
  LinearProgress,
  CircularProgress,
  Stack,
  Alert,
  Divider
} from '@mui/material';

// Іконки
import AssessmentIcon from '@mui/icons-material/Assessment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import PieChartIcon from '@mui/icons-material/PieChart';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

import { useLanguage } from '../context/LanguageContext';
import api from '../api/axiosConfig';
import { reportsApi } from '../api/reportsApi';
import type {
  TurnoverStatement,
  StockValuationReport,
  PartnersReport
} from '../api/reportsApi';

interface CategoryOption {
  id: string;
  name: string;
}

export default function ReportsPage() {
  const { t } = useLanguage();

  // Активна вкладка (0 = ОСВ, 1 = Оцінка категорій, 2 = Контрагенти)
  const [tabIndex, setTabIndex] = useState<number>(0);

  // Фільтри періоду (за замовчуванням: останні 30 днів)
  const getDefaultDates = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10)
    };
  };

  const defaultDates = useMemo(getDefaultDates, []);
  const [fromDate, setFromDate] = useState<string>(defaultDates.from);
  const [toDate, setToDate] = useState<string>(defaultDates.to);
  const [categoryId, setCategoryId] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Дані звітів
  const [turnoverData, setTurnoverData] = useState<TurnoverStatement | null>(null);
  const [valuationData, setValuationData] = useState<StockValuationReport | null>(null);
  const [partnersData, setPartnersData] = useState<PartnersReport | null>(null);

  // Стан завантаження
  const [loadingTurnover, setLoadingTurnover] = useState<boolean>(true);
  const [loadingValuation, setLoadingValuation] = useState<boolean>(false);
  const [loadingPartners, setLoadingPartners] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Категорії для фільтра
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    api.get<CategoryOption[]>('/categories')
      .then(res => setCategories(res.data))
      .catch(err => console.error('Failed to load categories', err));
  }, []);

  // Завантаження ОСВ
  const loadTurnover = useCallback(async () => {
    setLoadingTurnover(true);
    setErrorMessage(null);
    try {
      const data = await reportsApi.getTurnoverStatement({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        categoryId: categoryId || undefined
      });
      setTurnoverData(data);
    } catch (err: any) {
      console.error('Failed to load turnover statement', err);
      setErrorMessage(err?.response?.data || t('common.error'));
    } finally {
      setLoadingTurnover(false);
    }
  }, [fromDate, toDate, categoryId, t]);

  // Завантаження оцінки запасів
  const loadValuation = useCallback(async () => {
    setLoadingValuation(true);
    try {
      const data = await reportsApi.getStockValuation();
      setValuationData(data);
    } catch (err) {
      console.error('Failed to load stock valuation', err);
    } finally {
      setLoadingValuation(false);
    }
  }, []);

  // Завантаження активності контрагентів
  const loadPartners = useCallback(async () => {
    setLoadingPartners(true);
    try {
      const data = await reportsApi.getPartnersActivity({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined
      });
      setPartnersData(data);
    } catch (err) {
      console.error('Failed to load partners report', err);
    } finally {
      setLoadingPartners(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadTurnover();
  }, [loadTurnover]);

  useEffect(() => {
    if (tabIndex === 1 && !valuationData) loadValuation();
    if (tabIndex === 2 && !partnersData) loadPartners();
  }, [tabIndex, valuationData, partnersData, loadValuation, loadPartners]);

  // Швидкі пресети періодів
  const setPreset = (type: '7' | '30' | 'month' | 'year') => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    let from = new Date();

    if (type === '7') {
      from.setDate(today.getDate() - 7);
    } else if (type === '30') {
      from.setDate(today.getDate() - 30);
    } else if (type === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (type === 'year') {
      from = new Date(today.getFullYear(), 0, 1);
    }

    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to);
  };

  // Експорт CSV
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await reportsApi.downloadTurnoverCsv({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        categoryId: categoryId || undefined
      });
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setExporting(false);
    }
  };

  // Друк відомості
  const handlePrint = () => {
    window.print();
  };

  // Локальна фільтрація товарів в ОСВ за пошуком
  const filteredItems = useMemo(() => {
    if (!turnoverData?.items) return [];
    if (!search.trim()) return turnoverData.items;
    const q = search.toLowerCase().trim();
    return turnoverData.items.filter(i =>
      i.productName.toLowerCase().includes(q) ||
      i.productSKU.toLowerCase().includes(q)
    );
  }, [turnoverData?.items, search]);

  return (
    <Box sx={{ width: '100%', pb: 6 }}>
      {/* Шапка розділу */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }} className="no-print">
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon color="primary" /> {t('reports.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('reports.subtitle')}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
          >
            {t('reports.printReport')}
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : <FileDownloadIcon />}
            onClick={handleExportCsv}
            disabled={exporting || loadingTurnover}
          >
            {t('reports.exportCsv')}
          </Button>
        </Stack>
      </Box>

      {/* Вкладки звітності */}
      <Paper sx={{ mb: 3, borderRadius: 2 }} elevation={1} className="no-print">
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<AssessmentIcon />} iconPosition="start" label={t('reports.turnoverTab')} sx={{ fontWeight: 600 }} />
          <Tab icon={<PieChartIcon />} iconPosition="start" label={t('reports.valuationTab')} sx={{ fontWeight: 600 }} />
          <Tab icon={<PeopleAltIcon />} iconPosition="start" label={t('reports.partnersTab')} sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {/* ========================================================================= */}
      {/* ВКЛАДКА 0: ОБОРОТНО-САЛЬДОВА ВІДОМІСТЬ (ОСВ)                              */}
      {/* ========================================================================= */}
      {tabIndex === 0 && (
        <Box>
          {/* Панель фільтрів і швидких пресетів */}
          <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1} className="no-print">
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => setPreset('7')}>
                    {t('reports.quickPresets.last7Days')}
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => setPreset('30')}>
                    {t('reports.quickPresets.last30Days')}
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => setPreset('month')}>
                    {t('reports.quickPresets.thisMonth')}
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => setPreset('year')}>
                    {t('reports.quickPresets.thisYear')}
                  </Button>
                </Stack>
              </Grid>

              <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('reports.periodFrom')}
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </Grid>

              <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('reports.periodTo')}
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={t('products.category')}
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                >
                  <MenuItem value=""><em>{t('reports.allCategories')}</em></MenuItem>
                  {categories.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 2, md: 1.5 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadTurnover}
                  disabled={loadingTurnover}
                >
                  {t('common.refresh')}
                </Button>
              </Grid>
            </Grid>

            <Divider sx={{ my: 1.5 }} />

            {/* Рядок пошуку по товарах */}
            <TextField
              fullWidth
              size="small"
              placeholder={t('reports.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
              }}
            />
          </Paper>

          {/* Повідомлення про помилку */}
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          {/* KPI картки початкового, приходу, розходу та кінцевого сальдо */}
          {turnoverData && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card elevation={1} sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'primary.main' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('reports.openingBalance')}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {Math.round(turnoverData.totalOpeningAmount).toLocaleString()} {t('common.uah')}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card elevation={1} sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'success.main' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('reports.inflow')} (+)
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                          +{Math.round(turnoverData.totalInflowAmount).toLocaleString()} {t('common.uah')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {turnoverData.totalInflowQuantity} {t('common.pcs')}
                        </Typography>
                      </Box>
                      <TrendingUpIcon color="success" sx={{ fontSize: 32, opacity: 0.8 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card elevation={1} sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'error.main' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('reports.outflow')} (-)
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
                          -{Math.round(turnoverData.totalOutflowAmount).toLocaleString()} {t('common.uah')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {turnoverData.totalOutflowQuantity} {t('common.pcs')}
                        </Typography>
                      </Box>
                      <TrendingDownIcon color="error" sx={{ fontSize: 32, opacity: 0.8 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card elevation={1} sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'info.main' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('reports.closingBalance')}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                          {Math.round(turnoverData.totalClosingAmount).toLocaleString()} {t('common.uah')}
                        </Typography>
                      </Box>
                      <AccountBalanceWalletIcon color="info" sx={{ fontSize: 32, opacity: 0.8 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Головна таблиця Оборотно-сальдової відомості */}
          <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 700 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  {/* Рядок 1: Головні групи колонок */}
                  <TableRow>
                    <TableCell colSpan={3} sx={{ fontWeight: 700, bgcolor: 'action.hover', borderRight: 1, borderColor: 'divider' }}>
                      Товарні дані
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'action.hover', borderRight: 1, borderColor: 'divider' }}>
                      Ціна
                    </TableCell>
                    <TableCell colSpan={2} align="center" sx={{ fontWeight: 700, bgcolor: 'action.hover', borderRight: 1, borderColor: 'divider' }}>
                      {t('reports.openingBalance')}
                    </TableCell>
                    <TableCell colSpan={2} align="center" sx={{ fontWeight: 700, bgcolor: 'success.light', color: 'success.contrastText', borderRight: 1, borderColor: 'divider' }}>
                      {t('reports.inflow')}
                    </TableCell>
                    <TableCell colSpan={2} align="center" sx={{ fontWeight: 700, bgcolor: 'error.light', color: 'error.contrastText', borderRight: 1, borderColor: 'divider' }}>
                      {t('reports.outflow')}
                    </TableCell>
                    <TableCell colSpan={2} align="center" sx={{ fontWeight: 700, bgcolor: 'info.light', color: 'info.contrastText' }}>
                      {t('reports.closingBalance')}
                    </TableCell>
                  </TableRow>

                  {/* Рядок 2: Детальні підколонки */}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: 110 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t('products.name')}</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 130, borderRight: 1, borderColor: 'divider' }}>{t('products.category')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 95, borderRight: 1, borderColor: 'divider' }}>{t('common.uah')}</TableCell>

                    <TableCell align="right" sx={{ fontWeight: 700, width: 65 }}>{t('reports.qty')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 95, borderRight: 1, borderColor: 'divider' }}>{t('reports.sum')}</TableCell>

                    <TableCell align="right" sx={{ fontWeight: 700, width: 65, color: 'success.dark' }}>{t('reports.qty')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 95, color: 'success.dark', borderRight: 1, borderColor: 'divider' }}>{t('reports.sum')}</TableCell>

                    <TableCell align="right" sx={{ fontWeight: 700, width: 65, color: 'error.dark' }}>{t('reports.qty')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 95, color: 'error.dark', borderRight: 1, borderColor: 'divider' }}>{t('reports.sum')}</TableCell>

                    <TableCell align="right" sx={{ fontWeight: 700, width: 65, color: 'info.dark' }}>{t('reports.qty')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 105, color: 'info.dark' }}>{t('reports.sum')}</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {loadingTurnover ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">
                          {t('reports.noData')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map(item => (
                      <TableRow key={item.productId} hover>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                          {item.productSKU}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {item.productName}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', borderRight: 1, borderColor: 'divider' }}>
                          {item.categoryName}
                        </TableCell>
                        <TableCell align="right" sx={{ borderRight: 1, borderColor: 'divider' }}>
                          {item.unitPrice.toLocaleString()}
                        </TableCell>

                        {/* Початковий залишок */}
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {item.openingQuantity}
                        </TableCell>
                        <TableCell align="right" sx={{ borderRight: 1, borderColor: 'divider' }}>
                          {Math.round(item.openingAmount).toLocaleString()}
                        </TableCell>

                        {/* Прихід */}
                        <TableCell align="right" sx={{ fontWeight: 600, color: item.inflowQuantity > 0 ? 'success.main' : 'text.disabled' }}>
                          {item.inflowQuantity > 0 ? `+${item.inflowQuantity}` : 0}
                        </TableCell>
                        <TableCell align="right" sx={{ color: item.inflowAmount > 0 ? 'success.main' : 'text.disabled', borderRight: 1, borderColor: 'divider' }}>
                          {Math.round(item.inflowAmount).toLocaleString()}
                        </TableCell>

                        {/* Розхід */}
                        <TableCell align="right" sx={{ fontWeight: 600, color: item.outflowQuantity > 0 ? 'error.main' : 'text.disabled' }}>
                          {item.outflowQuantity > 0 ? `-${item.outflowQuantity}` : 0}
                        </TableCell>
                        <TableCell align="right" sx={{ color: item.outflowAmount > 0 ? 'error.main' : 'text.disabled', borderRight: 1, borderColor: 'divider' }}>
                          {Math.round(item.outflowAmount).toLocaleString()}
                        </TableCell>

                        {/* Кінцевий залишок */}
                        <TableCell align="right" sx={{ fontWeight: 700, color: item.closingQuantity === 0 ? 'error.main' : 'text.primary' }}>
                          {item.closingQuantity}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'info.main' }}>
                          {Math.round(item.closingAmount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>

                {/* Підсумковий рядок */}
                {turnoverData && (
                  <TableFooter sx={{ bgcolor: 'action.selected' }}>
                    <TableRow>
                      <TableCell colSpan={4} sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                        {t('reports.totalWarehouse')} ({turnoverData.totalProductsCount} поз.)
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>—</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, borderRight: 1, borderColor: 'divider' }}>
                        {Math.round(turnoverData.totalOpeningAmount).toLocaleString()}
                      </TableCell>

                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                        +{turnoverData.totalInflowQuantity}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main', borderRight: 1, borderColor: 'divider' }}>
                        +{Math.round(turnoverData.totalInflowAmount).toLocaleString()}
                      </TableCell>

                      <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>
                        -{turnoverData.totalOutflowQuantity}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main', borderRight: 1, borderColor: 'divider' }}>
                        -{Math.round(turnoverData.totalOutflowAmount).toLocaleString()}
                      </TableCell>

                      <TableCell align="right" sx={{ fontWeight: 700 }}>—</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'info.main', fontSize: '0.9375rem' }}>
                        {Math.round(turnoverData.totalClosingAmount).toLocaleString()} {t('common.uah')}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* ========================================================================= */}
      {/* ВКЛАДКА 1: ОЦІНКА ЗАПАСІВ ЗА КАТЕГОРІЯМИ                                  */}
      {/* ========================================================================= */}
      {tabIndex === 1 && (
        <Box>
          {loadingValuation || !valuationData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card elevation={1} sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        {t('reports.totalCapital')}
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mt: 0.5 }}>
                        {Math.round(valuationData.totalWarehouseValuation).toLocaleString()} {t('common.uah')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('reports.totalUnits')}: {valuationData.totalStockQuantity} {t('common.pcs')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 8 }}>
                  <Paper sx={{ p: 2, borderRadius: 2 }} elevation={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                      {t('reports.categoryShare')}
                    </Typography>
                    <Stack spacing={1.5}>
                      {valuationData.categories.map(cat => (
                        <Box key={cat.categoryId}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {cat.categoryName} ({cat.productsCount} тов., {cat.totalQuantity} шт)
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {Math.round(cat.totalValuation).toLocaleString()} {t('common.uah')} ({cat.sharePercentage}%)
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={cat.sharePercentage}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>
      )}

      {/* ========================================================================= */}
      {/* ВКЛАДКА 2: АКТИВНІСТЬ КОНТРАГЕНТІВ                                       */}
      {/* ========================================================================= */}
      {tabIndex === 2 && (
        <Box>
          {loadingPartners || !partnersData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {/* Топ постачальників */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2.5, borderRadius: 2 }} elevation={1}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
                    <TrendingUpIcon /> {t('reports.topSuppliers')}
                  </Typography>

                  {partnersData.topSuppliers.length === 0 ? (
                    <Typography color="text.secondary">
                      {t('reports.noData')}
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      {partnersData.topSuppliers.map(s => (
                        <Paper variant="outlined" key={s.partnerId} sx={{ p: 1.5, borderRadius: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {s.partnerName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t('reports.operationsCount')}: {s.operationsCount} | {s.totalQuantity} {t('common.pcs')}
                              </Typography>
                            </Box>
                            <Chip
                              label={`+${Math.round(s.totalEstimatedCost).toLocaleString()} ${t('common.uah')}`}
                              color="success"
                              size="small"
                              sx={{ fontWeight: 700 }}
                            />
                          </Box>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Grid>

              {/* Топ покупців / замовників */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2.5, borderRadius: 2 }} elevation={1}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                    <PeopleAltIcon /> {t('reports.topCustomers')}
                  </Typography>

                  {partnersData.topCustomers.length === 0 ? (
                    <Typography color="text.secondary">
                      {t('reports.noData')}
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      {partnersData.topCustomers.map(c => (
                        <Paper variant="outlined" key={c.partnerId} sx={{ p: 1.5, borderRadius: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {c.partnerName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t('reports.operationsCount')}: {c.operationsCount} | {c.totalQuantity} {t('common.pcs')}
                              </Typography>
                            </Box>
                            <Chip
                              label={`${Math.round(c.totalEstimatedCost).toLocaleString()} ${t('common.uah')}`}
                              color="primary"
                              size="small"
                              sx={{ fontWeight: 700 }}
                            />
                          </Box>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
