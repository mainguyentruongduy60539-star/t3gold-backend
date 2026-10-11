const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting the API server.');
}

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Không tìm thấy mã xác thực. Vui lòng đăng nhập.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.findById('users', decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Tài khoản không tồn tại trên hệ thống.' });
    }

    // Attach basic user info (exclude password)
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ dành cho Admin.' });
  }
  next();
}

function requireStaffOrAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'staff_admin')) {
    return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ dành cho Quản trị viên hoặc Thành viên quản trị.' });
  }
  next();
}

function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Vui lòng đăng nhập.' });
  }
  
  const isApproved = Boolean(req.user.isApproved || req.user.status === 'sold' || req.user.status === 'trial' || req.user.role === 'admin' || req.user.role === 'staff_admin' || req.user.role === 'shareholder');

  if (!isApproved) {
    return res.status(403).json({ 
      message: 'Tài khoản chưa được phê duyệt để xem thông tin chuyên sâu.',
      isApproved: false
    });
  }
  next();
}

function requireOrgAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Vui lòng đăng nhập.' });
  }

  // Admin and Shareholder have active access
  if (req.user.role === 'admin' || req.user.role === 'shareholder') {
    return next();
  }

  // Manager and Staff MUST be approved by Admin
  if ((req.user.role === 'manager' || req.user.role === 'staff') && req.user.isApproved !== false) {
    return next();
  }

  return res.status(403).json({ 
    message: 'Tài khoản của bạn chưa được Quản trị viên phê duyệt quyền xem Sơ đồ tổ chức.',
    accessDenied: true
  });
}

function requireManagerOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Vui lòng đăng nhập.' });
  }
  const allowedRoles = ['admin', 'manager'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ Cấp Quản Lý hoặc Lãnh Đạo mới được nhập liệu.' });
  }
  next();
}

module.exports = {
  verifyToken,
  requireAdmin,
  requireStaffOrAdmin,
  requireApproved,
  requireOrgAccess,
  requireManagerOrAdmin
};
