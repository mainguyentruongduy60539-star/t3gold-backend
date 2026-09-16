const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireAdmin, requireOrgAccess, requireManagerOrAdmin } = require('../middleware/auth');

// Helper to automatically link top-level operational nodes to all Shareholder nodes as multi-parents
function ensureShareholderMultiParentLinks(nodes) {
  const shareholderNodes = nodes.filter(n => n.roleType === 'shareholder');
  if (shareholderNodes.length === 0) return nodes;

  const shareholderIds = shareholderNodes.map(n => n.id);

  return nodes.map(node => {
    // Only apply multi-parent linking if node is an operational node and not a shareholder or president
    if (node.roleType !== 'shareholder' && node.roleType !== 'president') {
      const currentParentIds = Array.isArray(node.parentIds) && node.parentIds.length > 0
        ? node.parentIds
        : (node.parentId ? [node.parentId] : []);

      const isAttachedToShareholder = currentParentIds.some(pId => shareholderIds.includes(pId));
      const hasNonShareholderParent = currentParentIds.some(pId => {
        const parentNode = nodes.find(n => n.id === pId);
        return parentNode && parentNode.roleType !== 'shareholder' && parentNode.roleType !== 'president';
      });

      // ONLY multi-parent link to all Shareholders if this node is directly attached to a shareholder OR has no operational parent!
      // Sub-child nodes (which have an operational parent like "Nhân sự") MUST retain their specific parent.
      if (isAttachedToShareholder || (!hasNonShareholderParent && currentParentIds.length === 0)) {
        const mergedParentIds = Array.from(new Set([...currentParentIds, ...shareholderIds]));
        return {
          ...node,
          parentIds: mergedParentIds,
          parentId: mergedParentIds[0] || node.parentId
        };
      }
    }
    return node;
  });
}

// Helper to compute Bottom-Up Rolled-Up Costs and Depth Levels for all nodes (supporting Multi-Parent nodes)
function calculateRollupsAndLevels(nodes) {
  const nodesMap = {};
  nodes.forEach(node => {
    let directCost = 0;
    if (node.expenses && Array.isArray(node.expenses)) {
      node.expenses.forEach(e => directCost += Number(e.amount || 0));
    }
    const parentIds = Array.isArray(node.parentIds) && node.parentIds.length > 0
      ? node.parentIds
      : (node.parentId ? [node.parentId] : []);

    nodesMap[node.id] = {
      ...node,
      parentIds,
      parentId: parentIds[0] || null,
      directCost,
      rolledUpCost: directCost,
      children: []
    };
  });

  Object.values(nodesMap).forEach(node => {
    node.parentIds.forEach(pId => {
      if (nodesMap[pId] && !nodesMap[pId].children.includes(node.id)) {
        nodesMap[pId].children.push(node.id);
      }
    });
  });

  function computeNodeRollup(nodeId, currentDepth = 1) {
    const node = nodesMap[nodeId];
    if (!node) return 0;
    if (!node.level || currentDepth < node.level) {
      node.level = currentDepth;
    }

    let totalFromChildren = 0;
    node.children.forEach(childId => {
      totalFromChildren += computeNodeRollup(childId, currentDepth + 1);
    });

    node.rolledUpCost = node.directCost + totalFromChildren;
    return node.rolledUpCost;
  }

  const rootNodes = Object.values(nodesMap).filter(n => n.parentIds.length === 0 || !n.parentIds.some(p => nodesMap[p]));
  rootNodes.forEach(r => computeNodeRollup(r.id, 1));

  return Object.values(nodesMap).map(({ children, ...cleanNode }) => cleanNode);
}

// Managers may modify only their assigned nodes and descendants. UI visibility is
// not a security boundary, so every mutating route must enforce this on the API.
function getManagerEditableNodeIds(user, nodes) {
  if (user.role === 'admin') return new Set(nodes.map(node => node.id));
  if (user.role !== 'manager') return new Set();

  const assignedNodeIds = Array.isArray(user.nodeIds) && user.nodeIds.length > 0
    ? user.nodeIds
    : (user.nodeId ? [user.nodeId] : []);

  const editableIds = new Set();
  const queue = nodes
    .filter(node => node.userId === user.id || (assignedNodeIds.includes(node.id) && (!node.userId || node.userId === user.id)))
    .map(node => node.id);

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (editableIds.has(nodeId)) continue;
    editableIds.add(nodeId);

    nodes.forEach(node => {
      const parentIds = Array.isArray(node.parentIds) && node.parentIds.length > 0
        ? node.parentIds
        : (node.parentId ? [node.parentId] : []);
      if (parentIds.includes(nodeId) && !editableIds.has(node.id)) {
        queue.push(node.id);
      }
    });
  }

  return editableIds;
}

