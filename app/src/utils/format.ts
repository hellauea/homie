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
 * Formats conversation date for the feed view list: e.g. "Today", "Yesterday", "Mon", "12 May"
 */
export function formatConversationDate(isoString: string): string {
  if (!isoString) return '';
  const now = dayjs();
  const date = dayjs(isoString);
  
  if (date.isSame(now, 'day')) {
    return date.format('h:mm A');
  }
  
  if (date.isSame(now.subtract(1, 'day'), 'day')) {
    return 'Yesterday';
  }
  
  if (date.isAfter(now.subtract(6, 'days'))) {
    return date.format('ddd'); // e.g. "Mon"
  }
  
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
