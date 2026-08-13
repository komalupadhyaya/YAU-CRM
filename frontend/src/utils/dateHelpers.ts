/**
 * WhatsApp-style date/time utilities for YAU-CRM chat history
 */

/**
 * Returns a relative date label (e.g., "Today", "Yesterday", "Monday", or a full date)
 * for use in message stream dividers.
 */
export function getRelativeDateLabel(dateInput: Date | string | number): string {
  if (!dateInput) return '';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const dateZeroTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayZeroTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayZeroTime = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    const diffTime = todayZeroTime.getTime() - dateZeroTime.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (dateZeroTime.getTime() === todayZeroTime.getTime()) {
      return 'Today';
    } else if (dateZeroTime.getTime() === yesterdayZeroTime.getTime()) {
      return 'Yesterday';
    } else if (diffDays > 0 && diffDays < 7) {
      // Day of the week (e.g., "Monday")
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      // Older than a week, full date (e.g., "August 12, 2026")
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  } catch (e) {
    console.error('Error generating relative date label:', e);
    return '';
  }
}

/**
 * Formats timestamps for conversation list entries (sidebar).
 * - Today: e.g. "03:20 PM"
 * - Yesterday: "Yesterday"
 * - Last 7 Days: weekday name (e.g. "Monday")
 * - Older: short numeric date (e.g. "08/12/26" or "08/12/2026")
 */
export function formatConversationTimestamp(dateInput: Date | string | number): string {
  if (!dateInput) return '';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const dateZeroTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayZeroTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayZeroTime = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    const diffTime = todayZeroTime.getTime() - dateZeroTime.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (dateZeroTime.getTime() === todayZeroTime.getTime()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (dateZeroTime.getTime() === yesterdayZeroTime.getTime()) {
      return 'Yesterday';
    } else if (diffDays > 0 && diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      // e.g. "08/12/2026"
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    }
  } catch (e) {
    console.error('Error formatting conversation timestamp:', e);
    return '';
  }
}
