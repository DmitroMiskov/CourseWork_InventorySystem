import { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, 
  TextField, MenuItem, Select, FormControl, InputLabel, Box, Typography 
} from '@mui/material';
import axios from 'axios';

// Типи
interface Product {
  id: string;
  name: string;
  quantity: number;
}

interface Supplier {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
}

interface StockOperationModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess: () => void;
}

export default function StockOperationModal({ open, onClose, product, onSuccess }: StockOperationModalProps) {
  const [type, setType] = useState<'Incoming' | 'Outgoing'>('Incoming');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');

  const AZURE_API_URL = "https://inventory-api-miskov-dtcyece6dme4hme8.polandcentral-01.azurewebsites.net";

  useEffect(() => {
    if (open) {
      const token = localStorage.getItem('token');
      
      if (!token) return;

      const config = {
        headers: { 'Authorization': `Bearer ${token}` }
      };

      axios.get<Supplier[]>(`${AZURE_API_URL}/api/suppliers`, config)
        .then(res => setSuppliers(res.data))
        .catch(err => console.error("Помилка завантаження постачальників:", err));

      axios.get<Customer[]>(`${AZURE_API_URL}/api/customers`, config)
        .then(res => setCustomers(res.data))
        .catch(err => console.error("Помилка завантаження клієнтів:", err));
    }
  }, [open]);

  const resetForm = () => {
    setQuantity('');
    setReason('');
    setSelectedSupplier('');
    setSelectedCustomer('');
    setType('Incoming');
  };

  const handleClose = () => {
    resetForm(); 
    onClose();   
  };

  const handleSubmit = async () => {
    if (!product || !quantity) return;

    const payload = {
      productId: product.id,
      type,
      quantity: parseInt(quantity),
      reason,
      supplierId: type === 'Incoming' && selectedSupplier ? selectedSupplier : null,
      customerId: type === 'Outgoing' && selectedCustomer ? selectedCustomer : null
    };

    try {
      const token = localStorage.getItem('token');
      
      await axios.post(`${AZURE_API_URL}/api/stockmovements`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      resetForm(); 
      onSuccess(); 
    } catch (error) {
      alert('Помилка виконання операції. Перевірте консоль.');
      console.error(error);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>
        Операція: {product.name} 
        <Typography variant="caption" display="block" color="text.secondary">
          Поточний залишок: {product.quantity}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          
          <FormControl fullWidth>
            <InputLabel>Тип операції</InputLabel>
            <Select
              value={type}
              label="Тип операції"
              onChange={(e) => setType(e.target.value as 'Incoming' | 'Outgoing')}
            >
              <MenuItem value="Incoming">➕ Прихід (Закупівля)</MenuItem>
              <MenuItem value="Outgoing">➖ Розхід (Продаж)</MenuItem>
            </Select>
          </FormControl>

          {type === 'Incoming' ? (
             <FormControl fullWidth>
               <InputLabel>Постачальник</InputLabel>
               <Select
                 value={selectedSupplier}
                 label="Постачальник"
                 onChange={(e) => setSelectedSupplier(e.target.value)}
               >
                 <MenuItem value=""><em>Не вказано</em></MenuItem>
                 {suppliers.map(s => (
                   <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                 ))}
               </Select>
             </FormControl>
          ) : (
             <FormControl fullWidth>
               <InputLabel>Клієнт</InputLabel>
               <Select
                 value={selectedCustomer}
                 label="Клієнт"
                 onChange={(e) => setSelectedCustomer(e.target.value)}
               >
                 <MenuItem value=""><em>Не вказано</em></MenuItem>
                 {customers.map(c => (
                   <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                 ))}
               </Select>
             </FormControl>
          )}

          <TextField
            label="Кількість"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            fullWidth
          />

          <TextField
            label="Коментар"
            multiline
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Скасувати</Button>
        <Button onClick={handleSubmit} variant="contained" color={type === 'Incoming' ? 'success' : 'error'}>
          {type === 'Incoming' ? 'Зарахувати' : 'Списати'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}