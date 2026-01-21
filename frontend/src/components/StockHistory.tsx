import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Dialog, DialogTitle, DialogContent, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, 
  CircularProgress, Chip, Typography, Button, DialogActions, Box 
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';

interface HistoryRecord {
  id: string;
  change: number;
  stockAfter: string | number; // 👇 Змінено, бо бекенд може слати "---"
  note: string;
  userName: string;
  createdAt: string;
}

interface StockHistoryProps {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  productName?: string;
}

export default function StockHistory({ open, onClose, productId, productName }: StockHistoryProps) {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const AZURE_API_URL = "https://inventory-api-miskov-dtcyece6dme4hme8.polandcentral-01.azurewebsites.net";

  useEffect(() => {
    if (!productId || !open) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        // 👇👇👇 ВИПРАВЛЕНО URL АДРЕСУ 👇👇👇
        // Було: /api/products/${productId}/history
        // Стало: /api/stockmovements/product/${productId}
        const res = await axios.get<HistoryRecord[]>(
          `${AZURE_API_URL}/api/stockmovements/product/${productId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        setHistory(res.data);
      } catch (err) {
        console.error("Помилка завантаження історії:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory(); 

  }, [productId, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        📜 Історія руху: <b>{productName || 'Товар'}</b>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <CircularProgress sx={{ display: 'block', mx: 'auto', my: 2 }} />
        ) : history.length === 0 ? (
          <Typography align="center" color="text.secondary" sx={{ py: 3 }}>
            Історія операцій порожня
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell><b>Дата / Час</b></TableCell>
                  <TableCell><b>Користувач</b></TableCell>
                  <TableCell align="center"><b>Зміна</b></TableCell>
                  <TableCell align="center"><b>Залишок</b></TableCell>
                  <TableCell><b>Примітка</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      {new Date(row.createdAt).toLocaleString('uk-UA', { 
                        day: '2-digit', month: '2-digit', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                      })}
                    </TableCell>
                    
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2">{row.userName || 'Система'}</Typography>
                      </Box>
                    </TableCell>

                    <TableCell align="center">
                      <Chip 
                        label={row.change > 0 ? `+${row.change}` : row.change} 
                        color={row.change > 0 ? "success" : "error"} 
                        size="small" 
                        variant="filled"
                        sx={{ fontWeight: 'bold', minWidth: 50 }}
                      />
                    </TableCell>

                    <TableCell align="center" sx={{ color: 'text.secondary' }}>
                      {/* Відображаємо StockAfter, навіть якщо це рядок "---" */}
                      {row.stockAfter}
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