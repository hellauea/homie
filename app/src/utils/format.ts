import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import calendar from 'dayjs/plugin/calendar';

dayjs.extend(relativeTime);
dayjs.extend(calendar);

/**
 * Formats message timestamp into standard local time: e.g. "10:42 PM"
 */
export function formatMessageTime(isoString: string): string {
  if (!isoString) return '';
  return dayjs(isoString).format('h:mm A');
}

/**
 * Instagram-style relative timestamp for conversation list:
 * "now", "2m", "14m", "1h", "3h", "yesterday", "2d", "1w", "12 May"
 */
export function formatConversationDate(isoString: string): string {
  if (!isoString) return '';
  const now = dayjs();
  const date = dayjs(isoString);
  const diffMinutes = now.diff(date, 'minute');
  const diffHours = now.diff(date, 'hour');
  const diffDays = now.diff(date, 'day');

  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1 || date.isSame(now.subtract(1, 'day'), 'day')) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  return date.format('D MMM'); // e.g. "12 May"
}

/**
 * Formats the group date dividers in a chat window: e.g. "Today", "Yesterday", "Monday, May 12"
 */
export function formatChatDividerDate(isoString: string): string {
  if (!isoString) return '';
  const now = dayjs();
  const date = dayjs(isoString);
  
  if (date.isSame(now, 'day')) {
    return 'Today';
  }
  
  if (date.isSame(now.subtract(1, 'day'), 'day')) {
    return 'Yesterday';
  }
  
  if (date.isSame(now, 'year')) {
    return date.format('dddd, MMMM D'); // e.g. "Monday, May 12"
  }
  
  return date.format('dddd, MMMM D, YYYY');
}

/**
 * Truncates long text with an ellipsis for message feed item previews
 */
export function truncate(text: string | null, maxLength: number = 32): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
