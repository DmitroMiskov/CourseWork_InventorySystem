import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import axios from 'axios';
import api from '../api/axiosConfig';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Box,
  Checkbox,
  FormControlLabel,
  Chip,
  LinearProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { SelectChangeEvent } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import type { Product } from '../types/inventory';
import {
  downloadWaybillPdf,
  printWaybillPdf,
  formatCurrency,
  numberToUkrainianWords,
  type WaybillData
} from '../utils/pdfWaybillGenerator';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
}

interface IssuanceModalProps {
  open: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  onSuccess: () => void;
}

interface IssueItem {
  productId: string;
  sku: string;
  name: string;
  price: number;
  availableQuantity: number;
  unit: string;
  issueQuantity: number;
}

interface ServerError {
  title?: string;
  status?: number;
  message?: string;
}

export default function IssuanceModal({
  open,
  onClose,
  selectedProducts,
  onSuccess
}: IssuanceModalProps) {
  const [items, setItems] = useState<IssueItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [autoDownloadPdf, setAutoDownloadPdf] = useState<boolean>(true);
  const [completedWaybill, setCompletedWaybill] = useState<WaybillData | null>(null);

  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Генеруємо новий номер накладної при відкритті вікна
  useEffect(() => {
    if (!open) return;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setDocumentNumber(`ВН-${dateStr}-${randomSuffix}`);
    setCompletedWaybill(null);
    setError('');

    setItems(
      selectedProducts.map((p) => ({
        productId: p.id,
        sku: p.sku || '',
        name: p.name,
        price: Number(p.price) || 0,
        availableQuantity: p.quantity,
        unit: p.unit || 'шт',
        issueQuantity: 1
      }))
    );

    const fetchCustomers = async () => {
      try {
        const res = await api.get<Customer[]>('/customers');
        setCustomers(Array.isArray(res.data) ? res.data : []);
      } catch (err: unknown) {
        console.error('Помилка завантаження контрагентів:', err);
      }
    };

    fetchCustomers();
  }, [open, selectedProducts]);

  // Підсумкові обчислення
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.issueQuantity, 0),
    [items]
  );

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.issueQuantity * item.price, 0),
    [items]
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) || null,
    [customers, customerId]
  );

  // Формуємо об'єкт накладної
  const buildWaybillData = (): WaybillData => ({
    documentNumber: documentNumber || `ВН-${Date.now().toString().slice(-6)}`,
    date: new Date(),
    customer: selectedCustomer,
    reason: reason.trim() || 'Видача матеріальних цінностей зі складу',
    storekeeperName: localStorage.getItem('username') || 'Адміністратор складу',
    items: items.map((it) => ({
      sku: it.sku,
      name: it.name,
      unit: it.unit,
      quantity: it.issueQuantity,
      price: it.price
    }))
  });

  const handleQuantityChange = (productId: string, value: string) => {
    const parsed = parseInt(value, 10) || 0;
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, issueQuantity: parsed } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Попередній перегляд або друк накладної без списання
  const handlePreviewPdf = async () => {
    if (items.length === 0) {
      setError('Немає товарів для формування накладної');
      return;
    }
    try {
      const data = buildWaybillData();
      await printWaybillPdf(data);
    } catch (err) {
      console.error(err);
      setError('Не вдалося відкрити накладну для друку');
    }
  };

  // Пряме завантаження файлу PDF
  const handleDownloadPdf = async () => {
    if (items.length === 0) {
      setError('Немає товарів для формування накладної');
      return;
    }
    try {
      const data = buildWaybillData();
      await downloadWaybillPdf(data);
    } catch (err) {
      console.error(err);
      setError('Не вдалося сформувати PDF накладну');
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      setError('Список товарів для видачі порожній');
      return;
    }

    for (const item of items) {
      if (item.issueQuantity <= 0) {
        setError(`Вкажіть кількість більше 0 для товару "${item.name}"`);
        return;
      }
      if (item.issueQuantity > item.availableQuantity) {
        setError(
          `Кількість для видачі "${item.name}" перевищує залишок (${item.availableQuantity} ${item.unit})`
        );
        return;
      }
    }

    setLoading(true);
    setError('');

    const waybillData = buildWaybillData();

    try {
      // 1. Проводимо складські операції списання
      await Promise.all(
        items.map((item) =>
          api.post('/StockMovements', {
            productId: item.productId,
            quantity: item.issueQuantity,
            type: 2,
            movementType: 2, // 2 = Розхід / Видача
            customerId: customerId || null,
            reason: reason.trim() || `Видача за накладною № ${documentNumber}`
          })
        )
      );

      // 2. Якщо ввімкнено автозавантаження — відразу завантажуємо PDF
      if (autoDownloadPdf) {
        try {
          await downloadWaybillPdf(waybillData);
        } catch (pdfErr) {
          console.error('Помилка автоматичного завантаження PDF:', pdfErr);
        }
      }

      // 3. Зберігаємо дані для вікна успішного завершення
      setCompletedWaybill(waybillData);
      onSuccess();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError | string>(err)) {
        const data = err.response?.data;
        const msg =
          typeof data === 'string'
            ? data
            : data?.message || data?.title || 'Помилка оформлення видачі';
        setError(`Сервер: ${msg}`);
      } else {
        setError('Непередбачена помилка під час видачі товарів');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setCustomerId('');
    setReason('');
    setItems([]);
    setCompletedWaybill(null);
    onClose();
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight="bold">
            {completedWaybill ? 'Видачу оформлено' : 'Оформлення видачі'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={completedWaybill ? completedWaybill.documentNumber : documentNumber}
              color="primary"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
            {isMobile && (
              <IconButton onClick={handleClose} size="small" edge="end">
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 1. Екран успіху після проведення видачі */}
        {completedWaybill ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 1 }} />
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Товари успішно списано зі складу!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Сформовано офіційну накладну{' '}
              <strong>№ {completedWaybill.documentNumber}</strong> від{' '}
              {new Date().toLocaleDateString('uk-UA')}.
            </Typography>

            <Paper
              variant="outlined"
              sx={{ p: 2.5, mb: 3, maxWidth: 500, mx: 'auto', textAlign: 'left', bgcolor: 'action.hover' }}
            >
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Одержувач:</strong> {completedWaybill.customer?.name || 'Не вказано'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Підстава:</strong> {completedWaybill.reason}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Позицій:</strong> {completedWaybill.items.length} найм. ({totalQuantity} од.)
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: 'primary.main', fontWeight: 'bold' }}>
                <strong>Загальна сума:</strong> {formatCurrency(totalAmount)} грн
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {numberToUkrainianWords(totalAmount)}
              </Typography>
            </Paper>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => downloadWaybillPdf(completedWaybill)}
              >
                Завантажити накладну (PDF)
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => printWaybillPdf(completedWaybill)}
              >
                Роздрукувати накладну
              </Button>
            </Box>
          </Box>
        ) : (
          /* 2. Форма оформлення видачі */
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Отримувач / Клієнт</InputLabel>
                <Select
                  value={customerId}
                  label="Отримувач / Клієнт"
                  onChange={(e: SelectChangeEvent<string>) => setCustomerId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Не вказано</em>
                  </MenuItem>
                  {customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Номер накладної"
                size="small"
                fullWidth
                value={documentNumber}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDocumentNumber(e.target.value)}
              />
            </Box>

            <TextField
              label="Підстава / Замовлення / Примітка"
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              value={reason}
              placeholder="Наприклад: Замовлення №45 від ТОВ «ТехноРітейл»"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
            />

            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Товари для включення у накладну ({items.length}):
            </Typography>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 280, mb: 2, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table size="small" sx={{ minWidth: 520 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Товар / Артикул</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ціна</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Залишок</TableCell>
                    <TableCell align="center" width={110} sx={{ fontWeight: 'bold' }}>
                      До видачі
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Сума</TableCell>
                    <TableCell align="center" width={40}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Список товарів порожній
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      const itemTotal = item.issueQuantity * item.price;
                      return (
                        <TableRow key={item.productId} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="500">
                              {item.name}
                            </Typography>
                            {item.sku && (
                              <Typography variant="caption" color="text.secondary">
                                Артикул: {item.sku}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {formatCurrency(item.price)} грн
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" color="text.secondary">
                              {item.availableQuantity} {item.unit}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number"
                              size="small"
                              value={item.issueQuantity}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                handleQuantityChange(item.productId, e.target.value)
                              }
                              inputProps={{ min: 1, max: item.availableQuantity, style: { textAlign: 'center' } }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold">
                              {formatCurrency(itemTotal)} грн
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveItem(item.productId)}
                            >
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

            {/* Підсумковий блок */}
            <Box
              sx={{
                p: 1.5,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1
              }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Всього позицій: <strong>{items.length}</strong> | Загальна кількість: <strong>{totalQuantity} од.</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {numberToUkrainianWords(totalAmount)}
                </Typography>
              </Box>
              <Typography variant="h6" color="primary.main" fontWeight="bold">
                Разом: {formatCurrency(totalAmount)} грн
              </Typography>
            </Box>

            {/* Опція автозавантаження */}
            <Box sx={{ mt: 1.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoDownloadPdf}
                    onChange={(e) => setAutoDownloadPdf(e.target.checked)}
                    color="primary"
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    Автоматично завантажити видаткову накладну (PDF) після підтвердження
                  </Typography>
                }
              />
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
        {completedWaybill ? (
          <Button onClick={handleClose} variant="contained">
            Закрити
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={loading}>
              Скасувати
            </Button>
            <Button
              onClick={handlePreviewPdf}
              disabled={loading || items.length === 0}
              startIcon={<PrintIcon />}
              variant="outlined"
            >
              Друк
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={loading || items.length === 0}
              startIcon={<PictureAsPdfIcon />}
              variant="outlined"
              color="secondary"
            >
              Накладна (PDF)
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              color="primary"
              disabled={loading || items.length === 0}
            >
              {loading ? 'Оформлення...' : 'Підтвердити видачу'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}