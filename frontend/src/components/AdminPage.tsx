import { useState, useEffect, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { 
    Box, Button, TextField, Typography, Paper, Alert, 
    FormControl, InputLabel, Select, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';

interface AdminPageProps {
    onBack: () => void;
}

interface User {
    id: string;
    userName: string;
    role: string;
}

// Інтерфейс для помилки від сервера
interface ErrorResponse {
    message?: string;
}

const AdminPage = ({ onBack }: AdminPageProps) => {
    // Стан для списку юзерів
    const [users, setUsers] = useState<User[]>([]);
    
    // Стан для форми додавання
    const [openDialog, setOpenDialog] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('User');
    
    // Стан для повідомлень
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    // 👇 1. ВИПРАВЛЕННЯ: Використовуємо useCallback, щоб "заморозити" функцію
    const fetchUsers = useCallback(async () => {
        try {
            const res = await axios.get('/api/Auth/users');
            setUsers(res.data);
        } catch (error) {
            console.error("Не вдалося завантажити користувачів", error);
        }
    }, []); // Порожній масив означає, що функція створюється один раз

    // 👇 2. Тепер викликаємо її в useEffect (додавши в залежності)
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleCreateUser = async () => {
        if (!username || !password) {
            setMessage({ type: 'error', text: 'Заповніть логін та пароль' });
            return;
        }

        try {
            await axios.post('/api/Auth/register', { username, password, role });
            setMessage({ type: 'success', text: `Співробітника ${username} додано!` });
            
            // Очистка і оновлення
            setUsername('');
            setPassword('');
            setOpenDialog(false);
            fetchUsers(); 
        } catch (error) {
            const axiosError = error as AxiosError<ErrorResponse>;
            const errorText = axiosError.response?.data?.message || 'Помилка створення';
            setMessage({ type: 'error', text: errorText });
        }
    };

    const handleDeleteUser = async (id: string, name: string) => {
        if (!window.confirm(`Ви точно хочете звільнити ${name}?`)) return;

        try {
            await axios.delete(`/api/Auth/users/${id}`);
            setMessage({ type: 'success', text: `Користувача ${name} видалено` });
            fetchUsers();
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Не вдалося видалити користувача' });
        }
    };

    return (
        <Paper sx={{ p: 3, borderRadius: 2 }}>
            {/* Заголовок і навігація */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
                    Назад
                </Button>
                <Typography variant="h5">
                    Управління персоналом
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
                    Додати працівника
                </Button>
            </Box>

            {message && (
                <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
                    {message.text}
                </Alert>
            )}

            {/* ТАБЛИЦЯ КОРИСТУВАЧІВ */}
            <TableContainer component={Paper} elevation={2}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell>Login</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <PersonIcon color="action" />
                                        <Typography fontWeight="bold">{user.userName}</Typography>
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Chip 
                                        icon={user.role === 'Admin' ? <SupervisorAccountIcon /> : <PersonIcon />}
                                        label={user.role} 
                                        color={user.role === 'Admin' ? 'warning' : 'default'} 
                                        size="small" 
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton color="error" onClick={() => handleDeleteUser(user.id, user.userName)}>
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* МОДАЛЬНЕ ВІКНО ДОДАВАННЯ */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="xs">
                <DialogTitle>Новий співробітник</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField 
                            label="Логін" 
                            fullWidth 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                        />
                        <TextField 
                            label="Пароль" 
                            type="password" 
                            fullWidth 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                        />
                        <FormControl fullWidth>
                            <InputLabel>Роль</InputLabel>
                            <Select
                                value={role}
                                label="Роль"
                                onChange={(e) => setRole(e.target.value)}
                            >
                                <MenuItem value="User">User (Комірник)</MenuItem>
                                <MenuItem value="Admin">Admin (Керівник)</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Скасувати</Button>
                    <Button variant="contained" onClick={handleCreateUser}>Створити</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default AdminPage;