// Helper to apply RBAC filtering
function applyRBACFilter(nodes, user) {
  if (!user) return nodes;

  const userRole = user.role;
  const userNodeIds = Array.isArray(user.nodeIds) && user.nodeIds.length > 0
    ? user.nodeIds
    : (user.nodeId ? [user.nodeId] : []);

  // Lãnh đạo tối cao (Admin) & Ban quản trị (Staff Admin không gán nút riêng): Full view
  if (userRole === 'admin' || (userRole === 'staff_admin' && userNodeIds.length === 0 && !nodes.some(n => n.userId === user.id))) {
    return nodes;
  }

  // Quản lý bộ phận (Manager): Chỉ hiển thị các bộ phận được gán và các cấp con trực thuộc trở xuống (Ẩn cấp trên Chủ tịch / Cổ đông)
  if (userRole === 'manager') {
    let ownNodes = nodes.filter(n => user.id && n.userId === user.id);

    if (ownNodes.length === 0 && userNodeIds.length > 0) {
      ownNodes = nodes.filter(n => userNodeIds.includes(n.id) && (!n.userId || n.userId === user.id));
    }

    // Strictly return empty if manager has no linked departments
    if (ownNodes.length === 0) {
      return [];
    }

    const ownNodeIds = new Set(ownNodes.map(n => n.id));
    const downstreamSet = new Set();

    ownNodes.forEach(ownNode => {
      downstreamSet.add(ownNode.id);
      const collectDownstream = (pId) => {
        nodes.filter(n => {
          const pIds = Array.isArray(n.parentIds) && n.parentIds.length > 0 ? n.parentIds : (n.parentId ? [n.parentId] : []);
          return pIds.includes(pId);
        }).forEach(child => {
          if (!downstreamSet.has(child.id)) {
            downstreamSet.add(child.id);
            collectDownstream(child.id);
          }
        });
      };
      collectDownstream(ownNode.id);
    });

    return nodes
      .filter(node => downstreamSet.has(node.id))
      .map(node => {
        const pIds = Array.isArray(node.parentIds) && node.parentIds.length > 0 ? node.parentIds : (node.parentId ? [node.parentId] : []);
        const hasParentInTree = pIds.some(pId => downstreamSet.has(pId));

        if (ownNodeIds.has(node.id) && !hasParentInTree) {
          return {
            ...node,
            level: 1,
            isShareholderRoot: true,
            canAddChild: true,
            canEditExpense: true
          };
        }
        return {
          ...node,
          canAddChild: true,
          canEditExpense: true
        };
      });
  }

  // Cổ đông & Bộ máy trực thuộc (Shareholder / Staff Admin được gán nút / Staff)
  let ownNodes = nodes.filter(n =>
    userNodeIds.includes(n.id) ||
    (user.id && n.userId === user.id)
  );

  if (ownNodes.length === 0 && (userRole === 'shareholder' || userRole === 'staff_admin')) {
    const foundSh = nodes.find(n => n.roleType === 'shareholder' && (user.name && n.label.toLowerCase().includes(user.name.toLowerCase())));
    if (foundSh) ownNodes = [foundSh];
  }
  if (ownNodes.length === 0 && (userRole === 'shareholder' || userRole === 'staff_admin')) {
    const firstSh = nodes.find(n => n.roleType === 'shareholder');
    if (firstSh) ownNodes = [firstSh];
  }
  if (ownNodes.length === 0) {
    ownNodes = [nodes[0]]; // Guaranteed fallback so org chart is NEVER blank
  }

  const ownNodeIds = new Set(ownNodes.map(n => n.id));
  const downstreamSet = new Set();

  ownNodes.forEach(ownNode => {
    downstreamSet.add(ownNode.id);
    const collectDownstream = (pId) => {
      nodes.filter(n => {
        const pIds = Array.isArray(n.parentIds) && n.parentIds.length > 0 ? n.parentIds : (n.parentId ? [n.parentId] : []);
        return pIds.includes(pId);
      }).forEach(child => {
        if (!downstreamSet.has(child.id)) {
          downstreamSet.add(child.id);
          collectDownstream(child.id);
        }
      });
    };
    collectDownstream(ownNode.id);
  });

  // Thêm các nút vận hành (Bộ máy nhân sự, Công cụ AI, Chi phí mặt bằng...) được cấu hình hiển thị công khai
  const visibleNodesSet = new Set(downstreamSet);
  nodes.forEach(n => {
    // Với tài khoản Cổ đông, ẩn hoàn toàn Ban Quản Trị Cấp Trên (President) và các Cổ Đông Khác không liên kết
    if (userRole === 'shareholder') {
      if (n.roleType === 'president' || (n.roleType === 'shareholder' && !ownNodeIds.has(n.id) && n.userId !== user.id)) {
        return;
      }
    }

    const vUserIds = Array.isArray(n.visibleToUserIds) ? n.visibleToUserIds : (n.visibleToUserIds ? [n.visibleToUserIds] : ['all']);
    if (vUserIds.includes('all') || vUserIds.includes('all_shareholders') || vUserIds.includes(user.id) || userNodeIds.some(id => vUserIds.includes(id))) {
      visibleNodesSet.add(n.id);
      // Thu thập toàn bộ nút con của các bộ phận vận hành được chia sẻ
      const collectVisibleChildren = (pId) => {
        nodes.filter(child => {
          if (userRole === 'shareholder' && (child.roleType === 'president' || (child.roleType === 'shareholder' && !ownNodeIds.has(child.id) && child.userId !== user.id))) {
            return false;
          }
          const pIds = Array.isArray(child.parentIds) && child.parentIds.length > 0 ? child.parentIds : (child.parentId ? [child.parentId] : []);
          return pIds.includes(pId);
        }).forEach(child => {
          if (!visibleNodesSet.has(child.id)) {
            visibleNodesSet.add(child.id);
            collectVisibleChildren(child.id);
          }
        });
      };
      collectVisibleChildren(n.id);
    }
  });

  // Xóa bỏ hoàn toàn nút Ban Quản Trị Cấp Trên và các Cổ Đông Khác khỏi visibleNodesSet đối với tài khoản Cổ Đông
  if (userRole === 'shareholder') {
    nodes.forEach(n => {
      if (n.roleType === 'president' || (n.roleType === 'shareholder' && !ownNodeIds.has(n.id) && n.userId !== user.id)) {
        visibleNodesSet.delete(n.id);
      }
    });
  }

  // Trả về danh sách nút với phân quyền chi tiết
  return nodes
    .filter(node => visibleNodesSet.has(node.id))
    .map(node => {
      const isOtherShareholder = (node.roleType === 'shareholder' || node.roleType === 'president') && !ownNodeIds.has(node.id) && node.userId !== user.id;

      if (isOtherShareholder) {
        return {
          ...node,
          commission: 0,
          taxes: 0,
          masked: true,
          label: node.roleType === 'president' ? '👑 Ban Quản Trị Cấp Trên (Phân Quyền)' : '💼 Cổ Đông Khác (Phân Quyền Bảo Mật)',
          canAddChild: false,
          canEditExpense: false
        };
      }

      const isOwnOrDownstream = downstreamSet.has(node.id);
      const parentInVisible = (node.parentIds && node.parentIds.some(pId => visibleNodesSet.has(pId))) || visibleNodesSet.has(node.parentId);
      const canModify = userRole !== 'shareholder' && isOwnOrDownstream;

      return {
        ...node,
        ...(ownNodeIds.has(node.id) && !parentInVisible ? { level: 1, isShareholderRoot: true } : {}),
        canAddChild: canModify,
        canEditExpense: canModify
      };
    });
}

