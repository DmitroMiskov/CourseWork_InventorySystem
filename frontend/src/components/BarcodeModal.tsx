import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, FormControl, InputLabel, Select, MenuItem,
  TextField, FormControlLabel, Switch, Paper, Divider, Chip,
  IconButton, Tooltip, Stack, Alert
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import type { Product } from '../types/inventory';
import { useLanguage } from '../context/LanguageContext';
import {
  generateBarcodeDataUrl,
  generateQrCodeDataUrl,
  buildProductQrPayload,
  printLabelsInBrowser,
  downloadBarcodePdfSheet,
  type BarcodeFormat,
  type LabelSize,
  type LabelOptions
} from '../utils/pdfBarcodeGenerator';

interface BarcodeModalProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
}

export default function BarcodeModal({ open, onClose, products }: BarcodeModalProps) {
  const { t } = useLanguage();

  const [format, setFormat] = useState<BarcodeFormat>('COMBINED');
  const [size, setSize] = useState<LabelSize>('standard');
  const [copies, setCopies] = useState<number>(1);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showCategory, setShowCategory] = useState<boolean>(true);
  const [showDate, setShowDate] = useState<boolean>(true);

  // Live preview states
  const [previewBarcodeUrl, setPreviewBarcodeUrl] = useState<string>('');
  const [previewQrUrl, setPreviewQrUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  // Головний товар для попереднього перегляду
  const previewProduct = products[0] || null;

  useEffect(() => {
    if (!previewProduct || !open) return;

    const updatePreview = async () => {
      try {
        const skuValue = previewProduct.sku && previewProduct.sku.trim() !== ''
          ? previewProduct.sku
          : `SKU-${previewProduct.id.slice(0, 8).toUpperCase()}`;

        const barcode = generateBarcodeDataUrl(skuValue, 45);
        setPreviewBarcodeUrl(barcode);

        const qr = await generateQrCodeDataUrl(buildProductQrPayload(previewProduct), 140);
        setPreviewQrUrl(qr);
        setErrorMsg(null);
      } catch (err) {
        console.error('Failed to generate preview:', err);
        setErrorMsg('Помилка генерації коду');
      }
    };

    updatePreview();
  }, [previewProduct, open, format]);

  if (!previewProduct) return null;

  const currentOptions: LabelOptions = {
    format,
    size,
    copies: Math.max(1, Math.min(100, copies)),
    showPrice,
    showCategory,
    showDate,
    showSku: true
  };

  const handlePrint = async () => {
    try {
      setIsGenerating(true);
      await printLabelsInBrowser(products, currentOptions);
    } catch (err) {
      console.error(err);
      setErrorMsg('Помилка відкриття вікна друку');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsGenerating(true);
      await downloadBarcodePdfSheet(products, currentOptions);
    } catch (err) {
      console.error(err);
      setErrorMsg('Помилка створення PDF файлу');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadSingleImage = () => {
    if (!previewBarcodeUrl) return;
    const link = document.createElement('a');
    link.href = format === 'QR' ? previewQrUrl : previewBarcodeUrl;
    link.download = `${previewProduct.sku || 'barcode'}_${format.toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalLabels = products.length * copies;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCode2Icon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            {t('barcode.title') || 'Друк штрихкодів та етикеток'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
        {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

        {products.length > 1 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('barcode.batchPrint')?.replace('{{count}}', products.length.toString()) || 
              `Обрано товарів для друку: ${products.length} шт. (Усього етикеток буде надруковано: ${totalLabels})`}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {/* Ліва колонка: Налаштування етикетки */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
              Параметри етикетки
            </Typography>

            <FormControl size="small" fullWidth>
              <InputLabel>{t('barcode.format') || 'Формат коду'}</InputLabel>
              <Select
                value={format}
                label={t('barcode.format') || 'Формат коду'}
                onChange={(e) => setFormat(e.target.value as BarcodeFormat)}
              >
                <MenuItem value="COMBINED">{t('barcode.combined') || 'Комбінована (Штрихкод + QR)'}</MenuItem>
                <MenuItem value="CODE128">{t('barcode.barcodeCode128') || 'Штрихкод (Code 128)'}</MenuItem>
                <MenuItem value="QR">{t('barcode.qrCode') || 'QR-код'}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>{t('barcode.labelSize') || 'Розмір етикетки'}</InputLabel>
              <Select
                value={size}
                label={t('barcode.labelSize') || 'Розмір етикетки'}
                onChange={(e) => setSize(e.target.value as LabelSize)}
              >
                <MenuItem value="standard">{t('barcode.sizeStandard') || '58 x 40 мм (Термопринтер)'}</MenuItem>
                <MenuItem value="large">{t('barcode.sizeLarge') || '80 x 50 мм (Велика)'}</MenuItem>
                <MenuItem value="compact">{t('barcode.sizeSmall') || '40 x 25 мм (Компактна)'}</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={t('barcode.copies') || 'Кількість копій (на кожен товар)'}
              type="number"
              size="small"
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              inputProps={{ min: 1, max: 100 }}
              fullWidth
            />

            <Divider />

            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
              Вміст етикетки
            </Typography>

            <Stack spacing={1}>
              <FormControlLabel
                control={<Switch checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} size="small" />}
                label={t('barcode.showPrice') || 'Показувати ціну'}
              />
              <FormControlLabel
                control={<Switch checked={showCategory} onChange={(e) => setShowCategory(e.target.checked)} size="small" />}
                label={t('barcode.showCategory') || 'Показувати категорію'}
              />
              <FormControlLabel
                control={<Switch checked={showDate} onChange={(e) => setShowDate(e.target.checked)} size="small" />}
                label={t('barcode.showDate') || 'Показувати дату'}
              />
            </Stack>
          </Box>

          {/* Права колонка: Інтерактивний Live Preview етикетки */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ alignSelf: 'flex-start', mb: 1 }}>
              {t('barcode.preview') || 'Попередній перегляд етикетки'}
            </Typography>

            {/* Карточка етикетки */}
            <Paper
              ref={previewRef}
              elevation={3}
              sx={{
                width: size === 'large' ? '280px' : size === 'compact' ? '200px' : '240px',
                minHeight: size === 'large' ? '180px' : size === 'compact' ? '120px' : '155px',
                p: 1.5,
                bgcolor: '#ffffff',
                color: '#111111',
                borderRadius: 1.5,
                border: '1px solid #e0e0e0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {/* Верхній рядок: назва та ціна */}
              <Box sx={{ borderBottom: '1px solid #eaeaea', pb: 0.5, mb: 0.5 }}>
                <Typography variant="body2" fontWeight="bold" sx={{ color: '#000', fontSize: size === 'compact' ? '11px' : '13px', lineHeight: 1.2 }}>
                  {previewProduct.name}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.3 }}>
                  {showCategory && (
                    <Typography variant="caption" sx={{ color: '#555', fontSize: '10px' }}>
                      {previewProduct.category?.name || 'Без категорії'}
                    </Typography>
                  )}
                  {showPrice && (
                    <Typography variant="body2" fontWeight="800" sx={{ color: '#000', ml: 'auto', fontSize: '12px' }}>
                      {previewProduct.price.toFixed(2)} грн/{previewProduct.unit}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Зона коду */}
              <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', my: 0.5 }}>
                {format === 'CODE128' && previewBarcodeUrl && (
                  <img
                    src={previewBarcodeUrl}
                    alt="Barcode"
                    style={{ maxWidth: '100%', maxHeight: size === 'compact' ? '60px' : '85px', objectFit: 'contain' }}
                  />
                )}

                {format === 'QR' && previewQrUrl && (
                  <img
                    src={previewQrUrl}
                    alt="QR Code"
                    style={{ maxWidth: size === 'compact' ? '70px' : '95px', maxHeight: size === 'compact' ? '70px' : '95px', objectFit: 'contain' }}
                  />
                )}

                {format === 'COMBINED' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                    {previewBarcodeUrl && (
                      <img
                        src={previewBarcodeUrl}
                        alt="Barcode"
                        style={{ maxWidth: '65%', maxHeight: size === 'compact' ? '50px' : '75px', objectFit: 'contain' }}
                      />
                    )}
                    {previewQrUrl && (
                      <img
                        src={previewQrUrl}
                        alt="QR Code"
                        style={{ maxWidth: '30%', maxHeight: size === 'compact' ? '50px' : '65px', objectFit: 'contain' }}
                      />
                    )}
                  </Box>
                )}
              </Box>

              {/* Нижній рядок: артикул та дата */}
              <Box sx={{ borderTop: '1px solid #eaeaea', pt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#666', fontSize: '9px', fontWeight: 'bold' }}>
                  SKU: {previewProduct.sku || previewProduct.id.slice(0, 8).toUpperCase()}
                </Typography>
                {showDate && (
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '9px' }}>
                    {new Date().toLocaleDateString('uk-UA')}
                  </Typography>
                )}
              </Box>
            </Paper>

            <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
              <Chip
                label={`Розмір: ${size === 'large' ? '80x50 мм' : size === 'compact' ? '40x25 мм' : '58x40 мм'}`}
                size="small"
                variant="outlined"
              />
              <Tooltip title={t('barcode.downloadPng') || 'Завантажити зображення'}>
                <IconButton size="small" onClick={handleDownloadSingleImage} color="primary">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} color="inherit">
          {t('common.close')}
        </Button>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleDownloadPdf}
            disabled={isGenerating}
          >
            {t('barcode.downloadPdf') || 'Експорт в PDF'}
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            disabled={isGenerating}
          >
            {t('barcode.printNow') || 'Друкувати'} ({totalLabels})
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
