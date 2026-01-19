import React, { useEffect, useState, useMemo } from 'react';
import { AxiosError } from 'axios';
import axios from 'axios';
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, 
  Button, TextField, IconButton, Dialog, DialogActions, DialogContent, 
  DialogTitle, MenuItem, Select, InputLabel, FormControl, Typography, 
  Toolbar, Tooltip, TablePagination, InputAdornment, Chip, LinearProgress, 
  Alert, Snackbar, Box, Checkbox, Badge, Fab 
} from '@mui/material';

// Іконки
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import HistoryIcon from '@mui/icons-material/History';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';

// Бібліотеки для Excel та навігації
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Наші компоненти
import StockHistory from './StockHistory';
import StockOperationModal from './StockOperationModal';
import IssuanceModal from './IssuanceModal';

const AZURE_API_URL = "https://inventory-api-miskov-dtcyece6dme4hme8.polandcentral-01.azurewebsites.net";

// --- ТИПИ ---
interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  unit: string;
  categoryId: string;
  category?: Category;
  minStock: number;
  imageUrl?: string;
}

interface ProductListProps {
  isAdmin?: boolean;
}

interface ServerError {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
}

// --- НАДІЙНИЙ КОМПОНЕНТ ДЛЯ КАРТИНОК ---
const ProductImage = ({ imageName, alt, size = 50, radius = 4 }: { imageName?: string; alt?: string; size?: number; radius?: number }) => {
  const [hasError, setHasError] = useState(false);
  
  const SERVER_URL = AZURE_API_URL; 

  if (!imageName || hasError) {
    return (
      <Box sx={{ 
        width: size, height: size, 
        bgcolor: '#f5f5f5', borderRadius: radius, border: '1px dashed #ccc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#999', flexShrink: 0 
      }}>
        <PhotoCamera sx={{ fontSize: size * 0.5 }} />
      </Box>
    );
  }

  let src = '';
  
  if (imageName.startsWith('http')) {
      src = imageName;
  } else {
      let cleanName = imageName.startsWith('/') ? imageName.slice(1) : imageName;
      if (cleanName.startsWith('images/')) {
          cleanName = cleanName.replace('images/', '');
      }
      src = `${SERVER_URL}/images/${cleanName}`;
  }

  return (
    <Box 
        component="img"
        src={src}
        alt={alt || 'Product'}
        sx={{ 
            width: size, height: size, objectFit: 'cover', 
            borderRadius: radius, border: '1px solid #ddd', flexShrink: 0 
        }}
        onError={() => {
            setHasError(true); 
        }}
    />
  );
};