// Get organization chart nodes, members, custom calculations and current financials with RBAC
router.get('/', verifyToken, requireOrgAccess, (req, res) => {
  const rawOrgNodes = db.getCollection('orgNodes');
  const customCalculations = db.getCollection('customCalculations');
  const users = db.getCollection('users');

  // Calculate Bottom-Up Rollups for all nodes
  const processedNodes = calculateRollupsAndLevels(rawOrgNodes);

  // Apply Role-Based Access Control (RBAC) filtering
  const filteredNodes = applyRBACFilter(processedNodes, req.user);

  // Team members list for Org Chart node linking dropdown (Created accounts: Shareholders, Managers, Staff, Admin)
  const membersList = users
    .filter(u => u.role === 'shareholder' || u.role === 'manager' || u.role === 'staff' || u.role === 'staff_admin')
    .map(({ id, name, phone, email, role }) => {
      let roleLabel = '👑 Quản trị';
      if (role === 'shareholder') roleLabel = '💼 Cổ đông';
      else if (role === 'manager') roleLabel = '📁 Quản lý';
      else if (role === 'staff') roleLabel = '👨‍💻 Nhân sự';
      return {
        id,
        name,
        phone,
        email,
        role,
        label: `${name} (${phone || email} - ${roleLabel})`
      };
    });

  // Calculate software license revenue
  const soldMembers = users.filter(u => u.role === 'member' && u.status === 'sold');
  const totalRevenue = soldMembers.reduce((sum, m) => sum + (m.amountPaid || 0), 0);

  // Total company expenses sum from root
  const rootNode = processedNodes.find(n => !n.parentId);
  let totalExpenses = rootNode ? rootNode.rolledUpCost : 0;
  let profit = totalRevenue - totalExpenses;
  let shareholderCommissionPct = 0;
  let shareholderGross = 0;

  // Custom financial calculation for Shareholder role
  if (req.user.role === 'shareholder') {
    let ownNode = processedNodes.find(n => n.id === req.user.nodeId || n.userId === req.user.id);
    if (!ownNode) {
      ownNode = processedNodes.find(n => n.roleType === 'shareholder' && (req.user.name && n.label.toLowerCase().includes(req.user.name.toLowerCase())));
    }
    shareholderCommissionPct = ownNode ? (ownNode.commission || 0) : (req.user.commission || 0);
    const shareholderBranchCost = ownNode ? (ownNode.rolledUpCost || 0) : 0;

    // Net Branch Profit = Total Revenue - Branch Expenses
    const branchNetProfit = totalRevenue - shareholderBranchCost;
    // Net Dividend = (Net Branch Profit > 0 ? Net Branch Profit : 0) * Shareholder %
    const netDividend = Math.round((branchNetProfit > 0 ? branchNetProfit : 0) * (shareholderCommissionPct / 100));

    totalExpenses = shareholderBranchCost;
    shareholderGross = Math.round(totalRevenue * (shareholderCommissionPct / 100));
    profit = netDividend;
  }

  const isRevenueApproved = req.user.role === 'admin' || req.user.role === 'staff_admin' || req.user.isRevenueApproved !== false;

  res.json({
    nodes: filteredNodes,
    customCalculations,
    members: membersList,
    userRole: req.user.role,
    userNodeId: req.user.nodeId,
    financials: {
      isRevenueApproved,
      totalRevenue: isRevenueApproved ? totalRevenue : 0,
      totalExpenses: isRevenueApproved ? totalExpenses : 0,
      profit: isRevenueApproved ? profit : 0,
      shareholderCommissionPct,
      shareholderGross: isRevenueApproved ? shareholderGross : 0
    }
  });
});

