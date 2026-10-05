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
  type WaybillData
} from '../utils/pdfWaybillGenerator';
import { useLanguage } from '../context/LanguageContext';

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
  const { t } = useLanguage();
  const [items, setItems] = useState<IssueItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [autoDownloadPdf, setAutoDownloadPdf] = useState<boolean>(true);
  const [completedWaybill, setCompletedWaybill] = useState<WaybillData | null>(null);

  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setDocumentNumber(`VN-${dateStr}-${randomSuffix}`);
    setCompletedWaybill(null);
    setError('');

    setItems(
      selectedProducts.map((p) => ({
        productId: p.id,
        sku: p.sku || '',
        name: p.name,
        price: Number(p.price) || 0,
        availableQuantity: p.quantity,
        unit: p.unit || t('common.pcs'),
        issueQuantity: 1
      }))
    );

    const fetchCustomers = async () => {
      try {
        const res = await api.get<Customer[]>('/customers');
        setCustomers(Array.isArray(res.data) ? res.data : []);
      } catch (err: unknown) {
        console.error('Fetch customers error:', err);
      }
    };

    fetchCustomers();
  }, [open, selectedProducts, t]);

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

  const buildWaybillData = (): WaybillData => ({
    documentNumber: documentNumber || `VN-${Date.now().toString().slice(-6)}`,
    date: new Date(),
    customer: selectedCustomer,
    reason: reason.trim() || t('operations.issuance'),
    storekeeperName: localStorage.getItem('username') || 'Storekeeper',
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

  const handlePreviewPdf = async () => {
    if (items.length === 0) return;
    try {
      const data = buildWaybillData();
      await printWaybillPdf(data);
    } catch (err) {
      console.error(err);
      setError(t('copilot.pdfError'));
    }
  };

  const handleDownloadPdf = async () => {
    if (items.length === 0) return;
    try {
      const data = buildWaybillData();
      await downloadWaybillPdf(data);
    } catch (err) {
      console.error(err);
      setError(t('copilot.pdfError'));
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;

    for (const item of items) {
      if (item.issueQuantity <= 0) {
        setError(`${item.name}: ${t('operations.quantity')}`);
        return;
      }
      if (item.issueQuantity > item.availableQuantity) {
        setError(`${item.name}: ${t('operations.insufficientStock')} (${item.availableQuantity} ${item.unit})`);
        return;
      }
    }

    setLoading(true);
    setError('');

    const waybillData = buildWaybillData();

    try {
      await Promise.all(
        items.map((item) =>
          api.post('/StockMovements', {
            productId: item.productId,
            quantity: item.issueQuantity,
            type: 2,
            movementType: 2,
            customerId: customerId || null,
            reason: reason.trim() || `${t('operations.issuance')} ${documentNumber}`
          })
        )
      );

      if (autoDownloadPdf) {
        try {
          await downloadWaybillPdf(waybillData);
        } catch (pdfErr) {
          console.error('PDF error:', pdfErr);
        }
      }

      setCompletedWaybill(waybillData);
      onSuccess();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError | string>(err)) {
        const data = err.response?.data;
        const msg =
          typeof data === 'string'
            ? data
            : data?.message || data?.title || t('common.error');
        setError(msg);
      } else {
        setError(t('common.error'));
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
            {t('operations.issuanceTitle')}
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

        {completedWaybill ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 1 }} />
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {t('operations.issuedSuccess')}
            </Typography>

            <Paper
              variant="outlined"
              sx={{ p: 2.5, mb: 3, maxWidth: 500, mx: 'auto', textAlign: 'left', bgcolor: 'action.hover' }}
            >
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>{t('operations.receiver')}:</strong> {completedWaybill.customer?.name || '—'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>{t('operations.reason')}:</strong> {completedWaybill.reason}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>{t('products.quantity')}:</strong> {completedWaybill.items.length} ({totalQuantity} {t('common.pcs')})
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: 'primary.main', fontWeight: 'bold' }}>
                <strong>{t('common.total')}:</strong> {formatCurrency(totalAmount)} {t('common.uah')}
              </Typography>
            </Paper>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => downloadWaybillPdf(completedWaybill)}
              >
                {t('operations.downloadPdf')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => printWaybillPdf(completedWaybill)}
              >
                {t('operations.printPdf')}
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('operations.receiver')}</InputLabel>
                <Select
                  value={customerId}
                  label={t('operations.receiver')}
                  onChange={(e: SelectChangeEvent<string>) => setCustomerId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>—</em>
                  </MenuItem>
                  {customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label={t('operations.documentNumber')}
                size="small"
                fullWidth
                value={documentNumber}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDocumentNumber(e.target.value)}
              />
            </Box>

            <TextField
              label={t('operations.reason')}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              value={reason}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
            />

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 280, mb: 2, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table size="small" sx={{ minWidth: 520 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>{t('products.name')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('products.price')}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{t('intelligence.currentStock')}</TableCell>
                    <TableCell align="center" width={110} sx={{ fontWeight: 'bold' }}>
                      {t('operations.quantity')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('common.total')}</TableCell>
                    <TableCell align="center" width={40}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        {t('common.emptyData')}
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
                                {item.sku}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {formatCurrency(item.price)} {t('common.uah')}
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
                              {formatCurrency(itemTotal)} {t('common.uah')}
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
              <Typography variant="body2" color="text.secondary">
                {t('products.quantity')}: <strong>{totalQuantity} {t('common.pcs')}</strong>
              </Typography>
              <Typography variant="h6" color="primary.main" fontWeight="bold">
                {t('common.total')}: {formatCurrency(totalAmount)} {t('common.uah')}
              </Typography>
            </Box>

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
                    {t('operations.downloadPdf')}
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
            {t('common.close')}
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handlePreviewPdf}
              disabled={loading || items.length === 0}
              startIcon={<PrintIcon />}
              variant="outlined"
            >
              {t('operations.printPdf')}
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={loading || items.length === 0}
              startIcon={<PictureAsPdfIcon />}
              variant="outlined"
              color="secondary"
            >
              {t('operations.generateWaybill')}
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              color="primary"
              disabled={loading || items.length === 0}
            >
              {loading ? t('common.loading') : t('operations.execute')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}