import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box, Paper, Tabs, Tab, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, LinearProgress
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

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

  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '', contactPerson: ''
  });

  const endpoint = tabIndex === 0 ? '/api/suppliers' : '/api/customers';
  const entityName = tabIndex === 0 ? 'Постачальник' : 'Клієнт';

  // 👇 FIX 1: Wrapped in useCallback to make it a stable dependency
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<Partner[]>(endpoint);
      setData(res.data);
    } catch (err) {
      console.error(err);
      alert('Помилка завантаження даних');
    } finally {
      setLoading(false);
    }
  }, [endpoint]); // Re-creates function only when endpoint changes

  // 👇 FIX 1 (Continued): Added fetchData to the dependency array
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Видалити ${entityName}а?`)) return;
    try {
      await axios.delete(`${endpoint}/${id}`);
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
        alert("Редагування поки не налаштовано на сервері, видаліть і створіть заново.");
      } else {
        await axios.post(endpoint, formData);
      }
      setOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Помилка збереження');
    }
  };

  return (
    <Paper sx={{ width: '100%', mb: 2 }}>
      <Tabs
        value={tabIndex}
        // 👇 FIX 2: Removed unused 'e' parameter (replaced with _)
        onChange={(_, val) => setTabIndex(val)}
        indicatorColor="primary"
        textColor="primary"
        centered
      >
        <Tab icon={<LocalShippingIcon />} label="Постачальники" />
        <Tab icon={<PersonIcon />} label="Клієнти" />
      </Tabs>

      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f9f9f9' }}>
        <Typography variant="h6">{entityName}и</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Додати {entityName}а
        </Button>
      </Box>

      {loading && <LinearProgress />}

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Назва / ПІБ</TableCell>
              <TableCell>Телефон</TableCell>
              <TableCell>Email</TableCell>
              {tabIndex === 0 && <TableCell>Контактна особа</TableCell>}
              {tabIndex === 1 && <TableCell>Адреса</TableCell>}
              <TableCell align="right">Дії</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
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
               <TableRow><TableCell colSpan={5} align="center">Список порожній</TableCell></TableRow>
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