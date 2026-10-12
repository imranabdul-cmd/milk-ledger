import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatDisplayDate, formatDisplayTime } from '../utils/dateFormatter';

interface DateTimeBadgeProps {
  date: string;
  createdAt?: string;
  className?: string;
  showTime?: boolean;
  style?: React.CSSProperties;
}

export const DateTimeBadge: React.FC<DateTimeBadgeProps> = ({
  date,
  createdAt,
  className = '',
  showTime = true,
  style,
}) => {
  const { language } = useLanguage();
  const dateFormatted = formatDisplayDate(date, language);
  const timeFormatted = showTime ? formatDisplayTime(createdAt) : '';

  return (
    <div className={`datetime-badge-row ${className}`} style={style}>
      <span className="datetime-pill-date">
        <Calendar size={13} className="datetime-icon" />
        <span>{dateFormatted}</span>
      </span>
      {timeFormatted ? (
        <span className="datetime-pill-time">
          <Clock size={12} className="datetime-icon" />
          <span>{timeFormatted}</span>
        </span>
      ) : null}
    </div>
  );
};