// Add a new node
router.post('/', verifyToken, requireManagerOrAdmin, (req, res) => {
  const { label, parentId, parentIds, roleType, commission, expenses, taxes, userId, visibleToUserIds } = req.body;

  if (!label) {
    return res.status(400).json({ message: 'Tên nút không được để trống.' });
  }

  const finalParentIds = Array.isArray(parentIds) && parentIds.length > 0
    ? parentIds
    : (parentId ? [parentId] : []);

  if (req.user.role === 'manager') {
    const editableNodeIds = getManagerEditableNodeIds(req.user, db.getCollection('orgNodes'));
    const managerOnlyRoleTypes = ['president', 'shareholder'];
    if (finalParentIds.length === 0 || finalParentIds.some(id => !editableNodeIds.has(id))) {
      return res.status(403).json({ message: 'Quản lý chỉ có thể tạo nút con trong bộ phận được phân quyền.' });
    }
    if (userId !== undefined || visibleToUserIds !== undefined || managerOnlyRoleTypes.includes(roleType)) {
      return res.status(403).json({ message: 'Quản lý không có quyền tạo nút có liên kết tài khoản hoặc quyền hiển thị đặc biệt.' });
    }
  }

  const newNode = {
    label,
    parentIds: finalParentIds,
    parentId: finalParentIds[0] || null,
    roleType: roleType || 'other',
    commission: Number(commission || 0),
    expenses: Array.isArray(expenses) ? expenses.map(e => ({ name: e.name, amount: Number(e.amount) })) : [],
    taxes: Number(taxes || 0),
    userId: userId || null,
    visibleToUserIds: Array.isArray(visibleToUserIds) ? visibleToUserIds : (visibleToUserIds ? [visibleToUserIds] : ['all']),
    customFields: []
  };

  const savedNode = db.insert('orgNodes', newNode);
  res.status(201).json({ message: 'Đã thêm nút sơ đồ thành công.', node: savedNode });
});

