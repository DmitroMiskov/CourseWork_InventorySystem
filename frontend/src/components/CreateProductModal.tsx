import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Box, Alert, MenuItem 
} from '@mui/material';

// 👇 1. ПРАВИЛЬНИЙ ТИПІЗОВАНИЙ ІНТЕРФЕЙС
// Ми описуємо все, що може прийти, щоб не використовувати "any"
interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  
  // Основні поля (з GET запиту)
  minStock: number;
  quantity: number;
  unit: string;
  
  // Додаткові/альтернативні поля (позначаємо як необов'язкові "?")
  // Це дозволяє безпечно перевіряти їх існування без помилок
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
    // Варіант 1: Створення нового (пуста форма)
    if (!productToEdit) {
      return {
        sku: '', name: '', description: '', price: '', 
        minStockLevel: '', quantity: '', unitOfMeasurement: 'шт', categoryId: ''
      };
    }

    // Варіант 2: Редагування (заповнення)
    // 👇 ТЕПЕР МИ НЕ ВИКОРИСТОВУЄМО "any". 
    // TypeScript бачить ці поля в інтерфейсі вище.
    
    // Логіка для minStock: шукаємо minStock, якщо немає — minStockLevel, якщо немає — пустий рядок
    let initialMinStock = '';
    if (productToEdit.minStock !== undefined) initialMinStock = String(productToEdit.minStock);
    else if (productToEdit.minStockLevel !== undefined) initialMinStock = String(productToEdit.minStockLevel);

    // Логіка для unit
    let initialUnit = 'шт';
    if (productToEdit.unit) initialUnit = productToEdit.unit;
    else if (productToEdit.unitOfMeasurement) initialUnit = productToEdit.unitOfMeasurement;

    // Логіка для quantity
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

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{productToEdit ? 'Редагувати товар' : 'Новий товар'}</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          
          <TextField label="Артикул" name="sku" value={formData.sku} onChange={handleChange} fullWidth required />
          <TextField label="Назва" name="name" value={formData.name} onChange={handleChange} fullWidth required />
          
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