/** Transcribed from the educational objectives reference supplied by the user.
 * These are general educational aims, not claims about a teacher's achievements.
 */
export const SAUDI_EDUCATIONAL_AIM =
  "غاية التعليم فهم الإسلام فهماً صحيحاً متكاملاً، وغرس العقيدة الإسلامية ونشرها، وتزويد الطالب بالقيم والتعاليم الإسلامية والمثل العليا، وإكسابه المعارف والمهارات المختلفة، وتنمية الاتجاهات السلوكية البناءة، وتطوير المجتمع اقتصادياً واجتماعياً وثقافياً، وتهيئة الفرد ليكون عضواً نافعاً في بناء مجتمعه.";

export const SAUDI_EDUCATIONAL_OBJECTIVES = [
  "النصيحة لكتاب الله وسنة رسوله بصيانتهما، ورعاية حفظهما، وتعهد علومهما، والعمل بما جاء فيهما.",
  "تزويد الفرد بالأفكار والمشاعر والقدرات اللازمة لحمل رسالة الإسلام.",
  "تربية المواطن المؤمن ليكون لبنة صالحة في بناء أمته، ويشعر بمسؤوليته لخدمة بلاده والدفاع عنها.",
  "تنمية إحساس الطلاب بمشكلات المجتمع الثقافية والاقتصادية والاجتماعية، وإعدادهم للإسهام في حلها.",
  "تأكيد كرامة الفرد وتوفير الفرص المناسبة لتنمية قدراته حتى يستطيع المساهمة في نهضة الأمة.",
  "رفع مستوى الصحة النفسية بإحلال السكينة في نفس الطالب، وتهيئة الجو المدرسي المناسب.",
  "تنمية مهارات القراءة وعادة المطالعة سعياً وراء زيادة المعارف.",
  "إكساب القدرة على التعبير الصحيح في التخاطب والتحدث والكتابة بلغة سليمة وتفكير منظم.",
  "تعويد الطالب العادات الصحية السليمة، ونشر الوعي الصحي.",
  "التعرف على الفروق الفردية بين الطلاب توطئة لحسن توجيههم، ومساعدتهم على النمو وفق قدراتهم واستعداداتهم وميولهم.",
  "الاهتمام باكتشاف الموهوبين ورعايتهم، وإتاحة الإمكانيات والفرص المختلفة لنمو مواهبهم في إطار البرامج العامة، وبوضع برامج خاصة.",
  "إقامة الصلات الوثيقة التي تربط بين أبناء الإسلام وتبرز وحدة أمته.",
] as const;

export function buildEducationalObjectives(): string {
  return `
    <section data-educational-objectives="true" style="direction:rtl;text-align:right">
      <div style="font-size:11px;color:#8C7146;margin-bottom:10px">من وثيقة سياسة التعليم · وفق المرجع المقدم</div>
      <div style="padding:15px 18px;background:#F0ECE2;border-right:3px solid #C5A46D">
        <h2 style="font-size:16px;color:#07584F;margin:0 0 6px">غاية التعليم</h2>
        <p style="margin:0;font-size:13px;line-height:1.85;color:#40514E">${SAUDI_EDUCATIONAL_AIM}</p>
      </div>
      <h2 style="margin:17px 0 12px;font-size:16px;color:#07584F">من الأهداف العامة التي تحقق غاية التعليم</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px 13px">
        ${SAUDI_EDUCATIONAL_OBJECTIVES.map((objective, index) => `
          <div data-educational-objective="${index + 1}" style="display:flex;align-items:flex-start;gap:9px;padding:12px 13px;background:#FFFFFF;border:1px solid #E5DFD2;border-right:2px solid #07584F;box-sizing:border-box">
            <span dir="ltr" style="flex-shrink:0;font-size:12px;line-height:1.85;font-weight:700;color:#8C7146">${String(index + 1).padStart(2, "0")}</span>
            <p style="margin:0;font-size:12.5px;line-height:1.85;color:#40514E">${objective}</p>
          </div>`).join("")}
      </div>
      <p style="margin:13px 0 0;color:#697773;font-size:10px;line-height:1.7">أهداف تعليمية عامة من المرجع المرفق؛ لا تمثل إقراراً بإنجازات المعلم أو تقييماً لأدائه.</p>
    </section>`;
}
