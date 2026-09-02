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
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

interface Product {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface Customer {
  id: string;
  name: string;
}

interface IssuanceModalProps {
  open: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  onSuccess: () => void;
}

interface IssueItem {
  productId: string;
  name: string;
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
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;

    setItems(
      selectedProducts.map((p) => ({
        productId: p.id,
        name: p.name,
        availableQuantity: p.quantity,
        unit: p.unit,
        issueQuantity: 1
      }))
    );

    const fetchCustomers = async () => {
      try {
        const res = await api.get<Customer[]>('/customers');
        setCustomers(res.data);
      } catch (err: unknown) {
        console.error(err);
      }
    };

    fetchCustomers();
  }, [open, selectedProducts]);

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

    try {
      await Promise.all(
        items.map((item) =>
          api.post('/StockMovements', {
            productId: item.productId,
            quantity: item.issueQuantity,
            movementType: 2, // 2 = Розхід / Видача
            customerId: customerId || null,
            reason: reason.trim() || 'Масова видача зі складу'
          })
        )
      );

      onSuccess();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError>(err)) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.title ||
          'Помилка оформлення видачі';
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
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Оформлення видачі товарів</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
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
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Причина / Примітка"
          fullWidth
          margin="dense"
          sx={{ mb: 2 }}
          value={reason}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
        />

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
          Список обраних позицій:
        </Typography>

        <TableContainer component={Paper} elevation={1} sx={{ maxHeight: 260 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell>Товар</TableCell>
                <TableCell align="center">Залишок</TableCell>
                <TableCell align="center" width={110}>
                  Видати
                </TableCell>
                <TableCell align="right" width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell>
                    <Typography variant="body2">{item.name}</Typography>
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
                      inputProps={{ min: 1, max: item.availableQuantity }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveItem(item.productId)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Скасувати
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || items.length === 0}
        >
          {loading ? 'Оформлення...' : 'Підтвердити видачу'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}