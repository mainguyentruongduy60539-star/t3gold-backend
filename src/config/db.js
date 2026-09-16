const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../data/database.json');

// Ensure database file exists
function initDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    seedDb();
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      let modified = false;
      if (!data.orgNodes || data.orgNodes.length === 0) {
        data.orgNodes = [
          { id: 'org_chairman', label: 'Chủ tịch', parentIds: [], parentId: null, roleType: 'president', commission: 70, expenses: [], taxes: 10, customFields: [] },
          { id: 'org_shareholder1', label: 'Cổ đông 1', parentIds: ['org_chairman'], parentId: 'org_chairman', roleType: 'shareholder', commission: 5, expenses: [], taxes: 0, userId: 'usr_shareholder1', customFields: [] },
          { id: 'org_shareholder2', label: 'Cổ đông 2', parentIds: ['org_chairman'], parentId: 'org_chairman', roleType: 'shareholder', commission: 10, expenses: [], taxes: 0, userId: 'usr_shareholder2', customFields: [] },
          { id: 'org_shareholder3', label: 'Cổ đông 3', parentIds: ['org_chairman'], parentId: 'org_chairman', roleType: 'shareholder', commission: 15, expenses: [], taxes: 0, userId: 'usr_shareholder3', customFields: [] },
          { id: 'org_staff_dept', label: 'Bộ máy nhân sự', parentIds: ['org_shareholder1', 'org_shareholder2'], parentId: 'org_shareholder1', roleType: 'department', commission: 0, expenses: [], taxes: 0, customFields: [] },
          { id: 'org_staff1', label: 'NV Code 1', parentIds: ['org_staff_dept'], parentId: 'org_staff_dept', roleType: 'staff', commission: 0, expenses: [{ name: 'Lương', amount: 6000000 }, { name: 'Bảo hiểm', amount: 2000000 }, { name: 'Phụ cấp', amount: 3000000 }], taxes: 0, customFields: [] },
          { id: 'org_staff2', label: 'NV Code 2', parentIds: ['org_staff_dept'], parentId: 'org_staff_dept', roleType: 'staff', commission: 0, expenses: [{ name: 'Lương', amount: 5000000 }, { name: 'Bảo hiểm', amount: 1500000 }, { name: 'Phụ cấp', amount: 1000000 }], taxes: 0, customFields: [] },
          { id: 'org_staff3', label: 'NV Code 3', parentIds: ['org_staff_dept'], parentId: 'org_staff_dept', roleType: 'staff', commission: 0, expenses: [{ name: 'Lương', amount: 4000000 }, { name: 'Bảo hiểm', amount: 1000000 }, { name: 'Phụ cấp', amount: 500000 }], taxes: 0, customFields: [] },
          { id: 'org_tools_dept', label: 'Công cụ phần mềm / AI', parentIds: ['org_shareholder2', 'org_shareholder3'], parentId: 'org_shareholder2', roleType: 'department', commission: 0, expenses: [], taxes: 0, customFields: [] },
          { id: 'org_tool1', label: 'AI Chat GPT', parentIds: ['org_tools_dept'], parentId: 'org_tools_dept', roleType: 'tool', commission: 0, expenses: [{ name: 'Phí bản quyền', amount: 2000000 }], taxes: 0, customFields: [] },
          { id: 'org_tool2', label: 'Capcut', parentIds: ['org_tools_dept'], parentId: 'org_tools_dept', roleType: 'tool', commission: 0, expenses: [{ name: 'Phí bản quyền', amount: 1000000 }], taxes: 0, customFields: [] },
          { id: 'org_tool3', label: 'Canva', parentIds: ['org_tools_dept'], parentId: 'org_tools_dept', roleType: 'tool', commission: 0, expenses: [{ name: 'Phí bản quyền', amount: 500000 }], taxes: 0, customFields: [] },
          { id: 'org_ops_dept', label: 'Chi phí vận hành', parentIds: ['org_shareholder1', 'org_shareholder3'], parentId: 'org_shareholder1', roleType: 'department', commission: 0, expenses: [], taxes: 0, customFields: [] },
          { id: 'org_op1', label: 'mặt Bằng', parentIds: ['org_ops_dept'], parentId: 'org_ops_dept', roleType: 'expense', commission: 0, expenses: [{ name: 'Tiền thuê nhà', amount: 10000000 }], taxes: 0, customFields: [] },
          { id: 'org_op2', label: 'chi phí thiết bị', parentIds: ['org_ops_dept'], parentId: 'org_ops_dept', roleType: 'expense', commission: 0, expenses: [{ name: 'Khấu hao thiết bị', amount: 2000000 }], taxes: 0, customFields: [] },
          { id: 'org_op3', label: 'CP Khác', parentIds: ['org_ops_dept'], parentId: 'org_ops_dept', roleType: 'expense', commission: 0, expenses: [{ name: 'Chi phí phát sinh', amount: 1000000 }], taxes: 0, customFields: [] }
        ];
        modified = true;
      } else {
        // Automatic migration for existing database.json file
        data.orgNodes = data.orgNodes.map(node => {
          if (!Array.isArray(node.parentIds) || node.parentIds.length === 0) {
            modified = true;
            if (node.id === 'org_staff_dept') {
              return { ...node, parentIds: ['org_shareholder1', 'org_shareholder2'], parentId: 'org_shareholder1' };
            }
            if (node.id === 'org_tools_dept') {
              return { ...node, parentIds: ['org_shareholder2', 'org_shareholder3'], parentId: 'org_shareholder2' };
            }
            if (node.id === 'org_ops_dept') {
              return { ...node, parentIds: ['org_shareholder1', 'org_shareholder3'], parentId: 'org_shareholder1' };
            }
            return {
              ...node,
              parentIds: node.parentId ? [node.parentId] : [],
              parentId: node.parentId || null
            };
          }
          return node;
        });
      }
      if (!data.customCalculations || data.customCalculations.length === 0) {
        data.customCalculations = [
          { id: 'cc_reserve', name: 'Quỹ dự phòng phát triển', type: 'subtract', value: 500000 }
        ];
        modified = true;
      }
      if (modified) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
        console.log('Successfully initialized org chart tables in existing database.');
      }
    } catch (e) {
      console.error('Error auto-initializing org chart tables:', e);
    }
  }
}

