const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireAdmin, requireStaffOrAdmin } = require('../middleware/auth');
const { sendApprovalSMS } = require('../utils/sms');
const { sendZaloApprovalZNS } = require('../utils/zalo');

// 1. Get list of all member and staff accounts (accessible by Admin & Staff Admin)
router.get('/', verifyToken, requireStaffOrAdmin, (req, res) => {
  const users = db.getCollection('users');
  const members = users.map(({ password, ...u }) => u);
  res.json(members);
});

// 1b. Get customer network list (ONLY registered customer store accounts with role === 'member')
router.get('/network', (req, res) => {
  const users = db.getCollection('users');
  const customers = users
    .filter(u => u.role === 'member')
    .map(u => ({
      id: u.id,
      storeName: u.storeName || u.name || 'Tiệm Vàng Thành Viên',
      name: u.name,
      address: u.address || 'Việt Nam',
      softwarePackage: u.softwarePackage || 'Gói phần mềm T3Gold',
      status: u.status || (u.isApproved ? 'sold' : 'pending'),
      isApproved: Boolean(u.isApproved),
      role: u.role,
      createdAt: u.createdAt
    }));
  res.json(customers);
});


// 2. Get referral details
router.get('/referrals/all', verifyToken, requireStaffOrAdmin, (req, res) => {
  const referrals = db.getCollection('referrals');
  res.json(referrals);
});

// 3. Update member license status (Super Admin only)
router.put('/:id/status', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['sold', 'pending', 'trial', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Trạng thái bản quyền không hợp lệ.' });
  }

  const isApproved = status === 'sold' || status === 'trial';
  const updatedUser = db.update('users', id, { status, isApproved });
  if (!updatedUser) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản thành viên.' });
  }

  if (isApproved && updatedUser.referrerCode) {
    const referrals = db.getCollection('referrals');
    const userReferral = referrals.find(r => r.referrerId === updatedUser.referrerCode || r.refereeName === updatedUser.storeName);
    if (userReferral && userReferral.status === 'pending') {
      db.update('referrals', userReferral.id, {
        status: 'completed',
        commission: 500000
      });
    }
  }

  let smsNotice = '';
  if (isApproved && updatedUser.phone) {
    const rawPass = updatedUser.rawPassword || 'Mật khẩu bạn đã đăng ký';
    const smsRes = await sendApprovalSMS({
      phone: updatedUser.phone,
      storeName: updatedUser.storeName,
      softwarePackage: updatedUser.softwarePackage,
      loginId: updatedUser.phone,
      password: rawPass
    });
    smsNotice = ` 📱 Đã tự động gửi SMS thông báo tới SĐT ${updatedUser.phone}! Nội dung: "${smsRes.message}"`;

    // Gửi thông báo Zalo ZNS Phê Duyệt Kích Hoạt Bản Quyền Thành Công
    try {
      await sendZaloApprovalZNS({
        phone: updatedUser.phone,
        name: updatedUser.name,
        storeName: updatedUser.storeName,
        softwarePackage: updatedUser.softwarePackage,
        licenseKey: updatedUser.licenseKey || `T3G-PRO-${Math.floor(1000 + Math.random() * 9000)}`,
        loginId: updatedUser.phone,
        password: rawPass
      });
    } catch (zaloApprovalErr) {
      console.error('Error sending Zalo approval notification:', zaloApprovalErr);
    }
  }

  const { password, ...memberProfile } = updatedUser;
  res.json({
    message: `Đã cập nhật trạng thái tài khoản thành công sang: ${status === 'sold' ? 'Đã bán' :
      status === 'trial' ? 'Dùng thử' :
        status === 'cancelled' ? 'Hủy bỏ' : 'Chờ duyệt'
      }.${smsNotice}`,
    member: memberProfile,
    smsSent: Boolean(smsNotice)
  });
});

