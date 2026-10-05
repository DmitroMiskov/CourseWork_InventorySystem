import React from 'react';
import { Button, Tooltip } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import { useLanguage } from '../context/LanguageContext';

export const LanguageToggle: React.FC<{ sx?: object }> = ({ sx }) => {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <Tooltip title={t('common.langToggle')} arrow>
      <Button
        onClick={toggleLanguage}
        color="inherit"
        size="small"
        startIcon={<TranslateIcon sx={{ fontSize: 18 }} />}
        sx={{
          ml: 0.5,
          mr: 0.5,
          px: 1.2,
          py: 0.5,
          borderRadius: 2,
          fontWeight: 700,
          fontSize: '0.82rem',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          bgcolor: 'rgba(255, 255, 255, 0.12)',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.22)',
          },
          ...sx
        }}
      >
        {language === 'uk' ? 'UA' : 'EN'}
      </Button>
    </Tooltip>
  );
};

export default LanguageToggle;
