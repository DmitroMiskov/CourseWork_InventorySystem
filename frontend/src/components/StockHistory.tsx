import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Dialog, DialogTitle, DialogContent, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, 
  CircularProgress, Chip, Typography, Button, DialogActions 
} from '@mui/material';

interface StockMovement {
  id: string;
  type: number;
  quantity: number;
  movementDate: string;
  note: string;
}

interface StockHistoryProps {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  productName?: string;
}

export default function StockHistory({ open, onClose, productId, productName }: StockHistoryProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  
  // 👇 1. ВИПРАВЛЕННЯ: Починаємо з loading = true
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Якщо ID є, робимо запит
    if (productId) {
      // ❌ setLoading(true) ТУТ БІЛЬШЕ НЕМАЄ (це прибирає помилку ESLint)
      
      axios.get(`/api/stockmovements/product/${productId}`)
        .then(res => {
          setMovements(res.data);
        })
        .catch(err => {
          console.error(err);
        })
        .finally(() => {
          setLoading(false); // 👇 Тільки вимикаємо в кінці
        });
    }
  }, [productId]); // Залежимо тільки від ID

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Історія руху: <b>{productName || 'Товар'}</b>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <CircularProgress sx={{ display: 'block', mx: 'auto', my: 2 }} />
        ) : movements.length === 0 ? (
          <Typography align="center" color="text.secondary">
            Історія порожня
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><b>Дата</b></TableCell>
                  <TableCell><b>Тип</b></TableCell>
                  <TableCell align="right"><b>Кількість</b></TableCell>
                  <TableCell><b>Примітка</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movements.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {new Date(row.movementDate).toLocaleString('uk-UA')}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={row.type === 1 ? "Прихід" : "Розхід"} 
                        color={row.type === 1 ? "success" : "error"} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ 
                        color: row.type === 1 ? 'green' : 'red', 
                        fontWeight: 'bold' 
                    }}>
                      {row.type === 1 ? '+' : '-'}{row.quantity}
                    </TableCell>
                    <TableCell>{row.note || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрити</Button>
      </DialogActions>
    </Dialog>
  );
}