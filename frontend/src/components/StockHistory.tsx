import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import api from '../api/axiosConfig';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  Box,
  LinearProgress,
  TablePagination,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloseIcon from '@mui/icons-material/Close';
import { downloadWaybillPdf, type WaybillData } from '../utils/pdfWaybillGenerator';
import { useLanguage } from '../context/LanguageContext';

interface StockHistoryProps {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  productName?: string;
}

interface StockMovement {
  id: string;
  productId: string;
  quantity: number;
  type?: number | string;
  movementType?: number | string;
  createdAt: string;
  reason?: string;
  note?: string;
  comment?: string;
  supplierName?: string;
  customerName?: string;
  userName?: string;
}

export default function StockHistory({
  open,
  onClose,
  productId,
  productName
}: StockHistoryProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);

  useEffect(() => {
    if (!open || !productId) return;

    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get<StockMovement[]>(`/StockMovements/by-product/${productId}`);
        setMovements(res.data);
      } catch (err: unknown) {
        console.error(err);
        setError(t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, productId, t]);

  const isIncoming = (item: StockMovement): boolean => {
    const val = item.movementType ?? item.type;
    return val === 1 || val === '1' || val === 'Incoming' || val === 'In';
  };

  const handleDownloadHistoryPdf = async (item: StockMovement) => {
    const isInc = isIncoming(item);
    const dateStr = item.createdAt
      ? new Date(item.createdAt).toISOString().slice(0, 10).replace(/-/g, '')
      : '2026';
    const idShort = item.id ? item.id.replace(/-/g, '').slice(0, 4).toUpperCase() : '0001';
    const docPrefix = isInc ? 'PN' : 'VN';
    const data: WaybillData = {
      documentNumber: `${docPrefix}-${dateStr}-${idShort}`,
      date: item.createdAt || new Date(),
      customer: item.customerName
        ? { name: item.customerName }
        : item.supplierName
        ? { name: item.supplierName }
        : null,
      reason:
        item.reason ||
        item.note ||
        (isInc ? t('operations.receipt') : t('operations.writeOff')),
      storekeeperName: item.userName || 'Storekeeper',
      items: [
        {
          name: productName || t('intelligence.productName'),
          unit: t('common.pcs'),
          quantity: item.quantity,
          price: 0
        }
      ]
    };
    try {
      await downloadWaybillPdf(data);
    } catch (err) {
      console.error(err);
      setError(t('copilot.pdfError'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ m: 0, p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
            {t('history.title')}: {productName || t('intelligence.productName')}
          </Typography>
          {isMobile && (
            <IconButton onClick={onClose} size="small" edge="end">
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 1, sm: 2 } }}>
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Table size="small" sx={{ minWidth: 550 }}>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>{t('history.operationDate')}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{t('history.operationType')}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{t('history.quantity')}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{t('history.partner')}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{t('history.reasonNote')}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>{t('history.downloadPdf')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    {t('history.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                movements
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((item) => {
                    const inc = isIncoming(item);
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(item.createdAt).toLocaleString([], {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={inc ? t('operations.receipt') : t('operations.writeOff')}
                            color={inc ? 'success' : 'warning'}
                            size="small"
                            variant="filled"
                            sx={{ fontWeight: 'bold' }}
                          />
                        </TableCell>

                        <TableCell sx={{ fontWeight: 'bold', color: inc ? 'success.main' : 'warning.main' }}>
                          {inc ? `+${item.quantity}` : `-${item.quantity}`}
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2">
                            {item.customerName || item.supplierName || '—'}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {item.reason || item.note || item.comment || '—'}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Tooltip title={t('operations.generateWaybill')}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleDownloadHistoryPdf(item)}
                            >
                              <PictureAsPdfIcon fontSize="small" />
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
          rowsPerPageOptions={[5, 10, 20]}
          component="div"
          count={movements.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined">
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}