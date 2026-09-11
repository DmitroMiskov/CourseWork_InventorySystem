import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import axios from 'axios';
import api from '../api/axiosConfig';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Category, ServerError } from '../types/inventory';

interface CategoryListProps {
  isAdmin?: boolean;
}

export default function CategoryList({ isAdmin = false }: CategoryListProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [name, setName] = useState<string>('');

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get<Category[]>('/categories');
      setCategories(res.data);
    } catch (err: unknown) {
      console.error(err);
      setError('Не вдалося завантажити категорії');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpen = (category?: Category) => {
    if (category) {
      setCurrentCategory(category);
      setName(category.name);
    } else {
      setCurrentCategory(null);
      setName('');
    }
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setCurrentCategory(null);
    setName('');
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Назва категорії не може бути порожньою');
      return;
    }

    try {
      if (currentCategory) {
        await api.put(`/categories/${currentCategory.id}`, {
          id: currentCategory.id,
          name: trimmedName,
        });
        setSuccessMsg('Категорію успішно оновлено');
      } else {
        await api.post('/categories', {
          name: trimmedName,
        });
        setSuccessMsg('Категорію успішно створено');
      }
      handleClose();
      await fetchCategories();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError>(err)) {
        const msg = err.response?.data?.title || 'Помилка при збереженні категорії';
        setError(`Сервер: ${msg}`);
      } else {
        setError('Непередбачена помилка збереження');
      }
    }
  };

  const handleDelete = async (id: string, categoryName: string) => {
    if (!window.confirm(`Видалити категорію "${categoryName}"?`)) return;

    try {
      await api.delete(`/categories/${id}`);
      setSuccessMsg(`Категорію "${categoryName}" видалено`);
      await fetchCategories();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError>(err)) {
        const msg = err.response?.data?.title || 'Не вдалося видалити категорію';
        setError(`Помилка: ${msg}`);
      } else {
        setError('Помилка при видаленні категорії');
      }
    }
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 2 }}>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar open={!!successMsg} autoHideDuration={4000} onClose={() => setSuccessMsg('')}>
        <Alert severity="success" onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      </Snackbar>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Категорії товарів
        </Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            Додати категорію
          </Button>
        )}
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper} elevation={1}>
        <Table>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Назва категорії</TableCell>
              {isAdmin && <TableCell align="right" sx={{ fontWeight: 'bold' }}>Дії</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 2 : 1} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  Категорій не знайдено
                </TableCell>
              </TableRow>
            ) : (
              categories.map((cat) => (
                <TableRow key={cat.id} hover>
                  <TableCell>
                    <Typography variant="body1">{cat.name}</Typography>
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <Tooltip title="Редагувати">
                        <IconButton color="primary" onClick={() => handleOpen(cat)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Видалити">
                        <IconButton color="error" onClick={() => handleDelete(cat.id, cat.name)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>
          {currentCategory ? 'Редагувати категорію' : 'Створити категорію'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Назва категорії"
            fullWidth
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Скасувати</Button>
          <Button variant="contained" onClick={handleSave}>
            Зберегти
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}