// Update a node
router.put('/:id', verifyToken, requireManagerOrAdmin, (req, res) => {
  const { id } = req.params;
  const { label, parentId, parentIds, roleType, commission, expenses, taxes, userId, visibleToUserIds } = req.body;

  const existingNode = db.findById('orgNodes', id);
  if (!existingNode) {
    return res.status(404).json({ message: 'Không tìm thấy nút trong sơ đồ.' });
  }

  if (req.user.role === 'manager') {
    const editableNodeIds = getManagerEditableNodeIds(req.user, db.getCollection('orgNodes'));
    const changesProtectedStructure = parentId !== undefined || parentIds !== undefined || userId !== undefined ||
      visibleToUserIds !== undefined || commission !== undefined || taxes !== undefined;
    if (!editableNodeIds.has(id) || changesProtectedStructure) {
      return res.status(403).json({ message: 'Quản lý chỉ có thể sửa thông tin hoạt động của các nút được phân quyền.' });
    }
  }

  const updates = {};
  if (label !== undefined) updates.label = label;
  if (parentIds !== undefined && Array.isArray(parentIds)) {
    updates.parentIds = parentIds;
    updates.parentId = parentIds[0] || null;
  } else if (parentId !== undefined) {
    updates.parentId = parentId === '' ? null : parentId;
    updates.parentIds = parentId ? [parentId] : [];
  }
  if (roleType !== undefined) updates.roleType = roleType;
  if (commission !== undefined) updates.commission = Number(commission);
  if (expenses !== undefined && Array.isArray(expenses)) {
    updates.expenses = expenses.map(e => ({ name: e.name, amount: Number(e.amount) }));
  }
  if (taxes !== undefined) updates.taxes = Number(taxes);
  if (visibleToUserIds !== undefined) {
    updates.visibleToUserIds = Array.isArray(visibleToUserIds) ? visibleToUserIds : (visibleToUserIds ? [visibleToUserIds] : ['all']);
  }
  const finalRoleType = roleType !== undefined ? roleType : existingNode?.roleType;

  // ONLY Super Admin can change or disconnect user linkage (userId)
  if (req.user.role === 'admin' && userId !== undefined) {
    const targetUserId = (!userId || userId === '') ? null : userId;
    const oldUserId = existingNode?.userId;
    updates.userId = targetUserId;

    // 1. If oldUserId was set and is changing, remove this node from oldUser's nodeIds
    if (oldUserId && oldUserId !== targetUserId) {
      const orgNodesList = db.getCollection('orgNodes');
      const remainingNodeIds = orgNodesList
        .filter(n => n.userId === oldUserId && n.id !== id)
        .map(n => n.id);
      db.update('users', oldUserId, {
        nodeIds: remainingNodeIds,
        nodeId: remainingNodeIds[0] || null
      });
    }

    // 2. If targetUserId is provided, add this node to targetUser's nodeIds
    if (targetUserId) {
      const linkedUser = db.findById('users', targetUserId);
      if (linkedUser && linkedUser.role !== 'admin') {
        const orgNodesList = db.getCollection('orgNodes');
        const userNodeIds = Array.from(new Set([
          ...orgNodesList.filter(n => n.userId === targetUserId || n.id === id).map(n => n.id),
          id
        ]));

        const userUpdates = {
          nodeId: userNodeIds[0] || id,
          nodeIds: userNodeIds,
          isApproved: true
        };
        if (finalRoleType === 'shareholder') userUpdates.role = 'shareholder';
        else if (finalRoleType === 'manager') userUpdates.role = 'manager';
        else if (finalRoleType === 'staff') userUpdates.role = 'staff';
        db.update('users', targetUserId, userUpdates);
      }
    }
  }

  const updatedNode = db.update('orgNodes', id, updates);
  res.json({ message: 'Đã cập nhật nút sơ đồ thành công.', node: updatedNode });
});

