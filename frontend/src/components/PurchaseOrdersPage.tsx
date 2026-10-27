import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  Stack,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Send as SendIcon,
  LocalShipping as LocalShippingIcon,
  Warehouse as WarehouseIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material';

import {
  purchaseOrderApi,
  PurchaseOrderStatus
} from '../api/purchaseOrderApi';
import type {
  PurchaseOrderSummary,
  PurchaseOrderDetail,
  CreatePurchaseOrderInput,
  ReceiveItemInput
} from '../api/purchaseOrderApi';
import api from '../api/axiosConfig';
import type { Product, Partner } from '../types/inventory';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  isAdmin?: boolean;
  isManager?: boolean;
}

export const PurchaseOrdersPage: React.FC<Props> = ({ isAdmin = false, isManager = false }) => {
  const { t } = useLanguage();
  const canManage = isAdmin || isManager;

  // State
  const [orders, setOrders] = useState<PurchaseOrderSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<number | 'all'>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Aux data for dropdowns
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSupplierId, setFormSupplierId] = useState<string>('');
  const [formExpectedDate, setFormExpectedDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formItems, setFormItems] = useState<
    Array<{ productId: string; orderedQuantity: number; unitPrice: number; notes: string }>
  >([]);

  const [receiveModalOpen, setReceiveModalOpen] = useState<boolean>(false);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrderDetail | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  const [receiveNote, setReceiveNote] = useState<string>('');
  const [receiveLoading, setReceiveLoading] = useState<boolean>(false);

  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Initial load
  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await purchaseOrderApi.getAll();
      setOrders(data);
    } catch (err: unknown) {
      console.error(err);
      setError('Не вдалося завантажити список замовлень на закупівлю');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get<Partner[] | { items: Partner[] }>('/suppliers');
      const data = Array.isArray(res.data) ? res.data : (res.data as { items: Partner[] }).items || [];
      setSuppliers(data);
    } catch (err) {
      console.error('Error fetching suppliers', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get<Product[] | { items: Product[] }>('/products');
      const data = Array.isArray(res.data) ? res.data : (res.data as { items: Product[] }).items || [];
      setProducts(data);
    } catch (err) {
      console.error('Error fetching products', err);
    }
  };

  const loadOrderDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      const data = await purchaseOrderApi.getById(id);
      setSelectedOrder(data);
      setDetailModalOpen(true);
    } catch (err) {
      console.error(err);
      setError('Не вдалося завантажити деталі замовлення');
    } finally {
      setDetailLoading(false);
    }
  };

  // Status mapping
  const getStatusInfo = (status: PurchaseOrderStatus) => {
    switch (status) {
      case PurchaseOrderStatus.Draft:
        return { label: t('purchaseOrders.draft'), color: 'default' as const };
      case PurchaseOrderStatus.PendingApproval:
        return { label: t('purchaseOrders.pendingApproval'), color: 'warning' as const };
      case PurchaseOrderStatus.Approved:
        return { label: t('purchaseOrders.approved'), color: 'info' as const };
      case PurchaseOrderStatus.Sent:
        return { label: t('purchaseOrders.sent'), color: 'secondary' as const };
      case PurchaseOrderStatus.PartiallyReceived:
        return { label: t('purchaseOrders.partiallyReceived'), color: 'warning' as const };
      case PurchaseOrderStatus.Completed:
        return { label: t('purchaseOrders.completed'), color: 'success' as const };
      case PurchaseOrderStatus.Cancelled:
        return { label: t('purchaseOrders.cancelled'), color: 'error' as const };
      default:
        return { label: 'Невідомо', color: 'default' as const };
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (supplierFilter !== 'all' && o.supplierId !== supplierFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = o.orderNumber.toLowerCase().includes(q);
        const matchesTitle = o.title.toLowerCase().includes(q);
        const matchesSupplier = o.supplierName.toLowerCase().includes(q);
        if (!matchesNumber && !matchesTitle && !matchesSupplier) return false;
      }
      return true;
    });
  }, [orders, statusFilter, supplierFilter, searchQuery]);

  // Totals
  const totalOrdersCount = orders.length;
  const inTransitCount = orders.filter(o => o.status === PurchaseOrderStatus.Sent || o.status === PurchaseOrderStatus.PartiallyReceived).length;
  const totalVolumeAmount = orders.reduce((acc, o) => acc + o.totalAmount, 0);

  // Create / Edit modal handlers
  const handleOpenCreateModal = () => {
    setEditOrderId(null);
    setFormTitle('');
    setFormSupplierId(suppliers.length > 0 ? suppliers[0].id : '');
    setFormExpectedDate('');
    setFormNotes('');
    setFormItems(
      products.length > 0
        ? [{ productId: products[0].id, orderedQuantity: 1, unitPrice: products[0].price, notes: '' }]
        : []
    );
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = async (order: PurchaseOrderSummary) => {
    try {
      setDetailLoading(true);
      const detail = await purchaseOrderApi.getById(order.id);
      setEditOrderId(detail.id);
      setFormTitle(detail.title);
      setFormSupplierId(detail.supplierId);
      setFormExpectedDate(detail.expectedDeliveryDate ? detail.expectedDeliveryDate.substring(0, 10) : '');
      setFormNotes(detail.notes || '');
      setFormItems(
        detail.items.map(i => ({
          productId: i.productId,
          orderedQuantity: i.orderedQuantity,
          unitPrice: i.unitPrice,
          notes: i.notes || ''
        }))
      );
      setCreateModalOpen(true);
    } catch (err) {
      console.error(err);
      setError('Не вдалося відкрити замовлення для редагування');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddItemRow = () => {
    const firstProd = products[0];
    setFormItems(prev => [
      ...prev,
      {
        productId: firstProd ? firstProd.id : '',
        orderedQuantity: 1,
        unitPrice: firstProd ? firstProd.price : 0,
        notes: ''
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemProductChange = (index: number, newProductId: string) => {
    const prod = products.find(p => p.id === newProductId);
    setFormItems(prev =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              productId: newProductId,
              unitPrice: prod ? prod.price : item.unitPrice
            }
          : item
      )
    );
  };

  const handleSaveOrder = async () => {
    if (!formTitle.trim()) {
      setError('Вкажіть назву або призначення замовлення');
      return;
    }
    if (!formSupplierId) {
      setError('Оберіть постачальника');
      return;
    }
    if (formItems.length === 0) {
      setError('Додайте хоча б одну позицію товару');
      return;
    }
    for (const item of formItems) {
      if (!item.productId || item.orderedQuantity <= 0) {
        setError('Перевірте правильність заповнення кількості та товарів');
        return;
      }
    }

    try {
      setLoading(true);
      const payload: CreatePurchaseOrderInput = {
        title: formTitle.trim(),
        supplierId: formSupplierId,
        expectedDeliveryDate: formExpectedDate ? new Date(formExpectedDate).toISOString() : null,
        notes: formNotes.trim() || null,
        items: formItems.map(i => ({
          productId: i.productId,
          orderedQuantity: Number(i.orderedQuantity),
          unitPrice: Number(i.unitPrice),
          notes: i.notes.trim() || undefined
        }))
      };

      if (editOrderId) {
        await purchaseOrderApi.update(editOrderId, payload);
        setSuccessMsg(t('purchaseOrders.successUpdated'));
      } else {
        await purchaseOrderApi.create(payload);
        setSuccessMsg(t('purchaseOrders.successCreated'));
      }

      setCreateModalOpen(false);
      await fetchOrders();
    } catch (err: unknown) {
      console.error(err);
      setError('Помилка при збереженні замовлення');
    } finally {
      setLoading(false);
    }
  };

  // Workflow actions
  const handleSubmitForApproval = async (id: string) => {
    try {
      setLoading(true);
      await purchaseOrderApi.submitForApproval(id);
      setSuccessMsg('Замовлення передано на затвердження');
      await fetchOrders();
      if (selectedOrder && selectedOrder.id === id) {
        const updated = await purchaseOrderApi.getById(id);
        setSelectedOrder(updated);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Не вдалося відправити на погодження');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setLoading(true);
      await purchaseOrderApi.approve(id);
      setSuccessMsg(t('purchaseOrders.successApproved'));
      await fetchOrders();
      if (selectedOrder && selectedOrder.id === id) {
        const updated = await purchaseOrderApi.getById(id);
        setSelectedOrder(updated);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Не вдалося затвердити замовлення');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToSupplier = async (id: string) => {
    try {
      setLoading(true);
      await purchaseOrderApi.sendToSupplier(id);
      setSuccessMsg(t('purchaseOrders.successSent'));
      await fetchOrders();
      if (selectedOrder && selectedOrder.id === id) {
        const updated = await purchaseOrderApi.getById(id);
        setSelectedOrder(updated);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Не вдалося відправити замовлення постачальнику');
    } finally {
      setLoading(false);
    }
  };

  // Receiving modal
  const handleOpenReceiveModal = async (order: PurchaseOrderSummary) => {
    try {
      setReceiveLoading(true);
      const detail = await purchaseOrderApi.getById(order.id);
      setReceivingOrder(detail);
      const initialQtys: Record<string, number> = {};
      detail.items.forEach(i => {
        initialQtys[i.id] = i.remainingQuantity; // Default to receiving remaining
      });
      setReceiveQuantities(initialQtys);
      setReceiveNote('');
      setReceiveModalOpen(true);
    } catch (err) {
      console.error(err);
      setError('Не вдалося завантажити позиції для приймання');
    } finally {
      setReceiveLoading(false);
    }
  };

  const handleFillAllRemaining = () => {
    if (!receivingOrder) return;
    const filled: Record<string, number> = {};
    receivingOrder.items.forEach(i => {
      filled[i.id] = i.remainingQuantity;
    });
    setReceiveQuantities(filled);
  };

  const handleConfirmReceive = async () => {
    if (!receivingOrder) return;

    const itemsToReceive: ReceiveItemInput[] = Object.entries(receiveQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([itemId, qty]) => ({
        itemId,
        quantityToReceive: Number(qty)
      }));

    if (itemsToReceive.length === 0) {
      setError('Вкажіть кількість хоча б для однієї позиції для оприбуткування');
      return;
    }

    try {
      setReceiveLoading(true);
      await purchaseOrderApi.receiveItems(receivingOrder.id, {
        items: itemsToReceive,
        notes: receiveNote.trim() || undefined
      });
      setSuccessMsg(t('purchaseOrders.successReceived'));
      setReceiveModalOpen(false);
      await fetchOrders();
      if (selectedOrder && selectedOrder.id === receivingOrder.id) {
        const updated = await purchaseOrderApi.getById(receivingOrder.id);
        setSelectedOrder(updated);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Помилка при оприбуткуванні товарів');
    } finally {
      setReceiveLoading(false);
    }
  };

  // Cancel order
  const handleOpenCancelModal = (orderId: string) => {
    setOrderToCancel(orderId);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;
    try {
      setLoading(true);
      await purchaseOrderApi.cancel(orderToCancel, cancelReason.trim() || undefined);
      setSuccessMsg(t('purchaseOrders.successCancelled'));
      setCancelModalOpen(false);
      await fetchOrders();
      if (selectedOrder && selectedOrder.id === orderToCancel) {
        const updated = await purchaseOrderApi.getById(orderToCancel);
        setSelectedOrder(updated);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Не вдалося скасувати замовлення');
    } finally {
      setLoading(false);
    }
  };

  // Delete order
  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('Ви впевнені, що бажаєте видалити це замовлення?')) return;
    try {
      setLoading(true);
      await purchaseOrderApi.delete(orderId);
      setSuccessMsg('Замовлення успішно видалено');
      await fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setDetailModalOpen(false);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Не вдалося видалити замовлення');
    } finally {
      setLoading(false);
    }
  };

  const formTotalCalculated = useMemo(() => {
    return formItems.reduce((acc, i) => acc + (Number(i.orderedQuantity) || 0) * (Number(i.unitPrice) || 0), 0);
  }, [formItems]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCartIcon color="primary" fontSize="large" />
            {t('purchaseOrders.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('purchaseOrders.subtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchOrders()}
            disabled={loading}
          >
            Оновити
          </Button>
          {canManage && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateModal}
              sx={{ boxShadow: 2 }}
            >
              {t('purchaseOrders.createOrder')}
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
                Всього замовлень
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="primary.main">
                {totalOrdersCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card elevation={1}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                В дорозі / Очікують приймання
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
                Загальний бюджет замовлень
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                {totalVolumeAmount.toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters Toolbar */}
      <Paper sx={{ p: 2, mb: 3 }} elevation={1}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('purchaseOrders.searchPlaceholder')}
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
          <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('purchaseOrders.filterSupplier')}</InputLabel>
              <Select
                value={supplierFilter}
                label={t('purchaseOrders.filterSupplier')}
                onChange={e => setSupplierFilter(e.target.value)}
              >
                <MenuItem value="all">Всі постачальники</MenuItem>
                {suppliers.map(s => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('purchaseOrders.allStatuses')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('purchaseOrders.allStatuses')}
                onChange={e => setStatusFilter(e.target.value as number | 'all')}
              >
                <MenuItem value="all">{t('purchaseOrders.allStatuses')}</MenuItem>
                <MenuItem value={PurchaseOrderStatus.Draft}>{t('purchaseOrders.draft')}</MenuItem>
                <MenuItem value={PurchaseOrderStatus.PendingApproval}>{t('purchaseOrders.pendingApproval')}</MenuItem>
                <MenuItem value={PurchaseOrderStatus.Approved}>{t('purchaseOrders.approved')}</MenuItem>
                <MenuItem value={PurchaseOrderStatus.Sent}>{t('purchaseOrders.sent')}</MenuItem>
                <MenuItem value={PurchaseOrderStatus.PartiallyReceived}>{t('purchaseOrders.partiallyReceived')}</MenuItem>
                <MenuItem value={PurchaseOrderStatus.Completed}>{t('purchaseOrders.completed')}</MenuItem>
                <MenuItem value={PurchaseOrderStatus.Cancelled}>{t('purchaseOrders.cancelled')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Orders Table */}
      <TableContainer component={Paper} elevation={1}>
        {loading && <LinearProgress />}
        <Table sx={{ minWidth: 800 }}>
          <TableHead sx={{ backgroundColor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>{t('purchaseOrders.orderNumber')}</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>{t('purchaseOrders.orderTitle')}</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>{t('purchaseOrders.supplier')}</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>{t('purchaseOrders.expectedDate')}</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>{t('purchaseOrders.status')}</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                {t('purchaseOrders.totalQty')}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                {t('purchaseOrders.totalAmount')}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                {t('purchaseOrders.actions')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {t('purchaseOrders.emptyList')}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map(order => {
                const statusInfo = getStatusInfo(order.status);
                const progressPct =
                  order.totalOrderedQuantity > 0
                    ? Math.round((order.totalReceivedQuantity / order.totalOrderedQuantity) * 100)
                    : 0;

                return (
                  <TableRow key={order.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {order.orderNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(order.createdAt).toLocaleDateString('uk-UA')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{order.title}</Typography>
                      {order.notes && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                          {order.notes}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {order.supplierName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {order.expectedDeliveryDate ? (
                        <Typography variant="body2">
                          {new Date(order.expectedDeliveryDate).toLocaleDateString('uk-UA')}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={statusInfo.label} color={statusInfo.color} size="small" variant="filled" />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {order.totalReceivedQuantity} / {order.totalOrderedQuantity}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, progressPct)}
                        color={order.status === PurchaseOrderStatus.Completed ? 'success' : 'primary'}
                        sx={{ height: 5, borderRadius: 2, mt: 0.5 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold">
                        {order.totalAmount.toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.totalItemsCount} поз.
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        {/* View Details */}
                        <Tooltip title={t('purchaseOrders.detailsTitle')}>
                          <IconButton size="small" color="primary" onClick={() => loadOrderDetail(order.id)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        {/* Submit draft for approval */}
                        {order.status === PurchaseOrderStatus.Draft && (
                          <Tooltip title={t('purchaseOrders.submitApproval')}>
                            <IconButton size="small" color="warning" onClick={() => handleSubmitForApproval(order.id)}>
                              <SendIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Approve (Manager / Admin) */}
                        {canManage && (order.status === PurchaseOrderStatus.PendingApproval || order.status === PurchaseOrderStatus.Draft) && (
                          <Tooltip title={t('purchaseOrders.approve')}>
                            <IconButton size="small" color="success" onClick={() => handleApprove(order.id)}>
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Mark Sent (Manager / Admin) */}
                        {canManage && order.status === PurchaseOrderStatus.Approved && (
                          <Tooltip title={t('purchaseOrders.sendSupplier')}>
                            <IconButton size="small" color="secondary" onClick={() => handleSendToSupplier(order.id)}>
                              <LocalShippingIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Receive Goods (Staff / Worker) */}
                        {(order.status === PurchaseOrderStatus.Approved ||
                          order.status === PurchaseOrderStatus.Sent ||
                          order.status === PurchaseOrderStatus.PartiallyReceived) && (
                          <Tooltip title={t('purchaseOrders.receiveGoods')}>
                            <IconButton size="small" color="info" onClick={() => handleOpenReceiveModal(order)}>
                              <WarehouseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Edit Draft */}
                        {order.status === PurchaseOrderStatus.Draft && canManage && (
                          <Tooltip title={t('purchaseOrders.editOrder')}>
                            <IconButton size="small" color="inherit" onClick={() => handleOpenEditModal(order)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Cancel order */}
                        {canManage &&
                          order.status !== PurchaseOrderStatus.Completed &&
                          order.status !== PurchaseOrderStatus.Cancelled && (
                            <Tooltip title={t('purchaseOrders.cancelOrder')}>
                              <IconButton size="small" color="error" onClick={() => handleOpenCancelModal(order.id)}>
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                        {/* Delete order (Admin only) */}
                        {isAdmin &&
                          (order.status === PurchaseOrderStatus.Draft || order.status === PurchaseOrderStatus.Cancelled) && (
                            <Tooltip title={t('purchaseOrders.deleteOrder')}>
                              <IconButton size="small" color="default" onClick={() => handleDeleteOrder(order.id)}>
                                <DeleteIcon fontSize="small" />
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

      {/* ============================================================== */}
      {/* CREATE / EDIT ORDER MODAL                                      */}
      {/* ============================================================== */}
      <Dialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold">
            {editOrderId ? t('purchaseOrders.editOrder') : t('purchaseOrders.createOrder')}
          </Typography>
          <IconButton size="small" onClick={() => setCreateModalOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                required
                size="small"
                label={t('purchaseOrders.orderTitle')}
                placeholder="напр. Регулярна закупівля побутової техніки"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label={t('purchaseOrders.expectedDate')}
                InputLabelProps={{ shrink: true }}
                value={formExpectedDate}
                onChange={e => setFormExpectedDate(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" required>
                <InputLabel>{t('purchaseOrders.supplier')}</InputLabel>
                <Select
                  value={formSupplierId}
                  label={t('purchaseOrders.supplier')}
                  onChange={e => setFormSupplierId(e.target.value)}
                >
                  {suppliers.map(s => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label={t('purchaseOrders.notes')}
                placeholder="Примітки до замовлення..."
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Items Sub-table */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Позиції замовлення ({formItems.length})
            </Typography>
            <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={handleAddItemRow}>
              {t('purchaseOrders.addItem')}
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ minWidth: 260, fontWeight: 'bold' }}>{t('purchaseOrders.selectProduct')}</TableCell>
                  <TableCell align="center" sx={{ width: 140, fontWeight: 'bold' }}>{t('purchaseOrders.orderedQuantity')}</TableCell>
                  <TableCell align="center" sx={{ width: 220, fontWeight: 'bold' }}>{t('purchaseOrders.unitPrice')}</TableCell>
                  <TableCell align="right" sx={{ width: 160, fontWeight: 'bold' }}>{t('purchaseOrders.cost')}</TableCell>
                  <TableCell align="center" sx={{ width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      {t('purchaseOrders.noItems')}
                    </TableCell>
                  </TableRow>
                ) : (
                  formItems.map((item, idx) => {
                    const rowCost = (Number(item.orderedQuantity) || 0) * (Number(item.unitPrice) || 0);
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <FormControl fullWidth size="small">
                            <Select
                              value={item.productId}
                              onChange={e => handleItemProductChange(idx, e.target.value)}
                            >
                              {products.map(p => (
                                <MenuItem key={p.id} value={p.id}>
                                  {p.name} ({p.sku || 'SKU'}) — {p.price} ₴
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell sx={{ width: 140 }}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            inputProps={{ min: 1 }}
                            value={item.orderedQuantity}
                            onChange={e => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setFormItems(prev =>
                                prev.map((it, i) => (i === idx ? { ...it, orderedQuantity: val } : it))
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ width: 220 }}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: '0.01' }}
                            InputProps={{
                              endAdornment: <InputAdornment position="end">₴</InputAdornment>
                            }}
                            value={item.unitPrice}
                            onChange={e => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              setFormItems(prev =>
                                prev.map((it, i) => (i === idx ? { ...it, unitPrice: val } : it))
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ width: 160 }}>
                          <Typography variant="body2" fontWeight="bold">
                            {rowCost.toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleRemoveItemRow(idx)}>
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

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1">Загальна сума замовлення:</Typography>
            <Typography variant="h6" fontWeight="bold" color="primary.main">
              {formTotalCalculated.toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCreateModalOpen(false)}>Скасувати</Button>
          <Button variant="contained" onClick={handleSaveOrder} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Зберегти замовлення'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* RECEIVE GOODS MODAL                                            */}
      {/* ============================================================== */}
      <Dialog
        open={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {t('purchaseOrders.receiveDialogTitle')}
            </Typography>
            {receivingOrder && (
              <Typography variant="caption" color="text.secondary">
                {receivingOrder.orderNumber} ({receivingOrder.supplierName})
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={() => setReceiveModalOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('purchaseOrders.receiveDialogSubtitle')}
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <TextField
              size="small"
              sx={{ flexGrow: 1, minWidth: 280 }}
              label={t('purchaseOrders.receiptNote')}
              placeholder="напр. ТТН №123456789 від Нової Пошти"
              value={receiveNote}
              onChange={e => setReceiveNote(e.target.value)}
            />
            <Button variant="outlined" size="small" onClick={handleFillAllRemaining}>
              {t('purchaseOrders.receiveAll')}
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Товар</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                    {t('purchaseOrders.ordered')}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                    {t('purchaseOrders.received')}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                    {t('purchaseOrders.remaining')}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', width: 160 }}>
                    {t('purchaseOrders.quantityToReceive')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receivingOrder?.items.map(item => {
                  const toReceive = receiveQuantities[item.id] || 0;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {item.productName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          SKU: {item.productSKU} | {item.categoryName}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{item.orderedQuantity} {item.unit}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="success.main" fontWeight="bold">
                          {item.receivedQuantity} {item.unit}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="warning.main" fontWeight="bold">
                          {item.remainingQuantity} {item.unit}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          inputProps={{ min: 0, max: item.remainingQuantity }}
                          disabled={item.remainingQuantity <= 0}
                          value={toReceive}
                          onChange={e => {
                            const val = Math.min(
                              item.remainingQuantity,
                              Math.max(0, parseInt(e.target.value) || 0)
                            );
                            setReceiveQuantities(prev => ({
                              ...prev,
                              [item.id]: val
                            }));
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReceiveModalOpen(false)}>Скасувати</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<WarehouseIcon />}
            onClick={handleConfirmReceive}
            disabled={receiveLoading}
          >
            {receiveLoading ? <CircularProgress size={24} /> : t('purchaseOrders.confirmReceive')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* DETAILS / TIMELINE / PRINT DIALOG                              */}
      {/* ============================================================== */}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {selectedOrder ? `${selectedOrder.orderNumber}: ${selectedOrder.title}` : t('purchaseOrders.detailsTitle')}
            </Typography>
            {selectedOrder && (
              <Typography variant="caption" color="text.secondary">
                Постачальник: {selectedOrder.supplierName} | Створено: {new Date(selectedOrder.createdAt).toLocaleString('uk-UA')} ({selectedOrder.createdByUserName})
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title={t('purchaseOrders.printOrder')}>
              <IconButton size="small" onClick={() => window.print()}>
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setDetailModalOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading || !selectedOrder ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Stepper for Lifecycle */}
              <Box sx={{ mb: 4, mt: 1 }}>
                <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
                  {t('purchaseOrders.timeline')}
                </Typography>
                <Stepper
                  activeStep={
                    selectedOrder.status === PurchaseOrderStatus.Completed
                      ? 5
                      : selectedOrder.status === PurchaseOrderStatus.PartiallyReceived
                      ? 4
                      : selectedOrder.status === PurchaseOrderStatus.Sent
                      ? 3
                      : selectedOrder.status === PurchaseOrderStatus.Approved
                      ? 2
                      : selectedOrder.status === PurchaseOrderStatus.PendingApproval
                      ? 1
                      : 0
                  }
                  alternativeLabel
                >
                  <Step completed={selectedOrder.status > PurchaseOrderStatus.Draft && selectedOrder.status !== PurchaseOrderStatus.Cancelled}>
                    <StepLabel>{t('purchaseOrders.draft')}</StepLabel>
                  </Step>
                  <Step completed={selectedOrder.status > PurchaseOrderStatus.PendingApproval && selectedOrder.status !== PurchaseOrderStatus.Cancelled}>
                    <StepLabel>{t('purchaseOrders.pendingApproval')}</StepLabel>
                  </Step>
                  <Step completed={selectedOrder.status > PurchaseOrderStatus.Approved && selectedOrder.status !== PurchaseOrderStatus.Cancelled}>
                    <StepLabel>{t('purchaseOrders.approved')}</StepLabel>
                  </Step>
                  <Step completed={selectedOrder.status > PurchaseOrderStatus.Sent && selectedOrder.status !== PurchaseOrderStatus.Cancelled}>
                    <StepLabel>{t('purchaseOrders.sent')}</StepLabel>
                  </Step>
                  <Step completed={selectedOrder.status === PurchaseOrderStatus.Completed}>
                    <StepLabel>
                      {selectedOrder.status === PurchaseOrderStatus.PartiallyReceived
                        ? t('purchaseOrders.partiallyReceived')
                        : t('purchaseOrders.completed')}
                    </StepLabel>
                  </Step>
                </Stepper>
              </Box>

              {/* Status info bar */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: 'action.hover' }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Поточний статус</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={getStatusInfo(selectedOrder.status).label}
                        color={getStatusInfo(selectedOrder.status).color}
                        size="small"
                      />
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Затвердив</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {selectedOrder.approvedByUserName || '—'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Очікувана поставка</Typography>
                    <Typography variant="body2">
                      {selectedOrder.expectedDeliveryDate
                        ? new Date(selectedOrder.expectedDeliveryDate).toLocaleDateString('uk-UA')
                        : 'Не вказано'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Загальна вартість</Typography>
                    <Typography variant="body2" fontWeight="bold" color="primary.main">
                      {selectedOrder.totalAmount.toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Line items table */}
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
                Товарні позиції замовлення
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Товар</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Категорія</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ціна за од.</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Замовлено</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Прийнято</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Сума</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedOrder.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {item.productName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            SKU: {item.productSKU}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">{item.categoryName}</TableCell>
                        <TableCell align="right">
                          {item.unitPrice.toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight="bold">
                            {item.orderedQuantity} {item.unit}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color={item.receivedQuantity >= item.orderedQuantity ? 'success.main' : 'warning.main'}
                          >
                            {item.receivedQuantity} {item.unit}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold">
                            {item.totalCost.toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {selectedOrder.notes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    Примітки:
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    {selectedOrder.notes}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDetailModalOpen(false)}>Закрити</Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* CANCEL ORDER MODAL                                             */}
      {/* ============================================================== */}
      <Dialog open={cancelModalOpen} onClose={() => setCancelModalOpen(false)}>
        <DialogTitle>{t('purchaseOrders.cancelOrder')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ви дійсно бажаєте скасувати це замовлення? Цю дію неможливо буде відмінити.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label={t('purchaseOrders.cancelReason')}
            placeholder="Вкажіть причину скасування (необов'язково)..."
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelModalOpen(false)}>Назад</Button>
          <Button variant="contained" color="error" onClick={handleConfirmCancel} disabled={loading}>
            Підтвердити скасування
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseOrdersPage;
