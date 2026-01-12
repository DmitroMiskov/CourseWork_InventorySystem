// 👇 1. Додаємо useCallback в імпорт
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Box, Alert, MenuItem 
} from '@mui/material';

// --- ТИПИ ---
interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  minStock: number;
  quantity: number;
  unit: string;
  minStockLevel?: number;
  unitOfMeasurement?: string;
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
  
  const getInitialState = () => {
    if (!productToEdit) {
      return {
        sku: '', name: '', description: '', price: '', 
        minStockLevel: '', quantity: '', unitOfMeasurement: 'шт', categoryId: ''
      };
    }

    let initialMinStock = '';
    if (productToEdit.minStock !== undefined) initialMinStock = String(productToEdit.minStock);
    else if (productToEdit.minStockLevel !== undefined) initialMinStock = String(productToEdit.minStockLevel);

    let initialUnit = 'шт';
    if (productToEdit.unit) initialUnit = productToEdit.unit;
    else if (productToEdit.unitOfMeasurement) initialUnit = productToEdit.unitOfMeasurement;

    let initialQuantity = '0';
    if (productToEdit.quantity !== undefined) initialQuantity = String(productToEdit.quantity);

    return {
      sku: productToEdit.sku,
      name: productToEdit.name,
      description: productToEdit.description || '',
      price: String(productToEdit.price),
      
      minStockLevel: initialMinStock,
      quantity: initialQuantity,
      unitOfMeasurement: initialUnit,
      
      categoryId: productToEdit.category?.id || productToEdit.categoryId || ''
    };
  };

  const [formData, setFormData] = useState(getInitialState);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 👇 2. ВИПРАВЛЕННЯ: Використовуємо useCallback, щоб "заморозити" функцію
  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get('/api/categories');
      setCategories(res.data);
    } catch (err) {
      console.error("Не вдалося завантажити категорії", err);
    }
  }, []); // Пустий масив залежностей означає, що функція створюється лише раз

  // 👇 3. Тепер додаємо функцію в залежності ефекту (це безпечно)
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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
        await axios.put(`/api/products/${productToEdit.id}`, { ...payload, id: productToEdit.id });
      } else {
        await axios.post('/api/products', payload);
      }
      
      onProductSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Помилка збереження. Перевірте консоль.');
    }
  };

  const handleQuickCreateCategory = async () => {
    const newName = window.prompt("Введіть назву нової категорії:");
    if (!newName) return;

    try {
      await axios.post('/api/categories', { name: newName });
      
      // Оновлюємо список (викликаємо нашу "заморожену" функцію)
      await fetchCategories();
      
      // Отримуємо актуальний список ще раз, щоб знайти нову категорію
      // (або можна просто взяти з state, але після fetchCategories треба почекати)
      const res = await axios.get('/api/categories');
      
      const createdCat = res.data.find((c: Category) => c.name === newName);
      if (createdCat) {
        setFormData(prev => ({ ...prev, categoryId: createdCat.id }));
      }
    } catch (err) {
      console.error(err);
      alert("Не вдалося створити категорію.");
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
          
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField 
              select 
              label="Категорія" 
              name="categoryId" 
              value={categories.some(c => c.id === formData.categoryId) ? formData.categoryId : ''}
              onChange={handleChange} 
              fullWidth 
              required
            >
              {categories.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
              ))}
              {categories.length === 0 && <MenuItem disabled value="">Завантаження...</MenuItem>}
            </TextField>
            
            <Button 
              variant="outlined" 
              sx={{ height: 56, minWidth: 56, fontSize: '1.5rem', p: 0 }}
              onClick={handleQuickCreateCategory}
              title="Додати нову категорію"
            >
              +
            </Button>
          </Box>

          <TextField label="Опис" name="description" value={formData.description} onChange={handleChange} fullWidth multiline rows={2} />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Ціна" name="price" type="number" value={formData.price} onChange={handleChange} fullWidth required />
            
            <TextField 
                label="Кількість на складі" 
                name="quantity" 
                type="number" 
                value={formData.quantity} 
                onChange={handleChange} 
                fullWidth required 
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
             <TextField label="Мін. ліміт" name="minStockLevel" type="number" value={formData.minStockLevel} onChange={handleChange} fullWidth required />
             <TextField label="Од. виміру" name="unitOfMeasurement" value={formData.unitOfMeasurement} onChange={handleChange} fullWidth />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Скасувати</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">Зберегти</Button>
      </DialogActions>
    </Dialog>
  );
}