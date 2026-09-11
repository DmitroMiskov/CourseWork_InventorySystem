import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useSignalR } from '../context/SignalRContext';
import * as signalR from '@microsoft/signalr';

export const SignalRStatusBadge: React.FC = () => {
  const { connectionState, isConnected } = useSignalR();

  let label = 'Realtime Офлайн';
  let color: 'success' | 'warning' | 'default' = 'default';
  let icon = <WifiOffIcon sx={{ fontSize: '1rem !important' }} />;

  if (connectionState === signalR.HubConnectionState.Connected) {
    label = 'Realtime Live';
    color = 'success';
    icon = <WifiIcon sx={{ fontSize: '1rem !important' }} />;
  } else if (connectionState === signalR.HubConnectionState.Connecting || connectionState === signalR.HubConnectionState.Reconnecting) {
    label = 'З\'єднання...';
    color = 'warning';
  }

  return (
    <Tooltip 
      title={
        isConnected 
          ? 'SignalR підключено: залишки та операції оновлюються в реальному часі без перезавантаження' 
          : 'Спроба підключення до сервера SignalR...'
      }
    >
      <Chip
        size="small"
        icon={icon}
        label={label}
        color={color}
        variant="filled"
        sx={{
          fontWeight: 600,
          fontSize: '0.75rem',
          mr: 1.5,
          cursor: 'default',
          boxShadow: isConnected ? '0 0 8px rgba(76, 175, 80, 0.6)' : 'none',
          animation: isConnected ? 'pulse 2.5s infinite' : 'none',
          '@keyframes pulse': {
            '0%': { opacity: 0.9 },
            '50%': { opacity: 1, transform: 'scale(1.03)' },
            '100%': { opacity: 0.9 }
          }
        }}
      />
    </Tooltip>
  );
};

export default SignalRStatusBadge;
