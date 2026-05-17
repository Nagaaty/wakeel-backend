// ─── Egyptian Laws Database (Verbatim Text) ──────────────────────────────────
// This file contains the exact, verbatim text of Egyptian laws as published in the Official Gazette.

export const LAW_DATABASE = [
  // ─── القانون المدني (رقم 131 لسنة 1948) ───
  {
    id: 'civil_1',
    law: 'القانون المدني (رقم 131 لسنة 1948)',
    lawEn: 'Civil Code',
    article: 'مادة 1',
    articleEn: 'Article 1',
    content: 'تسري النصوص التشريعية على جميع المسائل التي تتناولها هذه النصوص في لفظها أو في فحواها. فإذا لم يوجد نص تشريعي يمكن تطبيقه، حكم القاضي بمقتضى العرف، فإذا لم يوجد، فبمقتضى مبادئ الشريعة الإسلامية، فإذا لم توجد، فبمقتضى مبادئ القانون الطبيعي وقواعد العدالة.',
    contentEn: 'Legislative provisions govern all matters to which these provisions apply in letter or spirit. In the absence of a legislative provision, the judge shall decide according to custom, and in the absence of custom, according to the principles of Islamic Sharia.',
  },
  {
    id: 'civil_44',
    law: 'القانون المدني (رقم 131 لسنة 1948)',
    lawEn: 'Civil Code',
    article: 'مادة 44',
    articleEn: 'Article 44',
    content: 'كل شخص يبلغ سن الرشد متمتعاً بقواه العقلية، ولم يحجر عليه، يكون كامل الأهلية لمباشرة حقوقه المدنية.',
    contentEn: 'Every person who has attained the age of majority, is of sound mind, and has not been interdicted, has full capacity to exercise his civil rights.',
  },
  {
    id: 'civil_147',
    law: 'القانون المدني (رقم 131 لسنة 1948)',
    lawEn: 'Civil Code',
    article: 'مادة 147',
    articleEn: 'Article 147',
    content: 'العقد شريعة المتعاقدين، فلا يجوز نقضه ولا تعديله إلا باتفاق الطرفين، أو للأسباب التي يقررها القانون.',
    contentEn: 'The contract makes the law of the parties. It can be revoked or altered only by mutual consent of the parties or for reasons provided for by the law.',
  },
  {
    id: 'civil_148',
    law: 'القانون المدني (رقم 131 لسنة 1948)',
    lawEn: 'Civil Code',
    article: 'مادة 148',
    articleEn: 'Article 148',
    content: 'يجب تنفيذ العقد طبقاً لما اشتمل عليه وبطريقة تتفق مع ما يوجبه حسن النية.',
    contentEn: 'A contract must be performed in accordance with its contents and in compliance with the requirements of good faith.',
  },
  {
    id: 'civil_163',
    law: 'القانون المدني (رقم 131 لسنة 1948)',
    lawEn: 'Civil Code',
    article: 'مادة 163',
    articleEn: 'Article 163',
    content: 'كل خطأ سبب ضرراً للغير يلزم من ارتكبه بالتعويض.',
    contentEn: 'Every fault which causes injury to another imposes an obligation to make reparation upon the person by whom it is committed.',
  },

  // ─── قانون العقوبات (رقم 58 لسنة 1937) ───
  {
    id: 'penal_234',
    law: 'قانون العقوبات (رقم 58 لسنة 1937)',
    lawEn: 'Penal Code',
    article: 'مادة 234',
    articleEn: 'Article 234',
    content: 'من قتل نفساً عمداً من غير سبق إصرار ولا ترصد يعاقب بالسجن المؤبد أو المشدد.',
    contentEn: 'Whoever intentionally kills a person without premeditation or lying in wait shall be punished with life or aggravated imprisonment.',
  },
  {
    id: 'penal_311',
    law: 'قانون العقوبات (رقم 58 لسنة 1937)',
    lawEn: 'Penal Code',
    article: 'مادة 311',
    articleEn: 'Article 311',
    content: 'كل من اختلس منقولا مملوكا لغيره فهو سارق.',
    contentEn: 'Whoever embezzles a movable property belonging to another is a thief.',
  },

  // ─── قانون مكافحة جرائم تقنية المعلومات (رقم 175 لسنة 2018) ───
  {
    id: 'cyber_25',
    law: 'مكافحة جرائم تقنية المعلومات (175 لسنة 2018)',
    lawEn: 'Cybercrimes Law',
    article: 'مادة 25',
    articleEn: 'Article 25',
    content: 'يعاقب بالحبس مدة لا تقل عن ستة أشهر، وبغرامة لا تقل عن خمسين ألف جنيه ولا تجاوز مائة ألف جنيه، أو بإحدى هاتين العقوبتين، كل من اعتدى على أي من المبادئ أو القيم الأسرية في المجتمع المصري، أو انتهك حرمة الحياة الخاصة.',
    contentEn: 'Punishable by imprisonment for at least 6 months and a fine between 50,000 and 100,000 EGP, or either penalty, for anyone who violates Egyptian family principles or values, or breaches the privacy of an individual.',
  }
];
