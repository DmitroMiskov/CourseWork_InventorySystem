import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import axios from 'axios';
import type { SelectChangeEvent } from '@mui/material';
import api from '../api/axiosConfig';
import { 
    Box, Button, TextField, Typography, Paper, Alert, 
    FormControl, InputLabel, Select, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip, InputAdornment, Tooltip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import InventoryIcon from '@mui/icons-material/Inventory';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useLanguage } from '../context/LanguageContext';

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
    const { t } = useLanguage();
    const [users, setUsers] = useState<User[]>([]);
    const [refreshKey, setRefreshKey] = useState<number>(0);
    
    const [openDialog, setOpenDialog] = useState<boolean>(false);
    const [userName, setUserName] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [role, setRole] = useState<string>('WarehouseWorker');
    
    const [message, setMessage] = useState<AlertMessage | null>(null);

    const getRoleBadge = (roleName: string) => {
        const r = (roleName || '').toLowerCase();
        if (r === 'admin') {
            return (
                <Chip 
                    icon={<SupervisorAccountIcon />}
                    label={t('roles.admin')} 
                    color="warning" 
                    size="small" 
                    sx={{ fontWeight: 'bold' }}
                />
            );
        }
        if (r === 'manager') {
            return (
                <Chip 
                    icon={<TrendingUpIcon />}
                    label={t('roles.manager')} 
                    color="secondary" 
                    size="small" 
                    sx={{ fontWeight: 'bold' }}
                />
            );
        }
        if (r === 'warehouseworker' || r === 'worker') {
            return (
                <Chip 
                    icon={<InventoryIcon />}
                    label={t('roles.worker')} 
                    color="success" 
                    size="small" 
                    sx={{ fontWeight: 'bold' }}
                />
            );
        }
        return (
            <Chip 
                icon={<PersonIcon />}
                label={roleName || t('roles.user')} 
                color="default" 
                size="small" 
            />
        );
    };

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await api.get<User[]>('/Auth/users');
                setUsers(res.data);
            } catch (err: unknown) {
                console.error("Fetch users error", err);
            }
        };

        fetchUsers();
    }, [refreshKey]);

    const handleCreateUser = async () => {
        if (!userName || !password) {
            setMessage({ type: 'error', text: t('staff.fillCredentials') });
            return;
        }

        try {
            await api.post('/Auth/register', { 
                userName, 
                password, 
                role 
            }); 
            
            setMessage({ type: 'success', text: `${t('staff.userAdded')} (${userName})` });
            
            setUserName('');
            setPassword('');
            setShowPassword(false);
            setOpenDialog(false);
            
            setRefreshKey(prev => prev + 1); 
        } catch (err: unknown) {
            let errorText = t('common.error');

            if (axios.isAxiosError<ErrorResponse>(err)) {
                errorText = err.response?.data?.message || err.response?.data?.title || errorText;
            }

            setMessage({ type: 'error', text: errorText });
        }
    };

    const handleDeleteUser = async (id: string, name: string) => {
        if (!window.confirm(`${t('staff.fireConfirm')} ${name}?`)) return;

        try {
            await api.delete(`/Auth/users/${id}`);
            
            setMessage({ type: 'success', text: `${t('staff.userDeleted')}: ${name}` });
            setRefreshKey(prev => prev + 1);
        } catch (err: unknown) {
            console.error(err);
            setMessage({ type: 'error', text: t('common.error') });
        }
    };

    return (
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
                <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
                    {t('common.back')}
                </Button>
                <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                    {t('staff.title')}
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
                    {t('staff.addEmployee')}
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
                            <TableCell sx={{ fontWeight: 'bold' }}>{t('staff.login')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{t('staff.role')}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('staff.actions')}</TableCell>
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
                                    {getRoleBadge(user.role)}
                                </TableCell>
                                <TableCell align="right">
                                    <Tooltip title={t('common.delete')}>
                                        <IconButton color="error" onClick={() => handleDeleteUser(user.id, user.userName)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog 
                open={openDialog} 
                onClose={() => {
                    setOpenDialog(false);
                    setShowPassword(false);
                }} 
                fullWidth 
                maxWidth="xs"
            >
                <DialogTitle>{t('staff.newEmployee')}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField 
                            label={t('staff.login')} 
                            fullWidth 
                            value={userName} 
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setUserName(e.target.value)} 
                        />
                        <TextField 
                            label={t('staff.password')} 
                            type={showPassword ? 'text' : 'password'} 
                            fullWidth 
                            value={password} 
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} 
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label={t('auth.togglePassword')}
                                            onClick={() => setShowPassword(prev => !prev)}
                                            onMouseDown={(e) => e.preventDefault()}
                                            edge="end"
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <FormControl fullWidth>
                            <InputLabel>{t('staff.role')}</InputLabel>
                            <Select
                                value={role}
                                label={t('staff.role')}
                                onChange={(e: SelectChangeEvent<string>) => setRole(e.target.value)}
                            >
                                <MenuItem value="Admin">{t('roles.admin')}</MenuItem>
                                <MenuItem value="Manager">{t('roles.manager')}</MenuItem>
                                <MenuItem value="WarehouseWorker">{t('roles.worker')}</MenuItem>
                                <MenuItem value="User">{t('roles.user')}</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>{t('common.cancel')}</Button>
                    <Button variant="contained" onClick={handleCreateUser}>{t('common.add')}</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}