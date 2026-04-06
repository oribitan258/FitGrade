// apps/web/lib/exercise-config.ts

export interface ExercisePhysioData {
  primaryFocus: string;
  targetMuscles: string;
  briefDescription: string;
  anatomyImageUrl: string;
}

// Available anatomy PNGs in /public/anatomy/:
//   beep.png | pullups.png | pushups.png | run-endurance.png | situps.png | sprint.png

const exerciseDataMap: Record<string, ExercisePhysioData> = {
  '2000': {
    primaryFocus: 'סיבולת לב-ריאה',
    targetMuscles: 'ארבע ראשי, שוקיים, מערכת הקרדיו',
    briefDescription: 'ריצת מרחק למדידת סיבולת אירובית מקסימלית ויכולת התמדה לאורך זמן.',
    anatomyImageUrl: '/anatomy/run-endurance.png',
  },
  '1500': {
    primaryFocus: 'סיבולת לב-ריאה',
    targetMuscles: 'ארבע ראשי, שוקיים, מערכת הקרדיו',
    briefDescription: 'ריצת מרחק המבחנת את הסף האירובי והיכולת להתמיד במאמץ.',
    anatomyImageUrl: '/anatomy/run-endurance.png',
  },
  '1000': {
    primaryFocus: 'סיבולת אירובית',
    targetMuscles: 'ארבע ראשי, שוקיים, לב',
    briefDescription: 'ריצת ביניים הבוחנת שילוב של סיבולת ומהירות לאורך זמן ממושך.',
    anatomyImageUrl: '/anatomy/run-endurance.png',
  },
  '800': {
    primaryFocus: 'סיבולת אירובית',
    targetMuscles: 'ארבע ראשי, שוקיים, לב',
    briefDescription: 'ריצת ביניים הבוחנת שילוב של סיבולת ומהירות לאורך זמן ממושך.',
    anatomyImageUrl: '/anatomy/run-endurance.png',
  },
  '60': {
    primaryFocus: 'כוח מתפרץ ומהירות',
    targetMuscles: 'ארבע ראשי, המסטרינגס, תאומים',
    briefDescription: 'ספרינט קצר למדידת כוח מתפרץ מרבי, מהירות רגליים וזמן תגובה.',
    anatomyImageUrl: '/anatomy/sprint.png',
  },
  '10x4': {
    primaryFocus: 'זריזות וכוח מתפרץ',
    targetMuscles: 'שרירי הרגליים, יציבה (Core)',
    briefDescription: 'מבחן זריזות (Agility) הבוחן יכולת שינוי כיוון מהיר תוך שמירה על כוח מתפרץ.',
    anatomyImageUrl: '/anatomy/sprint.png',
  },
  'ספרינט': {
    primaryFocus: 'כוח מתפרץ ומהירות',
    targetMuscles: 'ארבע ראשי, המסטרינגס, תאומים',
    briefDescription: 'ספרינט למדידת כוח מתפרץ מרבי ומהירות ריצה.',
    anatomyImageUrl: '/anatomy/sprint.png',
  },
  'בי-פ': {
    primaryFocus: 'סיבולת מקסימלית (VO₂ Max)',
    targetMuscles: 'לב, ריאות, כל שרירי הגפיים',
    briefDescription: 'מבחן מאמץ מתגבר הבוחן את סף חומצת החלב וצריכת החמצן המרבית של התלמיד.',
    anatomyImageUrl: '/anatomy/beep.png',
  },
  'ביפ': {
    primaryFocus: 'סיבולת מקסימלית (VO₂ Max)',
    targetMuscles: 'לב, ריאות, כל שרירי הגפיים',
    briefDescription: 'מבחן מאמץ מתגבר הבוחן את סף חומצת החמצן המרבית של התלמיד.',
    anatomyImageUrl: '/anatomy/beep.png',
  },
  'סמיכה': {
    primaryFocus: 'כוח פלג גוף עליון',
    targetMuscles: 'חזה (Pectoralis), כתפיים, יד אחורית (Triceps)',
    briefDescription: 'תרגיל כוח בסיסי המודד את הסיבולת השרירית של פלג הגוף העליון והיציבה.',
    anatomyImageUrl: '/anatomy/pushups.png',
  },
  'מתח': {
    primaryFocus: 'כוח משיכה (Pull)',
    targetMuscles: 'גב רחב (Latissimus), דו-ראשי (Biceps), אמות',
    briefDescription: 'מבחן כוח קלאסי המודד את היכולת למשוך את משקל הגוף כנגד כוח המשיכה.',
    anatomyImageUrl: '/anatomy/pullups.png',
  },
  'בטן': {
    primaryFocus: 'כוח ליבה (Core)',
    targetMuscles: 'שרירי הבטן (Rectus Abdominis), כופפי הירך',
    briefDescription: 'מבחן סיבולת המודד את חוזק שרירי הליבה, החשובים במיוחד ליציבה ולמניעת פציעות.',
    anatomyImageUrl: '/anatomy/situps.png',
  },
  'גמישות': {
    primaryFocus: 'גמישות וטווחי תנועה',
    targetMuscles: 'שרירי הגב התחתון, המסטרינגס',
    briefDescription: 'מבחן הבוחן את אורך השריר ואת טווח התנועה של המפרקים למניעת פציעות.',
    // No dedicated flexibility PNG — use the closest relevant image
    anatomyImageUrl: '/anatomy/situps.png',
  },
};

const fallbacks: Record<string, ExercisePhysioData> = {
  'ENDURANCE': {
    primaryFocus: 'סיבולת לב-ריאה',
    targetMuscles: 'שרירי הגפיים התחתונות, מערכת הלב והריאות',
    briefDescription: 'פעילות אירובית מתמשכת לשיפור הסיבולת והכושר הגופני הכללי.',
    anatomyImageUrl: '/anatomy/run-endurance.png',
  },
  'STRENGTH': {
    primaryFocus: 'כוח שרירים',
    targetMuscles: 'קבוצות שרירים רלוונטיות לפעילות',
    briefDescription: 'פעילות התנגדות המיועדת לפיתוח כוח מרבי, מסת שריר וסיבולת שרירית.',
    anatomyImageUrl: '/anatomy/pushups.png',
  },
  'SPEED_AGILITY': {
    primaryFocus: 'מהירות וזריזות',
    targetMuscles: 'שרירי הרגליים והליבה',
    briefDescription: 'תרגילים המתמקדים בזמן תגובה, תאוצה ושינויי כיוון תכופים.',
    anatomyImageUrl: '/anatomy/sprint.png',
  },
  'DEFAULT': {
    primaryFocus: 'כושר גופני כללי',
    targetMuscles: 'מערכות הגוף השונות',
    briefDescription: 'פעילות גופנית המיועדת למדידה ושיפור של מרכיבי הכושר השונים.',
    anatomyImageUrl: '/anatomy/run-endurance.png',
  },
};

export function getExerciseConfig(testNameHe: string, categoryCode?: string): ExercisePhysioData {
  if (!testNameHe) return fallbacks['DEFAULT']!;

  const normalizedName = testNameHe.trim().toLowerCase();

  for (const [key, data] of Object.entries(exerciseDataMap)) {
    if (normalizedName.includes(key.toLowerCase())) {
      return data;
    }
  }

  if (categoryCode && fallbacks[categoryCode]) {
    return fallbacks[categoryCode]!;
  }

  return fallbacks['DEFAULT']!;
}
