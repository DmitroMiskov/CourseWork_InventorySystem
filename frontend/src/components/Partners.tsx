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
import { useLanguage } from '../context/LanguageContext';

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
  const { t } = useLanguage();
  const canManagePartners = isAdmin || isManager;
  const [tabIndex, setTabIndex] = useState<number>(0); // 0 = Suppliers, 1 = Customers
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [currentPartner, setCurrentPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<PartnerFormData>(DEFAULT_FORM_DATA);

  const currentEndpoint = tabIndex === 0 ? '/suppliers' : '/customers';

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Partner[]>(currentEndpoint);
      setPartners(res.data);
    } catch (err: unknown) {
      console.error(err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [currentEndpoint, t]);

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
      setError(t('products.enterName'));
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
        setSuccessMsg(t('common.success'));
      } else {
        await api.post(currentEndpoint, payload);
        setSuccessMsg(t('common.success'));
      }
      handleClose();
      await fetchPartners();
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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`${t('common.confirmDelete')} "${name}"?`)) return;

    try {
      await api.delete(`${currentEndpoint}/${id}`);
      setSuccessMsg(t('common.success'));
      await fetchPartners();
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

  const handleGenerateOrderLetter = async (supplier: Partner) => {
    try {
      const todayStr = new Date().toLocaleDateString();
      const orderNumber = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`;

      const draftText = `Вихідний № ${orderNumber} від ${todayStr}
Кому: ${supplier.name}
Від кого: Складська служба
Тема: Замовлення на поповнення складських запасів згідно з ${supplier.contractNumber || 'договором'}

Просимо виставити рахунок-фактуру та погодити графік відвантаження продукції відповідно до узгодженого терміну поставки (${supplier.leadTimeDays || 5} робочих днів).

1. Номенклатурні позиції згідно з графіком поповнення: 10 шт.
Бажаний термін прибуття на склад: протягом ${supplier.leadTimeDays || 5} робочих днів.
Умови оплати: ${supplier.paymentTerms || 'згідно з договором'}.`;

      await downloadOrderLetterPdf(draftText);
      setSuccessMsg(t('copilot.pdfSuccess'));
    } catch (err) {
      console.error(err);
      setError(t('copilot.pdfError'));
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
        <Tabs value={tabIndex} onChange={handleTabChange} textColor="primary" indicatorColor="primary">
          <Tab icon={<LocalShippingIcon />} iconPosition="start" label={t('partners.suppliers')} />
          <Tab icon={<AssignmentIcon />} iconPosition="start" label={t('partners.customers')} />
        </Tabs>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" fontWeight="bold">
          {tabIndex === 0 ? t('partners.suppliersTitle') : t('partners.customersTitle')}
        </Typography>
        {canManagePartners && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} size="medium">
            {tabIndex === 0 ? t('partners.addSupplier') : t('partners.addCustomer')}
          </Button>
        )}
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Table sx={{ minWidth: tabIndex === 0 ? 850 : 600 }}>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>
                {tabIndex === 0 ? `${t('partners.suppliers')} / ${t('partners.edrpou')}` : t('partners.name')}
              </TableCell>
              {tabIndex === 0 && <TableCell sx={{ fontWeight: 'bold' }}>{t('partners.contactPerson')}</TableCell>}
              <TableCell sx={{ fontWeight: 'bold' }}>{t('partners.contacts')}</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>{t('partners.address')}</TableCell>
              {tabIndex === 0 && (
                <>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>{t('partners.leadTime')}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{t('partners.contract')}</TableCell>
                </>
              )}
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {partners.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={tabIndex === 0 ? 7 : 4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {t('partners.notFound')}
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
                        label={`${t('partners.edrpou')}: ${partner.edrpou}`}
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
                          label={`${partner.leadTimeDays || 5} ${t('common.days')}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ fontWeight: 'bold' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="500">
                          {partner.contractNumber || t('partners.onDemand')}
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
                        <Tooltip title={t('partners.generatePdf')}>
                          <IconButton color="secondary" size="small" onClick={() => handleGenerateOrderLetter(partner)}>
                            <PictureAsPdfIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canManagePartners && (
                        <Tooltip title={t('common.edit')}>
                          <IconButton color="primary" size="small" onClick={() => handleOpen(partner)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {isAdmin && (
                        <Tooltip title={t('common.delete')}>
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
          {currentPartner
            ? (tabIndex === 0 ? t('partners.editSupplier') : t('partners.editCustomer'))
            : (tabIndex === 0 ? t('partners.addSupplier') : t('partners.addCustomer'))}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.2 }}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                autoFocus
                label={`${t('partners.name')} *`}
                fullWidth
                value={formData.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label={t('partners.edrpou')}
                fullWidth
                value={formData.edrpou}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, edrpou: e.target.value }))
                }
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t('partners.contactPerson')}
                fullWidth
                value={formData.contactPerson}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, contactPerson: e.target.value }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t('partners.phone')}
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
                label={t('partners.email')}
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
                  label={t('partners.leadTimeDays')}
                  type="number"
                  inputProps={{ min: 1, max: 90 }}
                  fullWidth
                  value={formData.leadTimeDays}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev) => ({ ...prev, leadTimeDays: parseInt(e.target.value, 10) || 5 }))
                  }
                />
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <TextField
                label={t('partners.address')}
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
                    label={t('partners.contractNumber')}
                    fullWidth
                    value={formData.contractNumber}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, contractNumber: e.target.value }))
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={t('partners.paymentTerms')}
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
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}