import { useState } from 'react'; // ❌ Прибрали useEffect
import axios, { AxiosError } from 'axios'; // 👈 1. Додали тип помилки
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, ToggleButton, ToggleButtonGroup, 
  Typography, Box, Alert 
} from '@mui/material';

interface Product {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface StockOperationModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess: () => void;
}

export default function StockOperationModal({ open, onClose, product, onSuccess }: StockOperationModalProps) {
  // Початкові значення (State)
  const [type, setType] = useState<number>(1);
  const [quantity, setQuantity] = useState<string>('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // ❌ 2. МИ ВИДАЛИЛИ useEffect ЗВІДСИ.
  // Замість нього ми змусимо компонент "перезавантажитись" через ProductList (див. нижче)

  const handleSubmit = async () => {
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      setError("Кількість має бути більше 0");
      return;
    }

    if (type === 2 && product && qty > product.quantity) {
      setError(`Не можна списати більше, ніж є на складі (${product.quantity} ${product.unit})`);
      return;
    }

    try {
      await axios.post('/api/stockmovements', {
        productId: product?.id,
        type: type,
        quantity: qty,
        note: note
      });
      onSuccess();
      onClose();
    } catch (err: unknown) { // 👈 3. Виправили any на unknown
      console.error(err);
      // Безпечне перетворення типу помилки
      const axiosError = err as AxiosError;
      setError(axiosError.response?.data as string || "Помилка при збереженні");
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Операція: {product.name}</DialogTitle>
      {/* ... решта коду без змін (DialogContent, DialogActions) ... */}
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <ToggleButtonGroup
            value={type}
            exclusive
            onChange={(_, newVal) => newVal && setType(newVal)}
            fullWidth
          >
            <ToggleButton value={1} color="success" sx={{ fontWeight: 'bold' }}>
              📥 Прихід
            </ToggleButton>
            <ToggleButton value={2} color="error" sx={{ fontWeight: 'bold' }}>
              📤 Розхід (Списання)
            </ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="body2" color="text.secondary" align="center">
            Поточний залишок: <b>{product.quantity} {product.unit}</b>
          </Typography>

          <TextField
            label="Кількість"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            fullWidth
            autoFocus
          />

          <TextField
            label="Примітка (необов'язково)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Напр: Нова поставка або Брак"
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Скасувати</Button>
        <Button variant="contained" onClick={handleSubmit} color={type === 1 ? "success" : "error"}>
          Зберегти
        </Button>
      </DialogActions>
    </Dialog>
  );
}