// Delete a node
router.delete('/:id', verifyToken, requireManagerOrAdmin, (req, res) => {
  const { id } = req.params;

  const existingNode = db.findById('orgNodes', id);
  if (!existingNode) {
    return res.status(404).json({ message: 'Không tìm thấy nút cần xóa.' });
  }

  if (req.user.role === 'manager') {
    const editableNodeIds = getManagerEditableNodeIds(req.user, db.getCollection('orgNodes'));
    if (!editableNodeIds.has(id)) {
      return res.status(403).json({ message: 'Quản lý không có quyền xóa nút này.' });
    }
  }

  // If node had a linked user, update user's assigned nodeIds
  if (existingNode.userId) {
    const orgNodesList = db.getCollection('orgNodes');
    const remaining = orgNodesList
      .filter(n => n.userId === existingNode.userId && n.id !== id)
      .map(n => n.id);
    db.update('users', existingNode.userId, {
      nodeIds: remaining,
      nodeId: remaining[0] || null
    });
  }

  // To prevent breaking the hierarchy tree, find children of the deleted node and link them to its parent
  const orgNodes = db.getCollection('orgNodes');
  const children = orgNodes.filter(n => n.parentId === id);

  children.forEach(child => {
    db.update('orgNodes', child.id, { parentId: existingNode.parentId });
  });

  const success = db.delete('orgNodes', id);
  if (success) {
    res.json({ message: 'Đã xóa nút thành công. Các nút con đã được chuyển giao cho cấp trên.' });
  } else {
    res.status(500).json({ message: 'Không thể xóa nút.' });
  }
});

// Reset org chart nodes and custom calculations to default seed values
router.post('/reset', verifyToken, requireAdmin, (req, res) => {
  // Hardcoded default seed
  const defaultNodes = [
    {
      id: 'org_chairman',
      label: 'Chủ tịch',
      parentId: null,
      roleType: 'president',
      commission: 70,
      expenses: [],
      taxes: 10,
      customFields: []
    },
    {
      id: 'org_shareholder1',
      label: 'Cổ đông 1',
      parentId: 'org_chairman',
      roleType: 'shareholder',
      commission: 5,
      expenses: [],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_shareholder2',
      label: 'Cổ đông 2',
      parentId: 'org_chairman',
      roleType: 'shareholder',
      commission: 10,
      expenses: [],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_shareholder3',
      label: 'Cổ đông 3',
      parentId: 'org_chairman',
      roleType: 'shareholder',
      commission: 15,
      expenses: [],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_staff_dept',
      label: 'Bộ máy nhân sự',
      parentId: 'org_shareholder1',
      roleType: 'department',
      commission: 0,
      expenses: [],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_staff1',
      label: 'NV Code 1',
      parentId: 'org_staff_dept',
      roleType: 'staff',
      commission: 0,
      expenses: [
        { name: 'Lương', amount: 6000000 },
        { name: 'Bảo hiểm', amount: 2000000 },
        { name: 'Phụ cấp', amount: 3000000 }
      ],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_staff2',
      label: 'NV Code 2',
      parentId: 'org_staff_dept',
      roleType: 'staff',
      commission: 0,
      expenses: [
        { name: 'Lương', amount: 5000000 },
        { name: 'Bảo hiểm', amount: 1500000 },
        { name: 'Phụ cấp', amount: 1000000 }
      ],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_staff3',
      label: 'NV Code 3',
      parentId: 'org_staff_dept',
      roleType: 'staff',
      commission: 0,
      expenses: [
        { name: 'Lương', amount: 4000000 },
        { name: 'Bảo hiểm', amount: 1000000 },
        { name: 'Phụ cấp', amount: 500000 }
      ],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_tools_dept',
      label: 'Công cụ phần mềm / AI',
      parentId: 'org_shareholder2',
      roleType: 'department',
      commission: 0,
      expenses: [],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_tool1',
      label: 'AI Chat GPT',
      parentId: 'org_tools_dept',
      roleType: 'tool',
      commission: 0,
      expenses: [
        { name: 'Phí bản quyền', amount: 2000000 }
      ],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_tool2',
      label: 'Capcut',
      parentId: 'org_tools_dept',
      roleType: 'tool',
      commission: 0,
      expenses: [
        { name: 'Phí bản quyền', amount: 1000000 }
      ],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_tool3',
      label: 'Canva',
      parentId: 'org_tools_dept',
      roleType: 'tool',
      commission: 0,
      expenses: [
        { name: 'Phí bản quyền', amount: 500000 }
      ],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_ops_dept',
      label: 'Chi phí vận hành',
      parentId: 'org_shareholder3',
      roleType: 'department',
      commission: 0,
      expenses: [],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_op1',
      label: 'mặt Bằng',
      parentId: 'org_ops_dept',
      roleType: 'expense',
      commission: 0,
      expenses: [
        { name: 'Tiền thuê nhà', amount: 10000000 }
      ],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_op2',
      label: 'chi phí thiết bị',
      parentId: 'org_ops_dept',
      roleType: 'expense',
      commission: 0,
      expenses: [
        { name: 'Khấu hao thiết bị', amount: 2000000 }
      ],
      taxes: 0,
      customFields: []
    },
    {
      id: 'org_op3',
      label: 'CP Khác',
      parentId: 'org_ops_dept',
      roleType: 'expense',
      commission: 0,
      expenses: [
        { name: 'Chi phí phát sinh', amount: 1000000 }
      ],
      taxes: 0,
      customFields: []
    }
  ];

  const defaultCalculations = [
    {
      id: 'cc_reserve',
      name: 'Quỹ dự phòng phát triển',
      type: 'subtract',
      value: 500000
    }
  ];

  db.setCollection('orgNodes', defaultNodes);
  db.setCollection('customCalculations', defaultCalculations);

  res.json({ message: 'Đã hoàn tác sơ đồ tổ chức về cấu hình mặc định vẽ tay.' });
});

