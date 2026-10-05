import { useState, useEffect } from 'react';
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
  Box,
  Typography,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';

import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { downloadWaybillPdf, type WaybillData } from '../utils/pdfWaybillGenerator';
import { useLanguage } from '../context/LanguageContext';

interface Product {
  id: string;
  sku?: string;
  name: string;
  price?: number;
  quantity: number;
  unit: string;
}

interface Partner {
  id: string;
  name: string;
}

interface StockOperationModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess: () => void;
}

interface ServerError {
  title?: string;
  status?: number;
  message?: string;
}

export default function StockOperationModal({
  open,
  onClose,
  product,
  onSuccess
}: StockOperationModalProps) {
  const { t } = useLanguage();
  const [movementType, setMovementType] = useState<number>(1); // 1 = Прихід, 2 = Розхід
  const [quantity, setQuantity] = useState<string>('');
  const [partnerId, setPartnerId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;

    const fetchPartners = async () => {
      try {
        const endpoint = movementType === 1 ? '/suppliers' : '/customers';
        const res = await api.get<Partner[]>(endpoint);
        setPartners(res.data);
      } catch (err: unknown) {
        console.error(err);
      }
    };

    fetchPartners();
  }, [open, movementType]);

  const handleSubmit = async () => {
    if (!product) return;

    const parsedQty = parseInt(quantity, 10);
    if (!parsedQty || parsedQty <= 0) {
      setError(t('operations.quantity'));
      return;
    }

    if (movementType === 2 && parsedQty > product.quantity) {
      setError(`${t('operations.insufficientStock')} (${product.quantity} ${product.unit})`);
      return;
    }

    const payload = {
      productId: product.id,
      quantity: parsedQty,
      type: movementType,
      movementType,
      supplierId: movementType === 1 ? partnerId || null : null,
      customerId: movementType === 2 ? partnerId || null : null,
      reason: reason.trim() || undefined
    };

    setLoading(true);
    setError('');

    try {
      await api.post('/StockMovements', payload);
      onSuccess();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError | string>(err)) {
        const data = err.response?.data;
        const msg = typeof data === 'string' 
          ? data 
          : (data?.message || data?.title || t('common.error'));
        setError(msg);
      } else {
        setError(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!product) return;
    const parsedQty = parseInt(quantity, 10) || 1;
    const selectedPartner = partners.find((p) => p.id === partnerId);
    const data: WaybillData = {
      documentNumber: `ВН-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date(),
      customer: selectedPartner ? { name: selectedPartner.name } : null,
      reason: reason.trim() || t('operations.writeOff'),
      storekeeperName: localStorage.getItem('username') || 'Storekeeper',
      items: [
        {
          sku: product.sku || '',
          name: product.name,
          unit: product.unit || t('common.pcs'),
          quantity: parsedQty,
          price: product.price || 0
        }
      ]
    };
    try {
      await downloadWaybillPdf(data);
    } catch (err) {
      console.error(err);
      setError(t('copilot.pdfError'));
    }
  };

  const handleClose = () => {
    setError('');
    setQuantity('');
    setPartnerId('');
    setReason('');
    setMovementType(1);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('operations.operationTitle')}</DialogTitle>
      <DialogContent dividers>
        {product && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {product.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('operations.currentStockLabel')} <strong>{product.quantity} {product.unit}</strong>
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <FormControl component="fieldset" sx={{ mb: 2 }}>
          <FormLabel component="legend">{t('operations.operationType')}</FormLabel>
          <RadioGroup
            row
            value={movementType}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setMovementType(parseInt(e.target.value, 10));
              setPartnerId('');
            }}
          >
            <FormControlLabel value={1} control={<Radio color="success" />} label={t('operations.receipt')} />
            <FormControlLabel value={2} control={<Radio color="warning" />} label={t('operations.writeOff')} />
          </RadioGroup>
        </FormControl>

        <TextField
          label={t('operations.quantity')}
          type="number"
          fullWidth
          margin="dense"
          value={quantity}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
        />

        <FormControl fullWidth margin="dense">
          <InputLabel>{movementType === 1 ? t('operations.supplier') : t('operations.receiver')}</InputLabel>
          <Select
            value={partnerId}
            label={movementType === 1 ? t('operations.supplier') : t('operations.receiver')}
            onChange={(e: SelectChangeEvent<string>) => setPartnerId(e.target.value)}
          >
            <MenuItem value=""><em>—</em></MenuItem>
            {partners.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label={t('operations.reason')}
          fullWidth
          multiline
          rows={2}
          margin="dense"
          value={reason}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={handleClose} disabled={loading}>{t('common.cancel')}</Button>
        {movementType === 2 && (
          <Button
            onClick={handleDownloadPdf}
            disabled={loading}
            startIcon={<PictureAsPdfIcon />}
            variant="outlined"
            color="secondary"
          >
            {t('operations.generateWaybill')}
          </Button>
        )}
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? t('common.loading') : t('operations.execute')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}