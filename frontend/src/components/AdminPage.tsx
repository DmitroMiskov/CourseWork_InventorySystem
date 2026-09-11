import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import axios from 'axios';
import type { SelectChangeEvent } from '@mui/material';
import api from '../api/axiosConfig';
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

interface ErrorResponse {
    message?: string;
    title?: string;
}

interface AlertMessage {
    type: 'success' | 'error';
    text: string;
}

export default function AdminPage({ onBack }: AdminPageProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [refreshKey, setRefreshKey] = useState<number>(0);
    
    const [openDialog, setOpenDialog] = useState<boolean>(false);
    const [userName, setUserName] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [role, setRole] = useState<string>('User');
    
    const [message, setMessage] = useState<AlertMessage | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await api.get<User[]>('/Auth/users');
                setUsers(res.data);
            } catch (err: unknown) {
                console.error("Не вдалося завантажити користувачів", err);
            }
        };

        fetchUsers();
    }, [refreshKey]);

    const handleCreateUser = async () => {
        if (!userName || !password) {
            setMessage({ type: 'error', text: 'Заповніть логін та пароль' });
            return;
        }

        try {
            await api.post('/Auth/register', { 
                userName, 
                password, 
                role 
            }); 
            
            setMessage({ type: 'success', text: `Співробітника ${userName} додано!` });
            
            setUserName('');
            setPassword('');
            setOpenDialog(false);
            
            setRefreshKey(prev => prev + 1); 
        } catch (err: unknown) {
            let errorText = 'Помилка створення';

            if (axios.isAxiosError<ErrorResponse>(err)) {
                errorText = err.response?.data?.message || err.response?.data?.title || errorText;
            }

            setMessage({ type: 'error', text: errorText });
        }
    };

    const handleDeleteUser = async (id: string, name: string) => {
        if (!window.confirm(`Ви точно хочете звільнити ${name}?`)) return;

        try {
            await api.delete(`/Auth/users/${id}`);
            
            setMessage({ type: 'success', text: `Користувача ${name} видалено` });
            setRefreshKey(prev => prev + 1);
        } catch (err: unknown) {
            console.error(err);
            setMessage({ type: 'error', text: 'Не вдалося видалити користувача' });
        }
    };

    return (
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
                <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
                    Назад
                </Button>
                <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
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

            <TableContainer component={Paper} elevation={2} sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <Table sx={{ minWidth: 400 }}>
                    <TableHead>
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

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="xs">
                <DialogTitle>Новий співробітник</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField 
                            label="Логін" 
                            fullWidth 
                            value={userName} 
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setUserName(e.target.value)} 
                        />
                        <TextField 
                            label="Пароль" 
                            type="password" 
                            fullWidth 
                            value={password} 
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} 
                        />
                        <FormControl fullWidth>
                            <InputLabel>Роль</InputLabel>
                            <Select
                                value={role}
                                label="Роль"
                                onChange={(e: SelectChangeEvent<string>) => setRole(e.target.value)}
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
}