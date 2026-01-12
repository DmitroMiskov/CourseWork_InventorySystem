import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Box, Alert, MenuItem 
} from '@mui/material';

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onProductCreated: () => void;
}

// Інтерфейс для категорії
interface Category {
  id: string;
  name: string;
}

export default function CreateProductModal({ open, onClose, onProductCreated }: CreateProductModalProps) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    price: '',
    minStockLevel: '',
    unitOfMeasurement: 'шт',
    categoryId: '' // Тут буде ID вибраної категорії
  });

  const [categories, setCategories] = useState<Category[]>([]); // Список категорій
  const [error, setError] = useState<string | null>(null);

  // Завантажуємо категорії при відкритті вікна
  useEffect(() => {
    if (open) {
      axios.get('/api/categories')
        .then(response => {
          setCategories(response.data);
        })
        .catch(err => console.error("Не вдалося завантажити категорії", err));
    }
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        minStockLevel: parseInt(formData.minStockLevel),
      };

      // Перевірка, чи вибрана категорія
      if (!payload.categoryId) {
        setError("Будь ласка, виберіть категорію.");
        return;
      }

      await axios.post('/api/products', payload);
      
      onProductCreated();
      handleClose();
    } catch (err) {
      console.error(err);
      setError('Не вдалося створити товар. Перевірте дані.');
    }
  };

  const handleClose = () => {
    onClose();
    // Очищаємо форму, але залишаємо unitOfMeasurement за замовчуванням
    setFormData({ 
      sku: '', name: '', description: '', price: '', 
      minStockLevel: '', unitOfMeasurement: 'шт', categoryId: '' 
    });
    setError(null);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Новий товар</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          
          <TextField label="Артикул (SKU)" name="sku" value={formData.sku} onChange={handleChange} fullWidth required />
          <TextField label="Назва" name="name" value={formData.name} onChange={handleChange} fullWidth required />
          
          {/* 👇 ВИПАДАЮЧИЙ СПИСОК КАТЕГОРІЙ */}
          <TextField
            select
            label="Категорія"
            name="categoryId"
            value={formData.categoryId}
            onChange={handleChange}
            fullWidth
            required
          >
            {categories.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
            {categories.length === 0 && (
              <MenuItem disabled value="">
                <em>Немає категорій (створіть їх у Swagger)</em>
              </MenuItem>
            )}
          </TextField>

          <TextField label="Опис" name="description" value={formData.description} onChange={handleChange} fullWidth multiline rows={2} />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Ціна" name="price" type="number" value={formData.price} onChange={handleChange} fullWidth required />
            <TextField label="Мін. залишок" name="minStockLevel" type="number" value={formData.minStockLevel} onChange={handleChange} fullWidth required />
          </Box>

          <TextField label="Одиниці виміру" name="unitOfMeasurement" value={formData.unitOfMeasurement} onChange={handleChange} fullWidth />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">Скасувати</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">Створити</Button>
      </DialogActions>
    </Dialog>
  );
}