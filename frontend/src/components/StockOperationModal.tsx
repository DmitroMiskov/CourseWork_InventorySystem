import { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, 
  TextField, MenuItem, Select, FormControl, InputLabel, Box, //Typography 
} from '@mui/material';
import axios, { AxiosError } from 'axios';

// --- ТИПИ ---
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

// 👇 НОВЕ: Інтерфейс для помилки бекенду (стандартний для ASP.NET Core)
interface ServerErrorResponse {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
  message?: string;
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

      const config = { headers: { 'Authorization': `Bearer ${token}` } };

      axios.get<Supplier[]>(`${AZURE_API_URL}/api/suppliers`, config)
        .then(res => setSuppliers(res.data))
        .catch(err => console.error(err));

      axios.get<Customer[]>(`${AZURE_API_URL}/api/customers`, config)
        .then(res => setCustomers(res.data))
        .catch(err => console.error(err));
    }
  }, [open]);

  const handleClose = () => {
    setQuantity('');
    setReason('');
    setSelectedSupplier('');
    setSelectedCustomer('');
    setType('Incoming');
    onClose();   
  };

  const handleSubmit = async () => {
    if (!product || !quantity) return;

    const qtyNumber = Number(quantity);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
        alert("Кількість має бути числом більше 0");
        return;
    }

    const payload = {
      productId: product.id,
      type: type, 
      quantity: qtyNumber,
      reason: reason || "Ручна операція",
      supplierId: (type === 'Incoming' && selectedSupplier) ? selectedSupplier : null,
      customerId: (type === 'Outgoing' && selectedCustomer) ? selectedCustomer : null
    };

    console.log("Відправляю payload:", payload);

    try {
      const token = localStorage.getItem('token');
      
      await axios.post(`${AZURE_API_URL}/api/stockmovements`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      alert("Операцію успішно виконано!");
      handleClose(); 
      onSuccess(); 
    } catch (error) {
      console.error("Помилка операції:", error);
      
      // 👇 ВИПРАВЛЕННЯ: Використовуємо типізовану помилку замість any
      const axiosError = error as AxiosError<ServerErrorResponse>;
      const data = axiosError.response?.data;
      
      let errorMessage = "Сталася помилка (400)";
      
      if (data) {
          // Якщо є список помилок валідації (наприклад, "Quantity must be > 0")
          if (data.errors) {
              const validationErrors = Object.values(data.errors).flat().join('\n');
              errorMessage = `Помилки валідації:\n${validationErrors}`;
          } 
          // Якщо є просто заголовок помилки
          else if (data.title) {
              errorMessage = data.title;
          } 
          // Якщо сервер повернув просто текст (рідко, але буває)
          else if (typeof data === 'string') {
              errorMessage = data;
          }
      }
      
      alert(errorMessage);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {product.name} (Залишок: {product.quantity})
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
              <MenuItem value="Incoming">➕ Прихід</MenuItem>
              <MenuItem value="Outgoing">➖ Розхід</MenuItem>
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
          Виконати
        </Button>
      </DialogActions>
    </Dialog>
  );
}