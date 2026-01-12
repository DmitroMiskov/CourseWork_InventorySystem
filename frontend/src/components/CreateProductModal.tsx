import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Box, Alert, MenuItem 
} from '@mui/material';

// Типи (дублюємо для надійності)
interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  minStock: number;
  unit: string;
  category?: {
    id: string;
    name: string;
  };
  categoryId?: string;
}

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onProductSaved: () => void;
  productToEdit?: Product | null;
}

interface Category {
  id: string;
  name: string;
}

export default function CreateProductModal({ onClose, onProductSaved, productToEdit }: CreateProductModalProps) {
  // 👇 ГОЛОВНА ЗМІНА: Ми ініціалізуємо state відразу з props!
  // Якщо є productToEdit — беремо дані з нього. Якщо ні — пусті рядки.
  const [formData, setFormData] = useState({
    sku: productToEdit?.sku || '',
    name: productToEdit?.name || '',
    description: productToEdit?.description || '',
    price: productToEdit?.price?.toString() || '',
    minStockLevel: productToEdit?.minStock?.toString() || '',
    unitOfMeasurement: productToEdit?.unit || 'шт',
    categoryId: productToEdit?.category?.id || productToEdit?.categoryId || ''
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Цей useEffect залишаємо, він безпечний (вантажить категорії)
  useEffect(() => {
    axios.get('/api/categories')
      .then(res => setCategories(res.data))
      .catch(err => console.error(err));
  }, []);

  // ❌ МИ ВИДАЛИЛИ ПРОБЛЕМНИЙ useEffect, який оновлював форму! ❌

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

      if (!payload.categoryId) {
        setError("Виберіть категорію");
        return;
      }

      if (productToEdit) {
        await axios.put(`/api/products/${productToEdit.id}`, { ...payload, id: productToEdit.id });
      } else {
        await axios.post('/api/products', payload);
      }
      
      onProductSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Помилка збереження. Перевірте дані.');
    }
  };

  return (
    // Додаємо open={true}, бо ми будемо керувати відкриттям ззовні
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{productToEdit ? 'Редагувати товар' : 'Новий товар'}</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          
          <TextField label="Артикул" name="sku" value={formData.sku} onChange={handleChange} fullWidth required />
          <TextField label="Назва" name="name" value={formData.name} onChange={handleChange} fullWidth required />
          
          <TextField select label="Категорія" name="categoryId" value={formData.categoryId} onChange={handleChange} fullWidth required>
            {categories.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
            ))}
            {categories.length === 0 && <MenuItem disabled value="">Немає категорій</MenuItem>}
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
        <Button onClick={onClose} color="inherit">Скасувати</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">Зберегти</Button>
      </DialogActions>
    </Dialog>
  );
}