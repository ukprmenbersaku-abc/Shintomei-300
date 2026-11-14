import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-950/95 border border-amber-400/60 text-amber-100 text-xs font-semibold shadow-xl pointer-events-none pt-safe">
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>オフラインモードで動作中（PWAキャッシュ有効）</span>
    </div>
  );
};
