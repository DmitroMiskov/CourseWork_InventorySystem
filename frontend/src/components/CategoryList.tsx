import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Button, IconButton, Dialog, DialogActions, DialogContent,
    DialogTitle, TextField, Typography, Toolbar, LinearProgress, Alert, Snackbar
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';

const AZURE_API_URL = "https://inventory-api-miskov-dtcyece6dme4hme8.polandcentral-01.azurewebsites.net";

interface Category {
    id: string;
    name: string;
}

interface CategoryListProps {
    isAdmin?: boolean;
}

export default function CategoryList({ isAdmin = false }: CategoryListProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Модалка
    const [open, setOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
    const [categoryName, setCategoryName] = useState('');

    const getAuthConfig = () => {
        const token = localStorage.getItem('token');
        return { headers: { 'Authorization': `Bearer ${token}` } };
    };

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const res = await axios.get<Category[]>(`${AZURE_API_URL}/api/categories`, getAuthConfig());
            setCategories(res.data);
        } catch (err) {
            console.error(err);
            setError("Помилка завантаження категорій");
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
            setCategoryName(category.name);
        } else {
            setCurrentCategory(null);
            setCategoryName('');
        }
        setOpen(true);
    };

    const handleSave = async () => {
        if (!categoryName.trim()) return;

        try {
            if (currentCategory) {
                // Update
                await axios.put(
                    `${AZURE_API_URL}/api/categories/${currentCategory.id}`, 
                    { id: currentCategory.id, name: categoryName }, 
                    getAuthConfig()
                );
            } else {
                // Create
                await axios.post(
                    `${AZURE_API_URL}/api/categories`, 
                    { name: categoryName }, 
                    getAuthConfig()
                );
            }
            setOpen(false);
            fetchCategories();
        } catch (err) {
            console.error(err);
            setError("Помилка збереження");
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Видалити цю категорію?")) return;
        try {
            await axios.delete(`${AZURE_API_URL}/api/categories/${id}`, getAuthConfig());
            fetchCategories();
        } catch (err) {
            console.error(err);
            setError("Помилка видалення (можливо, категорія використовується)");
        }
    };

    return (
        <Paper sx={{ p: 2, borderRadius: 2 }}>
            <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
                <Alert severity="error">{error}</Alert>
            </Snackbar>

            <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 } }}>
                <Typography variant="h6" component="div" sx={{ flex: '1 1 100%' }}>
                    Категорії
                </Typography>
                {isAdmin && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
                        Додати
                    </Button>
                )}
            </Toolbar>

            {loading && <LinearProgress />}

            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell>Назва</TableCell>
                            {isAdmin && <TableCell align="right">Дії</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {categories.map((cat) => (
                            <TableRow key={cat.id} hover>
                                <TableCell>{cat.name}</TableCell>
                                {isAdmin && (
                                    <TableCell align="right">
                                        <IconButton color="primary" onClick={() => handleOpen(cat)}>
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton color="error" onClick={() => handleDelete(cat.id)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{currentCategory ? 'Редагувати' : 'Нова категорія'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Назва категорії"
                        fullWidth
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>Скасувати</Button>
                    <Button onClick={handleSave} variant="contained">Зберегти</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}