// Custom calculations management endpoints
router.post('/custom-calc', verifyToken, requireAdmin, (req, res) => {
  const { name, type, value } = req.body;
  if (!name || !value) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ tên và giá trị.' });
  }

  const newItem = {
    name,
    type: type === 'add' ? 'add' : 'subtract',
    value: Number(value)
  };

  const savedItem = db.insert('customCalculations', newItem);
  res.status(201).json({ message: 'Đã thêm mục tính toán thành công.', item: savedItem });
});

router.put('/custom-calc/:id', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, type, value } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type === 'add' ? 'add' : 'subtract';
  if (value !== undefined) updates.value = Number(value);

  const updatedItem = db.update('customCalculations', id, updates);
  if (!updatedItem) {
    return res.status(404).json({ message: 'Không tìm thấy mục tính toán này.' });
  }

  res.json({ message: 'Đã cập nhật mục tính toán thành công.', item: updatedItem });
});

router.delete('/custom-calc/:id', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const success = db.delete('customCalculations', id);
  if (success) {
    res.json({ message: 'Đã xóa mục tính toán thành công.' });
  } else {
    res.status(404).json({ message: 'Không tìm thấy mục tính toán cần xóa.' });
  }
});

// Manager & Admin endpoint to update node expenses (Bottom-Up Rollup auto-summing)
router.post('/node-expense', verifyToken, requireManagerOrAdmin, (req, res) => {
  const { nodeId, expenses } = req.body;
  if (!nodeId || !Array.isArray(expenses)) {
    return res.status(400).json({ message: 'Vui lòng cung cấp mã nút và danh sách chi phí.' });
  }

  const existingNode = db.findById('orgNodes', nodeId);
  if (!existingNode) {
    return res.status(404).json({ message: 'Không tìm thấy nút trong hệ thống.' });
  }

  if (req.user.role === 'manager') {
    const editableNodeIds = getManagerEditableNodeIds(req.user, db.getCollection('orgNodes'));
    if (!editableNodeIds.has(nodeId)) {
      return res.status(403).json({ message: 'Quản lý không có quyền cập nhật chi phí của nút này.' });
    }
  }

  const formattedExpenses = expenses.map(e => ({ name: e.name, amount: Number(e.amount || 0) }));
  const updatedNode = db.update('orgNodes', nodeId, { expenses: formattedExpenses });

  // Clear/sync direct expenses on child nodes under nodeId to prevent duplicate summing with parent expenses
  const allOrgNodes = db.getCollection('orgNodes');
  allOrgNodes.forEach(child => {
    const pIds = Array.isArray(child.parentIds) && child.parentIds.length > 0 ? child.parentIds : (child.parentId ? [child.parentId] : []);
    if (pIds.includes(nodeId) && Array.isArray(child.expenses) && child.expenses.length > 0) {
      db.update('orgNodes', child.id, { expenses: [] });
    }
  });

  // Recalculate Bottom-Up Rollups
  const rawOrgNodes = db.getCollection('orgNodes');
  const processedNodes = calculateRollupsAndLevels(rawOrgNodes);

  res.json({
    message: 'Cập nhật chi phí bộ phận thành công! Chi phí đã tự động cộng dồn lên các cấp trên.',
    node: updatedNode,
    nodes: applyRBACFilter(processedNodes, req.user)
  });
});

