import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'מדיניות פרטיות — FitGrade',
};

export default function PrivacyPage(): React.JSX.Element {
  const lastUpdated = '21 במאי 2026';

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
        <h1 className="mb-2 text-2xl font-extrabold text-white">מדיניות פרטיות</h1>
        <p className="mb-10 text-xs text-slate-500">עדכון אחרון: {lastUpdated}</p>

        <Section title="1. מי אנחנו">
          <p>
            FitGrade היא מערכת דיגיטלית לניהול ציונים וכושר גופני בבתי ספר ישראליים.
            המערכת מיועדת למורים לחינוך גופני ולתלמידים בלבד.
          </p>
        </Section>

        <Section title="2. מידע שנאסף">
          <p>אנו אוספים את הפרטים הבאים על תלמידים, בהתאם לצורך התפעולי:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-300">
            <li>שם פרטי ושם משפחה</li>
            <li>מספר תעודת זהות (ת.ז.) — לצורך זיהוי ואימות בלבד</li>
            <li>תאריך לידה — לחישוב ציונים תקניים לפי גיל</li>
            <li>מגדר — לחישוב ציונים תקניים לפי מגדר</li>
            <li>תוצאות מבחני כושר גופני, ציונים ונוכחות</li>
          </ul>
          <p className="mt-3">
            אנו אוספים מידע על מורים: שם מלא, כתובת דואר אלקטרוני (דרך חשבון Google).
          </p>
        </Section>

        <Section title="3. הבסיס החוקי לעיבוד המידע">
          <p>
            איסוף מספרי תעודת זהות ומידע אישי אחר מתבצע מכוח{' '}
            <strong className="text-white">חובה חוקית</strong> החלה על מוסדות חינוך
            (חוק חינוך ממלכתי, תקנות חינוך) ולצורך{' '}
            <strong className="text-white">ביצוע חוזה</strong> — מתן שירות ניהול ציונים
            ונוכחות לבית הספר. בסיס זה אינו מותנה בהסכמה נפרדת, אולם אנו מחויבים
            לשקיפות מלאה לגבי השימוש בו.
          </p>
        </Section>

        <Section title="4. אופן השימוש במידע">
          <ul className="list-inside list-disc space-y-1 text-slate-300">
            <li>חישוב ציונים ומדדי כושר גופני לפי טבלאות תקן מאושרות</li>
            <li>ניהול נוכחות ורישום שיעורים</li>
            <li>הפקת דוחות לאנשי הצוות ההוראתי המורשים</li>
            <li>אימות זהות תלמידים בעת כניסה למערכת</li>
          </ul>
          <p className="mt-3">
            מספר תעודת הזהות <strong className="text-white">אינו מוצג</strong> בממשק הרגיל
            — הוא מסווג ומוצג בחלקו האחרון בלבד (XXXXX1234) למניעת חשיפה מיותרת.
          </p>
        </Section>

        <Section title="5. אבטחת מידע">
          <ul className="list-inside list-disc space-y-1 text-slate-300">
            <li>סיסמאות מאובטחות בהצפנה חד-כיוונית (bcrypt, 12 סיבובים)</li>
            <li>תקשורת מוצפנת (HTTPS/TLS) בין הדפדפן לשרת</li>
            <li>יומן ביקורת מלא לכל שינוי בציון או נוכחות, לתקופה של 24 חודשים</li>
            <li>הפרדה מוחלטת בין נתוני כיתות שונות ובין מורים שונים</li>
            <li>כניסת תלמיד מוגבלת לנתוניו האישיים בלבד</li>
          </ul>
        </Section>

        <Section title="6. שמירת מידע">
          <p>
            נתוני תלמידים נשמרים כל עוד בית הספר רשום במערכת. יומן הביקורת נשמר
            למשך <strong className="text-white">24 חודשים</strong> לפחות, בהתאם לדרישות
            חוק הגנת הפרטיות (תיקון מס׳ 13, 2025).
          </p>
        </Section>

        <Section title="7. זכויותיך כנושא מידע">
          <p>
            בהתאם לחוק הגנת הפרטיות, התשמ״א-1981 ותיקוניו, עומדות לך הזכויות הבאות:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-300">
            <li>
              <strong className="text-white">עיון</strong> — לקבל עותק של המידע השמור עליך
            </li>
            <li>
              <strong className="text-white">תיקון</strong> — לדרוש תיקון מידע שגוי
            </li>
            <li>
              <strong className="text-white">מחיקה</strong> — לדרוש מחיקת מידע בכפוף
              לדרישות חוקיות
            </li>
          </ul>
          <p className="mt-3">
            לממש זכויות אלה, יש לפנות למנהל/ת המוסד החינוכי שבו הופעלה המערכת.
          </p>
        </Section>

        <Section title="8. העברת מידע לצדדים שלישיים">
          <p>
            אין אנו מוכרים, מעבירים, או חושפים מידע אישי לצדדים שלישיים, למעט:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-300">
            <li>
              <strong className="text-white">Google LLC</strong> — לצורך אימות זהות מורים
              דרך Google OAuth (מידע מינימלי: שם ואימייל בלבד)
            </li>
            <li>
              ספקי תשתית ענן המאחסנים את המסד נתונים, בכפוף להסכמי עיבוד נתונים תואמים
            </li>
          </ul>
        </Section>

        <Section title="9. צור קשר">
          <p>
            לשאלות בנושא פרטיות ועיבוד מידע, פנו למנהל/ת בית הספר או לאחראי/ת
            הגנת הפרטיות של המוסד החינוכי.
          </p>
        </Section>

        <div className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          FitGrade · מדיניות פרטיות · {lastUpdated}
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
