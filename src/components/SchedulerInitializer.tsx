'use client';

import { useEffect } from 'react';

export default function SchedulerInitializer() {
  useEffect(() => {
    // Initialize the backup scheduler when the app loads
    const initializeScheduler = async () => {
      try {
        const response = await fetch('/api/backups/scheduler', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json();
        if (data.success) {
          console.log('Backup scheduler initialized successfully');
        } else {
          console.error('Failed to initialize backup scheduler:', data.error);
        }
      } catch (error) {
        console.error('Error initializing backup scheduler:', error);
      }
    };

    // Initialize after a short delay to let the app fully load
    const timer = setTimeout(initializeScheduler, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  return null; // This component doesn't render anything
}