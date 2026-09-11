import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Box, Alert, MenuItem 
} from '@mui/material';
import api from '../api/axiosConfig';
import type { Product, Category } from '../types/inventory';

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onProductSaved: () => void;
  productToEdit?: Product | null;
}

export default function CreateProductModal({ open, onClose, onProductSaved, productToEdit }: CreateProductModalProps) {
  const getInitialState = () => {
    if (!productToEdit) {
      return {
        sku: '', name: '', description: '', price: '', 
        minStock: '', quantity: '', unit: 'шт', categoryId: ''
      };
    }

    return {
      sku: productToEdit.sku || '',
      name: productToEdit.name,
      description: productToEdit.description || '',
      price: String(productToEdit.price),
      minStock: String(productToEdit.minStock ?? 0),
      quantity: String(productToEdit.quantity ?? 0),
      unit: productToEdit.unit || 'шт',
      categoryId: productToEdit.category?.id || productToEdit.categoryId || ''
    };
  };

  const [formData, setFormData] = useState(getInitialState);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [prevProductToEdit, setPrevProductToEdit] = useState<Product | null | undefined>(productToEdit);
  if (productToEdit !== prevProductToEdit) {
    setPrevProductToEdit(productToEdit);
    setFormData(getInitialState());
    setError(null);
  }

  useEffect(() => {
    if (!open) return;
    const loadCategories = async () => {
      try {
        const res = await api.get<Category[]>('/categories');
        setCategories(res.data);
      } catch (err) {
        console.error("Не вдалося завантажити категорії", err);
      }
    };
    
    loadCategories();
  }, [open]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        sku: formData.sku,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price) || 0,
        minStock: parseInt(formData.minStock, 10) || 0,
        quantity: parseInt(formData.quantity, 10) || 0,
        unit: formData.unit || 'шт',
        categoryId: formData.categoryId
      };

      if (!payload.name.trim()) {
        setError("Введіть назву товару");
        return;
      }

      if (!payload.categoryId) {
        setError("Виберіть категорію");
        return;
      }

      if (productToEdit) {
        await api.put(`/products/${productToEdit.id}`, { ...payload, id: productToEdit.id });
      } else {
        await api.post('/products', payload);
      }
      
      onProductSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Помилка збереження товару.');
    }
  };

  const handleQuickCreateCategory = async () => {
    const newName = window.prompt("Введіть назву нової категорії:");
    if (!newName?.trim()) return;

    try {
      await api.post('/categories', { name: newName.trim() });
      
      const res = await api.get<Category[]>('/categories');
      setCategories(res.data);
      
      const createdCat = res.data.find(c => c.name === newName.trim());
      if (createdCat) {
        setFormData(prev => ({ ...prev, categoryId: createdCat.id }));
      }
    } catch (err) {
      console.error(err);
      alert("Не вдалося створити категорію.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{productToEdit ? 'Редагувати товар' : 'Новий товар'}</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          
          <TextField label="Артикул (SKU)" name="sku" value={formData.sku} onChange={handleChange} fullWidth />
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
              {categories.length === 0 && <MenuItem disabled value="">Немає категорій</MenuItem>}
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
            <TextField label="Кількість" name="quantity" type="number" value={formData.quantity} onChange={handleChange} fullWidth required />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
             <TextField label="Мін. залишок" name="minStock" type="number" value={formData.minStock} onChange={handleChange} fullWidth />
             <TextField label="Од. виміру" name="unit" value={formData.unit} onChange={handleChange} fullWidth />
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