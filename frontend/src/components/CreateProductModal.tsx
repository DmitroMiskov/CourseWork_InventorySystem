import { useState } from 'react';
import axios from 'axios';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Box, Alert 
} from '@mui/material';

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onProductCreated: () => void; // Функція, що оновить таблицю після успіху
}

export default function CreateProductModal({ open, onClose, onProductCreated }: CreateProductModalProps) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    price: '',
    minStockLevel: '',
    unitOfMeasurement: 'шт',
    categoryId: '' // Поки що вводимо ID вручну
  });

  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      // Валідація і перетворення типів
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        minStockLevel: parseInt(formData.minStockLevel),
      };

      await axios.post('/api/products', payload);
      
      // Успіх!
      onProductCreated();
      onClose();
      // Очищення форми
      setFormData({ sku: '', name: '', description: '', price: '', minStockLevel: '', unitOfMeasurement: 'шт', categoryId: '' });
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Не вдалося створити товар. Перевірте дані (особливо ID категорії).');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Новий товар</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          
          <TextField label="Артикул (SKU)" name="sku" value={formData.sku} onChange={handleChange} fullWidth required />
          <TextField label="Назва" name="name" value={formData.name} onChange={handleChange} fullWidth required />
          <TextField label="Опис" name="description" value={formData.description} onChange={handleChange} fullWidth multiline rows={2} />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Ціна" name="price" type="number" value={formData.price} onChange={handleChange} fullWidth required />
            <TextField label="Мін. залишок" name="minStockLevel" type="number" value={formData.minStockLevel} onChange={handleChange} fullWidth required />
          </Box>

          <TextField label="Одиниці виміру" name="unitOfMeasurement" value={formData.unitOfMeasurement} onChange={handleChange} fullWidth />
          
          {/* Тимчасове поле для ID категорії */}
          <TextField 
            label="ID Категорії (Скопіюйте з Swagger або попереднього запиту)" 
            name="categoryId" 
            value={formData.categoryId} 
            onChange={handleChange} 
            fullWidth 
            helperText="Наприклад: 3fa85f64-5717-4562-b3fc-2c963f66afa6"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Скасувати</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">Створити</Button>
      </DialogActions>
    </Dialog>
  );
}