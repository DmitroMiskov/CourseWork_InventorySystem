import { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Button, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    TextField, LinearProgress, Typography, Box
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { AxiosError } from 'axios';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AZURE_API_URL = "https://inventory-api-miskov-dtcyece6dme4hme8.polandcentral-01.azurewebsites.net";

interface Product {
    id: string;
    name: string;
    quantity: number; 
    price: number;
    unit: string;
}

// Інтерфейс помилки
interface ServerErrorResponse {
    title?: string;
    status?: number;
    errors?: Record<string, string[]>;
    message?: string;
}

interface IssuanceModalProps {
    open: boolean;
    onClose: () => void;
    selectedProducts: Product[];
    onSuccess: () => void;
}

export default function IssuanceModal({ open, onClose, selectedProducts, onSuccess }: IssuanceModalProps) {
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [isGenerating, setIsGenerating] = useState(false);

    const getAuthConfig = () => {
        const token = localStorage.getItem('token');
        return {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };
    };

    const handleQuantityChange = (id: string, val: string) => {
        const num = parseInt(val) || 0;
        setQuantities(prev => ({ ...prev, [id]: num }));
    };

    const handleIssue = async () => {
        const itemsToIssue = selectedProducts.filter(p => (quantities[p.id] || 0) > 0);

        if (itemsToIssue.length === 0) {
            alert("Вкажіть кількість хоча б для одного товару");
            return;
        }

        setIsGenerating(true);

        try {
            // Відправляємо запити на створення руху.
            // Бекенд сам спише кількість, якщо контролер оновлено.
            const requests = itemsToIssue.map(p => {
                const payload = {
                    ProductId: p.id,
                    Type: 2, // 👇 ВАЖЛИВО: 2 = Out (Розхід) за вашим Enum
                    Quantity: quantities[p.id],
                    Reason: "Видача по накладній",
                    CustomerId: null 
                };
                return axios.post(`${AZURE_API_URL}/api/stockmovements`, payload, getAuthConfig());
            });

            await Promise.all(requests);

            alert("Успішно списано! Формуємо накладну...");
            await generatePDF(); 
            
            onSuccess();   
            onClose();     
        } catch (error) {
            console.error(error);
            const axiosError = error as AxiosError<ServerErrorResponse | string>;
            const data = axiosError.response?.data;
            let msg = "Помилка списання";

            if (data) {
                if (typeof data === 'string') {
                    msg = data;
                } else if (typeof data === 'object') {
                    if (data.title) msg = data.title;
                    else if (data.message) msg = data.message;
                }
            }
            
            alert(`Помилка: ${msg}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const generatePDF = () => {
        try {
            const doc = new jsPDF();
            doc.setFont("helvetica", "normal"); 

            doc.setFontSize(18);
            doc.text("Receipt (Nakladna)", 14, 22);
            
            doc.setFontSize(11);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);

            const tableData = selectedProducts
                .filter(p => (quantities[p.id] || 0) > 0)
                .map((p, index) => [
                    index + 1,
                    p.name, 
                    `${quantities[p.id]} ${p.unit}`,
                    `${p.price}`,
                    `${(p.price * quantities[p.id]).toFixed(2)}`
                ]);

            autoTable(doc, {
                head: [['#', 'Item', 'Qty', 'Price', 'Sum']],
                body: tableData,
                startY: 40,
                headStyles: { fillColor: [41, 128, 185] }
            });

            const totalSum = selectedProducts.reduce((acc, p) => acc + (p.price * (quantities[p.id] || 0)), 0);
            
            // @ts-expect-error: jspdf-autotable adds this property
            const finalY = doc.lastAutoTable.finalY || 50;
            
            doc.text(`Total: ${totalSum.toFixed(2)} UAH`, 14, finalY + 10);
            doc.text("Signature: _________________", 14, finalY + 20);

            doc.save("issue_receipt.pdf");

        } catch (error) {
            console.error("PDF Error:", error);
            alert("Помилка генерації PDF");
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Оформлення видачі (Кошик)</DialogTitle>
            <DialogContent>
                {isGenerating && (
                    <Box sx={{ width: '100%', mb: 2 }}>
                        <Typography variant="caption">Обробка списання та друк...</Typography>
                        <LinearProgress />
                    </Box>
                )}

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Назва</TableCell>
                                <TableCell>На складі</TableCell>
                                <TableCell width="150">До видачі</TableCell>
                                <TableCell>Одиниця</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {selectedProducts.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell>{p.name}</TableCell>
                                    <TableCell>{p.quantity}</TableCell>
                                    <TableCell>
                                        <TextField 
                                            type="number" 
                                            size="small" 
                                            value={quantities[p.id] || ''}
                                            onChange={(e) => handleQuantityChange(p.id, e.target.value)}
                                            error={(quantities[p.id] || 0) > p.quantity} 
                                        />
                                    </TableCell>
                                    <TableCell>{p.unit}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isGenerating}>Скасувати</Button>
                <Button 
                    onClick={handleIssue} 
                    variant="contained" 
                    color="success" 
                    startIcon={<PrintIcon />}
                    disabled={isGenerating}
                >
                    {isGenerating ? "Списати та Друк" : "Списати та Друк"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}