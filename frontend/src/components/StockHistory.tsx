import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Dialog, DialogTitle, DialogContent, 
  Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Typography, Chip 
} from '@mui/material';

interface StockMovement {
  id: string;
  movementDate: string;
  type: number; // 1 = In, 2 = Out
  quantity: number;
  note?: string;
}

interface StockHistoryProps {
  productId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function StockHistory({ productId, open, onClose }: StockHistoryProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    if (productId && open) {
      axios.get(`/api/stockmovements/product/${productId}`)
        .then(res => setMovements(res.data))
        .catch(err => console.error(err));
    }
  }, [productId, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Історія руху товару</DialogTitle>
      <DialogContent>
        {movements.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: 'center' }}>Історія порожня</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Дата</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell align="right">Кількість</TableCell>
                  <TableCell>Примітка</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(m.movementDate).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip 
                        label={m.type === 1 ? "Надходження" : "Відвантаження"} 
                        color={m.type === 1 ? "success" : "warning"} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {m.type === 1 ? '+' : '-'}{m.quantity}
                    </TableCell>
                    <TableCell>{m.note || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}