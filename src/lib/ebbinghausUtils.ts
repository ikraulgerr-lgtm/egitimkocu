import { SoruKaydi } from '../types';

/**
 * Returns today's date string in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Calculates the next Ebbinghaus review date based on repeat count.
 * Intervals:
 * - 0 repeats -> +1 day
 * - 1 repeat -> +3 days
 * - 2 repeats -> +7 days
 * - 3 repeats -> +14 days
 * - 4+ repeats -> +30 days
 */
export function getNextEbbinghausDate(currentRepeatCount: number = 0): string {
  const intervals = [1, 3, 7, 14, 30];
  const daysToAdd = intervals[Math.min(currentRepeatCount, intervals.length - 1)];
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate.toISOString().split('T')[0];
}

/**
 * Returns descriptive title for Ebbinghaus repetition interval level
 */
export function getEbbinghausLevelTitle(repeatCount: number = 0): string {
  switch (repeatCount) {
    case 0:
      return '1. Tekrar (1. Gün)';
    case 1:
      return '2. Tekrar (3. Gün)';
    case 2:
      return '3. Tekrar (7. Gün)';
    case 3:
      return '4. Tekrar (14. Gün)';
    default:
      return `${repeatCount + 1}. Tekrar (Kalıcı Hafıza)`;
  }
}

/**
 * Determines whether a question is due for repetition today according to Ebbinghaus curve.
 * A question is due if:
 * 1. It is not solved (!q.isSolved)
 * 2. OR its ebbinghausTarihi is today or in the past
 */
export function isQuestionDueToday(q: SoruKaydi): boolean {
  if (!q.ebbinghausTarihi) return !q.isSolved;
  const today = getTodayDateString();
  return !q.isSolved || q.ebbinghausTarihi <= today;
}

/**
 * Filters all questions in the pool that require repetition today.
 */
export function getDueQuestionsToday(questions: SoruKaydi[]): SoruKaydi[] {
  return questions.filter(isQuestionDueToday);
}

export interface DaySchedule {
  dayName: string;
  dateStr: string;
  count: number;
  isToday: boolean;
}

/**
 * Computes dynamic question count for each day of the current week (Pzt - Paz)
 * based on Ebbinghaus review dates (ebbinghausTarihi).
 */
export function getWeeklyEbbinghausBreakdown(questions: SoruKaydi[]): DaySchedule[] {
  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentDayIndex = today.getDay();

  // Find Monday of current week
  const distanceToMonday = currentDayIndex === 0 ? -6 : 1 - currentDayIndex;
  const monday = new Date(today);
  monday.setDate(today.getDate() + distanceToMonday);

  const result: DaySchedule[] = [];

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = dayDate.toISOString().split('T')[0];
    const dayName = dayNames[dayDate.getDay()];
    const isToday = dateStr === todayStr;

    // Count unsolved questions scheduled for this day
    const count = questions.filter((q) => {
      if (q.isSolved) return false;
      if (!q.ebbinghausTarihi) return isToday;
      return q.ebbinghausTarihi === dateStr;
    }).length;

    result.push({
      dayName,
      dateStr,
      count,
      isToday,
    });
  }

  return result;
}
