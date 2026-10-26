import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material';

// Іконки
import NotificationsIcon from '@mui/icons-material/Notifications';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { useSignalR } from '../context/SignalRContext';
import { useLanguage } from '../context/LanguageContext';
import { notificationApi, type TelegramStatus } from '../api/notificationApi';

interface NotificationCenterProps {
  onNavigate?: (view: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const {
    notifications,
    unreadCount,
    soundEnabled,
    setSoundEnabled,
    browserPushEnabled,
    requestBrowserPushPermission,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    loadActiveAlerts
  } = useSignalR();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'lowStock'>('all');

  // Стан діалогу Telegram
  const [telegramDialogOpen, setTelegramDialogOpen] = useState<boolean>(false);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [botToken, setBotToken] = useState<string>('');
  const [chatId, setChatId] = useState<string>('');
  const [tgEnabled, setTgEnabled] = useState<boolean>(false);
  const [notifyLowStock, setNotifyLowStock] = useState<boolean>(true);
  const [tgLoading, setTgLoading] = useState<boolean>(false);
  const [testSending, setTestSending] = useState<boolean>(false);
  const [tgFeedback, setTgFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  // Фільтрація сповіщень
  const filteredNotifications = notifications.filter(n => {
    if (filterTab === 'unread') return !n.read;
    if (filterTab === 'lowStock') return n.type === 'lowStock' || n.severity === 'warning' || n.severity === 'error';
    return true;
  });

  // Завантаження статусу Telegram при відкритті модалки
  const handleOpenTelegramDialog = async () => {
    setTelegramDialogOpen(true);
    setTgFeedback(null);
    setTgLoading(true);
    try {
      const status = await notificationApi.getTelegramStatus();
      setTelegramStatus(status);
      setBotToken(status.botToken || '');
      setChatId(status.chatId || '');
      setTgEnabled(status.isEnabled);
      setNotifyLowStock(status.notifyOnLowStock);
    } catch {
      setTgFeedback({ type: 'error', message: 'Не вдалося отримати статус Telegram' });
    } finally {
      setTgLoading(false);
    }
  };

  const handleSaveTelegram = async () => {
    setTgLoading(true);
    setTgFeedback(null);
    try {
      await notificationApi.updateTelegramConfig({
        botToken,
        chatId,
        enabled: tgEnabled,
        notifyOnLowStock: notifyLowStock
      });
      setTgFeedback({ type: 'success', message: 'Налаштування Telegram успішно збережено!' });
      const status = await notificationApi.getTelegramStatus();
      setTelegramStatus(status);
    } catch {
      setTgFeedback({ type: 'error', message: 'Помилка збереження конфігурації Telegram' });
    } finally {
      setTgLoading(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestSending(true);
    setTgFeedback(null);
    try {
      const res = await notificationApi.testTelegram();
      setTgFeedback({ type: 'success', message: res.message });
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Помилка надсилання тестового сповіщення';
      setTgFeedback({ type: 'error', message: errorMsg });
    } finally {
      setTestSending(false);
    }
  };

  const formatTimestamp = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Щойно';
      if (diffMins < 60) return `${diffMins} хв тому`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} год тому`;
      return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <ErrorOutlineIcon color="error" />;
      case 'warning':
        return <WarningAmberIcon color="warning" />;
      case 'success':
        return <CheckCircleOutlineIcon color="success" />;
      default:
        return <InfoOutlinedIcon color="info" />;
    }
  };

  return (
    <>
      <Tooltip title={t('notifications.title') || 'Сповіщення та алерти'}>
        <IconButton
          color="inherit"
          onClick={handleOpen}
          sx={{ mx: 0.5 }}
          aria-label="notifications"
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: { xs: 320, sm: 420 },
            maxHeight: 580,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
            borderRadius: 2
          }
        }}
      >
        {/* Шапка панелі сповіщень */}
        <Box sx={{ p: 2, pb: 1, backgroundColor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {t('notifications.title') || 'Сповіщення'}
              </Typography>
              {unreadCount > 0 && (
                <Chip 
                  label={`${unreadCount} нових`} 
                  color="error" 
                  size="small" 
                  sx={{ height: 20, fontSize: '0.75rem', fontWeight: 600 }}
                />
              )}
            </Box>

            {/* Швидкі налаштування */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/* Перемикач звуку */}
              <Tooltip title={soundEnabled ? 'Вимкнути звук' : 'Увімкнути звук'}>
                <IconButton 
                  size="small" 
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  color={soundEnabled ? 'primary' : 'default'}
                >
                  {soundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                </IconButton>
              </Tooltip>

              {/* Браузерні Push сповіщення */}
              <Tooltip title={browserPushEnabled ? 'Браузерні push активні' : 'Увімкнути push сповіщення в браузері'}>
                <IconButton 
                  size="small" 
                  onClick={() => requestBrowserPushPermission()}
                  color={browserPushEnabled ? 'success' : 'default'}
                >
                  {browserPushEnabled ? <NotificationsActiveIcon fontSize="small" /> : <NotificationsNoneIcon fontSize="small" />}
                </IconButton>
              </Tooltip>

              {/* Telegram-бот */}
              <Tooltip title="Налаштування Telegram-бота">
                <IconButton 
                  size="small" 
                  onClick={handleOpenTelegramDialog}
                  color={telegramStatus?.isEnabled ? 'info' : 'default'}
                >
                  <TelegramIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {/* Оновити актуальні дефіцити */}
              <Tooltip title="Оновити дефіцити">
                <IconButton size="small" onClick={() => loadActiveAlerts()}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Вкладки фільтрації */}
          <Tabs
            value={filterTab}
            onChange={(_, val) => setFilterTab(val)}
            variant="fullWidth"
            sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8rem', textTransform: 'none' } }}
          >
            <Tab value="all" label={`Всі (${notifications.length})`} />
            <Tab value="unread" label={`Непрочитані (${unreadCount})`} />
            <Tab value="lowStock" label="Дефіцити ⚠️" />
          </Tabs>
        </Box>

        <Divider />

        {/* Список сповіщень */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
          {filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <NotificationsNoneIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography variant="body2">
                {filterTab === 'unread' ? 'Усі сповіщення прочитано' : 'Немає активних сповіщень'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredNotifications.map((notif) => (
                <ListItem
                  key={notif.id}
                  alignItems="flex-start"
                  onClick={() => markAsRead(notif.id)}
                  sx={{
                    px: 2,
                    py: 1.2,
                    cursor: 'pointer',
                    backgroundColor: notif.read ? 'transparent' : 'action.hover',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    transition: 'background-color 0.2s',
                    '&:hover': {
                      backgroundColor: 'action.selected'
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                    {getSeverityIcon(notif.severity)}
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            fontWeight: notif.read ? 600 : 700,
                            fontSize: '0.875rem',
                            color: notif.severity === 'error' ? 'error.main' : 'text.primary'
                          }}
                        >
                          {notif.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1, whiteSpace: 'nowrap' }}>
                          {formatTimestamp(notif.timestamp)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.primary', lineHeight: 1.3 }}>
                          {notif.message}
                        </Typography>

                        {/* Кнопки переходу для дефіцитів */}
                        {notif.type === 'lowStock' && onNavigate && (
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<ArrowForwardIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notif.id);
                                handleClose();
                                onNavigate('intelligence');
                              }}
                              sx={{ py: 0.2, px: 1, fontSize: '0.75rem', textTransform: 'none' }}
                            >
                              Радар закупівель
                            </Button>
                          </Box>
                        )}
                      </Box>
                    }
                  />

                  {/* Крапка непрочитаного */}
                  {!notif.read && (
                    <Box 
                      sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        bgcolor: 'primary.main', 
                        ml: 1, 
                        mt: 1,
                        flexShrink: 0 
                      }} 
                    />
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        <Divider />

        {/* Футер дій */}
        <Box sx={{ p: 1, px: 2, display: 'flex', justifyContent: 'space-between', backgroundColor: 'background.paper' }}>
          <Button
            size="small"
            startIcon={<DoneAllIcon />}
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            Позначити всі як прочитані
          </Button>

          <Button
            size="small"
            color="inherit"
            startIcon={<DeleteSweepIcon />}
            onClick={() => clearNotifications()}
            disabled={notifications.length === 0}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            Очистити
          </Button>
        </Box>
      </Popover>

      {/* Діалог налаштування Telegram-бота */}
      <Dialog 
        open={telegramDialogOpen} 
        onClose={() => setTelegramDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TelegramIcon color="primary" />
          Налаштування сповіщень у Telegram
        </DialogTitle>

        <DialogContent dividers>
          {tgFeedback && (
            <Alert severity={tgFeedback.type} sx={{ mb: 2 }}>
              {tgFeedback.message}
            </Alert>
          )}

          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Підключіть Telegram-бота для миттєвого отримання сигналів про виникнення дефіциту («ТЕРМІНОВО», «КРИТИЧНО») на складі.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={tgEnabled}
                  onChange={(e) => setTgEnabled(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography sx={{ fontWeight: 600 }}>
                  Увімкнути сповіщення в Telegram
                </Typography>
              }
            />

            <FormControlLabel
              control={
                <Switch
                  checked={notifyLowStock}
                  onChange={(e) => setNotifyLowStock(e.target.checked)}
                  color="warning"
                />
              }
              label="Надсилати попередження при критичному залишку (Quantity &le; MinStock)"
            />

            <TextField
              label="Telegram Bot Token"
              variant="outlined"
              fullWidth
              size="small"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz..."
              helperText="Отримайте у @BotFather"
            />

            <TextField
              label="Chat ID / ID користувача або групи"
              variant="outlined"
              fullWidth
              size="small"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="123456789 або -1001234567890"
              helperText="Ваш ID або ID групи (можна дізнатись у @userinfobot)"
            />

            {/* Інструкція з налаштування */}
            <Accordion variant="outlined" sx={{ mt: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  📖 Інструкція: як створити бота за 2 хвилини
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  <li>Відкрийте Telegram та знайдіть офіційного бота <b>@BotFather</b>.</li>
                  <li>Надішліть команду <code>/newbot</code> та задайте ім'я боту (наприклад, <i>MyWarehouseAlertBot</i>).</li>
                  <li>Скопіюйте згенерований <b>HTTP API Token</b> та вставте його у поле вище.</li>
                  <li>Знайдіть створеного бота в Telegram і натисніть <b>/start</b>.</li>
                  <li>Дізнайтеся свій <b>Chat ID</b> у боті <b>@userinfobot</b> і вставте його у відповідне поле.</li>
                  <li>Натисніть «Тестове сповіщення» для перевірки!</li>
                </ol>
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            variant="outlined" 
            color="info"
            startIcon={testSending ? <CircularProgress size={16} /> : <SendIcon />}
            onClick={handleTestTelegram}
            disabled={!tgEnabled || !botToken || !chatId || testSending || tgLoading}
          >
            Тестове сповіщення
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Button onClick={() => setTelegramDialogOpen(false)} color="inherit">
            Закрити
          </Button>

          <Button 
            variant="contained" 
            color="primary"
            onClick={handleSaveTelegram}
            disabled={tgLoading}
          >
            {tgLoading ? <CircularProgress size={20} /> : 'Зберегти'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NotificationCenter;
