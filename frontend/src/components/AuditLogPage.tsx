import { useState, useEffect, useCallback } from 'react';
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
  TablePagination,
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
  Stack
} from '@mui/material';

// Іконки
import HistoryIcon from '@mui/icons-material/History';
import TodayIcon from '@mui/icons-material/Today';
import DateRangeIcon from '@mui/icons-material/DateRange';
import PersonIcon from '@mui/icons-material/Person';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { useLanguage } from '../context/LanguageContext';
import { auditLogApi } from '../api/auditLogApi';
import type { AuditLogItem, AuditStats } from '../api/auditLogApi';

export default function AuditLogPage() {
  const { t } = useLanguage();

  // Дані журналу
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [stats, setStats] = useState<AuditStats | null>(null);

  // Стан завантаження
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Пагінація
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);

  // Фільтри
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Модальне вікно деталей
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);

  // Завантаження статистики
  const loadStats = useCallback(async () => {
    try {
      const data = await auditLogApi.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load audit stats', err);
    }
  }, []);

  // Завантаження логів
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await auditLogApi.getLogs({
        page: page + 1,
        pageSize: rowsPerPage,
        search: search.trim() || undefined,
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        fromDate: fromDate ? `${fromDate}T00:00:00Z` : undefined,
        toDate: toDate ? `${toDate}T23:59:59Z` : undefined
      });
      setLogs(res.items);
      setTotalCount(res.totalCount);
    } catch (err: any) {
      console.error('Failed to load audit logs', err);
      setErrorMessage(err?.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, actionFilter, entityFilter, fromDate, toDate, t]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Скидання фільтрів
  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('');
    setEntityFilter('');
    setFromDate('');
    setToDate('');
    setPage(0);
  };

  // Експорт CSV
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await auditLogApi.downloadCsv({
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        fromDate: fromDate ? `${fromDate}T00:00:00Z` : undefined,
        toDate: toDate ? `${toDate}T23:59:59Z` : undefined
      });
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  // Форматування дати
  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  // Колір та іконка для дії
  const getActionBadge = (action: string) => {
    const act = (action || '').toLowerCase();
    switch (act) {
      case 'create':
        return {
          color: 'success' as const,
          icon: <AddCircleOutlineIcon sx={{ fontSize: 16 }} />,
          label: t('auditLog.actions.create')
        };
      case 'update':
        return {
          color: 'info' as const,
          icon: <EditOutlinedIcon sx={{ fontSize: 16 }} />,
          label: t('auditLog.actions.update')
        };
      case 'delete':
        return {
          color: 'error' as const,
          icon: <DeleteOutlineIcon sx={{ fontSize: 16 }} />,
          label: t('auditLog.actions.delete')
        };
      case 'stockoperation':
        return {
          color: 'warning' as const,
          icon: <SwapHorizIcon sx={{ fontSize: 16 }} />,
          label: t('auditLog.actions.stockOperation')
        };
      case 'import':
        return {
          color: 'secondary' as const,
          icon: <CloudUploadIcon sx={{ fontSize: 16 }} />,
          label: t('auditLog.actions.import')
        };
      default:
        return {
          color: 'default' as const,
          icon: <HistoryIcon sx={{ fontSize: 16 }} />,
          label: action
        };
    }
  };

  // Локалізація сутності
  const getEntityLabel = (entityType: string) => {
    const key = (entityType || '').toLowerCase();
    switch (key) {
      case 'product':
        return t('auditLog.entities.product');
      case 'stockmovement':
        return t('auditLog.entities.stockMovement');
      case 'category':
        return t('auditLog.entities.category');
      case 'partner':
        return t('auditLog.entities.partner');
      case 'user':
        return t('auditLog.entities.user');
      default:
        return entityType;
    }
  };

  // Безпечний рендер JSON
  const formatJson = (jsonString?: string | null) => {
    if (!jsonString) return null;
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  };

  return (
    <Box sx={{ width: '100%', pb: 6 }}>
      {/* Заголовок та кнопка експорту */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon color="primary" /> {t('auditLog.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('auditLog.subtitle')}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              loadLogs();
              loadStats();
            }}
            disabled={loading}
          >
            {t('auditLog.refresh')}
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : <FileDownloadIcon />}
            onClick={handleExportCsv}
            disabled={exporting || loading}
          >
            {t('auditLog.exportCsv')}
          </Button>
        </Stack>
      </Box>

      {/* KPI картки аналітики */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={1} sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'primary.main' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('auditLog.totalLogs')}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats?.totalLogs ?? '...'}
                  </Typography>
                </Box>
                <HistoryIcon color="primary" sx={{ fontSize: 36, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={1} sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'success.main' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('auditLog.todayLogs')}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {stats?.todayLogs ?? '...'}
                  </Typography>
                </Box>
                <TodayIcon color="success" sx={{ fontSize: 36, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={1} sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'info.main' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('auditLog.weekLogs')}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                    {stats?.weekLogs ?? '...'}
                  </Typography>
                </Box>
                <DateRangeIcon color="info" sx={{ fontSize: 36, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={1} sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'secondary.main' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('auditLog.topUsers')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {stats?.topUsers && stats.topUsers.length > 0 ? (
                    stats.topUsers.slice(0, 3).map((u) => (
                      <Chip
                        key={u.userName}
                        icon={<PersonIcon sx={{ fontSize: 14 }} />}
                        label={`${u.userName} (${u.actionsCount})`}
                        size="small"
                        variant="outlined"
                      />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.disabled">—</Typography>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Панель фільтрів */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 3.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('auditLog.searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              select
              fullWidth
              size="small"
              label={t('auditLog.filterAction')}
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value=""><em>{t('auditLog.allActions')}</em></MenuItem>
              <MenuItem value="Create">{t('auditLog.actions.create')}</MenuItem>
              <MenuItem value="Update">{t('auditLog.actions.update')}</MenuItem>
              <MenuItem value="Delete">{t('auditLog.actions.delete')}</MenuItem>
              <MenuItem value="StockOperation">{t('auditLog.actions.stockOperation')}</MenuItem>
              <MenuItem value="Import">{t('auditLog.actions.import')}</MenuItem>
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              select
              fullWidth
              size="small"
              label={t('auditLog.filterEntity')}
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value=""><em>{t('auditLog.allEntities')}</em></MenuItem>
              <MenuItem value="Product">{t('auditLog.entities.product')}</MenuItem>
              <MenuItem value="StockMovement">{t('auditLog.entities.stockMovement')}</MenuItem>
              <MenuItem value="Category">{t('auditLog.entities.category')}</MenuItem>
              <MenuItem value="Partner">{t('auditLog.entities.partner')}</MenuItem>
              <MenuItem value="User">{t('auditLog.entities.user')}</MenuItem>
            </TextField>
          </Grid>

          <Grid size={{ xs: 6, sm: 3, md: 1.75 }}>
            <TextField
              fullWidth
              size="small"
              label={t('auditLog.fromDate')}
              type="date"
              InputLabelProps={{ shrink: true }}
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 3, md: 1.75 }}>
            <TextField
              fullWidth
              size="small"
              label={t('auditLog.toDate')}
              type="date"
              InputLabelProps={{ shrink: true }}
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 1 }}>
            <Tooltip title={t('auditLog.resetFilters')}>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                onClick={handleResetFilters}
                sx={{ minWidth: 40, height: 40 }}
              >
                <FilterAltOffIcon />
              </Button>
            </Tooltip>
          </Grid>
        </Grid>
      </Paper>

      {/* Повідомлення про помилку */}
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {/* Таблиця журналу аудиту */}
      <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 650 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: 170 }}>{t('auditLog.colTime')}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140 }}>{t('auditLog.colUser')}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 150 }}>{t('auditLog.colAction')}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 130 }}>{t('auditLog.colEntity')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('auditLog.colName')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('auditLog.colDetails')}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 120 }}>{t('auditLog.colIp')}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, width: 80 }}>{t('auditLog.viewDetails')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={36} />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {t('auditLog.noLogs')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const badge = getActionBadge(log.action);

                  return (
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                        {formatDateTime(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<PersonIcon sx={{ fontSize: 14 }} />}
                          label={log.userName || 'system'}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={badge.icon}
                          label={badge.label}
                          color={badge.color}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {getEntityLabel(log.entityType)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {log.entityName || '—'}
                        </Typography>
                        {log.entityId && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            ID: {log.entityId.slice(0, 8)}...
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography variant="body2" noWrap title={log.details || ''} color="text.secondary">
                          {log.details || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {log.ipAddress || '—'}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={t('auditLog.viewDetails')}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              setSelectedLog(log);
                              setDetailsOpen(true);
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage={t('auditLog.rowsPerPage')}
        />
      </Paper>

      {/* Діалогове вікно деталей події */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t('auditLog.detailsTitle')}
            </Typography>
          </Box>
          {selectedLog && (
            <Chip
              {...getActionBadge(selectedLog.action)}
              size="small"
            />
          )}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          {selectedLog && (
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('auditLog.timestamp')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {formatDateTime(selectedLog.timestamp)}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('auditLog.operator')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {selectedLog.userName}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('auditLog.colEntity')} & ID
                  </Typography>
                  <Typography variant="body1">
                    {getEntityLabel(selectedLog.entityType)}{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      ({selectedLog.entityId || 'N/A'})
                    </Typography>
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('auditLog.colIp')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                    {selectedLog.ipAddress || '—'}
                  </Typography>
                </Grid>
              </Grid>

              {/* Деталі / опис */}
              {selectedLog.details && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('auditLog.colDetails')}
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: 'action.hover' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedLog.details}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {/* Порівняння OldValues vs NewValues */}
              {(selectedLog.oldValues || selectedLog.newValues) && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    {t('auditLog.changesComparison')}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                        {t('auditLog.oldValue')}
                      </Typography>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          mt: 0.5,
                          bgcolor: 'background.default',
                          maxHeight: 220,
                          overflow: 'auto',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          borderLeft: 3,
                          borderColor: 'error.main'
                        }}
                      >
                        <Box component="pre" sx={{ m: 0 }}>
                          {formatJson(selectedLog.oldValues) || '—'}
                        </Box>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                        {t('auditLog.newValue')}
                      </Typography>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          mt: 0.5,
                          bgcolor: 'background.default',
                          maxHeight: 220,
                          overflow: 'auto',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          borderLeft: 3,
                          borderColor: 'success.main'
                        }}
                      >
                        <Box component="pre" sx={{ m: 0 }}>
                          {formatJson(selectedLog.newValues) || '—'}
                        </Box>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDetailsOpen(false)} variant="outlined">
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
