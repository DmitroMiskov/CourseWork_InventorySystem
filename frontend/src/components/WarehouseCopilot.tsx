import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  TextField,
  Button,
  Chip,
  Paper,
  CircularProgress,
  Fab,
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';

// Іконки
import PsychologyIcon from '@mui/icons-material/Psychology';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import api from '../api/axiosConfig';
import type { CopilotMessage, CopilotAction, CopilotChatResponse } from '../types/inventory';

interface WarehouseCopilotProps {
  onNavigateToTab?: (tabName: 'list' | 'categories' | 'dashboard' | 'partners' | 'intelligence' | 'admin') => void;
}

const INITIAL_GREETING: CopilotMessage = {
  id: 'init-1',
  role: 'assistant',
  content: `### 👋 Вітаю! Я ваш AI-Копілот складу

Я маю доступ до **бази даних складу PostgreSQL**, математичних моделей **ML-прогнозування**, розрахунків страхового запасу ($SS, ROP, EOQ$) та матриці **ABC-XYZ**.

Чим я можу допомогти вам прямо зараз:
• 🚨 **Аудит дефіциту**: запитайте *«Що сьогодні треба замовити?»*
• 🧠 **Explainable AI (XAI)**: запитайте *«Чому статус товару RTX 4070 критичний?»*
• ✉️ **Ділові листи**: напишіть *«Склади лист постачальнику на замовлення»*
• 📊 **Матриця ABC-XYZ**: запитайте *«Які товари приносять 80% виручки?»*

Оберіть швидку підказку нижче або введіть власне запитання!`,
  model_used: 'Warehouse DSS Cognitive Engine',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  actions: [
    { label: '🚨 Що треба замовити?', action_type: 'quick_reply', payload: 'Що терміново треба замовити?' },
    { label: '🧠 Поясни статус RTX 4070', action_type: 'quick_reply', payload: 'Поясни статус товару RTX 4070' },
    { label: '✉️ Склади лист постачальнику', action_type: 'quick_reply', payload: 'Склади лист постачальнику на замовлення' },
    { label: '📊 Товари групи A (80% виручки)', action_type: 'quick_reply', payload: 'Які товари приносять 80% виручки згідно з аналізом ABC?' }
  ]
};

