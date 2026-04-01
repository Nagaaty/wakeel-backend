const { validationResult, body, param, query } = require('express-validator');

// Run validation and return 400 if errors
const validate = (validations) => async (req, res, next) => {
  for (const v of validations) await v.run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  }
  next();
};

// ── Reusable validation chains ─────────────────────────────────────────────
const rules = {
  register: [
    body('name').trim().notEmpty().withMessage('الاسم مطلوب').isLength({ min:2, max:100 }),
    body('email').isEmail().withMessage('بريد إلكتروني غير صحيح').normalizeEmail(),
    body('password').isLength({ min:8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
    body('role').optional().isIn(['client','lawyer']).withMessage('الدور يجب أن يكون client أو lawyer'),
    body('phone').optional().matches(/^(\+201|01)[0-9]{8,9}$/).withMessage('رقم هاتف مصري غير صحيح'),
  ],
  login: [
    body('email').isEmail().withMessage('بريد إلكتروني غير صحيح').normalizeEmail(),
    body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
  ],
  createBooking: [
    body('lawyerId').isInt({ min:1 }).withMessage('معرف المحامي غير صحيح'),
    body('bookingDate').isDate().withMessage('تاريخ الحجز غير صحيح'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('وقت البدء غير صحيح'),
    body('fee').isFloat({ min:0 }).withMessage('الرسوم يجب أن تكون رقماً موجباً'),
  ],
  createReview: [
    body('rating').isInt({ min:1, max:5 }).withMessage('التقييم يجب أن يكون بين 1 و 5'),
    body('comment').optional().trim().isLength({ max:1000 }),
  ],
  sendMessage: [
    body('content').optional().trim().isLength({ max:5000 }),
  ],
  updateProfile: [
    body('name').optional().trim().isLength({ min:2, max:100 }),
    body('phone').optional().matches(/^(\+201|01)[0-9]{8,9}$/).withMessage('رقم هاتف مصري غير صحيح'),
    body('bio').optional().trim().isLength({ max:1000 }),
  ],
  changePassword: [
    body('currentPassword').notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
    body('newPassword').isLength({ min:8 }).withMessage('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'),
  ],
  createTicket: [
    body('subject').trim().notEmpty().withMessage('الموضوع مطلوب').isLength({ max:200 }),
    body('body').trim().notEmpty().withMessage('محتوى التذكرة مطلوب').isLength({ max:5000 }),
  ],
  lawyerProfile: [
    body('specialization').optional().trim().isLength({ max:200 }),
    body('city').optional().trim().isLength({ max:100 }),
    body('consultation_fee').optional().isFloat({ min:50, max:50000 }).withMessage('الرسوم يجب أن تكون بين 50 و 50,000 جنيه'),
    body('experience_years').optional().isInt({ min:0, max:60 }),
    body('bar_number').optional().trim().isLength({ max:50 }),
  ],
};

module.exports = { validate, rules };
