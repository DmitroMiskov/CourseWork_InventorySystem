import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { 
  Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Typography, Box, CircularProgress, 
  Button, IconButton 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CreateProductModal from './CreateProductModal';

// Інтерфейс товару (відповідає даним з Backend)
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

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Стан для модального вікна
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Стан для редагування (якщо null — значить створюємо новий)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Функція завантаження товарів
  const fetchProducts = useCallback(() => {
    // Не вмикаємо setLoading(true) тут, щоб уникнути циклічного рендерингу в useEffect
    axios.get('/api/products')
      .then(response => {
        setProducts(response.data);
      })
      .catch(error => {
        console.error("Помилка завантаження:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Завантажуємо дані при першому запуску
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Функція для примусового оновлення таблиці (після створення/редагування/видалення)
  const handleRefresh = () => {
    setLoading(true);
    fetchProducts();
  };

  // Обробник видалення
  const handleDelete = async (id: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей товар?')) {
      return;
    }

    try {
      await axios.delete(`/api/products/${id}`);
      handleRefresh(); // Оновлюємо список
    } catch (error) {
      console.error("Не вдалося видалити:", error);
      alert("Помилка при видаленні");
    }
  };

  // Відкриття вікна для СТВОРЕННЯ
  const handleCreate = () => {
    setEditingProduct(null); // Очищаємо, бо це новий запис
    setIsModalOpen(true);
  };

  // Відкриття вікна для РЕДАГУВАННЯ
  const handleEdit = (product: Product) => {
    setEditingProduct(product); // Передаємо дані товару у форму
    setIsModalOpen(true);
  };

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      {/* Заголовок і кнопка Додати */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Складські запаси
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={handleCreate}
          sx={{ height: 40 }}
        >
          Додати товар
        </Button>
      </Box>
      
      {/* Спінер завантаження або Таблиця */}
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
                <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Статус</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Дії</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} hover>
                  <TableCell>{product.sku || '-'}</TableCell>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                    {product.name}
                  </TableCell>
                  <TableCell>{product.category?.name || 'Без категорії'}</TableCell>
                  <TableCell align="right">{product.price} грн</TableCell>
                  
                  {/* Статус наявності */}
                  <TableCell align="center">
                    <Box sx={{ 
                      color: 'green', // Тут можна додати умову: product.minStock > 0 ? 'green' : 'red'
                      fontWeight: 'bold', 
                      p: 1, 
                      borderRadius: 1, 
                      bgcolor: '#e8f5e9',
                      display: 'inline-block'
                    }}>
                      В наявності
                    </Box>
                  </TableCell>

                  {/* Кнопки Дій */}
                  <TableCell align="center">
                    <IconButton color="primary" onClick={() => handleEdit(product)} title="Редагувати">
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDelete(product.id)} title="Видалити">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              
              {/* Якщо список пустий */}
              {products.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center">Даних немає</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Модальне вікно (спільне для створення та редагування) */}
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