export const WarehouseCopilot: React.FC<WarehouseCopilotProps> = ({ onNavigateToTab }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([INITIAL_GREETING]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMsg: CopilotMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      // Формуємо історію для контексту
      const historyPayload = newMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.post<CopilotChatResponse>('/copilot/chat', {
        message: query,
        history: historyPayload
      });

      const assistantMsg: CopilotMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: res.data.reply,
        actions: res.data.actions,
        model_used: res.data.model_used,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Copilot error:', err);
      const errMsg: CopilotMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '⚠️ Не вдалося зв\'язатися з AI-сервісом. Перевірте з\'єднання з сервером або спробуйте ще раз.',
        model_used: 'Offline Fallback',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: CopilotAction) => {
    if (action.action_type === 'quick_reply') {
      handleSendMessage(action.payload || action.label);
    } else if (action.action_type === 'open_radar' || action.action_type === 'open_forecast' || action.action_type === 'open_abc') {
      if (onNavigateToTab) {
        onNavigateToTab('intelligence');
        setIsOpen(false);
      }
    } else if (action.action_type === 'copy_text') {
      if (action.payload) {
        navigator.clipboard.writeText(action.payload);
        setSnackbarMessage('Текст листа скопійовано в буфер обміну!');
      }
    }
  };

  const handleClearHistory = () => {
    setMessages([INITIAL_GREETING]);
  };

  // Простий парсер маркдауну для наочного форматування
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    let insideCodeBlock = false;
    let codeBlockContent: string[] = [];

    const elements: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      if (line.startsWith('```')) {
        if (insideCodeBlock) {
          // Закриваємо блок
          const blockText = codeBlockContent.join('\n');
          elements.push(
            <Paper
              key={`code-${idx}`}
              elevation={0}
              sx={{
                p: 1.5,
                my: 1,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                whiteSpace: 'pre-wrap',
                position: 'relative'
              }}
            >
              <IconButton
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(blockText);
                  setSnackbarMessage('Код/текст скопійовано!');
                }}
                sx={{ position: 'absolute', top: 6, right: 6 }}
                title="Копіювати текст"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
              {blockText}
            </Paper>
          );
          codeBlockContent = [];
          insideCodeBlock = false;
        } else {
          insideCodeBlock = true;
        }
        return;
      }

      if (insideCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Заголовки
      if (line.startsWith('### ')) {
        elements.push(
          <Typography key={idx} variant="subtitle1" sx={{ fontWeight: 'bold', mt: 1.2, mb: 0.5 }}>
            {parseInlineMarkup(line.replace('### ', ''))}
          </Typography>
        );
      } else if (line.startsWith('#### ')) {
        elements.push(
          <Typography key={idx} variant="subtitle2" sx={{ fontWeight: 'bold', mt: 1, mb: 0.3, color: 'primary.main' }}>
            {parseInlineMarkup(line.replace('#### ', ''))}
          </Typography>
        );
      } else if (line.startsWith('• ') || line.startsWith('- ')) {
        elements.push(
          <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', ml: 1, my: 0.3 }}>
            <Typography component="span" sx={{ mr: 1, color: 'primary.main', fontWeight: 'bold' }}>•</Typography>
            <Typography variant="body2" component="div">
              {parseInlineMarkup(line.substring(2))}
            </Typography>
          </Box>
        );
      } else if (line.trim() === '') {
        elements.push(<Box key={idx} sx={{ height: 6 }} />);
      } else {
        elements.push(
          <Typography key={idx} variant="body2" sx={{ my: 0.3, lineHeight: 1.5 }}>
            {parseInlineMarkup(line)}
          </Typography>
        );
      }
    });

    return elements;
  };

  // Парсер інлайнових тегів: **жирний**, `код`
  const parseInlineMarkup = (text: string): React.ReactNode => {
    // Розбиваємо за жирним шрифтом та моноширинним
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Chip
            key={i}
            label={part.slice(1, -1)}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              mx: 0.3,
              bgcolor: 'action.selected'
            }}
          />
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* ПЛАВАЮЧА КНОПКА ВИКЛИКУ COPILOT */}
      <Tooltip title="AI-Копілот складу (Чат-асистент)" placement="left">
        <Fab
          color="primary"
          onClick={() => setIsOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1250,
            background: 'linear-gradient(135deg, #1976d2 0%, #7b1fa2 100%)',
            boxShadow: '0 8px 24px rgba(123, 31, 162, 0.4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'scale(1.08) translateY(-2px)',
              boxShadow: '0 12px 28px rgba(123, 31, 162, 0.6)',
              background: 'linear-gradient(135deg, #1565c0 0%, #6a1b9a 100%)'
            }
          }}
        >
          <PsychologyIcon sx={{ fontSize: 30, color: '#fff' }} />
        </Fab>
      </Tooltip>

      {/* БІЧНИЙ ДІАЛОГОВИЙ ДРАВЕР (DRAWER) */}
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 480 },
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)'
          }
        }}
      >
        {/* ШАПКА ДРАВЕРА */}
        <Box
          sx={{
            p: 2,
            background: 'linear-gradient(135deg, #1976d2 0%, #7b1fa2 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.4)'
              }}
            >
              <AutoAwesomeIcon sx={{ color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                AI-Копілот складу
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                LLM & Explainable AI асистент
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Очистити діалог">
              <IconButton size="small" onClick={handleClearHistory} sx={{ color: '#fff' }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setIsOpen(false)} sx={{ color: '#fff' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* ПІДШАПКА: СТАТУС РУШІЯ */}
        <Box
          sx={{
            px: 2,
            py: 1,
            bgcolor: 'action.hover',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'success.main',
                boxShadow: '0 0 6px #4caf50'
              }}
            />
            <Typography variant="caption" color="text.secondary">
              Автономний XAI-рушій + Cloud LLM
            </Typography>
          </Box>
          <Chip label="PostgreSQL live" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
        </Box>

        {/* СПИСОК ПОВІДОМЛЕНЬ */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            bgcolor: 'background.default'
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '100%'
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    maxWidth: '92%'
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: isUser ? 'primary.main' : 'secondary.main',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.5
                    }}
                  >
                    {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
                  </Box>

                  <Paper
                    elevation={1}
                    sx={{
                      p: 1.75,
                      borderRadius: 2.5,
                      borderTopRightRadius: isUser ? 0 : 20,
                      borderTopLeftRadius: isUser ? 20 : 0,
                      bgcolor: isUser ? 'primary.main' : 'background.paper',
                      color: isUser ? 'primary.contrastText' : 'text.primary',
                      boxShadow: isUser ? '0 3px 12px rgba(25, 118, 210, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    {renderFormattedContent(msg.content)}

                    {/* ІНТЕРАКТИВНІ ДІЇ (КНОПКИ ДІЙ) */}
                    {msg.actions && msg.actions.length > 0 && (
                      <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: isUser ? 'rgba(255,255,255,0.2)' : 'divider', display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                        {msg.actions.map((act, aIdx) => (
                          <Button
                            key={aIdx}
                            size="small"
                            variant={act.action_type === 'copy_text' ? 'outlined' : 'contained'}
                            color={act.action_type === 'copy_text' ? 'info' : 'secondary'}
                            onClick={() => handleActionClick(act)}
                            endIcon={
                              act.action_type === 'open_radar' || act.action_type === 'open_forecast' ? (
                                <OpenInNewIcon fontSize="small" />
                              ) : act.action_type === 'copy_text' ? (
                                <ContentCopyIcon fontSize="small" />
                              ) : undefined
                            }
                            sx={{
                              textTransform: 'none',
                              fontSize: '0.78rem',
                              py: 0.4,
                              px: 1.2,
                              borderRadius: 2
                            }}
                          >
                            {act.label}
                          </Button>
                        ))}
                      </Box>
                    )}
                  </Paper>
                </Box>

                {/* Метадані повідомлення */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mt: 0.5,
                    px: 1,
                    fontSize: '0.7rem',
                    color: 'text.secondary'
                  }}
                >
                  {msg.model_used && (
                    <Typography variant="caption" sx={{ fontSize: '0.68rem', opacity: 0.8 }}>
                      ⚡ {msg.model_used}
                    </Typography>
                  )}
                  {msg.timestamp && (
                    <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>
                      {msg.timestamp}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}

          {isLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
              <CircularProgress size={20} color="secondary" />
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Аналізую складські залишки та формую рішення...
              </Typography>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* ШВИДКІ ПІДКАЗКИ (QUICK CHIPS) */}
        <Box
          sx={{
            p: 1.2,
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            gap: 0.8,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            '&::-webkit-scrollbar': { height: 4 }
          }}
        >
          <Chip
            label="🚨 Що замовити?"
            size="small"
            clickable
            onClick={() => handleSendMessage('Що терміново треба замовити?')}
            sx={{ fontSize: '0.75rem', bgcolor: 'action.hover' }}
          />
          <Chip
            label="🧠 Чому статус RTX 4070?"
            size="small"
            clickable
            onClick={() => handleSendMessage('Поясни статус товару RTX 4070')}
            sx={{ fontSize: '0.75rem', bgcolor: 'action.hover' }}
          />
          <Chip
            label="✉️ Лист постачальнику"
            size="small"
            clickable
            onClick={() => handleSendMessage('Склади лист постачальнику на замовлення дефіцитних товарів')}
            sx={{ fontSize: '0.75rem', bgcolor: 'action.hover' }}
          />
          <Chip
            label="📊 Товари групи A"
            size="small"
            clickable
            onClick={() => handleSendMessage('Які товари входять до групи A за виручкою?')}
            sx={{ fontSize: '0.75rem', bgcolor: 'action.hover' }}
          />
        </Box>

        {/* ПОЛЕ ВВЕДЕННЯ ПОВІДОМЛЕННЯ */}
        <Box
          sx={{
            p: 1.5,
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder="Запитайте у Копілота про залишки, попит або листи..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3
              }
            }}
          />
          <IconButton
            color="primary"
            disabled={!inputText.trim() || isLoading}
            onClick={() => handleSendMessage()}
            sx={{
              bgcolor: 'primary.main',
              color: '#fff',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
              p: 1.2,
              borderRadius: 3
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Box>
      </Drawer>

      {/* ПОВІДОМЛЕННЯ ПРО УСПІШНЕ КОПІЮВАННЯ */}
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSnackbarMessage(null)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default WarehouseCopilot;