// Top Admin endpoint to re-parent nodes (Drag & Drop / Re-ordering)
router.post('/reparent', verifyToken, requireAdmin, (req, res) => {
  const { nodeId, newParentId } = req.body;
  if (!nodeId) {
    return res.status(400).json({ message: 'Vui lòng cung cấp nodeId.' });
  }

  const targetNode = db.findById('orgNodes', nodeId);
  if (!targetNode) {
    return res.status(404).json({ message: 'Không tìm thấy nút cần chuyển cấp.' });
  }

  // Prevent cycle where a node becomes its own parent or descendant of itself
  if (nodeId === newParentId) {
    return res.status(400).json({ message: 'Nút không thể là cấp trên của chính mình.' });
  }

  db.update('orgNodes', nodeId, { parentId: newParentId === '' ? null : newParentId });

  const rawOrgNodes = db.getCollection('orgNodes');
  const processedNodes = calculateRollupsAndLevels(rawOrgNodes);

  res.json({
    message: `Đã chuyển vị trí phân cấp của "${targetNode.label}" thành công!`,
    nodes: processedNodes
  });
});

// Endpoint to insert a new level ABOVE an existing node
router.post('/insert-above', verifyToken, requireManagerOrAdmin, (req, res) => {
  const { targetNodeId, label, roleType } = req.body;
  if (!targetNodeId || !label) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ mã nút mục tiêu và tên nút mới.' });
  }

  const targetNode = db.findById('orgNodes', targetNodeId);
  if (!targetNode) {
    return res.status(404).json({ message: 'Không tìm thấy nút mục tiêu.' });
  }

  if (req.user.role === 'manager') {
    const editableNodeIds = getManagerEditableNodeIds(req.user, db.getCollection('orgNodes'));
    if (!editableNodeIds.has(targetNodeId)) {
      return res.status(403).json({ message: 'Quản lý không có quyền chèn cấp tại nút này.' });
    }
  }

  // 1. Create new node inserted above targetNode (taking targetNode's current parentId)
  const newNode = {
    label,
    parentId: targetNode.parentId,
    roleType: roleType || 'department',
    commission: 0,
    expenses: [],
    taxes: 0,
    userId: null,
    customFields: []
  };

  const savedNewNode = db.insert('orgNodes', newNode);

  // 2. Update targetNode's parentId to point to the newly created node
  db.update('orgNodes', targetNodeId, { parentId: savedNewNode.id });

  const rawOrgNodes = db.getCollection('orgNodes');
  const processedNodes = calculateRollupsAndLevels(rawOrgNodes);

  res.json({
    message: `Đã chèn cấp mới "${label}" phía trên "${targetNode.label}" thành công!`,
    nodes: processedNodes
  });
});

// Bulk update nodes and custom calculations from simulation mode
router.post('/bulk-save', verifyToken, requireAdmin, (req, res) => {
  const { nodes, customCalculations } = req.body;

  if (Array.isArray(nodes)) {
    db.setCollection('orgNodes', nodes);
  }
  if (Array.isArray(customCalculations)) {
    db.setCollection('customCalculations', customCalculations);
  }

  res.json({ message: 'Đã áp dụng toàn bộ cấu hình mô phỏng thành công vào sơ đồ gốc!' });
});

module.exports = router;
