import { useState, useEffect } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import axios from 'axios';
import api from '../api/axiosConfig';
import { Box, Button, TextField, Typography,
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
  LinearProgress,
  Tabs,
  Tab
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

interface Partner {
  id: string;
  name: string;
  contactInfo?: string;
}

interface PartnerFormData {
  name: string;
  contactInfo: string;
}

interface ServerError {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
}

export default function Partners() {
  const [tabIndex, setTabIndex] = useState<number>(0); // 0 = Постачальники (Suppliers), 1 = Клієнти (Customers)
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [currentPartner, setCurrentPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<PartnerFormData>({ name: '', contactInfo: '' });

  const currentEndpoint = tabIndex === 0 ? '/suppliers' : '/customers';
  const partnerTypeLabel = tabIndex === 0 ? 'постачальника' : 'клієнта';

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const res = await api.get<Partner[]>(currentEndpoint);
      setPartners(res.data);
    } catch (err: unknown) {
      console.error(err);
      setError(`Не вдалося завантажити список ${tabIndex === 0 ? 'постачальників' : 'клієнтів'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, [tabIndex]);

  const handleTabChange = (_: SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
    setPartners([]);
  };

  const handleOpen = (partner?: Partner) => {
    if (partner) {
      setCurrentPartner(partner);
      setFormData({
        name: partner.name,
        contactInfo: partner.contactInfo || ''
      });
    } else {
      setCurrentPartner(null);
      setFormData({ name: '', contactInfo: '' });
    }
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setCurrentPartner(null);
    setFormData({ name: '', contactInfo: '' });
  };

  const handleSave = async () => {
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setError("Назва або ПІБ є обов'язковими");
      return;
    }

    const payload = {
      id: currentPartner?.id,
      name: trimmedName,
      contactInfo: formData.contactInfo.trim()
    };

    try {
      if (currentPartner) {
        await api.put(`${currentEndpoint}/${currentPartner.id}`, payload);
        setSuccessMsg(`Дані ${partnerTypeLabel} успішно оновлено`);
      } else {
        await api.post(currentEndpoint, payload);
        setSuccessMsg(`Нового ${partnerTypeLabel} успішно створено`);
      }
      handleClose();
      await fetchPartners();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError>(err)) {
        const msg = err.response?.data?.title || 'Помилка збереження';
        setError(`Сервер: ${msg}`);
      } else {
        setError('Непередбачена помилка збереження');
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Ви дійсно бажаєте видалити ${partnerTypeLabel} "${name}"?`)) return;

    try {
      await api.delete(`${currentEndpoint}/${id}`);
      setSuccessMsg(`Успішно видалено: "${name}"`);
      await fetchPartners();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError<ServerError>(err)) {
        const msg = err.response?.data?.title || 'Не вдалося видалити запис';
        setError(`Помилка: ${msg}`);
      } else {
        setError('Помилка при видаленні');
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

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabIndex} onChange={handleTabChange} aria-label="контрагенти">
          <Tab label="Постачальники" />
          <Tab label="Клієнти / Отримувачі" />
        </Tabs>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          {tabIndex === 0 ? 'Постачальники' : 'Клієнти'}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Додати {tabIndex === 0 ? 'постачальника' : 'клієнта'}
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper} elevation={1}>
        <Table>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Назва / ПІБ</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Контактна інформація</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Дії</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {partners.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  Записів не знайдено
                </TableCell>
              </TableRow>
            ) : (
              partners.map((partner) => (
                <TableRow key={partner.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="500">
                      {partner.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {partner.contactInfo || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Редагувати">
                      <IconButton color="primary" onClick={() => handleOpen(partner)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Видалити">
                      <IconButton color="error" onClick={() => handleDelete(partner.id, partner.name)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>
          {currentPartner ? `Редагувати ${partnerTypeLabel}` : `Створити ${partnerTypeLabel}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              autoFocus
              label="Назва / ПІБ"
              fullWidth
              value={formData.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <TextField
              label="Контактна інформація (телефон, email, адреса)"
              fullWidth
              multiline
              rows={3}
              value={formData.contactInfo}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setFormData((prev) => ({ ...prev, contactInfo: e.target.value }))
              }
            />
          </Box>
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