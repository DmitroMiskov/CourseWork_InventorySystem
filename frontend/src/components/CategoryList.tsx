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
import { useLanguage } from '../context/LanguageContext';

interface CategoryListProps {
  isAdmin?: boolean;
  isManager?: boolean;
}

export default function CategoryList({ isAdmin = false, isManager = false }: CategoryListProps) {
  const { t } = useLanguage();
  const canManageCategories = isAdmin || isManager;
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
      setError(t('common.error'));
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
      setError(t('products.enterName'));
      return;
    }

    try {
      if (currentCategory) {
        await api.put(`/categories/${currentCategory.id}`, {
          id: currentCategory.id,
          name: trimmedName,
        });
        setSuccessMsg(t('common.success'));
      } else {
        await api.post('/categories', {
          name: trimmedName,
        });
        setSuccessMsg(t('common.success'));
      }
      handleClose();
      await fetchCategories();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError>(err)) {
        const msg = err.response?.data?.title || t('common.error');
        setError(msg);
      } else {
        setError(t('common.error'));
      }
    }
  };

  const handleDelete = async (id: string, categoryName: string) => {
    if (!window.confirm(`${t('common.confirmDelete')} "${categoryName}"?`)) return;

    try {
      await api.delete(`/categories/${id}`);
      setSuccessMsg(t('common.success'));
      await fetchCategories();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError>(err)) {
        const msg = err.response?.data?.title || t('common.error');
        setError(msg);
      } else {
        setError(t('common.error'));
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

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" fontWeight="bold">
          {t('categories.title')}
        </Typography>
        {canManageCategories && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} size="medium">
            {t('categories.addCategory')}
          </Button>
        )}
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper} elevation={1} sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Table sx={{ minWidth: 350 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>{t('categories.categoryName')}</TableCell>
              {canManageCategories && <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('common.actions')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={canManageCategories ? 2 : 1} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  {t('categories.notFound')}
                </TableCell>
              </TableRow>
            ) : (
              categories.map((cat) => (
                <TableRow key={cat.id} hover>
                  <TableCell>
                    <Typography variant="body1">{cat.name}</Typography>
                  </TableCell>
                  {canManageCategories && (
                    <TableCell align="right">
                      <Tooltip title={t('common.edit')}>
                        <IconButton color="primary" onClick={() => handleOpen(cat)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      {isAdmin && (
                        <Tooltip title={t('common.delete')}>
                          <IconButton color="error" onClick={() => handleDelete(cat.id, cat.name)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
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
          {currentCategory ? t('categories.editCategory') : t('categories.newCategory')}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('categories.categoryName')}
            fullWidth
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}