
import React, { createContext, useContext, useState, ReactNode } from 'react';

type DialogOptions = {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

type DialogContextType = {
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;
};

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  const showDialog = (options: DialogOptions) => setDialog(options);
  const hideDialog = () => setDialog(null);

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-semibold mb-2">{dialog.title}</h2>
            <p className="text-gray-600 mb-6">{dialog.message}</p>
            <div className="flex justify-end gap-3">
              {dialog.onCancel && (
                <button
                  onClick={() => { dialog.onCancel?.(); hideDialog(); }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200"
                >
                  {dialog.cancelLabel || 'Cancel'}
                </button>
              )}
              <button
                onClick={() => { dialog.onConfirm(); hideDialog(); }}
                className="px-4 py-2 text-white bg-indigo-600 rounded-lg font-medium hover:bg-indigo-700"
              >
                {dialog.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used within a DialogProvider');
  return context;
};
