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

interface IssuanceModalProps {
    open: boolean;
    onClose: () => void;
    selectedProducts: Product[];
    onSuccess: () => void;
}

// function arrayBufferToBase64(buffer: ArrayBuffer) {
//     let binary = '';
//     const bytes = new Uint8Array(buffer);
//     const len = bytes.byteLength;
//     for (let i = 0; i < len; i++) {
//         binary += String.fromCharCode(bytes[i]);
//     }
//     return window.btoa(binary);
// }

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
        const payload = selectedProducts.map(p => ({
            productId: p.id,
            quantity: quantities[p.id] || 0
        })).filter(i => i.quantity > 0);

        if (payload.length === 0) {
            alert("Вкажіть кількість хоча б для одного товару");
            return;
        }

        try {
            await axios.post(`${AZURE_API_URL}/api/products/issue`, payload, getAuthConfig());
            alert("Успішно списано!");
            
            await generatePDF(); 
            
            onSuccess();   
            onClose();     
        } catch (error) {
            const axiosError = error as AxiosError<string>;
            alert(axiosError.response?.data || "Помилка списання");
        }
    };

    const generatePDF = () => {
        setIsGenerating(true);
        try {
            const doc = new jsPDF();
            
            // 👇 ТИМЧАСОВО: Використовуємо стандартний шрифт, щоб не було помилки 404
            // (Кирилиця може не відображатися коректно, але файл створиться)
            doc.setFont("helvetica", "normal"); 

            // --- МАЛЮЄМО ЧЕК ---
            doc.setFontSize(18);
            doc.text("Receipt (Nakladna)", 14, 22); // Англійською, щоб точно працювало
            
            doc.setFontSize(11);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);

            const tableData = selectedProducts
                .filter(p => (quantities[p.id] || 0) > 0)
                .map((p, index) => [
                    index + 1,
                    p.name, // Якщо тут кирилиця, можуть бути "кракозябри" у стандартному шрифті
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
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Оформлення видачі (Кошик)</DialogTitle>
            <DialogContent>
                {isGenerating && (
                    <Box sx={{ width: '100%', mb: 2 }}>
                        <Typography variant="caption">Завантаження шрифтів та друк...</Typography>
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
                    {isGenerating ? "Друк..." : "Підтвердити"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}