export default function ProductList({ isAdmin = false }: ProductListProps) {
  // --- СТАНИ (STATE) ---
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Пагінація та Пошук
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // Сортування
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(null);

  // Модальні вікна
  const [open, setOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: '', description: '', price: '', quantity: '', unit: '', categoryId: '', minStock: '', imageUrl: ''
  });

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  const [opModalOpen, setOpModalOpen] = useState(false);
  const [opProduct, setOpProduct] = useState<Product | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [issueModalOpen, setIssueModalOpen] = useState(false);

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };
  };

  // --- ЗАВАНТАЖЕННЯ ДАНИХ ---
  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get<Product[]>(`${AZURE_API_URL}/api/products`, getAuthConfig());
      setProducts(res.data);
      
      const catRes = await axios.get<Category[]>(`${AZURE_API_URL}/api/categories`, getAuthConfig());
      setCategories(catRes.data);
    } catch (err) {
      console.error(err);
      setError("Не вдалося завантажити дані. Перевірте з'єднання.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // --- ЛОГІКА СОРТУВАННЯ ---
  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedProducts = useMemo(() => {
    const sortableItems = [...products]; 
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === undefined || bValue === undefined) return 0;
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [products, sortConfig]);

  // --- ФІЛЬТРАЦІЯ ---
  const filteredProducts = sortedProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory ? product.categoryId === filterCategory : true;
    return matchesSearch && matchesCategory;
  });

  // --- CRUD ОПЕРАЦІЇ ---
  const handleOpen = (product?: Product) => {
    if (product) {
      setCurrentProduct(product);
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        quantity: product.quantity.toString(),
        unit: product.unit,
        categoryId: product.categoryId,
        minStock: product.minStock?.toString() || '0',
        imageUrl: product.imageUrl || ''
      });
    } else {
      setCurrentProduct(null);
      setFormData({ name: '', description: '', price: '', quantity: '', unit: '', categoryId: '', minStock: '', imageUrl: '' });
    }
    setOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.post<{ url: string }>(`${AZURE_API_URL}/api/products/upload-image`, uploadData, {
          headers: { 
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`
          }
      });
      setFormData(prev => ({ ...prev, imageUrl: res.data.url }));
    } catch (err) {
      console.error(err);
      setError("Не вдалося завантажити фото");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Ви впевнені, що хочете видалити цей товар?')) {
      try {
        await axios.delete(`${AZURE_API_URL}/api/products/${id}`, getAuthConfig());
        fetchProducts();
      } catch (error) {
        console.error(error);
        setError("Помилка при видаленні товару");
      }
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.categoryId || !formData.price) {
      setError("Заповніть назву, категорію та ціну!");
      return;
    }

    const payload = {
      id: currentProduct?.id,
      name: formData.name,
      description: formData.description,
      unit: formData.unit,
      categoryId: formData.categoryId,
      imageUrl: formData.imageUrl,
      price: parseFloat(formData.price) || 0,
      quantity: parseInt(formData.quantity) || 0,
      minStock: parseInt(formData.minStock) || 0
    };

    try {
      if (currentProduct) {
        await axios.put(`${AZURE_API_URL}/api/products/${currentProduct.id}`, payload, getAuthConfig());
      } else {
        await axios.post(`${AZURE_API_URL}/api/products`, payload, getAuthConfig());
      }
      setOpen(false);
      fetchProducts();
    } catch (error) {
      console.error(error);
      const axiosError = error as AxiosError<ServerError>;
      const msg = axiosError.response?.data?.title || "Помилка збереження";
      setError(`Сервер: ${JSON.stringify(msg)}`);
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(products.map(p => ({
      Назва: p.name,
      Категорія: p.category?.name || '',
      Ціна: p.price,
      Кількість: p.quantity,
      Одиниця: p.unit,
      Опис: p.description
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Товари");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, 'inventory_export.xlsx');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const uploadData = new FormData();
    uploadData.append("file", event.target.files[0]);

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${AZURE_API_URL}/api/products/import`, uploadData, {
        headers: { 
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
        }
      });
      alert("Імпорт успішний!");
      fetchProducts();
    } catch (error) {
      console.error(error);
      const axiosError = error as AxiosError<string>;
      const msg = axiosError.response?.data || "Помилка імпорту";
      setError(typeof msg === 'string' ? msg : "Сталася помилка імпорту");
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleOpenOperation = (product: Product) => {
    setOpProduct(product);
    setOpModalOpen(true);
  };

  const handleOpenHistory = (product: Product) => {
    setHistoryProduct(product);
    setHistoryModalOpen(true);
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        const idsOnPage = filteredProducts
            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
            .map(p => p.id);
        // Додаємо тільки унікальні
        setSelectedIds(prev => Array.from(new Set([...prev, ...idsOnPage])));
    } else {
        setSelectedIds([]);
    }
  };

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
      </Snackbar>

      {/* ВЕРХНЯ ПАНЕЛЬ */}
      <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h6" component="div" sx={{ flex: '1 1 100%' }}>
          Список товарів
        </Typography>

        <TextField
          label="Пошук"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
          }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Категорія</InputLabel>
          <Select
            value={filterCategory}
            label="Категорія"
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <MenuItem value=""><em>Всі</em></MenuItem>
            {categories.map(cat => (
              <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="Експорт в Excel">
          <IconButton onClick={exportToExcel} color="success"><SaveAltIcon /></IconButton>
        </Tooltip>

        <Tooltip title="Імпорт з CSV">
          <IconButton component="label" color="primary">
            <UploadFileIcon />
            <input type="file" hidden accept=".csv" onChange={handleFileUpload} />
          </IconButton>
        </Tooltip>

        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Додати товар
        </Button>
      </Toolbar>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* ТАБЛИЦЯ */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              {/* ЧЕКБОКС "ВИБРАТИ ВСЕ" */}
              <TableCell padding="checkbox">
                  <Checkbox 
                      onChange={handleSelectAll} 
                      checked={selectedIds.length > 0 && selectedIds.length === filteredProducts.length}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < filteredProducts.length}
                  />
              </TableCell>
              <TableCell onClick={() => handleSort('name')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>Назва ↕</TableCell>
              <TableCell onClick={() => handleSort('categoryId')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>Категорія ↕</TableCell>
              <TableCell onClick={() => handleSort('price')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>Ціна ↕</TableCell>
              <TableCell onClick={() => handleSort('quantity')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>Кількість ↕</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Дії</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProducts
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((product) => (
                <TableRow 
                    key={product.id}
                    sx={{ backgroundColor: product.quantity <= product.minStock ? '#fff0f0' : 'inherit' }}
                >
                  {/* ЧЕКБОКС РЯДКА */}
                  <TableCell padding="checkbox">
                    <Checkbox 
                        checked={selectedIds.includes(product.id)}
                        onChange={() => handleSelect(product.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ProductImage 
                            key={product.imageUrl || 'no-img'}
                            imageName={product.imageUrl} 
                            alt={product.name} 
                            size={40} 
                        />
                        <Typography variant="body2">{product.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={product.category?.name || 'Без категорії'} size="small" />
                  </TableCell>
                  <TableCell>{product.price} грн</TableCell>
                  <TableCell>
                      {product.quantity} {product.unit}
                      {product.quantity <= product.minStock && (
                        <Typography variant="caption" color="error" display="block">(Закінчується!)</Typography>
                      )}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Прихід / Розхід">
                        <IconButton color="warning" onClick={() => handleOpenOperation(product)}>
                            <SyncAltIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Історія руху">
                        <IconButton color="info" onClick={() => handleOpenHistory(product)}>
                            <HistoryIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Редагувати">
                      <IconButton color="primary" onClick={() => handleOpen(product)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    {isAdmin && (
                        <Tooltip title="Видалити">
                        <IconButton color="error" onClick={() => handleDelete(product.id)}>
                            <DeleteIcon />
                        </IconButton>
                        </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredProducts.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
        }}
      />

      {/* МОДАЛКА РЕДАГУВАННЯ */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{currentProduct ? 'Редагувати товар' : 'Новий товар'}</DialogTitle>
        <DialogContent dividers>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
             <ProductImage 
                key={formData.imageUrl || 'preview'}
                imageName={formData.imageUrl} 
                alt="Preview" 
                size={100} 
                radius={8} 
             />
             
             <Box>
                <Button variant="outlined" component="label" startIcon={<PhotoCamera />}>
                    Завантажити фото
                    <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                </Button>
                <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                    Формати: JPG, PNG, WEBP
                </Typography>
             </Box>
          </Box>

          <TextField margin="dense" label="Назва" fullWidth value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          <TextField margin="dense" label="Опис" fullWidth multiline rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
             <TextField margin="dense" label="Ціна" type="number" fullWidth value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
             <TextField margin="dense" label="Кількість" type="number" fullWidth value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField margin="dense" label="Одиниця виміру" fullWidth value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} />
            <TextField margin="dense" label="Мін. залишок" type="number" fullWidth value={formData.minStock} onChange={(e) => setFormData({ ...formData, minStock: e.target.value })} />
          </Box>

          <FormControl fullWidth margin="dense" sx={{ mt: 2 }}>
            <InputLabel>Категорія</InputLabel>
            <Select value={formData.categoryId} label="Категорія" onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
              {categories.map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Скасувати</Button>
          <Button onClick={handleSave} variant="contained">Зберегти</Button>
        </DialogActions>
      </Dialog>

      {/* МОДАЛКА ІСТОРІЇ */}
      <StockHistory 
        key={historyModalOpen ? "hist-open" : "hist-closed"}
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        productId={historyProduct?.id || null} 
        productName={historyProduct?.name}
      />

      {/* МОДАЛКА ОПЕРАЦІЙ */}
      <StockOperationModal
        key={opModalOpen ? "open" : "closed"} 
        open={opModalOpen}
        onClose={() => setOpModalOpen(false)}
        product={opProduct}
        onSuccess={() => {
          fetchProducts();
          setOpModalOpen(false);
        }}
      />

      {/* ПЛАВАЮЧА КНОПКА КОШИКА (З'являється, коли щось вибрано) */}
      {selectedIds.length > 0 && (
        <Box sx={{ position: 'fixed', bottom: 30, right: 30, zIndex: 1000 }}>
            <Badge badgeContent={selectedIds.length} color="error">
                <Fab color="primary" variant="extended" onClick={() => setIssueModalOpen(true)}>
                    <ShoppingCartIcon sx={{ mr: 1 }} />
                    Оформити видачу
                </Fab>
            </Badge>
        </Box>
      )}

      {/* МОДАЛКА ВИДАЧІ */}
      <IssuanceModal 
        open={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        selectedProducts={products.filter(p => selectedIds.includes(p.id))}
        onSuccess={() => {
            fetchProducts();
            setSelectedIds([]); // Очистити вибір після успіху
        }}
      />
    </Paper>
  );
}