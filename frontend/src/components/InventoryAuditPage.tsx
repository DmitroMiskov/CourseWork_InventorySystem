import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  LinearProgress,
  FormControlLabel,
  Switch
} from '@mui/material';

// Іконки
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SearchIcon from '@mui/icons-material/Search';

import { useLanguage } from '../context/LanguageContext';
import api from '../api/axiosConfig';
import {
  inventoryAuditApi,
  InventoryAuditStatus
} from '../api/inventoryAuditApi';
import type {
  InventoryAuditSummary,
  InventoryAuditDetail,
  UpdateItemQuantityInput
} from '../api/inventoryAuditApi';

interface CategoryOption {
  id: string;
  name: string;
}

interface InventoryAuditPageProps {
  isAdmin?: boolean;
  isManager?: boolean;
}

export default function InventoryAuditPage({ isAdmin = false, isManager = false }: InventoryAuditPageProps) {
  const { t } = useLanguage();
  const canManage = isAdmin || isManager;

  // Список аудиторських документів
  const [audits, setAudits] = useState<InventoryAuditSummary[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [auditDetail, setAuditDetail] = useState<InventoryAuditDetail | null>(null);

  // Стан завантаження
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Категорії для вибору в модалці створення
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Модальне вікно створення
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategoryId, setNewCategoryId] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  // Підтвердження завершення / скасування
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState<boolean>(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState<boolean>(false);

  // Локальні зміни фактичних кількостей у поточному переобліку (ItemId -> actualQty)
  const [localQuantities, setLocalQuantities] = useState<Record<string, number | null>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Фільтри у робочому місці підрахунку
  const [searchItem, setSearchItem] = useState<string>('');
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState<boolean>(false);

  // Завантаження категорій
  useEffect(() => {
    api.get<CategoryOption[]>('/categories')
      .then(res => setCategories(res.data))
      .catch(err => console.error('Failed to load categories', err));
  }, []);

  // Завантаження списку документів
  const loadAudits = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await inventoryAuditApi.getAudits();
      setAudits(data);
    } catch (err: any) {
      console.error('Failed to load audits', err);
      setNotification({ type: 'error', message: err?.response?.data || t('common.error') });
    } finally {
      setLoadingList(false);
    }
  }, [t]);

  useEffect(() => {
    loadAudits();
  }, [loadAudits]);

  // Завантаження деталей конкретного переобліку
  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const detail = await inventoryAuditApi.getAuditById(id);
      setAuditDetail(detail);

      // Ініціалізація локальних значень кількостей
      const initMap: Record<string, number | null> = {};
      detail.items.forEach(i => {
        initMap[i.id] = i.actualQuantity ?? null;
      });
      setLocalQuantities(initMap);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      console.error('Failed to load audit detail', err);
      setNotification({ type: 'error', message: err?.response?.data || t('common.error') });
    } finally {
      setLoadingDetail(false);
    }
  }, [t]);

  const handleOpenAudit = (id: string) => {
    setSelectedAuditId(id);
    loadDetail(id);
  };

  const handleBackToList = () => {
    setSelectedAuditId(null);
    setAuditDetail(null);
    setLocalQuantities({});
    setHasUnsavedChanges(false);
    loadAudits();
  };

  // Створення нового переобліку
  const handleCreateSubmit = async () => {
    if (!newTitle.trim()) return;
    setActionInProgress(true);
    try {
      const created = await inventoryAuditApi.createAudit({
        title: newTitle.trim(),
        categoryId: newCategoryId || undefined,
        notes: newNotes.trim() || undefined
      });
      setCreateOpen(false);
      setNewTitle('');
      setNewCategoryId('');
      setNewNotes('');
      setNotification({ type: 'success', message: `Документ ${created.auditNumber} успішно створено!` });
      // Відкриваємо одразу створений документ
      handleOpenAudit(created.id);
    } catch (err: any) {
      console.error('Failed to create audit', err);
      setNotification({ type: 'error', message: err?.response?.data || t('common.error') });
    } finally {
      setActionInProgress(false);
    }
  };

  // Зміна кількості в інпуті
  const handleQuantityChange = (itemId: string, value: string) => {
    if (value === '') {
      setLocalQuantities(prev => ({ ...prev, [itemId]: null }));
    } else {
      const parsed = parseInt(value, 10);
      setLocalQuantities(prev => ({ ...prev, [itemId]: isNaN(parsed) ? 0 : Math.max(0, parsed) }));
    }
    setHasUnsavedChanges(true);
  };

  // Швидке встановлення "Факт = Облік" для одного товару
  const handleQuickMatchItem = (itemId: string, expected: number) => {
    setLocalQuantities(prev => ({ ...prev, [itemId]: expected }));
    setHasUnsavedChanges(true);
  };

  // Збереження введених фактів
  const handleSaveCounts = async () => {
    if (!selectedAuditId || !auditDetail) return;
    setActionInProgress(true);
    try {
      const updates: UpdateItemQuantityInput[] = Object.entries(localQuantities).map(([itemId, actualQuantity]) => ({
        itemId,
        actualQuantity
      }));
      const updated = await inventoryAuditApi.updateItems(selectedAuditId, updates);
      setAuditDetail(updated);
      setHasUnsavedChanges(false);
      setNotification({ type: 'success', message: t('inventoryAudit.savedSuccess') });
    } catch (err: any) {
      console.error('Failed to save counts', err);
      setNotification({ type: 'error', message: err?.response?.data || t('common.error') });
    } finally {
      setActionInProgress(false);
    }
  };

  // Автоматичне прирівняння залишків для всіх непорахованих товарів
  const handleMatchAllRemaining = async () => {
    if (!selectedAuditId) return;
    setActionInProgress(true);
    try {
      const updated = await inventoryAuditApi.matchAllRemaining(selectedAuditId);
      setAuditDetail(updated);
      const newMap: Record<string, number | null> = {};
      updated.items.forEach(i => {
        newMap[i.id] = i.actualQuantity ?? null;
      });
      setLocalQuantities(newMap);
      setHasUnsavedChanges(false);
      setNotification({ type: 'success', message: 'Всі незаповнені позиції прирівняно до облікових залишків!' });
    } catch (err: any) {
      console.error('Failed to match remaining', err);
      setNotification({ type: 'error', message: err?.response?.data || t('common.error') });
    } finally {
      setActionInProgress(false);
    }
  };

  // Проведення інвентаризації
  const handleCompleteAudit = async () => {
    if (!selectedAuditId) return;
    // Якщо були незбережені зміни, спочатку зберігаємо їх
    setActionInProgress(true);
    try {
      if (hasUnsavedChanges) {
        const updates: UpdateItemQuantityInput[] = Object.entries(localQuantities).map(([itemId, actualQuantity]) => ({
          itemId,
          actualQuantity
        }));
        await inventoryAuditApi.updateItems(selectedAuditId, updates);
      }

      const res = await inventoryAuditApi.completeAudit(selectedAuditId);
      setConfirmCompleteOpen(false);
      setNotification({ type: 'success', message: res.message || t('inventoryAudit.completedSuccess') });
      await loadDetail(selectedAuditId);
    } catch (err: any) {
      console.error('Failed to complete audit', err);
      setNotification({ type: 'error', message: err?.response?.data || t('common.error') });
    } finally {
      setActionInProgress(false);
    }
  };

  // Скасування інвентаризації
  const handleCancelAudit = async () => {
    if (!selectedAuditId) return;
    setActionInProgress(true);
    try {
      await inventoryAuditApi.cancelAudit(selectedAuditId);
      setConfirmCancelOpen(false);
      setNotification({ type: 'success', message: 'Інвентаризацію успішно скасовано' });
      await loadDetail(selectedAuditId);
    } catch (err: any) {
      console.error('Failed to cancel audit', err);
      setNotification({ type: 'error', message: err?.response?.data || t('common.error') });
    } finally {
      setActionInProgress(false);
    }
  };

  // Експорт CSV
  const handleExportCsv = async (id: string, auditNumber: string) => {
    try {
      await inventoryAuditApi.downloadActCsv(id, auditNumber);
    } catch (err) {
      console.error('Failed to export CSV', err);
      setNotification({ type: 'error', message: 'Помилка експорту CSV' });
    }
  };

  // Статус бейджа
  const getStatusBadge = (status: InventoryAuditStatus) => {
    switch (status) {
      case InventoryAuditStatus.Completed:
        return { label: t('inventoryAudit.statuses.completed'), color: 'success' as const };
      case InventoryAuditStatus.InProgress:
        return { label: t('inventoryAudit.statuses.inProgress'), color: 'warning' as const };
      case InventoryAuditStatus.Cancelled:
        return { label: t('inventoryAudit.statuses.cancelled'), color: 'error' as const };
      default:
        return { label: t('inventoryAudit.statuses.draft'), color: 'default' as const };
    }
  };

  // Фільтрація списку товарів у робочому місці переобліку
  const filteredItems = useMemo(() => {
    if (!auditDetail?.items) return [];
    let items = auditDetail.items;

    if (searchItem.trim()) {
      const q = searchItem.toLowerCase().trim();
      items = items.filter(i =>
        i.productName.toLowerCase().includes(q) ||
        i.productSKU.toLowerCase().includes(q)
      );
    }

    if (onlyDiscrepancies) {
      items = items.filter(i => {
        const actual = localQuantities[i.id];
        if (actual === null || actual === undefined) return false;
        return actual !== i.expectedQuantity;
      });
    }

    return items;
  }, [auditDetail?.items, searchItem, onlyDiscrepancies, localQuantities]);

  const isEditable = auditDetail &&
    auditDetail.status !== InventoryAuditStatus.Completed &&
    auditDetail.status !== InventoryAuditStatus.Cancelled;

  return (
    <Box sx={{ width: '100%', pb: 6 }}>
      {/* Спливаюче повідомлення */}
      {notification && (
        <Alert
          severity={notification.type}
          onClose={() => setNotification(null)}
          sx={{ mb: 2 }}
        >
          {notification.message}
        </Alert>
      )}

      {/* ========================================================================= */}
      {/* 1. РЕЖИМ СПИСКУ ДОКУМЕНТІВ ІНВЕНТАРИЗАЦІЇ                                */}
      {/* ========================================================================= */}
      {!selectedAuditId ? (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FactCheckIcon color="primary" /> {t('inventoryAudit.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('inventoryAudit.subtitle')}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadAudits}
                disabled={loadingList}
              >
                {t('common.refresh')}
              </Button>

              {canManage && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateOpen(true)}
                >
                  {t('inventoryAudit.newAudit')}
                </Button>
              )}
            </Stack>
          </Box>

          {loadingList ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : audits.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
              <FactCheckIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
              <Typography variant="h6" color="text.secondary">
                {t('inventoryAudit.noAudits')}
              </Typography>
              {canManage && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                  onClick={() => setCreateOpen(true)}
                >
                  {t('inventoryAudit.newAudit')}
                </Button>
              )}
            </Paper>
          ) : (
            <Grid container spacing={2.5}>
              {audits.map(audit => {
                const statusBadge = getStatusBadge(audit.status);
                const progressPercent = audit.totalItemsCount > 0
                  ? Math.round((audit.checkedItemsCount / audit.totalItemsCount) * 100)
                  : 0;

                return (
                  <Grid size={{ xs: 12, md: 6, lg: 4 }} key={audit.id}>
                    <Card elevation={1} sx={{ borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {audit.auditNumber}
                          </Typography>
                          <Chip label={statusBadge.label} color={statusBadge.color} size="small" sx={{ fontWeight: 600 }} />
                        </Box>

                        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {audit.title}
                        </Typography>

                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                          {t('inventoryAudit.date')}: {new Date(audit.createdAt).toLocaleDateString()} | {audit.createdByUserName}
                          {audit.categoryName && ` • [${audit.categoryName}]`}
                        </Typography>

                        {/* Прогрес підрахунку */}
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {t('inventoryAudit.checkedPositions')}: {audit.checkedItemsCount} / {audit.totalItemsCount}
                            </Typography>
                            <Typography variant="caption" fontWeight="bold">
                              {progressPercent}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={progressPercent}
                            color={progressPercent === 100 ? 'success' : 'primary'}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>

                        {/* Зведення розходжень */}
                        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5, fontSize: '0.8125rem' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {t('inventoryAudit.discrepancyCount')}:
                            </Typography>
                            <Typography variant="caption" fontWeight="bold" color={audit.discrepancyCount > 0 ? 'warning.main' : 'text.primary'}>
                              {audit.discrepancyCount}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {t('inventoryAudit.surplus')}:
                            </Typography>
                            <Typography variant="caption" fontWeight="bold" color="success.main">
                              +{Math.round(audit.totalSurplusCost).toLocaleString()} {t('common.uah')}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">
                              {t('inventoryAudit.deficit')}:
                            </Typography>
                            <Typography variant="caption" fontWeight="bold" color="error.main">
                              -{Math.round(audit.totalDeficitCost).toLocaleString()} {t('common.uah')}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>

                      <Divider />

                      <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<PlayArrowIcon />}
                          onClick={() => handleOpenAudit(audit.id)}
                        >
                          {audit.status === InventoryAuditStatus.Completed
                            ? t('common.preview')
                            : 'Відкрити переоблік'}
                        </Button>

                        <Tooltip title={t('inventoryAudit.exportAct')}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleExportCsv(audit.id, audit.auditNumber)}
                          >
                            <FileDownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>
      ) : (
        /* ========================================================================= */
        /* 2. РОБОЧЕ МІСЦЕ ПЕРЕОБЛІКУ ТА ПІДРАХУНКУ (DETAIL VIEW)                    */
        /* ========================================================================= */
        <Box>
          {loadingDetail || !auditDetail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              {/* Шапка документа */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={handleBackToList}
                    size="small"
                  >
                    {t('inventoryAudit.backToList')}
                  </Button>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {auditDetail.auditNumber}: {auditDetail.title}
                      </Typography>
                      <Chip {...getStatusBadge(auditDetail.status)} size="small" sx={{ fontWeight: 600 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('inventoryAudit.responsible')}: {auditDetail.createdByUserName} | {new Date(auditDetail.createdAt).toLocaleString()}
                      {auditDetail.categoryName && ` • [${auditDetail.categoryName}]`}
                    </Typography>
                  </Box>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {/* Кнопка експорту CSV */}
                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    onClick={() => handleExportCsv(auditDetail.id, auditDetail.auditNumber)}
                  >
                    {t('inventoryAudit.exportAct')}
                  </Button>

                  {/* Кнопки керування активним переобліком */}
                  {isEditable && canManage && (
                    <>
                      <Tooltip title={t('inventoryAudit.matchRemainingTooltip')}>
                        <Button
                          variant="outlined"
                          color="secondary"
                          startIcon={<DoneAllIcon />}
                          onClick={handleMatchAllRemaining}
                          disabled={actionInProgress}
                        >
                          {t('inventoryAudit.matchRemaining')}
                        </Button>
                      </Tooltip>

                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={actionInProgress ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                        onClick={handleSaveCounts}
                        disabled={actionInProgress || !hasUnsavedChanges}
                      >
                        {t('inventoryAudit.saveCounts')}
                      </Button>

                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleOutlineIcon />}
                        onClick={() => setConfirmCompleteOpen(true)}
                        disabled={actionInProgress}
                      >
                        {t('inventoryAudit.completeAudit')}
                      </Button>

                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<CancelOutlinedIcon />}
                        onClick={() => setConfirmCancelOpen(true)}
                        disabled={actionInProgress}
                      >
                        {t('common.cancel')}
                      </Button>
                    </>
                  )}
                </Stack>
              </Box>

              {/* Попередження про незбережені зміни */}
              {hasUnsavedChanges && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  У вас є незбережені зміни фактичних кількостей! Натисніть «{t('inventoryAudit.saveCounts')}», щоб зафіксувати їх.
                </Alert>
              )}

              {/* Підсумкова плашка KPI */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('inventoryAudit.totalPositions')}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {auditDetail.totalItemsCount}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('inventoryAudit.checkedPositions')}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">
                      {auditDetail.checkedItemsCount}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('inventoryAudit.discrepancyCount')}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color={auditDetail.discrepancyCount > 0 ? 'warning.main' : 'text.primary'}>
                      {auditDetail.discrepancyCount}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('inventoryAudit.surplus')} (+)
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="success.main">
                      +{Math.round(auditDetail.totalSurplusCost).toLocaleString()} {t('common.uah')}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('inventoryAudit.deficit')} (-)
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="error.main">
                      -{Math.round(auditDetail.totalDeficitCost).toLocaleString()} {t('common.uah')}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('inventoryAudit.netBalance')}
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color={auditDetail.netDifferenceCost >= 0 ? 'success.main' : 'error.main'}
                    >
                      {auditDetail.netDifferenceCost > 0 ? '+' : ''}
                      {Math.round(auditDetail.netDifferenceCost).toLocaleString()} {t('common.uah')}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Панель фільтрації товарів */}
              <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={t('inventoryAudit.searchPlaceholder')}
                      value={searchItem}
                      onChange={e => setSearchItem(e.target.value)}
                      InputProps={{
                        startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={onlyDiscrepancies}
                          onChange={e => setOnlyDiscrepancies(e.target.checked)}
                          color="warning"
                        />
                      }
                      label={t('inventoryAudit.filterDiscrepancies')}
                    />
                  </Grid>
                </Grid>
              </Paper>

              {/* Таблиця товарів для підрахунку */}
              <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 650 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: 120 }}>SKU</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{t('products.name')}</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 140 }}>{t('products.category')}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, width: 110 }}>{t('inventoryAudit.unitPrice')}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, width: 110 }}>{t('inventoryAudit.expectedQuantity')}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, width: 180 }}>{t('inventoryAudit.actualQuantity')}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, width: 120 }}>{t('inventoryAudit.difference')}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, width: 130 }}>{t('inventoryAudit.diffCost')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                            <Typography color="text.secondary">
                              {t('inventoryAudit.noItemsInAudit')}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredItems.map(item => {
                          const currentActual = localQuantities[item.id];
                          const hasValue = currentActual !== null && currentActual !== undefined;
                          const diff = hasValue ? currentActual - item.expectedQuantity : null;
                          const diffCost = diff !== null ? diff * item.unitPrice : 0;

                          return (
                            <TableRow key={item.id} hover>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                {item.productSKU}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {item.productName}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {item.categoryName || '—'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                {item.unitPrice.toLocaleString()} {t('common.uah')}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {item.expectedQuantity} {item.unit}
                              </TableCell>

                              {/* Введення фактичної кількості */}
                              <TableCell align="center">
                                {isEditable ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={currentActual ?? ''}
                                      onChange={e => handleQuantityChange(item.id, e.target.value)}
                                      placeholder="—"
                                      sx={{ width: 85, '& input': { textAlign: 'center', py: 0.75, fontWeight: 700 } }}
                                      inputProps={{ min: 0 }}
                                    />
                                    <Tooltip title="Встановити факт = облік">
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        sx={{ minWidth: 28, px: 0.5, py: 0.5, fontSize: '0.75rem' }}
                                        onClick={() => handleQuickMatchItem(item.id, item.expectedQuantity)}
                                      >
                                        =
                                      </Button>
                                    </Tooltip>
                                  </Box>
                                ) : (
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {hasValue ? `${currentActual} ${item.unit}` : '—'}
                                  </Typography>
                                )}
                              </TableCell>

                              {/* Статус розбіжності */}
                              <TableCell align="center">
                                {!hasValue || diff === null ? (
                                  <Chip label={t('inventoryAudit.itemStatuses.pending')} size="small" variant="outlined" />
                                ) : diff === 0 ? (
                                  <Chip label="0" color="success" size="small" sx={{ fontWeight: 700, minWidth: 50 }} />
                                ) : diff > 0 ? (
                                  <Chip label={`+${diff}`} color="warning" size="small" sx={{ fontWeight: 700, minWidth: 50 }} />
                                ) : (
                                  <Chip label={`${diff}`} color="error" size="small" sx={{ fontWeight: 700, minWidth: 50 }} />
                                )}
                              </TableCell>

                              {/* Сума розбіжності */}
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {!hasValue || diff === null || diff === 0 ? (
                                  <Typography variant="body2" color="text.secondary">0 {t('common.uah')}</Typography>
                                ) : diff > 0 ? (
                                  <Typography variant="body2" color="success.main">
                                    +{Math.round(diffCost).toLocaleString()} {t('common.uah')}
                                  </Typography>
                                ) : (
                                  <Typography variant="body2" color="error.main">
                                    -{Math.round(Math.abs(diffCost)).toLocaleString()} {t('common.uah')}
                                  </Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </Box>
      )}

      {/* ========================================================================= */}
      {/* 3. МОДАЛЬНЕ ВІКНО СТВОРЕННЯ НОВОЇ ІНВЕНТАРИЗАЦІЇ                           */}
      {/* ========================================================================= */}
      <Dialog
        open={createOpen}
        onClose={() => !actionInProgress && setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('inventoryAudit.createModalTitle')}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label={t('inventoryAudit.auditTitleField')}
              placeholder='Наприклад: "Плановий переоблік за жовтень 2026"'
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              required
            />

            <TextField
              select
              fullWidth
              label={t('inventoryAudit.selectCategory')}
              value={newCategoryId}
              onChange={e => setNewCategoryId(e.target.value)}
            >
              <MenuItem value="">
                <em>{t('inventoryAudit.allCategories')}</em>
              </MenuItem>
              {categories.map(c => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              multiline
              rows={3}
              label={t('inventoryAudit.notesField')}
              placeholder="Додаткові інструкції або номер наказу..."
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={actionInProgress}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateSubmit}
            disabled={actionInProgress || !newTitle.trim()}
          >
            {actionInProgress ? <CircularProgress size={20} color="inherit" /> : t('inventoryAudit.startAuditBtn')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. ПІДТВЕРДЖЕННЯ ПРОВЕДЕННЯ ІНВЕНТАРИЗАЦІЇ                                */}
      {/* ========================================================================= */}
      <Dialog
        open={confirmCompleteOpen}
        onClose={() => !actionInProgress && setConfirmCompleteOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main', fontWeight: 700 }}>
          <CheckCircleOutlineIcon /> {t('inventoryAudit.completeAudit')}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {t('inventoryAudit.confirmComplete')}
          </Typography>
          {auditDetail && (
            <Paper sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="body2">
                • Всього розбіжностей: <strong>{auditDetail.discrepancyCount}</strong> товарів
              </Typography>
              <Typography variant="body2" color="success.main">
                • Оприбуткування лишків: <strong>+{Math.round(auditDetail.totalSurplusCost).toLocaleString()} {t('common.uah')}</strong>
              </Typography>
              <Typography variant="body2" color="error.main">
                • Списання нестач: <strong>-{Math.round(auditDetail.totalDeficitCost).toLocaleString()} {t('common.uah')}</strong>
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmCompleteOpen(false)} disabled={actionInProgress}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleCompleteAudit}
            disabled={actionInProgress}
          >
            {actionInProgress ? <CircularProgress size={20} color="inherit" /> : 'Підтвердити проведення'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* 5. ПІДТВЕРДЖЕННЯ СКАСУВАННЯ ІНВЕНТАРИЗАЦІЇ                                */}
      {/* ========================================================================= */}
      <Dialog
        open={confirmCancelOpen}
        onClose={() => !actionInProgress && setConfirmCancelOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main', fontWeight: 700 }}>
          {t('inventoryAudit.cancelAudit')}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            {t('inventoryAudit.confirmCancel')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmCancelOpen(false)} disabled={actionInProgress}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancelAudit}
            disabled={actionInProgress}
          >
            {actionInProgress ? <CircularProgress size={20} color="inherit" /> : 'Скасувати переоблік'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
