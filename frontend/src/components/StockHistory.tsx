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
  TablePagination
} from '@mui/material';

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
}

export default function StockHistory({
  open,
  onClose,
  productId,
  productName
}: StockHistoryProps) {
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold">
            Історія руху: {productName || 'Товар'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <TableContainer component={Paper} elevation={1}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Дата</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Тип операції</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Кількість</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Контрагент</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Причина / Коментар</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
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