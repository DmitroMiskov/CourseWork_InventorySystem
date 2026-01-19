import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box, Paper, Tabs, Tab, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, LinearProgress, Alert, Snackbar
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

const AZURE_API_URL = "https://inventory-api-miskov-dtcyece6dme4hme8.polandcentral-01.azurewebsites.net";

interface Partner {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string; 
  contactPerson?: string;
}

export default function Partners() {
  const [tabIndex, setTabIndex] = useState(0);
  const [data, setData] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '', contactPerson: ''
  });

  const endpoint = tabIndex === 0 ? '/api/suppliers' : '/api/customers';
  const entityName = tabIndex === 0 ? 'Постачальник' : 'Клієнт';

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<Partner[]>(`${AZURE_API_URL}${endpoint}`, getAuthConfig());
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('Не вдалося завантажити дані');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Видалити ${entityName}а?`)) return;
    try {
      await axios.delete(`${AZURE_API_URL}${endpoint}/${id}`, getAuthConfig());
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Помилка видалення (можливо, є записи в історії, пов’язані з ним)');
    }
  };

  const handleOpen = (partner?: Partner) => {
    if (partner) {
      setCurrentId(partner.id);
      setFormData({
        name: partner.name,
        phone: partner.phone || '',
        email: partner.email || '',
        address: partner.address || '',
        contactPerson: partner.contactPerson || ''
      });
    } else {
      setCurrentId(null);
      setFormData({ name: '', phone: '', email: '', address: '', contactPerson: '' });
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return alert("Введіть назву!");

    try {
      if (currentId) {
        await axios.put(`${AZURE_API_URL}${endpoint}/${currentId}`, formData, getAuthConfig());
      } else {
        await axios.post(`${AZURE_API_URL}${endpoint}`, formData, getAuthConfig());
      }
      setOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Помилка збереження');
    }
  };

  return (
    <Paper sx={{ width: '100%', mb: 2, p: 2 }}>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
         <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
      </Snackbar>

      <Tabs
        value={tabIndex}
        onChange={(_, val) => setTabIndex(val)}
        indicatorColor="primary"
        textColor="primary"
        centered
        sx={{ mb: 2 }}
      >
        <Tab icon={<LocalShippingIcon />} label="Постачальники" />
        <Tab icon={<PersonIcon />} label="Клієнти" />
      </Tabs>

      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f9f9f9', borderRadius: 1 }}>
        <Typography variant="h6">{entityName}и</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Додати {entityName}а
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mt: 2 }} />}

      <TableContainer sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#eee' }}>
              <TableCell><b>Назва / ПІБ</b></TableCell>
              <TableCell><b>Телефон</b></TableCell>
              <TableCell><b>Email</b></TableCell>
              {tabIndex === 0 && <TableCell><b>Контактна особа</b></TableCell>}
              {tabIndex === 1 && <TableCell><b>Адреса</b></TableCell>}
              <TableCell align="right"><b>Дії</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ fontWeight: 'bold' }}>{row.name}</TableCell>
                <TableCell>{row.phone || '-'}</TableCell>
                <TableCell>{row.email || '-'}</TableCell>
                
                {tabIndex === 0 && <TableCell>{row.contactPerson || '-'}</TableCell>}
                {tabIndex === 1 && <TableCell>{row.address || '-'}</TableCell>}
                
                <TableCell align="right">
                  <IconButton color="primary" onClick={() => handleOpen(row)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleDelete(row.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && !loading && (
               <TableRow><TableCell colSpan={6} align="center">Список порожній</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{currentId ? 'Редагувати' : 'Додати'} {entityName}а</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField 
                label={tabIndex === 0 ? "Назва компанії" : "ПІБ Клієнта"} 
                fullWidth 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
            />
            <TextField 
                label="Телефон" 
                fullWidth 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
            />
            <TextField 
                label="Email" 
                fullWidth 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
            />
            
            {tabIndex === 0 ? (
                <TextField 
                    label="Контактна особа (Менеджер)" 
                    fullWidth 
                    value={formData.contactPerson} 
                    onChange={e => setFormData({...formData, contactPerson: e.target.value})} 
                />
            ) : (
                <TextField 
                    label="Адреса доставки" 
                    fullWidth 
                    value={formData.address} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Скасувати</Button>
          <Button onClick={handleSave} variant="contained">Зберегти</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}