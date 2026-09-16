const db = require('../config/db');

/**
 * Gửi tin nhắn SMS thông báo phê duyệt tài khoản tới số điện thoại khách hàng.
 * @param {Object} options
 * @param {string} options.phone - Số điện thoại khách hàng
 * @param {string} options.storeName - Tên tiệm vàng / Cửa hàng
 * @param {string} options.softwarePackage - Gói phần mềm đăng ký
 * @param {string} options.loginId - Tên đăng nhập (SĐT)
 * @param {string} options.password - Mật khẩu đăng ký
 */
async function sendApprovalSMS({ phone, storeName, softwarePackage, loginId, password }) {
  const pkgName = softwarePackage || 'Gói phần mềm T3Gold';
  const content = `🎉 CHÚC MỪNG! GÓI PHẦN MỀM T3GOLD ĐÃ ĐƯỢC PHÊ DUYỆT\n\n${pkgName} của anh/chị đã được T3Gold phê duyệt và kích hoạt thành công.\n\n🔐 Thông tin đăng nhập\n\nTên đăng nhập: ${loginId}\nMật khẩu: ${password}\n\n✨ Anh/chị có thể đăng nhập và bắt đầu trải nghiệm các tính năng quản lý trên T3Gold ngay hôm nay.\n\nT3Gold – Thao tác đơn giản, báo cáo thông minh.`;

  console.log(`====================================================`);
  console.log(`[SMS NOTIFICATION SERVICE] 📱 ĐANG GỬI TIN NHẮN TỚI: ${phone}`);
  console.log(`[NỘI DUNG TIN NHẮN]:\n${content}`);
  console.log(`====================================================`);

  // Lưu lịch sử nhật ký gửi tin nhắn SMS vào database.json
  const smsLog = {
    phone,
    storeName,
    content,
    status: 'sent',
    sentAt: new Date().toISOString()
  };

  try {
    db.insert('smsLogs', smsLog);
  } catch (e) {
    console.error('Error saving SMS log to database:', e);
  }

  return {
    success: true,
    message: content,
    phone,
    sentAt: smsLog.sentAt
  };
}

/**
 * Gửi tin nhắn SMS khôi phục mật khẩu mới tới số điện thoại khách hàng.
 * @param {Object} options
 * @param {string} options.phone - Số điện thoại khách hàng
 * @param {string} options.storeName - Tên tiệm vàng / Cửa hàng
 * @param {string} options.loginId - Tên đăng nhập (SĐT/Email)
 * @param {string} options.newPassword - Mật khẩu mới vừa được cấp
 */
async function sendForgotPasswordSMS({ phone, storeName, loginId, newPassword }) {
  const content = `🔑 KHÔI PHỤC MẬT KHẨU TÀI KHOẢN T3GOLD\n\nHệ thống T3Gold vừa cấp mật khẩu đăng nhập mới theo yêu cầu của anh/chị${storeName ? ` (${storeName})` : ''}.\n\n🔐 Thông tin đăng nhập mới:\nTên đăng nhập: ${loginId}\nMật khẩu mới: ${newPassword}\n\n✨ Vui lòng sử dụng mật khẩu này để đăng nhập lại hệ thống.\n\nT3Gold – Thao tác đơn giản, báo cáo thông minh.`;

  console.log(`====================================================`);
  console.log(`[SMS RESET PASSWORD SERVICE] 📱 ĐANG GỬI TIN NHẮN TỚI: ${phone}`);
  console.log(`[NỘI DUNG TIN NHẮN KHÔI PHỤC]:\n${content}`);
  console.log(`====================================================`);

  const smsLog = {
    phone,
    storeName: storeName || 'Khách hàng',
    type: 'forgot_password',
    content,
    status: 'sent',
    sentAt: new Date().toISOString()
  };

  try {
    db.insert('smsLogs', smsLog);
  } catch (e) {
    console.error('Error saving SMS log to database:', e);
  }

  return {
    success: true,
    message: content,
    phone,
    sentAt: smsLog.sentAt
  };
}

/**
 * Gửi tin nhắn SMS chứa mã xác thực OTP 6 số tới khách hàng.
 * @param {Object} options
 * @param {string} options.phone - Số điện thoại khách hàng
 * @param {string} options.storeName - Tên tiệm vàng / Cửa hàng
 * @param {string} options.otpCode - Mã OTP 6 chữ số
 */
async function sendOtpSMS({ phone, storeName, otpCode }) {
  const content = `[T3Gold] Mã OTP khôi phục mật khẩu của anh/chị${storeName ? ` (${storeName})` : ''} là: ${otpCode}. Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho người khác.`;

  console.log(`====================================================`);
  console.log(`[SMS OTP SERVICE] 📱 ĐANG GỬI MÃ OTP TỚI: ${phone}`);
  console.log(`[MÃ OTP KHÔI PHỤC]: >>> ${otpCode} <<<`);
  console.log(`[NỘI DUNG TIN NHẮN OTP]:\n${content}`);
  console.log(`====================================================`);

  const smsLog = {
    phone,
    storeName: storeName || 'Khách hàng',
    type: 'reset_otp',
    otpCode,
    content,
    status: 'sent',
    sentAt: new Date().toISOString()
  };

  try {
    db.insert('smsLogs', smsLog);
  } catch (e) {
    console.error('Error saving SMS log to database:', e);
  }

  return {
    success: true,
    message: content,
    phone,
    otpCode,
    sentAt: smsLog.sentAt
  };
}

module.exports = {
  sendApprovalSMS,
  sendForgotPasswordSMS,
  sendOtpSMS
};
