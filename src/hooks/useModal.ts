'use client';

import { useState, useCallback } from 'react';
import { ModalOptions } from '@/components/Modal';

export const useModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ModalOptions>({
    title: '',
    message: '',
    type: 'info'
  });

  const showModal = useCallback((modalOptions: ModalOptions) => {
    setOptions(modalOptions);
    setIsOpen(true);
  }, []);

  const hideModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Convenience methods for different types of modals
  const showSuccess = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'success' });
  }, [showModal]);

  const showError = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'error' });
  }, [showModal]);

  const showWarning = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'warning' });
  }, [showModal]);

  const showInfo = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'info' });
  }, [showModal]);

  const showConfirm = useCallback((
    title: string, 
    message: string, 
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => {
    showModal({ 
      title, 
      message, 
      type: 'confirm', 
      onConfirm, 
      onCancel,
      confirmText,
      cancelText 
    });
  }, [showModal]);

  return {
    isOpen,
    options,
    showModal,
    hideModal,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm
  };
};