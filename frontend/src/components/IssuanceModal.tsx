import { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Button, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    TextField, LinearProgress, Typography, Box
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import axios, { AxiosError } from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

// 👇 1. ХЕЛПЕР: Конвертує файл шрифту в рядок, зрозумілий для PDF
function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export default function IssuanceModal({ open, onClose, selectedProducts, onSuccess }: IssuanceModalProps) {
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [isGenerating, setIsGenerating] = useState(false); // Щоб показати загрузку поки качаємо шрифт

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
            await axios.post('/api/products/issue', payload);
            alert("Успішно списано!");
            
            // Запускаємо генерацію PDF
            await generatePDF(); 
            
            onSuccess();   
            onClose();     
        } catch (error) {
            const axiosError = error as AxiosError<string>;
            alert(axiosError.response?.data || "Помилка списання");
        }
    };

    const generatePDF = async () => {
        setIsGenerating(true);
        try {
            const doc = new jsPDF();

            // 👇 ТЕПЕР ШРИФТ ЗАВАНТАЖУЄТЬСЯ З ВАШОГО СЕРВЕРА (швидко і без помилок)
            const fontUrl = '/fonts/Roboto-Regular.ttf';
            
            const response = await axios.get(fontUrl, { responseType: 'arraybuffer' });
            const fontBase64 = arrayBufferToBase64(response.data);

            // Додаємо шрифт
            doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.setFont('Roboto');

            // --- МАЛЮЄМО ЧЕК ---
            doc.setFontSize(18);
            doc.text("Накладна на видачу", 14, 22);
            
            doc.setFontSize(11);
            doc.text(`Дата: ${new Date().toLocaleDateString()}`, 14, 30);

            const tableData = selectedProducts
                .filter(p => (quantities[p.id] || 0) > 0)
                .map((p, index) => [
                    index + 1,
                    p.name, 
                    `${quantities[p.id]} ${p.unit}`,
                    `${p.price} грн`,
                    `${(p.price * quantities[p.id]).toFixed(2)} грн`
                ]);

            autoTable(doc, {
                head: [['#', 'Товар', 'К-сть', 'Ціна', 'Сума']],
                body: tableData,
                startY: 40,
                styles: {
                    font: 'Roboto',     // Використовуємо наш шрифт
                    fontStyle: 'normal',
                },
                headStyles: {
                    fillColor: [41, 128, 185]
                }
            });

            const totalSum = selectedProducts.reduce((acc, p) => acc + (p.price * (quantities[p.id] || 0)), 0);
            
            // @ts-expect-error: jspdf-autotable adds this property
            const finalY = doc.lastAutoTable.finalY || 50;
            
            doc.text(`Всього до видачі: ${totalSum.toFixed(2)} грн`, 14, finalY + 10);
            doc.text("Підпис: _________________", 14, finalY + 20);

            doc.save("issue_receipt_ua.pdf");

        } catch (error) {
            console.error("PDF Error:", error);
            // Виводимо справжню помилку, щоб зрозуміти причину
            alert(`Не вдалося згенерувати PDF. Деталі: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Оформлення видачі (Кошик)</DialogTitle>
            <DialogContent>
                {/* Показуємо лоадер, якщо генеруємо PDF */}
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