function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      initDb();
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading DB:', error);
    return { users: [], orders: [], customers: [], referrals: [], orgNodes: [], customCalculations: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing DB:', error);
    return false;
  }
}

function seedDb() {
  const salt = bcrypt.genSaltSync(10);
  
  // Seed Users
  const users = [
    {
      id: 'usr_admin',
      name: 'Quản trị viên T3Gold',
      phone: '0988768345',
      email: 'admin@t3gold.vn',
      password: bcrypt.hashSync('T3GoldPassword2026', salt),
      storeName: 'Trụ sở chính T3Gold',
      address: 'TP. Hồ Chí Minh',
      role: 'admin',
      isApproved: true,
      referralCode: 'T3ADMIN',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_shareholder1',
      name: 'Trần Văn Cổ Đông 1',
      phone: '0901111111',
      email: 'codong1@t3gold.vn',
      password: bcrypt.hashSync('codong123', salt),
      storeName: 'Hội Đồng Cổ Đông 1',
      address: 'TP. HCM',
      role: 'shareholder',
      nodeId: 'org_shareholder1',
      isApproved: true,
      status: 'sold',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_shareholder2',
      name: 'Lê Thị Cổ Đông 2',
      phone: '0902222222',
      email: 'codong2@t3gold.vn',
      password: bcrypt.hashSync('codong123', salt),
      storeName: 'Hội Đồng Cổ Đông 2',
      address: 'Bình Dương',
      role: 'shareholder',
      nodeId: 'org_shareholder2',
      isApproved: true,
      status: 'sold',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_manager1',
      name: 'Nguyễn Văn Quản Lý Nhân Sự',
      phone: '0903333333',
      email: 'quanly1@t3gold.vn',
      password: bcrypt.hashSync('quanly123', salt),
      storeName: 'Bộ Máy Nhân Sự',
      address: 'Bình Dương',
      role: 'manager',
      nodeId: 'org_staff_dept',
      isApproved: true,
      status: 'sold',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_member1',
      name: 'Nguyễn Văn Minh',
      phone: '0912345678',
      email: 'member@t3gold.vn',
      password: bcrypt.hashSync('member123', salt),
      storeName: 'Tiệm Vàng Kim Long',
      address: 'Thuận An, Bình Dương',
      role: 'member',
      isApproved: false,
      status: 'pending',
      softwarePackage: 'T3Gold Pro - Gói 1 Năm',
      amountPaid: 3500000,
      licenseKey: 'T3G-PRO-MINH-7890',
      expirationDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      referralCode: 'KIMLONGT3',
      referrerCode: 'T3ADMIN',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_member2',
      name: 'Trần Thị Thu Thủy',
      phone: '0987654321',
      email: 'vip@t3gold.vn',
      password: bcrypt.hashSync('vip123', salt),
      storeName: 'Tiệm Vàng Kim Thịnh',
      address: 'Quận 3, TP. Hồ Chí Minh',
      role: 'member',
      isApproved: true,
      status: 'sold',
      softwarePackage: 'T3Gold Lifetime - Gói Vĩnh Viễn',
      amountPaid: 9500000,
      licenseKey: 'T3G-LIFETIME-THUY-1234',
      expirationDate: new Date(Date.now() + 70 * 365 * 24 * 3600 * 1000).toISOString(),
      referralCode: 'KIMTHINHT3',
      referrerCode: 'T3ADMIN',
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    }
  ];

  // Seed Orders
  const orders = [
    {
      id: 'ord_001',
      memberId: 'usr_member2',
      customerName: 'Lê Văn Tám',
      productName: 'Nhẫn vàng 24k - 1 chỉ',
      amount: 7600000,
      quantity: 1,
      status: 'completed',
      purchaseDate: '2026-07-15T10:00:00.000Z',
      createdAt: '2026-07-15T10:00:00.000Z'
    },
    {
      id: 'ord_002',
      memberId: 'usr_member2',
      customerName: 'Nguyễn Thị Hoa',
      productName: 'Lắc tay bạc ý 925',
      amount: 1200000,
      quantity: 2,
      status: 'completed',
      purchaseDate: '2026-07-16T14:30:00.000Z',
      createdAt: '2026-07-16T14:30:00.000Z'
    },
    {
      id: 'ord_003',
      memberId: 'usr_member2',
      customerName: 'Phạm Minh Trí',
      productName: 'Dây chuyền vàng 18k - 3 chỉ',
      amount: 18500000,
      quantity: 1,
      status: 'pending',
      purchaseDate: '2026-07-18T09:15:00.000Z',
      createdAt: '2026-07-18T09:15:00.000Z'
    },
    // Orders of the T3Gold software licenses themselves
    {
      id: 'ord_lic_001',
      memberId: 'usr_admin',
      customerName: 'Tiệm Vàng Kim Long (Minh)',
      productName: 'T3Gold Pro - Gói 1 Năm',
      amount: 3500000,
      quantity: 1,
      status: 'completed',
      purchaseDate: '2026-07-10T08:00:00.000Z',
      createdAt: '2026-07-10T08:00:00.000Z'
    },
    {
      id: 'ord_lic_002',
      memberId: 'usr_admin',
      customerName: 'Tiệm Vàng Kim Thịnh (Thủy)',
      productName: 'T3Gold Lifetime - Gói Vĩnh Viễn',
      amount: 9500000,
      quantity: 1,
      status: 'completed',
      purchaseDate: '2026-07-12T11:00:00.000Z',
      createdAt: '2026-07-12T11:00:00.000Z'
    }
  ];

  // Seed Customers
  const customers = [
    {
      id: 'cust_001',
      memberId: 'usr_member2',
      name: 'Lê Văn Tám',
      phone: '0909112233',
      email: 'tam.le@gmail.com',
      address: 'Quận 10, TP. Hồ Chí Minh',
      notes: 'Khách hàng thân thiết, thường mua vàng nhẫn tích lũy',
      createdAt: '2026-07-15T10:00:00.000Z'
    },
    {
      id: 'cust_002',
      memberId: 'usr_member2',
      name: 'Nguyễn Thị Hoa',
      phone: '0988776655',
      email: 'hoa.nguyen@yahoo.com',
      address: 'Bình Thạnh, TP. Hồ Chí Minh',
      notes: 'Ưa thích các dòng trang sức bạc phong cách trẻ trung',
      createdAt: '2026-07-16T14:30:00.000Z'
    },
    {
      id: 'cust_003',
      memberId: 'usr_member2',
      name: 'Phạm Minh Trí',
      phone: '0911223399',
      email: 'tri.pham@outlook.com',
      address: 'Thủ Dầu Một, Bình Dương',
      notes: 'Đặt chế tác riêng dây chuyền vàng 18k làm quà cưới',
      createdAt: '2026-07-18T09:15:00.000Z'
    }
  ];

  // Seed Referrals
  const referrals = [
    {
      id: 'ref_001',
      referrerId: 'usr_member2',
      refereeName: 'Tiệm Vàng Hùng Phát',
      status: 'completed', // 'pending', 'completed', 'cancelled'
      commission: 500000,
      createdAt: '2026-07-14T10:00:00.000Z'
    },
    {
      id: 'ref_002',
      referrerId: 'usr_member2',
      refereeName: 'Dịch vụ Cầm đồ Kim Tiền',
      status: 'pending',
      commission: 0,
      createdAt: '2026-07-18T16:00:00.000Z'
    }
  ];
  
  // Seed Org Nodes (Sơ đồ tổ chức)
  const orgNodes = [
    {
      id: 'org_chairman',
      label: 'Chủ tịch',
      parentId: null,
      roleType: 'president',
      commission: 70, // 70% commission of remaining profit
      expenses: [],
      taxes: 10, // 10% tax deduction
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
      parentId: 'org_chairman',
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
      parentId: 'org_chairman',
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
      parentId: 'org_chairman',
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

  // Seed Custom Calculations
  const customCalculations = [
    {
      id: 'cc_reserve',
      name: 'Quỹ dự phòng phát triển',
      type: 'subtract', // 'add' or 'subtract'
      value: 500000
    }
  ];

  const dbData = { users, orders, customers, referrals, orgNodes, customCalculations };
  writeDb(dbData);
  console.log('Seeded database successfully.');
}

const db = {
  getCollection: (collection) => {
    const data = readDb();
    return data[collection] || [];
  },

  setCollection: (collection, items) => {
    const data = readDb();
    data[collection] = items;
    return writeDb(data);
  },

  findById: (collection, id) => {
    const items = db.getCollection(collection);
    return items.find(item => item.id === id);
  },

  insert: (collection, item) => {
    const items = db.getCollection(collection);
    const newItem = {
      id: `${collection.substring(0, 3)}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
      ...item
    };
    items.push(newItem);
    db.setCollection(collection, items);
    return newItem;
  },

  update: (collection, id, updates) => {
    const items = db.getCollection(collection);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    db.setCollection(collection, items);
    return items[index];
  },

  delete: (collection, id) => {
    const items = db.getCollection(collection);
    const filtered = items.filter(item => item.id !== id);
    if (items.length === filtered.length) return false;
    db.setCollection(collection, filtered);
    return true;
  }
};

// Initialize DB on module load
initDb();

module.exports = db;
