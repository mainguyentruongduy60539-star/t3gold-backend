const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireApproved } = require('../middleware/auth');

// Apply verification and approval checks to all routes
router.use(verifyToken, requireApproved);

// Get customers list
router.get('/', (req, res) => {
  const customers = db.getCollection('customers');

  if (req.user.role === 'admin') {
    res.json(customers);
  } else {
    const memberCustomers = customers.filter(c => c.memberId === req.user.id);
    res.json(memberCustomers);
  }
});

// Create customer
router.post('/', (req, res) => {
  const { name, phone, email, address, notes, memberId } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ message: 'Vui lòng cung cấp Tên và Số điện thoại khách hàng.' });
  }

  let ownerId = req.user.id;
  if (req.user.role === 'admin' && memberId) {
    ownerId = memberId;
  }

  const newCustomer = {
    memberId: ownerId,
    name,
    phone,
    email: email || '',
    address: address || '',
    notes: notes || ''
  };

  const savedCustomer = db.insert('customers', newCustomer);
  res.status(201).json({
    message: 'Thêm khách hàng thành công!',
    customer: savedCustomer
  });
});

// Update customer
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const existingCustomer = db.findById('customers', id);
  if (!existingCustomer) {
    return res.status(404).json({ message: 'Không tìm thấy thông tin khách hàng.' });
  }

  if (req.user.role !== 'admin' && existingCustomer.memberId !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa khách hàng này.' });
  }

  if (req.user.role !== 'admin' && updates.memberId) {
    delete updates.memberId;
  }

  const updatedCustomer = db.update('customers', id, updates);
  res.json({
    message: 'Cập nhật thông tin khách hàng thành công!',
    customer: updatedCustomer
  });
});

// Delete customer
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existingCustomer = db.findById('customers', id);

  if (!existingCustomer) {
    return res.status(404).json({ message: 'Không tìm thấy khách hàng.' });
  }

  if (req.user.role !== 'admin' && existingCustomer.memberId !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền xóa khách hàng này.' });
  }

  db.delete('customers', id);
  res.json({ message: 'Đã xóa thông tin khách hàng.' });
});

module.exports = router;
