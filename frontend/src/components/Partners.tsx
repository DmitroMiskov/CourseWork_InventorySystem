import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
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
  LinearProgress,
  Tabs,
  Tab,
  Chip,
  Grid
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AssignmentIcon from '@mui/icons-material/Assignment';

import type { Partner, ServerError } from '../types/inventory';
import { downloadOrderLetterPdf } from '../utils/pdfOrderLetterGenerator';

interface PartnerFormData {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  edrpou: string;
  address: string;
  leadTimeDays: number;
  contractNumber: string;
  paymentTerms: string;
}

const DEFAULT_FORM_DATA: PartnerFormData = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  edrpou: '',
  address: '',
  leadTimeDays: 5,
  contractNumber: '',
  paymentTerms: ''
};

interface PartnersProps {
  isAdmin?: boolean;
  isManager?: boolean;
}

export default function Partners({ isAdmin = false, isManager = false }: PartnersProps) {
  const canManagePartners = isAdmin || isManager;
  const [tabIndex, setTabIndex] = useState<number>(0); // 0 = Постачальники (Suppliers), 1 = Клієнти (Customers)
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [currentPartner, setCurrentPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<PartnerFormData>(DEFAULT_FORM_DATA);

  const currentEndpoint = tabIndex === 0 ? '/suppliers' : '/customers';
  const partnerTypeLabel = tabIndex === 0 ? 'постачальника' : 'клієнта';

  const fetchPartners = useCallback(async () => {
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
  }, [currentEndpoint, tabIndex]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleTabChange = (_: SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
    setPartners([]);
  };

  const handleOpen = (partner?: Partner) => {
    if (partner) {
      setCurrentPartner(partner);
      setFormData({
        name: partner.name || '',
        contactPerson: partner.contactPerson || '',
        phone: partner.phone || '',
        email: partner.email || '',
        edrpou: partner.edrpou || '',
        address: partner.address || '',
        leadTimeDays: partner.leadTimeDays && partner.leadTimeDays > 0 ? partner.leadTimeDays : 5,
        contractNumber: partner.contractNumber || '',
        paymentTerms: partner.paymentTerms || ''
      });
    } else {
      setCurrentPartner(null);
      setFormData(DEFAULT_FORM_DATA);
    }
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setCurrentPartner(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  const handleSave = async () => {
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setError("Назва підприємства або організації є обов'язковою!");
      return;
    }

    const payload = {
      id: currentPartner?.id,
      name: trimmedName,
      contactPerson: formData.contactPerson.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      edrpou: formData.edrpou.trim(),
      address: formData.address.trim(),
      leadTimeDays: formData.leadTimeDays > 0 ? formData.leadTimeDays : 5,
      contractNumber: formData.contractNumber.trim(),
      paymentTerms: formData.paymentTerms.trim(),
      contactInfo: formData.contactPerson.trim() || formData.phone.trim()
    };

    try {
      if (currentPartner) {
        await api.put(`${currentEndpoint}/${currentPartner.id}`, payload);
        setSuccessMsg(`Дані ${partnerTypeLabel} "${trimmedName}" успішно оновлено`);
      } else {
        await api.post(currentEndpoint, payload);
        setSuccessMsg(`Нового ${partnerTypeLabel} "${trimmedName}" успішно створено`);
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

  const handleGenerateOrderLetter = async (supplier: Partner) => {
    try {
      const todayStr = new Date().toLocaleDateString('uk-UA');
      const orderNumber = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`;

      const draftText = `Вихідний № ${orderNumber} від ${todayStr}
Кому: Відділ оптових продажів ${supplier.name}
Від кого: ТОВ "Складські Системи та Логістика"
Тема: Замовлення на поповнення складських запасів згідно з ${supplier.contractNumber || 'договором постачання'}

Шановні партнери!

Просимо виставити рахунок-фактуру та погодити графік відвантаження номенклатури продукції відповідно до узгодженого терміну поставки (${supplier.leadTimeDays || 5} робочих днів).

1. Номенклатурні позиції згідно з плановим графіком поповнення запасів (Артикул: SKU-DEF-01) — 10 шт. по ціні 5,000.00 ₴ (Сума: 50,000.00 ₴)

Сукупна планова вартість поставки: 50,000.00 ₴ з ПДВ.
Бажаний термін прибуття товару на наш розподільчий склад: протягом ${supplier.leadTimeDays || 5} робочих днів.
Умови оплати: ${supplier.paymentTerms || 'безготівковий розрахунок згідно з договором'}.

З повагою,
Керівник відділу матеріально-технічного забезпечення
ТОВ "Складські Системи та Логістика"`;

      await downloadOrderLetterPdf(draftText);
      setSuccessMsg(`Офіційний лист-замовлення для "${supplier.name}" успішно сформовано у PDF!`);
    } catch (err) {
      console.error(err);
      setError('Помилка при генерації PDF листа-замовлення');
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
        <Tabs value={tabIndex} onChange={handleTabChange} aria-label="контрагенти" textColor="primary" indicatorColor="primary">
          <Tab icon={<LocalShippingIcon />} iconPosition="start" label="Постачальники продукції" />
          <Tab icon={<AssignmentIcon />} iconPosition="start" label="Клієнти / Покупці" />
        </Tabs>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            {tabIndex === 0 ? 'Реєстр постачальників' : 'База клієнтів та покупців'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tabIndex === 0
              ? 'Реквізити постачальників, логістичні плечі (Lead Time L) для розрахунків ROP/SS та договори'
              : 'Контактна інформація та адреси контрагентів для оформлення видаткових накладних М-11'}
          </Typography>
        </Box>
        {canManagePartners && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} size="medium">
            Додати {tabIndex === 0 ? 'постачальника' : 'клієнта'}
          </Button>
        )}
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Table sx={{ minWidth: tabIndex === 0 ? 850 : 600 }}>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>
                {tabIndex === 0 ? 'Постачальник / ЄДРПОУ' : 'Назва клієнта'}
              </TableCell>
              {tabIndex === 0 && <TableCell sx={{ fontWeight: 'bold' }}>Контактна особа</TableCell>}
              <TableCell sx={{ fontWeight: 'bold' }}>Контакти (Тел / Email)</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Адреса</TableCell>
              {tabIndex === 0 && (
                <>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Плече (Lead Time)</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Договір / Оплата</TableCell>
                </>
              )}
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Дії</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {partners.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={tabIndex === 0 ? 7 : 4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Записів не знайдено
                </TableCell>
              </TableRow>
            ) : (
              partners.map((partner) => (
                <TableRow key={partner.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="600">
                      {partner.name}
                    </Typography>
                    {partner.edrpou && (
                      <Chip
                        label={`ЄДРПОУ: ${partner.edrpou}`}
                        size="small"
                        sx={{ mt: 0.5, height: 20, fontSize: '0.72rem', bgcolor: 'action.selected' }}
                      />
                    )}
                  </TableCell>

                  {tabIndex === 0 && (
                    <TableCell>
                      <Typography variant="body2" fontWeight="500">
                        {partner.contactPerson || partner.contactInfo || '—'}
                      </Typography>
                    </TableCell>
                  )}

                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {partner.phone && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <PhoneIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                          <Typography
                            component="a"
                            href={`tel:${partner.phone}`}
                            variant="body2"
                            sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                          >
                            {partner.phone}
                          </Typography>
                        </Box>
                      )}
                      {partner.email && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <EmailIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                          <Typography
                            component="a"
                            href={`mailto:${partner.email}`}
                            variant="body2"
                            sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                          >
                            {partner.email}
                          </Typography>
                        </Box>
                      )}
                      {!partner.phone && !partner.email && (
                        <Typography variant="body2" color="text.secondary">
                          {partner.contactInfo || '—'}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>

                  <TableCell>
                    {partner.address ? (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                        <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.3 }} />
                        <Typography variant="body2" sx={{ maxWidth: 220 }}>
                          {partner.address}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>

                  {tabIndex === 0 && (
                    <>
                      <TableCell align="center">
                        <Chip
                          icon={<LocalShippingIcon sx={{ fontSize: '14px !important' }} />}
                          label={`${partner.leadTimeDays || 5} дн.`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ fontWeight: 'bold' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="500">
                          {partner.contractNumber || 'За разовими замовленнями'}
                        </Typography>
                        {partner.paymentTerms && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {partner.paymentTerms}
                          </Typography>
                        )}
                      </TableCell>
                    </>
                  )}

                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      {tabIndex === 0 && (
                        <Tooltip title="Сформувати офіційний лист-замовлення (PDF)">
                          <IconButton color="secondary" size="small" onClick={() => handleGenerateOrderLetter(partner)}>
                            <PictureAsPdfIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canManagePartners && (
                        <Tooltip title="Редагувати">
                          <IconButton color="primary" size="small" onClick={() => handleOpen(partner)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {isAdmin && (
                        <Tooltip title="Видалити">
                          <IconButton color="error" size="small" onClick={() => handleDelete(partner.id, partner.name)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ДІАЛОГ СТВОРЕННЯ ТА РЕДАГУВАННЯ */}
      <Dialog open={openDialog} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>
          {currentPartner ? `Редагувати ${partnerTypeLabel}` : `Створити ${partnerTypeLabel}`}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.2 }}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                autoFocus
                label="Назва підприємства / організації *"
                fullWidth
                value={formData.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Код ЄДРПОУ / ІПН"
                fullWidth
                value={formData.edrpou}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, edrpou: e.target.value }))
                }
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Контактна особа (ПІБ менеджера)"
                fullWidth
                value={formData.contactPerson}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, contactPerson: e.target.value }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Номер телефону"
                placeholder="+380..."
                fullWidth
                value={formData.phone}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Електронна пошта (Email)"
                placeholder="order@partner.ua"
                type="email"
                fullWidth
                value={formData.email}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </Grid>

            {tabIndex === 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Плече поставки (днів) — Lead Time L"
                  type="number"
                  inputProps={{ min: 1, max: 90 }}
                  fullWidth
                  value={formData.leadTimeDays}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev) => ({ ...prev, leadTimeDays: parseInt(e.target.value, 10) || 5 }))
                  }
                  helperText="Використовується для розрахунку точки ROP"
                />
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Юридична / фактична адреса"
                placeholder="м. Київ, вул. Хрещатик, 1"
                fullWidth
                value={formData.address}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
              />
            </Grid>

            {tabIndex === 0 && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Номер та дата договору"
                    placeholder="Договір № 12/25 від 01.02.2025"
                    fullWidth
                    value={formData.contractNumber}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, contractNumber: e.target.value }))
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Умови оплати"
                    placeholder="Відтермінування 14 днів"
                    fullWidth
                    value={formData.paymentTerms}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, paymentTerms: e.target.value }))
                    }
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose}>Скасувати</Button>
          <Button variant="contained" onClick={handleSave}>
            Зберегти
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}