// 4. Update member assigned department node (Super Admin only) - SPECIFIC SUB-ROUTE BEFORE /:id
router.put('/:id/node', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { nodeId, nodeIds, action } = req.body;

  const user = db.findById('users', id);
  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
  }

  const existingNodeIds = Array.isArray(user.nodeIds) && user.nodeIds.length > 0
    ? user.nodeIds
    : (user.nodeId ? [user.nodeId] : []);

  let targetNodeIds = [];

  if (Array.isArray(nodeIds)) {
    targetNodeIds = Array.from(new Set(nodeIds));
  } else if (action === 'add' && nodeId) {
    targetNodeIds = Array.from(new Set([...existingNodeIds, nodeId]));
  } else if (action === 'remove' && nodeId) {
    targetNodeIds = existingNodeIds.filter(nId => nId !== nodeId);
  } else if (nodeId !== undefined) {
    if (!nodeId || nodeId === '') {
      targetNodeIds = [];
    } else {
      targetNodeIds = Array.from(new Set([...existingNodeIds, nodeId]));
    }
  } else {
    targetNodeIds = existingNodeIds;
  }

  // Synchronize orgNodes collection userId linking atomically
  const orgNodesList = db.getCollection('orgNodes');

  const updatedOrgNodes = orgNodesList.map(n => {
    if (targetNodeIds.includes(n.id)) {
      return { ...n, userId: id };
    } else if (n.userId === id && !targetNodeIds.includes(n.id)) {
      return { ...n, userId: null };
    }
    return n;
  });
  db.setCollection('orgNodes', updatedOrgNodes);

  const updatedUser = db.update('users', id, {
    nodeId: targetNodeIds[0] || null,
    nodeIds: targetNodeIds
  });
  const { password, ...userProfile } = updatedUser;

  const assignedLabels = orgNodesList
    .filter(n => targetNodeIds.includes(n.id))
    .map(n => `"${n.label}"`)
    .join(', ');

  const nodeName = assignedLabels || 'Trụ sở chính T3Gold';

  res.json({
    message: `Đã cập nhật (các) bộ phận phân quyền thành công: ${nodeName}!`,
    user: userProfile
  });
});

// 5. Update user role directly (Super Admin only) - SPECIFIC SUB-ROUTE BEFORE /:id
router.put('/:id/role', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ['staff_admin', 'shareholder', 'manager', 'staff'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ message: 'Vai trò tài khoản không hợp lệ.' });
  }

  const user = db.findById('users', id);
  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
  }

  const isAutoApproved = role === 'shareholder';

  const updatedUser = db.update('users', id, {
    role,
    isApproved: isAutoApproved ? true : false,
    isRevenueApproved: isAutoApproved ? true : false
  });

  const { password, ...userProfile } = updatedUser;
  res.json({
    message: `Đã đổi vai trò tài khoản ${user.name} thành ${role === 'shareholder' ? 'Thành viên Cổ đông (Đã mở khóa Bộ máy)' :
      role === 'staff_admin' ? 'Thành viên quản trị (Quản trị hệ thống)' :
        role === 'manager' ? 'Quản lý bộ phận (Đang khóa Bộ máy - Chờ duyệt)' :
          'Nhân sự cấp dưới (Đang khóa Bộ máy - Chờ duyệt)'
      }.`,
    user: userProfile
  });
});

// 6. Approve or revoke member approval status - SPECIFIC SUB-ROUTE BEFORE /:id
router.put('/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { isApproved } = req.body;

  if (typeof isApproved !== 'boolean') {
    return res.status(400).json({ message: 'Trạng thái phê duyệt không hợp lệ.' });
  }

  const status = isApproved ? 'sold' : 'pending';
  const updatedUser = db.update('users', id, { isApproved, status, isRevenueApproved: isApproved });
  if (!updatedUser) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản thành viên.' });
  }

  let smsNotice = '';
  if (isApproved && updatedUser.phone) {
    const rawPass = updatedUser.rawPassword || 'Mật khẩu bạn đã đăng ký';
    const smsRes = await sendApprovalSMS({
      phone: updatedUser.phone,
      storeName: updatedUser.storeName,
      softwarePackage: updatedUser.softwarePackage,
      loginId: updatedUser.phone,
      password: rawPass
    });
    smsNotice = ` 📱 Đã gửi tin nhắn SMS tới ${updatedUser.phone}: "${smsRes.message}"`;
  }

  const { password, ...memberProfile } = updatedUser;
  res.json({
    message: isApproved ? `Phê duyệt thành viên thành công!${smsNotice}` : 'Đã thu hồi quyền truy cập chuyên sâu.',
    member: memberProfile,
    smsSent: Boolean(smsNotice)
  });
});

// 7. Toggle org chart approval - SPECIFIC SUB-ROUTE BEFORE /:id
router.put('/:id/toggle-org-approval', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const user = db.findById('users', id);
  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
  }

  const currentStatus = user.isApproved !== false;
  const newStatus = !currentStatus;

  const updatedUser = db.update('users', id, {
    isApproved: newStatus,
    isRevenueApproved: newStatus
  });

  const { password, ...userProfile } = updatedUser;
  res.json({
    message: `Đã ${newStatus ? 'phê duyệt cấp quyền xem Bộ Máy Tổ Chức' : 'khóa quyền xem Bộ Máy Tổ Chức'} cho tài khoản ${user.name}.`,
    user: userProfile
  });
});

