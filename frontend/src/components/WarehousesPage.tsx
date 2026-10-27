import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  Tabs,
  Tab,
  Stack,
  Divider,
  FormControlLabel,
  Checkbox,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import {
  Warehouse as WarehouseIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Close as CloseIcon,
  LocalShipping as LocalShippingIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  Star as StarIcon,
  LocationOn as LocationOnIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';

import {
  warehouseApi,
  TransferStatus
} from '../api/warehouseApi';
import type {
  WarehouseSummary,
  ProductStockDistribution,
  WarehouseTransfer,
  CreateTransferInput,
  WarehouseStockItem
} from '../api/warehouseApi';
import api from '../api/axiosConfig';
import type { Category } from '../types/inventory';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  isAdmin?: boolean;
  isManager?: boolean;
}

export const WarehousesPage: React.FC<Props> = ({ isAdmin = false, isManager = false }) => {
  const { t } = useLanguage();
  const canManage = isAdmin || isManager;

  // Active Tab: 0 = Distribution, 1 = Transfers, 2 = Warehouses
  const [activeTab, setActiveTab] = useState<number>(0);

  // States
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [distribution, setDistribution] = useState<ProductStockDistribution[]>([]);
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [transferStatusFilter, setTransferStatusFilter] = useState<number | 'all'>('all');

  // Modals
  // 1. Warehouse Modal (Create/Edit)
  const [warehouseModalOpen, setWarehouseModalOpen] = useState<boolean>(false);
  const [editWhId, setEditWhId] = useState<string | null>(null);
  const [whName, setWhName] = useState<string>('');
  const [whCode, setWhCode] = useState<string>('');
  const [whAddress, setWhAddress] = useState<string>('');
  const [whDefault, setWhDefault] = useState<boolean>(false);
  const [whActive, setWhActive] = useState<boolean>(true);
  const [whDescription, setWhDescription] = useState<string>('');

  // 2. Transfer Modal (Create)
  const [transferModalOpen, setTransferModalOpen] = useState<boolean>(false);
  const [fromWhId, setFromWhId] = useState<string>('');
  const [toWhId, setToWhId] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [completeImmediately, setCompleteImmediately] = useState<boolean>(false);
  const [sourceWarehouseStocks, setSourceWarehouseStocks] = useState<WarehouseStockItem[]>([]);
  const [transferItems, setTransferItems] = useState<Array<{ productId: string; quantity: number; notes: string }>>([]);

  // 3. Transfer Details Dialog
  const [transferDetailOpen, setTransferDetailOpen] = useState<boolean>(false);
  const [selectedTransfer, setSelectedTransfer] = useState<WarehouseTransfer | null>(null);

  // 4. Location Zone Edit Dialog
  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false);
  const [locStockId, setLocStockId] = useState<string | null>(null);
  const [locProductName, setLocProductName] = useState<string>('');
  const [locWarehouseName, setLocWarehouseName] = useState<string>('');
  const [locZone, setLocZone] = useState<string>('');
  const [locMinStock, setLocMinStock] = useState<number | ''>('');

  // Initial load
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [whData, distData, transData, catRes] = await Promise.all([
        warehouseApi.getAll(),
        warehouseApi.getDistribution(),
        warehouseApi.getTransfers(),
        api.get<Category[] | { items: Category[] }>('/categories')
      ]);

      setWarehouses(whData);
      setDistribution(distData);
      setTransfers(transData);

      const catList = Array.isArray(catRes.data) ? catRes.data : (catRes.data as { items: Category[] }).items || [];
      setCategories(catList);
    } catch (err: unknown) {
      console.error(err);
      setError('Не вдалося завантажити дані мультискладського обліку');
    } finally {
      setLoading(false);
    }
  };

  // Helper when changing source warehouse in transfer modal
  useEffect(() => {
    if (!fromWhId) return;
    const fetchStocks = async () => {
      try {
        const stocks = await warehouseApi.getStocks(fromWhId);
        setSourceWarehouseStocks(stocks);
        // Reset items to available products
        if (stocks.length > 0 && transferItems.length === 0) {
          setTransferItems([{ productId: stocks[0].productId, quantity: 1, notes: '' }]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStocks();
  }, [fromWhId]);

  // Totals
  const totalWarehousesCount = warehouses.length;
  const inTransitCount = transfers.filter(t => t.status === TransferStatus.InTransit).length;
  const totalStockValuation = warehouses.reduce((acc, w) => acc + w.totalValuation, 0);

  // Status mapping
  const getTransferStatusInfo = (status: TransferStatus) => {
    switch (status) {
      case TransferStatus.Draft:
        return { label: t('warehouses.draft'), color: 'default' as const };
      case TransferStatus.InTransit:
        return { label: t('warehouses.inTransit'), color: 'warning' as const };
      case TransferStatus.Completed:
        return { label: t('warehouses.completed'), color: 'success' as const };
      case TransferStatus.Cancelled:
        return { label: t('warehouses.cancelled'), color: 'error' as const };
      default:
        return { label: 'Невідомо', color: 'default' as const };
    }
  };

  // Filtered Distribution Matrix
  const filteredDistribution = useMemo(() => {
    return distribution.filter(item => {
      if (categoryFilter !== 'all' && item.categoryName !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.productName.toLowerCase().includes(q);
        const matchesSku = item.sku.toLowerCase().includes(q);
        if (!matchesName && !matchesSku) return false;
      }
      return true;
    });
  }, [distribution, searchQuery, categoryFilter]);

  // Filtered Transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(tr => {
      if (transferStatusFilter !== 'all' && tr.status !== transferStatusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = tr.transferNumber.toLowerCase().includes(q);
        const matchesFrom = tr.fromWarehouseName.toLowerCase().includes(q);
        const matchesTo = tr.toWarehouseName.toLowerCase().includes(q);
        const matchesNote = tr.notes ? tr.notes.toLowerCase().includes(q) : false;
        if (!matchesNum && !matchesFrom && !matchesTo && !matchesNote) return false;
      }
      return true;
    });
  }, [transfers, transferStatusFilter, searchQuery]);

  // -------------------------------------------------------------
  // Warehouse CRUD Actions
  // -------------------------------------------------------------
  const handleOpenCreateWarehouse = () => {
    setEditWhId(null);
    setWhName('');
    setWhCode('');
    setWhAddress('');
    setWhDefault(warehouses.length === 0);
    setWhActive(true);
    setWhDescription('');
    setWarehouseModalOpen(true);
  };

  const handleOpenEditWarehouse = (w: WarehouseSummary) => {
    setEditWhId(w.id);
    setWhName(w.name);
    setWhCode(w.code);
    setWhAddress(w.address || '');
    setWhDefault(w.isDefault);
    setWhActive(w.isActive);
    setWhDescription(w.description || '');
    setWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = async () => {
    if (!whName.trim()) {
      setError('Вкажіть назву складу');
      return;
    }
    try {
      setLoading(true);
      if (editWhId) {
        await warehouseApi.update(editWhId, {
          name: whName.trim(),
          code: whCode.trim(),
          address: whAddress.trim() || undefined,
          isDefault: whDefault,
          isActive: whActive,
          description: whDescription.trim() || undefined
        });
        setSuccessMsg(t('warehouses.successUpdatedWh'));
      } else {
        await warehouseApi.create({
          name: whName.trim(),
          code: whCode.trim(),
          address: whAddress.trim() || undefined,
          isDefault: whDefault,
          description: whDescription.trim() || undefined
        });
        setSuccessMsg(t('warehouses.successCreatedWh'));
      }
      setWarehouseModalOpen(false);
      await fetchInitialData();
    } catch (err: unknown) {
      console.error(err);
      setError('Помилка при збереженні складу');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWarehouse = async (w: WarehouseSummary) => {
    if (w.isDefault) {
      setError('Неможливо видалити головний склад системи');
      return;
    }
    if (w.totalQuantity > 0) {
      setError(`На складі є залишки (${w.totalQuantity} шт). Спочатку перемістіть товари.`);
      return;
    }
    if (!window.confirm(`Ви дійсно бажаєте видалити склад '${w.name}'?`)) return;

    try {
      setLoading(true);
      await warehouseApi.delete(w.id);
      setSuccessMsg('Склад успішно видалено');
      await fetchInitialData();
    } catch (err: unknown) {
      console.error(err);
      setError('Не вдалося видалити склад');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Transfers Actions
  // -------------------------------------------------------------
  const handleOpenCreateTransfer = () => {
    if (warehouses.length < 2) {
      setError('Для створення переміщення потрібно щонайменше 2 діючих склади');
      return;
    }
    const defaultFrom = warehouses[0]?.id || '';
    const defaultTo = warehouses[1]?.id || '';
    setFromWhId(defaultFrom);
    setToWhId(defaultTo);
    setTransferNotes('');
    setCompleteImmediately(false);
    setTransferItems([]);
    setTransferModalOpen(true);
  };

  const handleAddTransferItemRow = () => {
    const firstStock = sourceWarehouseStocks.find(s => s.quantity > 0) || sourceWarehouseStocks[0];
    if (!firstStock) {
      setError('На складі-відправнику немає доступних товарів');
      return;
    }
    setTransferItems(prev => [
      ...prev,
      { productId: firstStock.productId, quantity: 1, notes: '' }
    ]);
  };

  const handleRemoveTransferItemRow = (idx: number) => {
    setTransferItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveTransfer = async () => {
    if (fromWhId === toWhId) {
      setError('Склад-відправник та склад-одержувач не можуть бути однаковими');
      return;
    }
    if (transferItems.length === 0) {
      setError('Додайте хоча б один товар для переміщення');
      return;
    }
    for (const it of transferItems) {
      if (!it.productId || it.quantity <= 0) {
        setError('Перевірте коректність обраних товарів та кількості');
        return;
      }
      const stock = sourceWarehouseStocks.find(s => s.productId === it.productId);
      const available = stock ? stock.quantity : 0;
      if (it.quantity > available) {
        setError(`Кількість перевищує доступний залишок (${available} шт.)`);
        return;
      }
    }

    try {
      setLoading(true);
      const payload: CreateTransferInput = {
        fromWarehouseId: fromWhId,
        toWarehouseId: toWhId,
        notes: transferNotes.trim() || undefined,
        completeImmediately: completeImmediately,
        items: transferItems.map(i => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          notes: i.notes.trim() || undefined
        }))
      };

      await warehouseApi.createTransfer(payload);
      setSuccessMsg(t('warehouses.successCreatedTransfer'));
      setTransferModalOpen(false);
      await fetchInitialData();
    } catch (err: unknown) {
      console.error(err);
      setError('Помилка при створенні переміщення');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveTransfer = async (transferId: string) => {
    if (!window.confirm(t('warehouses.confirmReceiveMsg'))) return;
    try {
      setLoading(true);
      await warehouseApi.receiveTransfer(transferId);
      setSuccessMsg(t('warehouses.successReceivedTransfer'));
      await fetchInitialData();
      if (selectedTransfer && selectedTransfer.id === transferId) {
        const updated = await warehouseApi.getTransferById(transferId);
        setSelectedTransfer(updated);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Помилка при прийманні вантажу на склад');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    const reason = window.prompt('Вкажіть причину скасування:');
    if (reason === null) return;
    try {
      setLoading(true);
      await warehouseApi.cancelTransfer(transferId, reason || undefined);
      setSuccessMsg(t('warehouses.successCancelledTransfer'));
      await fetchInitialData();
      if (selectedTransfer && selectedTransfer.id === transferId) {
        const updated = await warehouseApi.getTransferById(transferId);
        setSelectedTransfer(updated);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Не вдалося скасувати переміщення');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTransferDetail = async (transferId: string) => {
    try {
      setLoading(true);
      const data = await warehouseApi.getTransferById(transferId);
      setSelectedTransfer(data);
      setTransferDetailOpen(true);
    } catch (err) {
      console.error(err);
      setError('Не вдалося завантажити деталі переміщення');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Location Zone Dialog Action
  // -------------------------------------------------------------
  const handleOpenEditLocation = (stockId: string, productName: string, warehouseName: string, locationZone?: string | null, minStock?: number | null) => {
    setLocStockId(stockId);
    setLocProductName(productName);
    setLocWarehouseName(warehouseName);
    setLocZone(locationZone || '');
    setLocMinStock(minStock !== null && minStock !== undefined ? minStock : '');
    setLocationModalOpen(true);
  };

  const handleSaveLocation = async () => {
    if (!locStockId) return;
    try {
      setLoading(true);
      await warehouseApi.updateLocation(locStockId, {
        locationZone: locZone.trim() || undefined,
        minStock: locMinStock !== '' ? Number(locMinStock) : undefined
      });
      setLocationModalOpen(false);
      setSuccessMsg('Комірку зберігання та страховий запас оновлено');
      await fetchInitialData();
    } catch (err) {
      console.error(err);
      setError('Не вдалося оновити дані комірки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <WarehouseIcon color="primary" fontSize="large" />
            {t('warehouses.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('warehouses.subtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchInitialData()}
            disabled={loading}
          >
            Оновити
          </Button>
          {canManage && activeTab === 1 && (
            <Button
              variant="contained"
              startIcon={<LocalShippingIcon />}
              onClick={handleOpenCreateTransfer}
            >
              {t('warehouses.newTransfer')}
            </Button>
          )}
          {canManage && activeTab === 2 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateWarehouse}
            >
              {t('warehouses.newWarehouse')}
            </Button>
          )}
        </Stack>
      </Box>

      {/* Messages */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      {/* Metric Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card elevation={1}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                Кількість складів
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="primary.main">
                {totalWarehousesCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card elevation={1}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                Переміщень в дорозі
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.main">
                {inTransitCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card elevation={1}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                Сумарна оцінка запасів
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                {totalStockValuation.toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs navigation */}
      <Paper sx={{ mb: 3 }} elevation={1}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<WarehouseIcon />} iconPosition="start" label={t('warehouses.tabDistribution')} />
          <Tab icon={<LocalShippingIcon />} iconPosition="start" label={t('warehouses.tabTransfers')} />
          <Tab icon={<EditIcon />} iconPosition="start" label={t('warehouses.tabWarehouses')} />
        </Tabs>
      </Paper>

      {/* ============================================================== */}
      {/* TAB 0: STOCK MATRIX / DISTRIBUTION                             */}
      {/* ============================================================== */}
      {activeTab === 0 && (
        <Box>
          <Paper sx={{ p: 2, mb: 3 }} elevation={1}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={t('warehouses.searchPlaceholder')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchQuery('')}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Категорія</InputLabel>
                  <Select
                    value={categoryFilter}
                    label="Категорія"
                    onChange={e => setCategoryFilter(e.target.value)}
                  >
                    <MenuItem value="all">Всі категорії</MenuItem>
                    {categories.map(c => (
                      <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          <TableContainer component={Paper} elevation={1}>
            <Table sx={{ minWidth: 800 }}>
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Товар (Номенклатура)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Категорія</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ціна (грн)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: 'rgba(25, 118, 210, 0.08)' }}>
                    Всього по системі
                  </TableCell>
                  {/* Dynamic Warehouse Columns */}
                  {warehouses.filter(w => w.isActive).map(wh => (
                    <TableCell key={wh.id} align="center" sx={{ fontWeight: 'bold' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        {wh.isDefault && <StarIcon color="warning" fontSize="small" />}
                        {wh.name}
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {wh.code}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDistribution.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4 + warehouses.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {t('warehouses.noDistribution')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDistribution.map(item => (
                    <TableRow key={item.productId} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {item.productName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          SKU: {item.sku}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={item.categoryName} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>
                          {item.price.toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: 'rgba(25, 118, 210, 0.04)' }}>
                        <Typography variant="body2" fontWeight="bold" color="primary.main">
                          {item.totalQuantity} {item.unit}
                        </Typography>
                      </TableCell>
                      {/* Warehouse cells */}
                      {warehouses.filter(w => w.isActive).map(wh => {
                        const whStock = item.warehouses.find(s => s.warehouseId === wh.id);
                        const qty = whStock ? whStock.quantity : 0;
                        const zone = whStock?.locationZone;
                        return (
                          <TableCell key={wh.id} align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <Typography
                                variant="body2"
                                fontWeight={qty > 0 ? 'bold' : 'normal'}
                                color={qty > 0 ? 'text.primary' : 'text.disabled'}
                              >
                                {qty} {item.unit}
                              </Typography>
                              {canManage && whStock && (
                                <Tooltip title="Налаштувати комірку та страховий запас">
                                  <IconButton
                                    size="small"
                                    sx={{ p: 0.25 }}
                                    onClick={() => handleOpenEditLocation(
                                      whStock.stockId,
                                      item.productName,
                                      wh.name,
                                      whStock.locationZone,
                                      whStock.minStock
                                    )}
                                  >
                                    <EditIcon sx={{ fontSize: '0.85rem' }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                            {zone && (
                              <Chip
                                size="small"
                                icon={<LocationOnIcon sx={{ fontSize: '0.9rem !important' }} />}
                                label={zone}
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.68rem', mt: 0.3 }}
                              />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* ============================================================== */}
      {/* TAB 1: INTER-WAREHOUSE TRANSFERS                               */}
      {/* ============================================================== */}
      {activeTab === 1 && (
        <Box>
          <Paper sx={{ p: 2, mb: 3 }} elevation={1}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 7 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Пошук за номером переміщення або назвою складу..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchQuery('')}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Фільтр за статусом</InputLabel>
                  <Select
                    value={transferStatusFilter}
                    label="Фільтр за статусом"
                    onChange={e => setTransferStatusFilter(e.target.value as number | 'all')}
                  >
                    <MenuItem value="all">Всі статуси</MenuItem>
                    <MenuItem value={TransferStatus.InTransit}>{t('warehouses.inTransit')}</MenuItem>
                    <MenuItem value={TransferStatus.Completed}>{t('warehouses.completed')}</MenuItem>
                    <MenuItem value={TransferStatus.Cancelled}>{t('warehouses.cancelled')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          <TableContainer component={Paper} elevation={1}>
            <Table sx={{ minWidth: 800 }}>
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>{t('warehouses.transferNumber')}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Маршрут переміщення</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>{t('warehouses.status')}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Позицій / Одиниць</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{t('warehouses.operator')}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>{t('warehouses.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {t('warehouses.noTransfers')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map(tr => {
                    const statusInfo = getTransferStatusInfo(tr.status);
                    return (
                      <TableRow key={tr.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {tr.transferNumber}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(tr.createdAt).toLocaleString('uk-UA')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {tr.fromWarehouseName}
                            </Typography>
                            <ArrowForwardIcon fontSize="small" color="action" />
                            <Typography variant="body2" fontWeight={600} color="primary.main">
                              {tr.toWarehouseName}
                            </Typography>
                          </Box>
                          {tr.notes && (
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 260, display: 'block' }}>
                              {tr.notes}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={statusInfo.label} color={statusInfo.color} size="small" />
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight="bold">
                            {tr.totalItemsCount} поз. / {tr.totalQuantity} од.
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{tr.createdByUserName}</Typography>
                          {tr.completedAt && (
                            <Typography variant="caption" color="text.secondary">
                              Завершено: {new Date(tr.completedAt).toLocaleDateString('uk-UA')}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Деталі переміщення">
                              <IconButton size="small" color="primary" onClick={() => handleViewTransferDetail(tr.id)}>
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* Receive on destination warehouse */}
                            {tr.status === TransferStatus.InTransit && (
                              <Tooltip title={t('warehouses.receiveTransfer')}>
                                <IconButton size="small" color="success" onClick={() => handleReceiveTransfer(tr.id)}>
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            {/* Cancel transfer */}
                            {canManage && (tr.status === TransferStatus.InTransit || tr.status === TransferStatus.Draft) && (
                              <Tooltip title={t('warehouses.cancelTransfer')}>
                                <IconButton size="small" color="error" onClick={() => handleCancelTransfer(tr.id)}>
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MANAGE WAREHOUSES                                       */}
      {/* ============================================================== */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          {warehouses.map(w => (
            <Grid key={w.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box>
                      <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {w.isDefault && (
                          <Tooltip title="Склад за замовчуванням">
                            <StarIcon color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                        {w.name}
                      </Typography>
                      <Chip label={w.code} size="small" variant="outlined" sx={{ mt: 0.5, fontWeight: 'bold' }} />
                    </Box>
                    <Chip
                      label={w.isActive ? 'Активний' : 'В архіві'}
                      color={w.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  {w.address && (
                    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <LocationOnIcon fontSize="small" color="action" />
                      {w.address}
                    </Typography>
                  )}

                  {w.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      {w.description}
                    </Typography>
                  )}

                  <Divider sx={{ my: 1.5 }} />

                  <Grid container spacing={1}>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">Позицій</Typography>
                      <Typography variant="body2" fontWeight="bold">{w.totalItemsCount}</Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">Одиниць</Typography>
                      <Typography variant="body2" fontWeight="bold">{w.totalQuantity}</Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">Оцінка</Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {w.totalValuation.toLocaleString('uk-UA', { maximumFractionDigits: 0 })} ₴
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>

                {canManage && (
                  <Box sx={{ p: 2, pt: 0, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => handleOpenEditWarehouse(w)}>
                      Редагувати
                    </Button>
                    {isAdmin && !w.isDefault && (
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        disabled={w.totalQuantity > 0}
                        onClick={() => handleDeleteWarehouse(w)}
                      >
                        Видалити
                      </Button>
                    )}
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ============================================================== */}
      {/* CREATE / EDIT WAREHOUSE MODAL                                  */}
      {/* ============================================================== */}
      <Dialog open={warehouseModalOpen} onClose={() => setWarehouseModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold">
            {editWhId ? t('warehouses.editWarehouse') : t('warehouses.newWarehouse')}
          </Typography>
          <IconButton size="small" onClick={() => setWarehouseModalOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              required
              size="small"
              label={t('warehouses.warehouseName')}
              placeholder="напр. Регіональний склад Дніпро"
              value={whName}
              onChange={e => setWhName(e.target.value)}
            />
            <TextField
              fullWidth
              required
              size="small"
              label={t('warehouses.warehouseCode')}
              placeholder="напр. WH-DNIPRO"
              value={whCode}
              onChange={e => setWhCode(e.target.value)}
            />
            <TextField
              fullWidth
              size="small"
              label={t('warehouses.address')}
              placeholder="м. Дніпро, вул. Заводська, 15"
              value={whAddress}
              onChange={e => setWhAddress(e.target.value)}
            />
            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              label={t('warehouses.notes')}
              value={whDescription}
              onChange={e => setWhDescription(e.target.value)}
            />
            <FormControlLabel
              control={<Checkbox checked={whDefault} onChange={e => setWhDefault(e.target.checked)} />}
              label={t('warehouses.isDefault')}
            />
            {editWhId && (
              <FormControlLabel
                control={<Checkbox checked={whActive} onChange={e => setWhActive(e.target.checked)} />}
                label={t('warehouses.isActive')}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setWarehouseModalOpen(false)}>Скасувати</Button>
          <Button variant="contained" onClick={handleSaveWarehouse} disabled={loading}>
            Зберегти склад
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* CREATE TRANSFER MODAL                                          */}
      {/* ============================================================== */}
      <Dialog open={transferModalOpen} onClose={() => setTransferModalOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold">
            {t('warehouses.newTransfer')}
          </Typography>
          <IconButton size="small" onClick={() => setTransferModalOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" required>
                <InputLabel>{t('warehouses.sourceWarehouse')}</InputLabel>
                <Select
                  value={fromWhId}
                  label={t('warehouses.sourceWarehouse')}
                  onChange={e => setFromWhId(e.target.value)}
                >
                  {warehouses.filter(w => w.isActive).map(w => (
                    <MenuItem key={w.id} value={w.id} disabled={w.id === toWhId}>
                      {w.name} ({w.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" required>
                <InputLabel>{t('warehouses.targetWarehouse')}</InputLabel>
                <Select
                  value={toWhId}
                  label={t('warehouses.targetWarehouse')}
                  onChange={e => setToWhId(e.target.value)}
                >
                  {warehouses.filter(w => w.isActive).map(w => (
                    <MenuItem key={w.id} value={w.id} disabled={w.id === fromWhId}>
                      {w.name} ({w.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                size="small"
                label={t('warehouses.notes')}
                placeholder="Вкажіть причину переміщення або номер машини/водія..."
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={completeImmediately}
                    onChange={e => setCompleteImmediately(e.target.checked)}
                  />
                }
                label={t('warehouses.completeImmediately')}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Товари для переміщення ({transferItems.length})
            </Typography>
            <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={handleAddTransferItemRow}>
              {t('warehouses.addItem')}
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ minWidth: 260, fontWeight: 'bold' }}>{t('warehouses.selectProduct')}</TableCell>
                  <TableCell align="center" sx={{ width: 180, fontWeight: 'bold' }}>{t('warehouses.availableQty')}</TableCell>
                  <TableCell align="center" sx={{ width: 160, fontWeight: 'bold' }}>{t('warehouses.transferQty')}</TableCell>
                  <TableCell align="center" sx={{ width: 60 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transferItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      Не додано жодного товару для переміщення
                    </TableCell>
                  </TableRow>
                ) : (
                  transferItems.map((item, idx) => {
                    const stock = sourceWarehouseStocks.find(s => s.productId === item.productId);
                    const available = stock ? stock.quantity : 0;
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <FormControl fullWidth size="small">
                            <Select
                              value={item.productId}
                              onChange={e => {
                                const newProdId = e.target.value;
                                setTransferItems(prev =>
                                  prev.map((it, i) => (i === idx ? { ...it, productId: newProdId } : it))
                                );
                              }}
                            >
                              {sourceWarehouseStocks.map(s => (
                                <MenuItem key={s.productId} value={s.productId}>
                                  {s.productName} ({s.productSKU}) — доступно {s.quantity} {s.unit}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight="bold" color={available > 0 ? 'success.main' : 'error.main'}>
                            {available} шт.
                          </Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ width: 160 }}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            inputProps={{ min: 1, max: available }}
                            value={item.quantity}
                            onChange={e => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setTransferItems(prev =>
                                prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleRemoveTransferItemRow(idx)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setTransferModalOpen(false)}>Скасувати</Button>
          <Button variant="contained" onClick={handleSaveTransfer} disabled={loading}>
            {completeImmediately ? 'Виконати переміщення' : 'Відправити в дорогу'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* TRANSFER DETAILS DIALOG                                        */}
      {/* ============================================================== */}
      <Dialog open={transferDetailOpen} onClose={() => setTransferDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {selectedTransfer ? `Переміщення ${selectedTransfer.transferNumber}` : 'Деталі переміщення'}
            </Typography>
            {selectedTransfer && (
              <Typography variant="caption" color="text.secondary">
                {selectedTransfer.fromWarehouseName} ➔ {selectedTransfer.toWarehouseName} | {new Date(selectedTransfer.createdAt).toLocaleString('uk-UA')}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title={t('warehouses.printTransfer')}>
              <IconButton size="small" onClick={() => window.print()}>
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setTransferDetailOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedTransfer && (
            <>
              {/* Stepper */}
              <Box sx={{ mb: 3, mt: 1 }}>
                <Stepper
                  activeStep={
                    selectedTransfer.status === TransferStatus.Completed
                      ? 2
                      : selectedTransfer.status === TransferStatus.InTransit
                      ? 1
                      : 0
                  }
                  alternativeLabel
                >
                  <Step completed={selectedTransfer.status !== TransferStatus.Cancelled}>
                    <StepLabel>{t('warehouses.draft')}</StepLabel>
                  </Step>
                  <Step completed={selectedTransfer.status === TransferStatus.Completed}>
                    <StepLabel>{t('warehouses.inTransit')}</StepLabel>
                  </Step>
                  <Step completed={selectedTransfer.status === TransferStatus.Completed}>
                    <StepLabel>{t('warehouses.completed')}</StepLabel>
                  </Step>
                </Stepper>
              </Box>

              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Товар</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Кількість</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ціна за од.</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedTransfer.items.map(it => (
                      <TableRow key={it.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">{it.productName}</Typography>
                        </TableCell>
                        <TableCell align="center">{it.productSKU}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold">
                            {it.quantity} {it.unit}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {it.unitPrice.toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {selectedTransfer.notes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">Примітки:</Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    {selectedTransfer.notes}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setTransferDetailOpen(false)}>Закрити</Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* EDIT LOCATION ZONE MODAL                                       */}
      {/* ============================================================== */}
      <Dialog open={locationModalOpen} onClose={() => setLocationModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('warehouses.locationZone')}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>{locProductName}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Склад: {locWarehouseName}
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              size="small"
              label={t('warehouses.locationZone')}
              placeholder="напр. Секція A-3, Стеллаж 4"
              value={locZone}
              onChange={e => setLocZone(e.target.value)}
            />
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Мінімальний страховий запас на складі"
              value={locMinStock}
              onChange={e => setLocMinStock(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocationModalOpen(false)}>Скасувати</Button>
          <Button variant="contained" onClick={handleSaveLocation}>Зберегти</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WarehousesPage;
