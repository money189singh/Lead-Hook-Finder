import React from 'react';
import { X, Target } from 'lucide-react';
import { IcpConfig } from '../../types';
import { IcpSettingsCard } from './IcpSettingsCard';

interface IcpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: IcpConfig;
  onSaveConfig: (config: IcpConfig) => Promise<void>;
}

export const IcpConfigModal: React.FC<IcpConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [localConfig, setLocalConfig] = React.useState<IcpConfig>(config);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveConfig(localConfig);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Target className="w-5 h-5 text-[#155eef] dark:text-blue-400" />
            <span>Configure Ideal Customer Profile (ICP) Scorer</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <IcpSettingsCard
          config={localConfig}
          onChange={setLocalConfig}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </div>
  );
};
