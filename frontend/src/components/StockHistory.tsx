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

interface StockHistoryProps {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  productName?: string;
}

// movementType: 1 = Вхід/Прихід (In), 2 = Вихід/Розхід (Out)
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
        setError('Не вдалося завантажити історію операцій для цього товару');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, productId]);

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
    const docPrefix = isInc ? 'ПН' : 'ВН';
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
        (isInc ? 'Оприбуткування товару на склад' : 'Видача матеріальних цінностей зі складу'),
      storekeeperName: item.userName || 'Адміністратор складу',
      items: [
        {
          name: productName || 'Товар',
          unit: 'шт',
          quantity: item.quantity,
          price: 0
        }
      ]
    };
    try {
      await downloadWaybillPdf(data);
    } catch (err) {
      console.error(err);
      setError('Не вдалося сформувати PDF накладну');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ m: 0, p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
            Історія руху: {productName || 'Товар'}
          </Typography>
          {isMobile && (
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{ color: (theme) => theme.palette.grey[500] }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <TableContainer component={Paper} elevation={1} sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Table size="small" sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Дата</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Тип операції</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Кількість</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Контрагент</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Причина / Коментар</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>PDF</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Записів про рух товару не знайдено
                  </TableCell>
                </TableRow>
              ) : (
                movements
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((item) => {
                    const incoming = isIncoming(item);
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          {new Date(item.createdAt).toLocaleString('uk-UA', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={incoming ? 'Прихід' : 'Розхід / Списання'}
                            color={incoming ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: incoming ? 'green' : 'error.main' }}>
                          {incoming ? `+${item.quantity}` : `-${item.quantity}`}
                        </TableCell>
                        <TableCell>
                          {item.supplierName || item.customerName || '—'}
                        </TableCell>
                        <TableCell>
                          {item.reason || item.note || item.comment || '—'}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Завантажити накладну (PDF)">
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
          onPageChange={(_, newPage: number) => setPage(newPage)}
          onRowsPerPageChange={(e: ChangeEvent<HTMLInputElement>) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Закрити
        </Button>
      </DialogActions>
    </Dialog>
  );
}