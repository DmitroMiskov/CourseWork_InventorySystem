import { useEffect, useState, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import axios from 'axios';
import api, { API_BASE_URL } from '../api/axiosConfig';
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, 
  Button, TextField, IconButton, Dialog, DialogActions, DialogContent, 
  DialogTitle, MenuItem, Select, InputLabel, FormControl, Typography, 
  Toolbar, Tooltip, TablePagination, InputAdornment, Chip, LinearProgress, 
  Alert, Snackbar, Box, Checkbox, Badge, Fab, useTheme, useMediaQuery 
} from '@mui/material';

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

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

import StockHistory from './StockHistory';
import StockOperationModal from './StockOperationModal';
import IssuanceModal from './IssuanceModal';
import type { Product, Category, ServerError } from '../types/inventory';
import { useSignalR } from '../context/SignalRContext';

interface ProductListProps {
  isAdmin?: boolean;
}

interface UploadImageResponse {
  url: string;
}

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  quantity: string;
  unit: string;
  categoryId: string;
  minStock: string;
  imageUrl: string;
}

const ProductImage = ({ 
  imageName, 
  alt, 
  size = 50, 
  radius = 4 
}: { 
  imageName?: string; 
  alt?: string; 
  size?: number; 
  radius?: number;
}) => {
  const [hasError, setHasError] = useState(false);

  if (!imageName || hasError) {
    return (
      <Box sx={{ 
        width: size, height: size, 
        bgcolor: 'action.hover', borderRadius: radius, border: '1px dashed', borderColor: 'divider',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'text.secondary', flexShrink: 0 
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
    src = `${API_BASE_URL}/images/${cleanName}`;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(null);

  const [open, setOpen] = useState<boolean>(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState<ProductFormData>({
    name: '', description: '', price: '', quantity: '', unit: '', categoryId: '', minStock: '', imageUrl: ''
  });

  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  const [opModalOpen, setOpModalOpen] = useState<boolean>(false);
  const [opProduct, setOpProduct] = useState<Product | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [issueModalOpen, setIssueModalOpen] = useState<boolean>(false);

  const { subscribeStockMovement, subscribeProductChange } = useSignalR();

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const [res, catRes] = await Promise.all([
        api.get<Product[] | { items: Product[] }>('/products'),
        api.get<Category[] | { items: Category[] }>('/categories')
      ]);
      const productList = Array.isArray(res.data)
        ? res.data
        : (Array.isArray(res.data?.items) ? res.data.items : []);
      const categoryList = Array.isArray(catRes.data)
        ? catRes.data
        : (Array.isArray(catRes.data?.items) ? catRes.data.items : []);
      setProducts(productList);
      setCategories(categoryList);
    } catch (err: unknown) {
      console.error(err);
      setError("Не вдалося завантажити дані. Перевірте з'єднання.");
    } finally {
      setLoading(false);
    }
  };

  const refreshProductsSilent = async () => {
    try {
      const [res, catRes] = await Promise.all([
        api.get<Product[] | { items: Product[] }>('/products'),
        api.get<Category[] | { items: Category[] }>('/categories')
      ]);
      const productList = Array.isArray(res.data)
        ? res.data
        : (Array.isArray(res.data?.items) ? res.data.items : []);
      const categoryList = Array.isArray(catRes.data)
        ? catRes.data
        : (Array.isArray(catRes.data?.items) ? catRes.data.items : []);
      setProducts(productList);
      setCategories(categoryList);
    } catch (err) {
      console.error('Silent refresh failed', err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Підписка на події SignalR для оновлення залишків та товарів у реальному часі
  useEffect(() => {
    const unsubMove = subscribeStockMovement((movement) => {
      setProducts(prev => prev.map(p => 
        p.id === movement.productId ? { ...p, quantity: movement.newStock } : p
      ));
    });

    const unsubProd = subscribeProductChange((change) => {
      if (change.action === 'StockUpdated' && change.productId && change.newQuantity !== undefined) {
        setProducts(prev => prev.map(p => 
          p.id === change.productId ? { ...p, quantity: change.newQuantity! } : p
        ));
      } else {
        refreshProductsSilent();
      }
    });

    return () => {
      unsubMove();
      unsubProd();
    };
  }, [subscribeStockMovement, subscribeProductChange]);

  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedProducts = useMemo(() => {
    const safeProducts = Array.isArray(products) ? products : [];
    const sortableItems = [...safeProducts]; 
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

  const filteredProducts = sortedProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory ? product.categoryId === filterCategory : true;
    return matchesSearch && matchesCategory;
  });

  const handleOpen = (product?: Product) => {
    if (product) {
      setCurrentProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
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

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      setLoading(true);
      const res = await api.post<UploadImageResponse>('/products/upload-image', uploadData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
        }
      });
      setFormData(prev => ({ ...prev, imageUrl: res.data.url }));
    } catch (err: unknown) {
      console.error(err);
      setError("Не вдалося завантажити фото");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Ви впевнені, що хочете видалити цей товар?')) {
      try {
        await api.delete(`/products/${id}`);
        await fetchProducts();
      } catch (err: unknown) {
        console.error(err);
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
      quantity: parseInt(formData.quantity, 10) || 0,
      minStock: parseInt(formData.minStock, 10) || 0
    };

    try {
      if (currentProduct) {
        await api.put(`/products/${currentProduct.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setOpen(false);
      await fetchProducts();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError>(err)) {
        const msg = err.response?.data?.title || "Помилка збереження";
        setError(`Сервер: ${msg}`);
      } else {
        setError("Помилка збереження даних");
      }
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
    const excelBuffer: unknown = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, 'inventory_export.xlsx');
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const uploadData = new FormData();
    uploadData.append("file", event.target.files[0]);

    setLoading(true);
    try {
      await api.post('/products/import', uploadData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
        }
      });
      alert("Імпорт успішний!");
      await fetchProducts();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<string>(err)) {
        const msg = err.response?.data || "Помилка імпорту";
        setError(typeof msg === 'string' ? msg : "Сталася помилка імпорту");
      } else {
        setError("Сталася неочікувана помилка імпорту");
      }
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

  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const idsOnPage = filteredProducts
        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
        .map(p => p.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...idsOnPage])));
    } else {
      setSelectedIds([]);
    }
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
      </Snackbar>

      <Toolbar sx={{ 
        px: { xs: 0.5, sm: 1 }, 
        py: { xs: 1, sm: 1.5 },
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' }, 
        alignItems: { xs: 'stretch', md: 'center' }, 
        gap: 1.5,
        flexWrap: 'wrap'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="div" fontWeight="bold">
            Список товарів
          </Typography>
        </Box>

        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' }, 
          alignItems: { xs: 'stretch', sm: 'center' }, 
          gap: 1.5,
          flexGrow: 1
        }}>
          <TextField
            label="Пошук"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
            }}
            sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 200 } }}
          />

          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
            <InputLabel>Категорія</InputLabel>
            <Select
              value={filterCategory}
              label="Категорія"
              onChange={(e) => setFilterCategory(e.target.value as string)}
            >
              <MenuItem value=""><em>Всі</em></MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          justifyContent: { xs: 'space-between', sm: 'flex-end' } 
        }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Експорт в Excel">
              <IconButton onClick={exportToExcel} color="success" size="small"><SaveAltIcon /></IconButton>
            </Tooltip>

            <Tooltip title="Імпорт з CSV">
              <IconButton component="label" color="primary" size="small">
                <UploadFileIcon />
                <input type="file" hidden accept=".csv" onChange={handleFileUpload} />
              </IconButton>
            </Tooltip>
          </Box>

          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => handleOpen()}
            size="medium"
            sx={{ whiteSpace: 'nowrap' }}
          >
            Додати товар
          </Button>
        </Box>
      </Toolbar>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
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
                  sx={{ 
                    backgroundColor: product.quantity <= product.minStock 
                      ? (theme) => theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.16)' : '#fff0f0' 
                      : 'inherit' 
                  }}
                >
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
        onPageChange={(_, newPage: number) => setPage(newPage)}
        onRowsPerPageChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
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

          <TextField margin="dense" label="Назва" fullWidth value={formData.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })} />
          <TextField margin="dense" label="Опис" fullWidth multiline rows={2} value={formData.description} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })} />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField margin="dense" label="Ціна" type="number" fullWidth value={formData.price} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, price: e.target.value })} />
            <TextField margin="dense" label="Кількість" type="number" fullWidth value={formData.quantity} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, quantity: e.target.value })} />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField margin="dense" label="Одиниця виміру" fullWidth value={formData.unit} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, unit: e.target.value })} />
            <TextField margin="dense" label="Мін. залишок" type="number" fullWidth value={formData.minStock} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, minStock: e.target.value })} />
          </Box>

          <FormControl fullWidth margin="dense" sx={{ mt: 2 }}>
            <InputLabel>Категорія</InputLabel>
            <Select value={formData.categoryId} label="Категорія" onChange={(e) => setFormData({ ...formData, categoryId: e.target.value as string })}>
              {categories.map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Скасувати</Button>
          <Button onClick={handleSave} variant="contained">Зберегти</Button>
        </DialogActions>
      </Dialog>

      <StockHistory 
        key={historyModalOpen ? "hist-open" : "hist-closed"}
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        productId={historyProduct?.id || null} 
        productName={historyProduct?.name}
      />

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

      <IssuanceModal 
        open={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        selectedProducts={(Array.isArray(products) ? products : []).filter(p => selectedIds.includes(p.id))}
        onSuccess={() => {
          fetchProducts();
          setSelectedIds([]);
        }}
      />
    </Paper>
  );
}