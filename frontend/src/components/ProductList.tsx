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
  quantity: number;
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
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>К-сть</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Статус</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Дії</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => {
                // 👇 ЛОГІКА: Чи мало товару?
                const isLowStock = product.quantity <= product.minStock;

                return (
                  <TableRow key={product.id} hover>
                    <TableCell>{product.sku || '-'}</TableCell>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                      {product.name}
                    </TableCell>
                    <TableCell>{product.category?.name || 'Без категорії'}</TableCell>
                    <TableCell align="right">{product.price} грн</TableCell>
                    
                    {/* 👇 НОВА КОЛОНКА КІЛЬКОСТІ */}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {product.quantity} {product.unit}
                    </TableCell>

                    {/* 👇 ОНОВЛЕНИЙ СТАТУС (ЧЕРВОНИЙ/ЗЕЛЕНИЙ) */}
                    <TableCell align="center">
                      <Box sx={{ 
                        color: isLowStock ? '#d32f2f' : '#2e7d32', // Червоний або Зелений текст
                        bgcolor: isLowStock ? '#ffcdd2' : '#e8f5e9', // Червоний або Зелений фон
                        fontWeight: 'bold', 
                        p: 1, 
                        borderRadius: 1, 
                        display: 'inline-block',
                        minWidth: '100px'
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