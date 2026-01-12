import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
  Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Typography, Box, CircularProgress, 
  Button, IconButton, TextField, MenuItem, FormControlLabel, Switch, InputAdornment 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CreateProductModal from './CreateProductModal';

// Інтерфейс товару
interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  minStock: number;
  quantity: number;
  unit: string;
  category?: {
    id: string;
    name: string;
  };
  categoryId?: string;
}

// Інтерфейс категорії для фільтру
interface Category {
  id: string;
  name: string;
}

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]); // Для фільтру
  const [loading, setLoading] = useState(true);
  
  // Стан для модального вікна
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // 👇 СТАНИ ДЛЯ ФІЛЬТРІВ
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Завантаження товарів
  const fetchProducts = useCallback(() => {
    axios.get('/api/products')
      .then(response => {
        setProducts(response.data);
      })
      .catch(error => console.error("Помилка завантаження товарів:", error))
      .finally(() => setLoading(false));
  }, []);

  // Завантаження категорій (для випадаючого списку фільтру)
  useEffect(() => {
    axios.get('/api/categories')
      .then(res => setCategories(res.data))
      .catch(err => console.error("Помилка завантаження категорій:", err));
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleRefresh = () => {
    setLoading(true);
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей товар?')) {
      return;
    }
    try {
      await axios.delete(`/api/products/${id}`);
      handleRefresh();
    } catch (error) {
      console.error("Не вдалося видалити:", error);
      alert("Помилка при видаленні");
    }
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  // 👇 МАГІЯ ФІЛЬТРАЦІЇ
  // useMemo дозволяє перераховувати список тільки коли змінюються фільтри або товари
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // 1. Пошук по назві або SKU (регістронезалежний)
      const matchesSearch = 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        product.sku.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Фільтр по категорії
      const matchesCategory = filterCategory ? product.category?.id === filterCategory || product.categoryId === filterCategory : true;

      // 3. Фільтр "Закінчується"
      const matchesStock = showLowStockOnly ? product.quantity <= product.minStock : true;

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchTerm, filterCategory, showLowStockOnly]);

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      {/* Заголовок */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Складські запаси</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} sx={{ height: 40 }}>
          Додати товар
        </Button>
      </Box>
      
      {/* 👇 ПАНЕЛЬ ФІЛЬТРІВ */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* Пошук */}
        <TextField 
          label="Пошук (Назва або SKU)" 
          variant="outlined" 
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1, minWidth: '200px' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />

        {/* Категорія */}
        <TextField 
          select 
          label="Категорія" 
          size="small"
          value={filterCategory} 
          onChange={(e) => setFilterCategory(e.target.value)}
          sx={{ minWidth: '200px' }}
        >
          <MenuItem value=""><em>Всі категорії</em></MenuItem>
          {categories.map((cat) => (
            <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
          ))}
        </TextField>

        {/* Тільки проблемні */}
        <FormControlLabel 
          control={
            <Switch 
              checked={showLowStockOnly} 
              onChange={(e) => setShowLowStockOnly(e.target.checked)} 
              color="error" 
            />
          } 
          label="Тільки проблемні (мало на складі)" 
        />
      </Paper>

      {/* Таблиця */}
      {loading ? (
         <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ width: '100%', mb: 4 }}>
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead sx={{ backgroundColor: '#1976d2' }}>
              <TableRow>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Артикул</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Назва</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Категорія</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Ціна</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>К-сть</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Статус</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Дії</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* 👇 ТУТ ТЕПЕР filteredProducts ЗАМІСТЬ products */}
              {filteredProducts.map((product) => {
                const isLowStock = product.quantity <= product.minStock;
                return (
                  <TableRow key={product.id} hover>
                    <TableCell>{product.sku || '-'}</TableCell>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>{product.name}</TableCell>
                    <TableCell>{product.category?.name || 'Без категорії'}</TableCell>
                    <TableCell align="right">{product.price} грн</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{product.quantity} {product.unit}</TableCell>
                    
                    <TableCell align="center">
                      <Box sx={{ 
                        color: isLowStock ? '#d32f2f' : '#2e7d32',
                        bgcolor: isLowStock ? '#ffcdd2' : '#e8f5e9',
                        fontWeight: 'bold', 
                        p: 1, 
                        borderRadius: 1, 
                        display: 'inline-block',
                        minWidth: '110px'
                      }}>
                        {isLowStock ? 'Закінчується' : 'В наявності'}
                      </Box>
                    </TableCell>

                    <TableCell align="center">
                      <IconButton color="primary" onClick={() => handleEdit(product)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton color="error" onClick={() => handleDelete(product.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {filteredProducts.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center">Товарів не знайдено</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {isModalOpen && (
        <CreateProductModal 
          open={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onProductSaved={handleRefresh} 
          productToEdit={editingProduct} 
        />
      )}
    </Box>
  );
}