import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpLeft,
  Bell,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  Clock3,
  FileCheck2,
  FilePlus2,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  Menu,
  MoreHorizontal,
  Printer,
  Search,
  Settings2,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import "./portfoliodashboard.css";

type Standard = {
  id: number;
  title: string;
  category: string;
  evidence: number;
  status: "مكتمل" | "قيد الإنجاز" | "لم يبدأ";
};

const startingStandards: Standard[] = [
  { id: 4, title: "التخطيط للتدريس بفاعلية", category: "الممارسات المهنية", evidence: 3, status: "قيد الإنجاز" },
  { id: 7, title: "تعزيز نواتج التعلّم", category: "التعليم والتعلّم", evidence: 2, status: "لم يبدأ" },
  { id: 9, title: "بناء بيئة صفية محفّزة", category: "الممارسات المهنية", evidence: 1, status: "قيد الإنجاز" },
];

const navigation = [
  { label: "الرئيسية", icon: LayoutDashboard },
  { label: "المعايير", icon: ListChecks },
  { label: "ملف الإنجاز", icon: BookOpenCheck },
  { label: "حسابي", icon: UserRound },
];

export function PortfolioDashboard() {
  const [activeNav, setActiveNav] = useState("الرئيسية");
  const [standards, setStandards] = useState(startingStandards);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const filteredStandards = useMemo(
    () => standards.filter((item) => `${item.title} ${item.category}`.includes(query.trim())),
    [standards, query],
  );

  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function completeStandard(id: number) {
    setStandards((current) =>
      current.map((item) => (item.id === id ? { ...item, status: "مكتمل" } : item)),
    );
    notify("تم تحديث حالة المعيار.");
  }

  return (
    <div className="injazi-app" dir="rtl">
      <header className="injazi-topbar">
        <a className="injazi-brand" href="#home" onClick={(event) => event.preventDefault()}>
          <span className="injazi-brand-mark"><BookOpenCheck size={20} strokeWidth={2} /></span>
          <span className="injazi-brand-word">إنجازي<span>ملفك المهني، أوضح</span></span>
        </a>
        <nav className="injazi-nav" aria-label="التنقل الرئيسي">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              type="button"
              key={label}
              className={`injazi-nav-item ${activeNav === label ? "is-active" : ""}`}
              onClick={() => {
                setActiveNav(label);
                if (label !== "الرئيسية") notify(`واجهة «${label}» في معاينة هذا النموذج.`);
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="injazi-profile-area">
          <button className="injazi-icon-button" type="button" aria-label="الإشعارات" onClick={() => notify("لا توجد إشعارات جديدة.")}>
            <Bell size={18} />
            <i />
          </button>
          <span className="injazi-top-divider" />
          <button className="injazi-profile" type="button" onClick={() => notify("إعدادات الحساب الشخصي")}>
            <span className="injazi-avatar">ن</span>
            <span className="injazi-profile-name">نورة العتيبي<small>معلمة رياضيات</small></span>
            <MoreHorizontal size={17} />
          </button>
          <button className="injazi-icon-button injazi-mobile-menu" type="button" aria-label="فتح القائمة" onClick={() => setShowMenu((value) => !value)}>
            {showMenu ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      {showMenu && (
        <div className="injazi-mobile-nav">
          {navigation.map(({ label, icon: Icon }) => (
            <button type="button" key={label} onClick={() => { setActiveNav(label); setShowMenu(false); }}>
              <Icon size={17} />{label}
            </button>
          ))}
        </div>
      )}

      <main className="injazi-main">
        <div className="injazi-breadcrumb"><span>مساحة المعلمة</span><ChevronLeft size={14} /><b>الرئيسية</b></div>

        <section className="injazi-welcome">
          <div className="injazi-welcome-copy">
            <span className="injazi-eyebrow"><Sparkles size={14} /> مساحتك المهنية</span>
            <h1>صباح الخير، أ. نورة</h1>
            <p>كل خطوة توثّق أثرًا. تابعي إنجازك وأضيفي شواهدك في مكان واحد.</p>
            <div className="injazi-welcome-foot">
              <span className="injazi-season-dot" />
              <span>الفصل الدراسي الثاني</span>
              <span className="injazi-foot-divider" />
              <span>١٤٤٦ هـ</span>
            </div>
          </div>
          <div className="injazi-progress-card">
            <div className="injazi-progress-ring" aria-label="نسبة الإنجاز 58 بالمئة">
              <div><strong>٥٨</strong><small>٪</small></div>
            </div>
            <div className="injazi-progress-info">
              <span className="injazi-progress-label">إنجازك اليدوي</span>
              <strong>٧ <small>من ١٢ معيارًا</small></strong>
              <span className="injazi-progress-note"><span /> أعلى من الأسبوع الماضي بـ ٨٪</span>
            </div>
            <div className="injazi-progress-sparkline" aria-hidden="true">
              <span style={{ height: "24%" }} /><span style={{ height: "38%" }} /><span style={{ height: "33%" }} />
              <span style={{ height: "51%" }} /><span style={{ height: "44%" }} /><span style={{ height: "68%" }} />
              <span style={{ height: "58%" }} /><span style={{ height: "82%" }} />
            </div>
          </div>
          <div className="injazi-decoration" aria-hidden="true"><span /><span /><span /></div>
        </section>

        <div className="injazi-section-heading">
          <div>
            <span className="injazi-kicker">نظرة سريعة</span>
            <h2>ملفك في أرقام</h2>
          </div>
          <span className="injazi-updated"><span /> آخر تحديث قبل قليل</span>
        </div>

        <section className="injazi-stats" aria-label="ملخص الإنجاز">
          <article className="injazi-stat-card stat-evidence">
            <span className="injazi-stat-icon"><FolderOpen size={19} /></span>
            <div><span>الشواهد المضافة</span><strong>١٤</strong><small>عبر ٨ معايير</small></div>
            <ArrowDownLeft className="injazi-stat-arrow" size={17} />
          </article>
          <article className="injazi-stat-card stat-progress">
            <span className="injazi-stat-icon"><Clock3 size={19} /></span>
            <div><span>قيد الإنجاز</span><strong>٣</strong><small>معايير تعملين عليها</small></div>
            <ArrowDownLeft className="injazi-stat-arrow" size={17} />
          </article>
          <article className="injazi-stat-card stat-complete">
            <span className="injazi-stat-icon"><CheckCircle2 size={19} /></span>
            <div><span>معايير مكتملة</span><strong>٧</strong><small>من أصل ١٢ معيارًا</small></div>
            <ArrowUpLeft className="injazi-stat-arrow" size={17} />
          </article>
          <article className="injazi-coverage-card">
            <div className="injazi-coverage-top"><span>تغطية الشواهد</span><span className="injazi-coverage-percent">٦٧٪</span></div>
            <div className="injazi-coverage-bar"><span /></div>
            <div className="injazi-coverage-bottom"><span>٨ معايير موثّقة</span><span>من ١٢</span></div>
          </article>
        </section>

        <section className="injazi-workspace">
          <div className="injazi-work-main">
            <div className="injazi-list-heading">
              <div>
                <span className="injazi-kicker">خطوتك التالية</span>
                <h2>معايير تستحق انتباهك <span className="injazi-count">٣</span></h2>
              </div>
              <label className="injazi-search">
                <Search size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحثي في المعايير" aria-label="ابحثي في المعايير" />
                {query && <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث"><X size={14} /></button>}
              </label>
            </div>
            <div className="injazi-standard-list">
              {filteredStandards.map((item) => (
                <article className="injazi-standard-row" key={item.id}>
                  <span className="injazi-standard-number">{String(item.id).padStart(2, "0")}</span>
                  <div className="injazi-standard-content">
                    <span className="injazi-standard-category">{item.category}</span>
                    <h3>{item.title}</h3>
                    <span className="injazi-standard-evidence"><FileCheck2 size={14} /> {item.evidence} {item.evidence === 1 ? "شاهد" : "شواهد"}</span>
                  </div>
                  <span className={`injazi-status ${item.status === "مكتمل" ? "status-done" : item.status === "قيد الإنجاز" ? "status-active" : "status-new"}`}>
                    <i />{item.status}
                  </span>
                  <button
                    type="button"
                    className={`injazi-row-action ${item.status === "مكتمل" ? "row-done" : ""}`}
                    aria-label={item.status === "مكتمل" ? "مكتمل" : `إكمال ${item.title}`}
                    onClick={() => item.status !== "مكتمل" && completeStandard(item.id)}
                  >
                    {item.status === "مكتمل" ? <Check size={17} /> : <ArrowLeft size={17} />}
                  </button>
                </article>
              ))}
              {filteredStandards.length === 0 && (
                <div className="injazi-empty"><Search size={22} /><strong>ما لقينا معيارًا بهذا الاسم</strong><span>جرّبي كلمة مختلفة أو امسحي البحث.</span></div>
              )}
            </div>
            <button type="button" className="injazi-view-all" onClick={() => { setActiveNav("المعايير"); notify("عرض جميع المعايير."); }}>
              عرض جميع المعايير <ArrowLeft size={15} />
            </button>
          </div>

          <aside className="injazi-side-column">
            <div className="injazi-actions-card">
              <div className="injazi-side-title"><span className="injazi-kicker">اختصارات</span><button type="button" aria-label="خيارات الاختصارات" onClick={() => notify("تخصيص الاختصارات قريبًا.")}><Settings2 size={17} /></button></div>
              <h2>ابدئي بخطوة صغيرة</h2>
              <button type="button" className="injazi-primary-action" onClick={() => notify("اختاري معيارًا لإضافة شاهد جديد.")}>
                <span><FilePlus2 size={18} /></span><span>إضافة شاهد جديد<small>وثّقي موقفًا أو إنجازًا</small></span><ArrowLeft size={16} />
              </button>
              <button type="button" className="injazi-secondary-action" onClick={() => notify("جارٍ تجهيز معاينة ملف الإنجاز.")}>
                <span><Printer size={17} /></span>معاينة ملف الإنجاز<ArrowLeft size={16} />
              </button>
              <button type="button" className="injazi-secondary-action" onClick={() => notify("تم فتح إرشادات تنظيم الشواهد.")}>
                <span><CircleHelp size={17} /></span>كيف أنظّم شواهدي؟<ArrowLeft size={16} />
              </button>
            </div>
            <div className="injazi-tip-card">
              <span className="injazi-tip-symbol"><Sparkles size={16} /></span>
              <span className="injazi-kicker">تلميحة إنجازي</span>
              <p>أضيفي وصفًا قصيرًا لكل شاهد؛ سيساعدك على تذكّر أثره عند إعداد ملفك.</p>
              <button type="button" onClick={() => notify("اطّلعي على دليل توثيق الشواهد.")}>اقرئي دليل الشواهد <ArrowLeft size={14} /></button>
              <span className="injazi-tip-lines" aria-hidden="true" />
            </div>
          </aside>
        </section>

        <footer className="injazi-footer">
          <span>إنجازي <i /> مساحة مهنية تنمو معك</span>
          <button type="button" onClick={() => notify("يسعدنا مساعدتك — تواصلي مع فريق إنجازي.")}>نحتاج مساعدة؟ <ArrowLeft size={13} /></button>
        </footer>
      </main>
      {notice && <div className="injazi-toast" role="status"><CheckCircle2 size={17} />{notice}<button type="button" onClick={() => setNotice("")} aria-label="إغلاق"><X size={15} /></button></div>}
    </div>
  );
}
