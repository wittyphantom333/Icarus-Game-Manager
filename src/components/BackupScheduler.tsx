'use client';

import { useState, useEffect } from 'react';

interface BackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  dayOfWeek?: number; // 0-6 (0 = Sunday) for weekly
  dayOfMonth?: number; // 1-31 for monthly
  lastRun?: string; // ISO string
  nextRun?: string; // ISO string
}

interface BackupSchedulerProps {
  schedule: BackupSchedule;
  onScheduleChange: (schedule: BackupSchedule) => void;
  isLoading?: boolean;
}

const BackupScheduler = ({ schedule, onScheduleChange, isLoading = false }: BackupSchedulerProps) => {
  const [localSchedule, setLocalSchedule] = useState<BackupSchedule>(schedule);

  useEffect(() => {
    setLocalSchedule(schedule);
  }, [schedule]);

  const handleScheduleChange = (updates: Partial<BackupSchedule>) => {
    const newSchedule = { ...localSchedule, ...updates };
    setLocalSchedule(newSchedule);
    onScheduleChange(newSchedule);
  };

  const getDayName = (dayNumber: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber];
  };

  const getNextRunDisplay = (): string => {
    if (!localSchedule.enabled) return 'Not scheduled';
    if (!localSchedule.nextRun) return 'Calculating...';
    
    try {
      const nextRun = new Date(localSchedule.nextRun);
      return nextRun.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const getLastRunDisplay = (): string => {
    if (!localSchedule.lastRun) return 'Never';
    
    try {
      const lastRun = new Date(localSchedule.lastRun);
      return lastRun.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-6">
      {/* Enable/Disable Schedule */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Scheduled Backups
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Automatically create backups on a schedule
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={localSchedule.enabled}
            onChange={(e) => handleScheduleChange({ enabled: e.target.checked })}
            disabled={isLoading}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
        </label>
      </div>

      {/* Schedule Configuration */}
      {localSchedule.enabled && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          {/* Frequency Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Frequency
            </label>
            <select 
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg px-3 py-2 disabled:opacity-50"
              value={localSchedule.frequency}
              onChange={(e) => handleScheduleChange({ frequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
              disabled={isLoading}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Time Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time
            </label>
            <input
              type="time"
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg px-3 py-2 disabled:opacity-50"
              value={localSchedule.time}
              onChange={(e) => handleScheduleChange({ time: e.target.value })}
              disabled={isLoading}
            />
          </div>

          {/* Day of Week Selection (for weekly) */}
          {localSchedule.frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Day of Week
              </label>
              <select 
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg px-3 py-2 disabled:opacity-50"
                value={localSchedule.dayOfWeek ?? 0}
                onChange={(e) => handleScheduleChange({ dayOfWeek: parseInt(e.target.value) })}
                disabled={isLoading}
              >
                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                  <option key={day} value={day}>{getDayName(day)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Day of Month Selection (for monthly) */}
          {localSchedule.frequency === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Day of Month
              </label>
              <select 
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg px-3 py-2 disabled:opacity-50"
                value={localSchedule.dayOfMonth ?? 1}
                onChange={(e) => handleScheduleChange({ dayOfMonth: parseInt(e.target.value) })}
                disabled={isLoading}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          )}

          {/* Schedule Status */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Last Run:</span>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{getLastRunDisplay()}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Next Run:</span>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{getNextRunDisplay()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Preview */}
      {localSchedule.enabled && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Schedule Summary
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {localSchedule.frequency === 'daily' && `Backups will run daily at ${localSchedule.time}`}
                {localSchedule.frequency === 'weekly' && `Backups will run every ${getDayName(localSchedule.dayOfWeek ?? 0)} at ${localSchedule.time}`}
                {localSchedule.frequency === 'monthly' && `Backups will run on the ${localSchedule.dayOfMonth ?? 1}${
                  (localSchedule.dayOfMonth ?? 1) === 1 ? 'st' :
                  (localSchedule.dayOfMonth ?? 1) === 2 ? 'nd' :
                  (localSchedule.dayOfMonth ?? 1) === 3 ? 'rd' :
                  'th'
                } of each month at ${localSchedule.time}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupScheduler;