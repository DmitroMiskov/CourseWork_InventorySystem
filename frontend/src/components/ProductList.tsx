import { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Typography, Box, CircularProgress, 
  Button, IconButton, TextField, MenuItem, FormControlLabel, Switch, InputAdornment, Tooltip 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import HistoryIcon from '@mui/icons-material/History';

import * as XLSX from 'xlsx';
import CreateProductModal from './CreateProductModal';
import StockHistory from './StockHistory'; 

// ... (Інтерфейси Product та Category залишаємо ті самі) ...
interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  minStock: number;
  quantity: number;
  unit: string;
  category?: { id: string; name: string };
  categoryId?: string;
}

interface Category {
  id: string;
  name: string;
}

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // 👈 СТАН ДЛЯ ІСТОРІЇ
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const fetchProducts = useCallback(() => {
    axios.get('/api/products')
      .then(response => setProducts(response.data))
      .catch(error => console.error("Помилка завантаження товарів:", error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    axios.get('/api/categories').then(res => setCategories(res.data));
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Видалити цей товар?')) return;
    try {
      await axios.delete(`/api/products/${id}`);
      fetchProducts();
    } catch (error) {
      console.error(error);
      alert("Помилка видалення");
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

  // 👈 ФУНКЦІЯ ВІДКРИТТЯ ІСТОРІЇ
  const handleOpenHistory = (id: string) => {
    setHistoryProductId(id);
    setHistoryOpen(true);
  };

  const handleExportExcel = () => {
    const dataToExport = products.map(p => ({
      'Артикул': p.sku,
      'Назва': p.name,
      'Категорія': p.category?.name || 'Без категорії',
      'Ціна': p.price,
      'Кількість': p.quantity,
      'Од.': p.unit,
      'Сума': p.price * p.quantity
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Залишки");
    XLSX.writeFile(workbook, `Sklad_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const formData = new FormData();
    formData.append("file", event.target.files[0]);

    setLoading(true);
    try {
      await axios.post('/api/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert("Імпорт успішний!");
      fetchProducts();
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data || "Помилка імпорту");
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            product.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory ? product.category?.id === filterCategory || product.categoryId === filterCategory : true;
      const matchesStock = showLowStockOnly ? product.quantity <= product.minStock : true;
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchTerm, filterCategory, showLowStockOnly]);

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Складські запаси</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" color="success" startIcon={<DownloadIcon />} onClick={handleExportExcel}>
            Excel
          </Button>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
            Імпорт CSV
            <input type="file" hidden accept=".csv" onChange={handleFileUpload} />
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            Додати товар
          </Button>
        </Box>
      </Box>

      {/* Фільтри */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField 
          label="Пошук" variant="outlined" size="small"
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1 }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
        />
        <TextField 
          select label="Категорія" size="small" sx={{ minWidth: 200 }}
          value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
        >
          <MenuItem value="">Всі категорії</MenuItem>
          {categories.map((cat) => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
        </TextField>
        <FormControlLabel 
          control={<Switch checked={showLowStockOnly} onChange={(e) => setShowLowStockOnly(e.target.checked)} color="error" />} 
          label="Тільки проблемні" 
        />
      </Paper>

      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ backgroundColor: '#1976d2' }}>
              <TableRow>
                <TableCell sx={{ color: 'white' }}>Артикул</TableCell>
                <TableCell sx={{ color: 'white' }}>Назва</TableCell>
                <TableCell sx={{ color: 'white' }}>Категорія</TableCell>
                <TableCell align="right" sx={{ color: 'white' }}>Ціна</TableCell>
                <TableCell align="right" sx={{ color: 'white' }}>Кількість</TableCell>
                <TableCell align="center" sx={{ color: 'white' }}>Дії</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} hover>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{product.name}</TableCell>
                  <TableCell>{product.category?.name || '-'}</TableCell>
                  <TableCell align="right">{product.price} грн</TableCell>
                  <TableCell align="right" sx={{ 
                    color: product.quantity <= product.minStock ? 'error.main' : 'success.main',
                    fontWeight: 'bold' 
                  }}>
                    {product.quantity} {product.unit}
                  </TableCell>
                  <TableCell align="center">
                    {/* 👈 КНОПКА ІСТОРІЇ */}
                    <Tooltip title="Історія руху">
                      <IconButton color="info" onClick={() => handleOpenHistory(product.id)}>
                        <HistoryIcon />
                      </IconButton>
                    </Tooltip>

                    <IconButton color="primary" onClick={() => handleEdit(product)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDelete(product.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Модальне вікно редагування */}
      {isModalOpen && (
        <CreateProductModal 
          open={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onProductSaved={fetchProducts} 
          productToEdit={editingProduct} 
        />
      )}

      {/* 👈 МОДАЛЬНЕ ВІКНО ІСТОРІЇ */}
      <StockHistory 
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        productId={historyProductId}
      />
    </Box>
  );
}