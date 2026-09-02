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

interface Product {
  id: string;
  name: string;
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
      setError('Вкажіть коректну кількість товару');
      return;
    }

    if (movementType === 2 && parsedQty > product.quantity) {
      setError(`Недостатньо залишку на складі. Доступно: ${product.quantity} ${product.unit}`);
      return;
    }

    const payload = {
      productId: product.id,
      quantity: parsedQty,
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
      if (axios.isAxiosError<ServerError>(err)) {
        const msg = err.response?.data?.message || err.response?.data?.title || 'Помилка виконання операції';
        setError(`Сервер: ${msg}`);
      } else {
        setError('Помилка надсилання даних');
      }
    } finally {
      setLoading(false);
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
      <DialogTitle>Складська операція</DialogTitle>
      <DialogContent dividers>
        {product && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {product.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Поточний залишок: <strong>{product.quantity} {product.unit}</strong>
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <FormControl component="fieldset" sx={{ mb: 2 }}>
          <FormLabel component="legend">Тип операції</FormLabel>
          <RadioGroup
            row
            value={movementType}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setMovementType(parseInt(e.target.value, 10));
              setPartnerId('');
            }}
          >
            <FormControlLabel value={1} control={<Radio color="success" />} label="Прихід (+)" />
            <FormControlLabel value={2} control={<Radio color="warning" />} label="Розхід (-)" />
          </RadioGroup>
        </FormControl>

        <TextField
          label="Кількість"
          type="number"
          fullWidth
          margin="dense"
          value={quantity}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
        />

        <FormControl fullWidth margin="dense">
          <InputLabel>{movementType === 1 ? 'Постачальник' : 'Отримувач / Клієнт'}</InputLabel>
          <Select
            value={partnerId}
            label={movementType === 1 ? 'Постачальник' : 'Отримувач / Клієнт'}
            onChange={(e: SelectChangeEvent<string>) => setPartnerId(e.target.value)}
          >
            <MenuItem value=""><em>Не вказано</em></MenuItem>
            {partners.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Причина / Примітка"
          fullWidth
          multiline
          rows={2}
          margin="dense"
          value={reason}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Скасувати</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Збереження...' : 'Провести'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}