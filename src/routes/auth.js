const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { sendForgotPasswordSMS, sendOtpSMS } = require('../utils/sms');
const { sendZaloCustomerRegistrationZNS, sendZaloAdminNotification } = require('../utils/zalo');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting the API server.');
}

// Register endpoint
router.post('/register', async (req, res) => {
  const { name, phone, email, storeName, address, password, referrerCode, softwarePackage } = req.body;

  // Basic validation (Email is optional now)
  if (!name || !phone || !storeName || !password) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ các thông tin bắt buộc (Họ tên, SĐT, Tên tiệm, Mật khẩu).' });
  }

  const users = db.getCollection('users');
  
  // Check if email or phone already exists
  const existingUser = users.find(u => 
    (phone && u.phone === phone) || 
    (email && email.trim() !== '' && u.email === email)
  );
  if (existingUser) {
    return res.status(400).json({ message: 'Số điện thoại hoặc Email đã được đăng ký sử dụng.' });
  }

  // Hash password
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  // Generate a simple referral code based on storeName
  const cleanStoreName = storeName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove tone marks
    .replace(/[^a-zA-Z0-9]/g, '')     // alphanumeric only
    .toUpperCase();
  const referralCode = `${cleanStoreName.substring(0, 8)}${Math.floor(100 + Math.random() * 900)}`;

  // Default package amount
  const selectedPackage = softwarePackage || 'T3Gold Trial - Dùng thử miễn phí';
  let amountPaid = 0;
  if (selectedPackage.includes('1 Năm')) amountPaid = 3500000;
  else if (selectedPackage.includes('3 Năm')) amountPaid = 8500000;
  else if (selectedPackage.includes('Vĩnh Viễn')) amountPaid = 9500000;

  // License Key generation
  const cleanPkg = selectedPackage.split('-')[0].replace('T3Gold', '').trim().toUpperCase();
  const licenseKey = `T3G-${cleanPkg || 'TRIAL'}-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // Expiration Date calculation
  let expirationDate = new Date();
  if (selectedPackage.includes('1 Năm')) {
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
  } else if (selectedPackage.includes('3 Năm')) {
    expirationDate.setFullYear(expirationDate.getFullYear() + 3);
  } else if (selectedPackage.includes('Vĩnh Viễn')) {
    expirationDate.setFullYear(expirationDate.getFullYear() + 70); // Lifetime
  } else {
    expirationDate.setDate(expirationDate.getDate() + 30); // 30 days trial
  }

  // Khôi phục quyền kích hoạt / phê duyệt của Admin:
  // Thành viên đăng ký mới sẽ ở trạng thái Chờ duyệt (isApproved: false, status: 'pending')
  const newUser = {
    name,
    phone,
    email: email || '',
    password: hashedPassword,
    rawPassword: password,
    storeName,
    address: address || '',
    role: 'member',
    isApproved: false, // Chờ Admin phê duyệt kích hoạt
    status: 'pending', // Trạng thái chờ Admin kích hoạt bản quyền
    softwarePackage: selectedPackage,
    amountPaid,
    licenseKey,
    expirationDate: expirationDate.toISOString(),
    referralCode,
    referrerCode: referrerCode || '',
    createdAt: new Date().toISOString()
  };

  const savedUser = db.insert('users', newUser);

  // Send Zalo Notification to Customer (ZNS)
  try {
    await sendZaloCustomerRegistrationZNS({
      phone: savedUser.phone,
      name: savedUser.name,
      storeName: savedUser.storeName,
      softwarePackage: savedUser.softwarePackage
    });
  } catch (zaloErr) {
    console.error('Lỗi khi gửi Zalo ZNS cho khách hàng:', zaloErr);
  }

  // Send Zalo Notification to Admin
  try {
    const adminUser = users.find(u => u.role === 'admin' || u.role === 'staff_admin');
    const adminPhone = adminUser ? adminUser.phone : '0900000000';
    await sendZaloAdminNotification({
      adminPhone,
      customerName: savedUser.name,
      customerPhone: savedUser.phone,
      storeName: savedUser.storeName,
      softwarePackage: savedUser.softwarePackage
    });
  } catch (zaloAdminErr) {
    console.error('Lỗi khi gửi Zalo thông báo cho Admin:', zaloAdminErr);
  }

  // If there's a referrer, write a pending referral record
  if (referrerCode) {
    const referrer = users.find(u => u.referralCode === referrerCode);
    if (referrer) {
      db.insert('referrals', {
        referrerId: referrer.id,
        refereeName: storeName,
        status: 'pending',
        commission: 0
      });
    }
  }

  // Create token
  const token = jwt.sign(
    { id: savedUser.id, email: savedUser.email, role: savedUser.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const { password: _, ...userProfile } = savedUser;
  res.status(201).json({
    message: 'Đăng ký thành viên thành công!',
    token,
    user: userProfile
  });
});

// Register package for existing logged in user
router.post('/register-package', verifyToken, async (req, res) => {
  const { softwarePackage, storeName, phone } = req.body;
  const user = db.findById('users', req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
  }

  const selectedPackage = softwarePackage || user.softwarePackage || 'Gói phần mềm T3Gold';
  const updatedUser = db.update('users', user.id, {
    softwarePackage: selectedPackage,
    status: 'pending',
    isApproved: false
  });

  // Trigger Zalo ZNS notifications
  try {
    await sendZaloCustomerRegistrationZNS({
      phone: updatedUser.phone,
      name: updatedUser.name,
      storeName: updatedUser.storeName || storeName,
      softwarePackage: selectedPackage
    });
  } catch (err) {
    console.error('Error sending Zalo ZNS customer reg:', err);
  }

  try {
    const adminUser = db.getCollection('users').find(u => u.role === 'admin' || u.role === 'staff_admin');
    const adminPhone = adminUser ? adminUser.phone : '0988768345';
    await sendZaloAdminNotification({
      adminPhone,
      customerName: updatedUser.name,
      customerPhone: updatedUser.phone,
      storeName: updatedUser.storeName || storeName,
      softwarePackage: selectedPackage
    });
  } catch (err) {
    console.error('Error sending Zalo ZNS admin alert:', err);
  }

  const { password: _, ...userProfile } = updatedUser;
  res.json({ message: 'Đăng ký gói thành công!', user: userProfile });
});

// Login endpoint
router.post('/login', (req, res) => {
  const { loginId, password } = req.body; // Can be email or phone

  if (!loginId || !password) {
    return res.status(400).json({ message: 'Vui lòng cung cấp tài khoản và mật khẩu.' });
  }

  const users = db.getCollection('users');
  const user = users.find(u => u.email === loginId || u.phone === loginId);

  if (!user) {
    return res.status(401).json({ message: 'Tài khoản đăng nhập hoặc mật khẩu không chính xác.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Tài khoản đăng nhập hoặc mật khẩu không chính xác.' });
  }

  // Sign token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const { password: _, ...userProfile } = user;
  res.json({
    message: 'Đăng nhập thành công!',
    token,
    user: userProfile
  });
});

// Forgot password endpoint - Reset & Send new password via SMS (Legacy direct reset)
router.post('/forgot-password', async (req, res) => {
  const { phone } = req.body;

  if (!phone || !phone.trim()) {
    return res.status(400).json({ message: 'Vui lòng nhập Số điện thoại tài khoản đăng ký.' });
  }

  const cleanPhone = phone.trim();
  const users = db.getCollection('users');
  const user = users.find(u => u.phone === cleanPhone || u.email === cleanPhone);

  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản với Số điện thoại này.' });
  }

  // Generate a random 6-digit numeric temporary password
  const newPassword = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash the new password and update user in database
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(newPassword, salt);

  db.update('users', user.id, {
    password: hashedPassword,
    rawPassword: newPassword,
    passwordResetAt: new Date().toISOString()
  });

  // Send new password via SMS service
  let smsSent = false;
  if (user.phone) {
    try {
      await sendForgotPasswordSMS({
        phone: user.phone,
        storeName: user.storeName,
        loginId: user.phone,
        newPassword
      });
      smsSent = true;
    } catch (err) {
      console.error('Error sending forgot password SMS:', err);
    }
  }

  // Mask phone for response security
  const maskedPhone = cleanPhone.length > 6
    ? cleanPhone.substring(0, 3) + '***' + cleanPhone.substring(cleanPhone.length - 3)
    : cleanPhone;

  res.json({
    success: true,
    message: `🎉 Đã khởi tạo mật khẩu mới thành công! Tin nhắn SMS chứa mật khẩu mới đã được gửi tới SĐT ${maskedPhone}.`,
    maskedPhone,
    smsSent
  });
});

// Step 1 OTP: Request OTP code via SMS for password reset
router.post('/request-reset-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone || !phone.trim()) {
    return res.status(400).json({ message: 'Vui lòng nhập Số điện thoại tài khoản đăng ký.' });
  }

  const cleanPhone = phone.trim();
  const users = db.getCollection('users');
  const user = users.find(u => u.phone === cleanPhone || u.email === cleanPhone);

  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản với Số điện thoại này.' });
  }

  // Generate a random 6-digit OTP code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  db.update('users', user.id, {
    otpCode,
    otpExpiresAt
  });

  let smsSent = false;
  if (user.phone) {
    try {
      await sendOtpSMS({
        phone: user.phone,
        storeName: user.storeName,
        otpCode
      });
      smsSent = true;
    } catch (err) {
      console.error('Error sending OTP SMS:', err);
    }
  }

  const maskedPhone = cleanPhone.length > 6
    ? cleanPhone.substring(0, 3) + '***' + cleanPhone.substring(cleanPhone.length - 3)
    : cleanPhone;

  res.json({
    success: true,
    message: `📲 Mã xác thực OTP đã được gửi tới SĐT ${maskedPhone}. Mã có hiệu lực trong 5 phút.`,
    phone: cleanPhone,
    maskedPhone,
    smsSent,
    expiresInSeconds: 300
  });
});

// Step 2 OTP: Verify OTP code and reset password to customer's chosen password
router.post('/reset-password-otp', async (req, res) => {
  const { phone, otpCode, newPassword } = req.body;

  if (!phone || !phone.trim()) {
    return res.status(400).json({ message: 'Vui lòng cung cấp Số điện thoại.' });
  }
  if (!otpCode || !otpCode.trim()) {
    return res.status(400).json({ message: 'Vui lòng nhập Mã OTP xác thực (6 số).' });
  }
  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
  }

  const cleanPhone = phone.trim();
  const cleanOtp = otpCode.trim();
  const users = db.getCollection('users');
  const user = users.find(u => u.phone === cleanPhone || u.email === cleanPhone);

  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản với Số điện thoại này.' });
  }

  // Verify OTP code and expiration time
  if (!user.otpCode || user.otpCode !== cleanOtp) {
    return res.status(400).json({ message: 'Mã OTP xác minh không chính xác. Vui lòng kiểm tra lại.' });
  }

  if (!user.otpExpiresAt || Date.now() > user.otpExpiresAt) {
    return res.status(400).json({ message: 'Mã OTP đã hết hạn (sau 5 phút). Vui lòng bấm "Gửi lại mã OTP".' });
  }

  // Hash the custom new password and update user in DB
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(newPassword.trim(), salt);

  db.update('users', user.id, {
    password: hashedPassword,
    rawPassword: newPassword.trim(),
    otpCode: null,
    otpExpiresAt: null,
    passwordResetAt: new Date().toISOString()
  });

  res.json({
    success: true,
    message: '🎉 Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.'
  });
});

// Get current user profile
router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// Create multi-role account (Admin, Shareholder, Manager, Staff)
router.post('/create-staff', verifyToken, requireAdmin, (req, res) => {
  const { name, phone, email, password, role, nodeId, nodeIds, commission, scope } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ các thông tin bắt buộc (Họ tên, SĐT, Mật khẩu).' });
  }

  const users = db.getCollection('users');
  const existingUser = users.find(u => u.phone === phone || (email && email.trim() !== '' && u.email === email));
  if (existingUser) {
    return res.status(400).json({ message: 'Số điện thoại hoặc Email đã được đăng ký sử dụng.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);
  const targetRole = role || 'staff_admin';

  const targetNodeIds = Array.isArray(nodeIds) && nodeIds.length > 0
    ? nodeIds
    : (nodeId ? [nodeId] : []);

  const newUser = {
    name,
    phone,
    email: email || `${phone}@t3gold.vn`,
    password: hashedPassword,
    storeName: targetRole === 'shareholder' ? `Hội Đồng Cổ Đông - ${name}` : 'Ban Quản Trị T3Gold',
    address: 'Trụ sở chính T3Gold',
    role: targetRole,
    nodeId: targetNodeIds[0] || null,
    nodeIds: targetNodeIds,
    scope: scope || 'all',
    commission: Number(commission || 0),
    isApproved: true, // Immediate access to view Org Chart without approval
    isRevenueApproved: targetRole !== 'shareholder', // Revenue breakdown requires Super Admin approval
    status: 'sold',
    createdAt: new Date().toISOString()
  };

  const savedUser = db.insert('users', newUser);

  // If creating a shareholder and nodeId is specified, link or update orgNode
  if (targetRole === 'shareholder') {
    if (targetNodeIds[0]) {
      db.update('orgNodes', targetNodeIds[0], {
        userId: savedUser.id,
        commission: Number(commission || 0)
      });
    } else {
      // Auto-create shareholder node under Chairman if none specified
      const rootChairman = db.getCollection('orgNodes').find(n => !n.parentId);
      const newShareholderNode = db.insert('orgNodes', {
        label: `Cổ đông ${name}`,
        parentIds: rootChairman ? [rootChairman.id] : [],
        parentId: rootChairman ? rootChairman.id : null,
        roleType: 'shareholder',
        commission: Number(commission || 0),
        expenses: [],
        taxes: 0,
        userId: savedUser.id,
        customFields: []
      });
      db.update('users', savedUser.id, { nodeId: newShareholderNode.id, nodeIds: [newShareholderNode.id] });
    }
  } else if (targetNodeIds.length > 0) {
    // Link account to all selected department nodes
    const orgNodesList = db.getCollection('orgNodes');
    const updatedOrgNodes = orgNodesList.map(n => {
      if (targetNodeIds.includes(n.id)) {
        return { ...n, userId: savedUser.id };
      }
      return n;
    });
    db.setCollection('orgNodes', updatedOrgNodes);
  }

  const { password: _, ...userProfile } = savedUser;

  res.status(201).json({
    message: `Khởi tạo tài khoản ${targetRole === 'shareholder' ? 'Cổ đông' : targetRole === 'manager' ? 'Quản lý bộ phận' : targetRole === 'staff' ? 'Nhân sự' : 'Quản trị'} thành công!`,
    user: userProfile
  });
});

module.exports = router;
