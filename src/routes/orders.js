const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireApproved } = require('../middleware/auth');

// Apply verification to all routes here
router.use(verifyToken, requireApproved);

// Get orders list
router.get('/', (req, res) => {
  const orders = db.getCollection('orders');

  if (req.user.role === 'admin') {
    // Admin sees all orders
    res.json(orders);
  } else {
    // Approved member only sees their own store orders
    const memberOrders = orders.filter(o => o.memberId === req.user.id);
    res.json(memberOrders);
  }
});

// Create a new sales order
router.post('/', (req, res) => {
  const { customerName, productName, amount, quantity, status, purchaseDate, memberId } = req.body;

  if (!customerName || !productName || !amount || !quantity) {
    return res.status(400).json({ message: 'Vui lòng cung cấp các trường bắt buộc.' });
  }

  // Determine owner of this order
  let ownerId = req.user.id;
  if (req.user.role === 'admin' && memberId) {
    // Admin can specify which member store this order belongs to
    ownerId = memberId;
  }

  const newOrder = {
    memberId: ownerId,
    customerName,
    productName,
    amount: Number(amount),
    quantity: Number(quantity),
    status: status || 'pending',
    purchaseDate: purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString()
  };

  const savedOrder = db.insert('orders', newOrder);
  res.status(210).json({
    message: 'Tạo đơn hàng thành công!',
    order: savedOrder
  });
});

// Update order
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const existingOrder = db.findById('orders', id);
  if (!existingOrder) {
    return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  }

  // Permission check
  if (req.user.role !== 'admin' && existingOrder.memberId !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đơn hàng này.' });
  }

  // Prevent editing memberId from non-admins
  if (req.user.role !== 'admin' && updates.memberId) {
    delete updates.memberId;
  }

  if (updates.amount) updates.amount = Number(updates.amount);
  if (updates.quantity) updates.quantity = Number(updates.quantity);

  const updatedOrder = db.update('orders', id, updates);
  res.json({
    message: 'Cập nhật đơn hàng thành công!',
    order: updatedOrder
  });
});

// Delete order
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existingOrder = db.findById('orders', id);

  if (!existingOrder) {
    return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  }

  // Permission check
  if (req.user.role !== 'admin' && existingOrder.memberId !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền xóa đơn hàng này.' });
  }

  db.delete('orders', id);
  res.json({ message: 'Đã xóa đơn hàng thành công.' });
});

module.exports = router;
