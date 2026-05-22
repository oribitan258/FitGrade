import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'תנאי שימוש — FitGrade',
};

export default function TermsPage(): React.JSX.Element {
  const lastUpdated = '22 במאי 2026';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200" dir="rtl">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-lg font-bold text-white">FitGrade</span>
          <Link
            href="/login"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            חזרה לכניסה
          </Link>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-12 text-sm leading-7">
        <h1 className="mb-2 text-2xl font-extrabold text-white">תנאי שימוש</h1>
        <p className="mb-10 text-xs text-slate-500">עדכון אחרון: {lastUpdated}</p>

        <Section title="1. הסכמה לתנאים">
          <p>
            השימוש במערכת FitGrade מהווה הסכמה מלאה ובלתי מסויגת לתנאי שימוש אלה.
            אם אינך מסכים/ה לאחד מהתנאים המפורטים להלן, עליך להפסיק את השימוש
            במערכת לאלתר. תנאים אלה חלים על כל משתמש/ת מורשה/ת, לרבות מורים, מנהלים,
            וכל גורם הפועל מטעם מוסד חינוכי.
          </p>
        </Section>

        <Section title="2. תיאור השירות ומגבלותיו">
          <p>
            FitGrade היא מערכת תוכנה לניהול ציונים, נוכחות ותוצאות מבחני כושר גופני
            במסגרת חינוכית. המערכת מיועדת לשימוש כלי ניהולי-פדגוגי בלבד.
          </p>
          <Callout>
            <strong>הצהרת כלי חינוכי — לא ייעוץ רפואי:</strong> הציונים, ההמלצות
            ותוצאות המבחנים המוצגים במערכת FitGrade מבוססים על טבלאות נורמה תקניות
            של משרד החינוך ומשמשים לצורכי הערכה פדגוגית בלבד.{' '}
            <strong>
              אין לפרש את תוצאות המערכת כייעוץ רפואי, אבחון קליני, או המלצה לפעילות
              גופנית מסוימת.
            </strong>{' '}
            במידה ועולות חששות לגבי מצבו הבריאותי של תלמיד/ה, יש לפנות לגורם רפואי
            מוסמך.
          </Callout>
        </Section>

        <Section title="3. אחריות המשתמש — בטיחות פיזית במהלך המבחנים">
          <p>
            השימוש במערכת לתיעוד מבחני כושר גופני (ריצות, מבחן צפצוף, קפיצות, ועוד)
            אינו מחליף את שיקול הדעת המקצועי של המורה בשטח.
          </p>
          <p className="mt-3 font-semibold text-white">
            המשתמש/ת מצהיר/ה ומתחייב/ת כדלקמן:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-2 text-slate-300">
            <li>
              <strong className="text-white">אחריות בטיחות מלאה:</strong> המורה ו/או
              המוסד החינוכי נושאים באחריות הבלעדית והמלאה לבטיחותם הפיזית של התלמידים
              לפני, במהלך, ואחרי כל פעילות גופנית המתועדת במערכת.
            </li>
            <li>
              <strong className="text-white">בדיקות כשירות:</strong> על המורה לוודא כי
              תלמידים הסובלים ממגבלה רפואית, פציעה, או כל מצב המונע השתתפות בפעילות
              גופנית — פטורים ממבחן בהתאם.
            </li>
            <li>
              <strong className="text-white">ציוד ותנאי סביבה:</strong> המשתמש/ת מצהיר/ה
              כי יוודא/תוודא שהתנאים הסביבתיים, הציוד, והמתקנים עומדים בתקני הבטיחות
              הנדרשים לפי חוק.
            </li>
            <li>
              <strong className="text-white">שיקול דעת מקצועי:</strong> תוצאת מבחן
              המוצגת במערכת אינה מחייבת את המורה לדרוש מתלמיד/ה לחזור על הביצוע
              בניגוד לשיקוליו/ה המקצועיים.
            </li>
          </ul>
          <p className="mt-4">
            FitGrade אינה אחראית לכל נזק גופני, פציעה, או תאונה שתתרחש במהלך
            פעילויות המתועדות באמצעות המערכת.
          </p>
        </Section>

        <Section title="4. הרשאה להזנת נתוני קטינים">
          <p>
            השימוש ב-FitGrade כרוך בהזנת נתונים אישיים של תלמידים, חלקם קטינים
            (מתחת לגיל 18), לרבות שם מלא, מספר תעודת זהות, תאריך לידה ומגדר.
          </p>
          <p className="mt-3 font-semibold text-white">
            על ידי שימוש במערכת, המשתמש/ת מצהיר/ה ומאשר/ת כי:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-2 text-slate-300">
            <li>
              <strong className="text-white">הרשאה מוסדית:</strong> קיבל/ה הרשאה מפורשת
              מהמוסד החינוכי שבו הוא/היא מועסק/ת להזין, לנהל ולעבד נתוני תלמידים
              במערכת FitGrade.
            </li>
            <li>
              <strong className="text-white">עמידה בחוק:</strong> הזנת נתוני התלמידים
              מתבצעת בהתאם לחוק הגנת הפרטיות, התשמ״א-1981, תיקון 13 (2025), ותקנות
              הגנת הפרטיות (אבטחת מידע), התשע"ז-2017.
            </li>
            <li>
              <strong className="text-white">הסכמת הורים (כנדרש):</strong> במידה
              ונדרשת הסכמת הורים לפי דין או מדיניות המוסד — קיימת הסכמה כאמור לפני
              הזנת פרטי התלמיד.
            </li>
            <li>
              <strong className="text-white">מינימום מידע:</strong> המשתמש/ת מתחייב/ת
              להזין אך ורק את המידע הנדרש לצורך תפעול המערכת, ולא מידע עודף.
            </li>
          </ul>
          <p className="mt-4">
            הפרת סעיף זה עשויה לחשוף את המשתמש/ת ו/או את המוסד החינוכי לאחריות
            אזרחית ו/או פלילית לפי חוק הגנת הפרטיות.
          </p>
        </Section>

        <Section title="5. הגבלת אחריות — ציונים והמלצות">
          <p>
            המערכת מפיקה ציונים מחושבים והמלצות ציון גמר על בסיס אלגוריתמים
            אוטומטיים ומשקלות שהוגדרו מראש. יש להבין ולהפנים את המגבלות הבאות:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-2 text-slate-300">
            <li>
              <strong className="text-white">ציון מומלץ בלבד:</strong> "ציון הגמר המומלץ"
              המוצג במערכת הוא המלצה חישובית בלבד. ציון הגמר הרשמי נקבע על ידי המורה
              ו/או המוסד החינוכי, ואינו נקבע על ידי FitGrade.
            </li>
            <li>
              <strong className="text-white">אחריות ציון:</strong> FitGrade אינה אחראית
              לכל השלכה הנובעת מציון שהוענק לתלמיד/ה, לרבות השלכות על קבלה למוסדות
              חינוך, מלגות, או כל עניין אחר.
            </li>
            <li>
              <strong className="text-white">שגיאות חישוב:</strong> על אף המאמץ להבטיח
              דיוק, FitGrade אינה מתחייבת לאמינות מוחלטת של החישובים. המורה אחראי/ת
              לוודא את סבירות הציון לפני מסירתו הרשמית.
            </li>
            <li>
              <strong className="text-white">זמינות שירות:</strong> FitGrade אינה מתחייבת
              לזמינות רציפה של המערכת. אין לאחסן נתוני תלמידים רק במערכת — יש לשמור
              גיבוי מקומי בהתאם לנהלי המוסד.
            </li>
          </ul>
          <Callout variant="warning">
            בשום מקרה לא תישא FitGrade באחריות לנזקים עקיפים, תוצאתיים, מיוחדים,
            עונשיים, או אקראיים הנובעים מהשימוש במערכת — לרבות אובדן נתונים,
            אובדן הכנסה, או כל נזק אחר — גם אם הוזהרה על אפשרות נזקים כאמור.
          </Callout>
        </Section>

        <Section title="6. קניין רוחני">
          <p>
            כל זכויות הקניין הרוחני במערכת FitGrade, לרבות תוכנה, עיצוב, אלגוריתמים,
            ותוכן — שמורות ל-FitGrade. אין להעתיק, לשכפל, לפרסם, להפיץ, או לבצע
            הנדסה לאחור של כל חלק מהמערכת ללא אישור בכתב מראש.
          </p>
          <p className="mt-3">
            נתוני התלמידים שמוזנים למערכת על ידי המשתמש/ת נשארים בבעלות המוסד
            החינוכי. FitGrade אינה רוכשת כל זכות בנתונים אלה ומשתמשת בהם אך ורק
            לצורך מתן השירות.
          </p>
        </Section>

        <Section title="7. שינויים בתנאי השימוש">
          <p>
            FitGrade שומרת לעצמה את הזכות לעדכן תנאי שימוש אלה בכל עת. שינויים
            מהותיים יועברו למשתמשים באמצעות הודעה בתוך המערכת לא פחות מ-14 ימים
            לפני כניסתם לתוקף. המשך השימוש במערכת לאחר מועד זה מהווה הסכמה לתנאים
            המעודכנים.
          </p>
        </Section>

        <Section title="8. דין חל וסמכות שיפוט">
          <p>
            תנאי שימוש אלה כפופים לדיני מדינת ישראל. כל מחלוקת הנובעת מהם תידון
            בבית משפט המוסמך במחוז תל-אביב-יפו, ישראל, בלבד.
          </p>
        </Section>

        <Section title="9. יצירת קשר">
          <p>
            לשאלות בנושא תנאי שימוש אלה, פנו אלינו דרך ערוצי התמיכה של FitGrade
            או דרך הנהלת המוסד החינוכי שלכם.
          </p>
        </Section>

        <div className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          FitGrade · תנאי שימוש · {lastUpdated}
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-bold text-white">{title}</h2>
      <div className="text-slate-300">{children}</div>
    </section>
  );
}

function Callout({
  children,
  variant = 'info',
}: {
  children: React.ReactNode;
  variant?: 'info' | 'warning';
}): React.JSX.Element {
  const styles =
    variant === 'warning'
      ? 'border-amber-500/30 bg-amber-500/8 text-amber-200'
      : 'border-indigo-500/30 bg-indigo-500/8 text-indigo-200';
  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-6 ${styles}`}>
      {children}
    </div>
  );
}