// 8. Toggle revenue approval - SPECIFIC SUB-ROUTE BEFORE /:id
router.put('/:id/toggle-revenue-approval', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const user = db.findById('users', id);
  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
  }

  const currentStatus = user.isRevenueApproved !== undefined ? user.isRevenueApproved : (user.role !== 'shareholder');
  const newStatus = !currentStatus;

  const updatedUser = db.update('users', id, {
    isRevenueApproved: newStatus
  });

  const { password, ...userProfile } = updatedUser;
  res.json({
    message: `Đã ${newStatus ? 'phê duyệt' : 'khóa'} quyền xem chi tiết báo cáo doanh thu cho tài khoản ${user.name}.`,
    user: userProfile
  });
});

// 9. Reset password - SPECIFIC SUB-ROUTE BEFORE /:id
router.post('/:id/reset-password', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  const existing = db.findById('users', id);
  if (!existing) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
  }

  const bcrypt = require('bcryptjs');
  const tempPassword = 't3gold@' + Math.floor(1000 + Math.random() * 9000);
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(tempPassword, salt);

  db.update('users', id, { password: hashedPassword });
  res.json({
    message: `Đã cấp lại mật khẩu mặc định thành công!`,
    newPassword: tempPassword
  });
});

// 10. Generic update member details (Super Admin only) - MUST BE BELOW SPECIFIC SUB-ROUTES
router.put('/:id', verifyToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, storeName, address, softwarePackage, amountPaid, expirationDate, role, isApproved, isRevenueApproved, nodeId, nodeIds, password: newPassword } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (storeName !== undefined) updates.storeName = storeName;
    if (address !== undefined) updates.address = address;
    if (softwarePackage !== undefined) updates.softwarePackage = softwarePackage;
    if (amountPaid !== undefined && amountPaid !== '') updates.amountPaid = Number(amountPaid);

    if (expirationDate !== undefined && expirationDate !== null && expirationDate !== '') {
      const parsedDate = new Date(expirationDate);
      if (!isNaN(parsedDate.getTime())) {
        updates.expirationDate = parsedDate.toISOString();
      }
    }

    if (role !== undefined) {
      updates.role = role;
      if (isApproved === undefined) {
        const isAuto = role === 'shareholder' || role === 'admin';
        updates.isApproved = isAuto;
        updates.isRevenueApproved = isAuto;
      }
    }
    if (isApproved !== undefined) updates.isApproved = Boolean(isApproved);
    if (isRevenueApproved !== undefined) updates.isRevenueApproved = Boolean(isRevenueApproved);
    if (nodeIds !== undefined || nodeId !== undefined) {
      const targetNodeIds = Array.isArray(nodeIds)
        ? nodeIds
        : (nodeId ? [nodeId] : []);
      updates.nodeId = targetNodeIds[0] || null;
      updates.nodeIds = targetNodeIds;

      const orgNodesList = db.getCollection('orgNodes');
      const updatedOrgNodes = orgNodesList.map(n => {
        if (targetNodeIds.includes(n.id)) {
          return { ...n, userId: id };
        } else if (n.userId === id && !targetNodeIds.includes(n.id)) {
          return { ...n, userId: null };
        }
        return n;
      });
      db.setCollection('orgNodes', updatedOrgNodes);
    }

    if (newPassword && newPassword.trim().length >= 6) {
      const bcrypt = require('bcryptjs');
      const salt = bcrypt.genSaltSync(10);
      updates.password = bcrypt.hashSync(newPassword.trim(), salt);
    }

    const updatedUser = db.update('users', id, updates);
    if (!updatedUser) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
    }

    const { password, ...profile } = updatedUser;
    res.json({ message: 'Cập nhật thông tin tài khoản thành công!', member: profile });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật thông tin tài khoản: ' + error.message });
  }
});

// 11. Generic delete account (Super Admin only) - MUST BE BELOW SPECIFIC SUB-ROUTES
router.delete('/:id', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ message: 'Bạn không thể tự xóa tài khoản của chính mình!' });
  }

  const existing = db.findById('users', id);
  if (!existing) {
    return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
  }

  db.delete('users', id);
  res.json({ message: 'Đã xóa tài khoản thành công.' });
});

module.exports = router;
