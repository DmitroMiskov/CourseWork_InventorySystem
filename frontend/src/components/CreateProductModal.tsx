import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Box, Alert, MenuItem 
} from '@mui/material';

// Тип даних, який приходить з бекенду (згідно з вашим JSON)
interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  minStock: number; // В JSON це minStock
  unit: string;     // В JSON це unit
  quantity: number;
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
  
  // 1. Логіка визначення початкових значень
  const getInitialState = () => {
    if (!productToEdit) {
      return {
        sku: '', name: '', description: '', price: '', 
        minStockLevel: '', unitOfMeasurement: 'шт', 
        quantity: productToEdit?.quantity !== undefined ? String(productToEdit.quantity) : '', 
        categoryId: ''
      };
    }

    // Трюк для коректної обробки 0. 
    // Якщо minStock === 0, то String(0) дасть "0", який відобразиться у полі.
    const safeMinStock = productToEdit.minStock !== undefined && productToEdit.minStock !== null 
      ? String(productToEdit.minStock) 
      : '';

    return {
      sku: productToEdit.sku,
      name: productToEdit.name,
      description: productToEdit.description || '',
      price: String(productToEdit.price),
      
      // Мапінг: беремо з minStock, кладемо в minStockLevel
      minStockLevel: safeMinStock,
      
      // Мапінг: беремо з unit, кладемо в unitOfMeasurement
      unitOfMeasurement: productToEdit.unit || 'шт',
      
      categoryId: productToEdit.category?.id || productToEdit.categoryId || ''
    };
  };

  const [formData, setFormData] = useState(getInitialState);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Завантаження категорій
  useEffect(() => {
    axios.get('/api/categories')
      .then(res => setCategories(res.data))
      .catch(err => console.error(err));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        minStockLevel: parseInt(formData.minStockLevel),
        quantity: parseInt(formData.quantity || '0'),
      };

      if (!payload.categoryId) {
        setError("Виберіть категорію");
        return;
      }

      if (productToEdit) {
        // PUT: відправляємо оновлені дані
        await axios.put(`/api/products/${productToEdit.id}`, { ...payload, id: productToEdit.id });
      } else {
        // POST: створюємо новий
        await axios.post('/api/products', payload);
      }
      
      onProductSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Помилка збереження. Перевірте консоль.');
    }
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{productToEdit ? 'Редагувати товар' : 'Новий товар'}</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          
          <TextField label="Артикул" name="sku" value={formData.sku} onChange={handleChange} fullWidth required />
          <TextField label="Назва" name="name" value={formData.name} onChange={handleChange} fullWidth required />
          
          <TextField select label="Категорія" name="categoryId" value={categories.some(c => c.id === formData.categoryId) ? formData.categoryId : ''} onChange={handleChange} fullWidth  required>
            {categories.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
            ))}
            {categories.length === 0 && <MenuItem disabled value="">Завантаження...</MenuItem>}
          </TextField>

          <TextField label="Опис" name="description" value={formData.description} onChange={handleChange} fullWidth multiline rows={2} />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Ціна" name="price" type="number" value={formData.price} onChange={handleChange} fullWidth required />
            <TextField label="Кількість на складі" name="quantity" type="number" value={formData.quantity} onChange={handleChange} fullWidth required />
            <TextField label="Мін. залишок" name="minStockLevel" type="number" value={formData.minStockLevel} onChange={handleChange} fullWidth required/>
          </Box>
          
          <TextField 
              label="Одиниці виміру" 
              name="unitOfMeasurement" 
              value={formData.unitOfMeasurement} 
              onChange={handleChange} 
              fullWidth 
           />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Скасувати</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">Зберегти</Button>
      </DialogActions>
    </Dialog>
  );
}