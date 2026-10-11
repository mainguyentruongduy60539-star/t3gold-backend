  require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const { verifyToken, requireApproved, requireStaffOrAdmin } = require('./middleware/auth');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting the API server.');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with support for frontend addresses
const allowedOrigins = [
  'https://www.t3gold.vn',
  'https://t3gold.vn',
  'http://localhost:3000'
];

if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').forEach(o => {
    const trimmed = o.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) allowedOrigins.push(trimmed);
  });
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Register routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/org-chart', require('./routes/orgChart'));
app.use('/api/gold-prices', require('./routes/goldPrices'));
app.use('/api/ai', require('./routes/ai'));

// In-depth Analytics Endpoint (Available only for Admin and Staff Admin)
app.get('/api/analytics', verifyToken, requireStaffOrAdmin, (req, res) => {
  const users = db.getCollection('users');
  const members = users.filter(u => u.role === 'member');

  // Calculate revenue from SOLD software packages
  const soldMembers = members.filter(m => m.status === 'sold');
  const totalRevenue = soldMembers.reduce((sum, m) => sum + (m.amountPaid || 0), 0);

  // Calculate pending revenue
  const pendingMembers = members.filter(m => m.status === 'pending');
  const pendingRevenue = pendingMembers.reduce((sum, m) => sum + (m.amountPaid || 0), 0);

  // Expose count stats
  const soldCount = soldMembers.length;
  const pendingCount = pendingMembers.length;
  const trialCount = members.filter(m => m.status === 'trial').length;
  const cancelledCount = members.filter(m => m.status === 'cancelled').length;

  // Group revenue by date, month, and year based on user registration/purchase date
  const dailyHistory = {};
  const monthlyHistory = {};
  const yearlyHistory = {};

  soldMembers.forEach(m => {
    const dateObj = new Date(m.createdAt || m.purchaseDate || Date.now());
    
    // Day (YYYY-MM-DD)
    const dayStr = dateObj.toISOString().split('T')[0];
    dailyHistory[dayStr] = (dailyHistory[dayStr] || 0) + (m.amountPaid || 0);

    // Month (YYYY-MM)
    const monthStr = dayStr.substring(0, 7);
    monthlyHistory[monthStr] = (monthlyHistory[monthStr] || 0) + (m.amountPaid || 0);

    // Year (YYYY)
    const yearStr = dayStr.substring(0, 4);
    yearlyHistory[yearStr] = (yearlyHistory[yearStr] || 0) + (m.amountPaid || 0);
  });

  // Convert to sorted arrays
  const chartDataDaily = Object.keys(dailyHistory).sort().map(date => ({ date, revenue: dailyHistory[date] }));
  const chartDataMonthly = Object.keys(monthlyHistory).sort().map(date => ({ date, revenue: monthlyHistory[date] }));
  const chartDataYearly = Object.keys(yearlyHistory).sort().map(date => ({ date, revenue: yearlyHistory[date] }));

  // Package popularity
  const packagePopularity = {};
  members.forEach(m => {
    const pkg = m.softwarePackage || 'T3Gold Trial - Dùng thử';
    packagePopularity[pkg] = (packagePopularity[pkg] || 0) + 1;
  });

  // Geographical distribution
  const geoDistribution = {};
  members.forEach(m => {
    const addr = m.address ? m.address.split(',').pop().trim() : 'Chưa cập nhật';
    geoDistribution[addr] = (geoDistribution[addr] || 0) + 1;
  });

  res.json({
    totalRevenue,
    pendingRevenue,
    licenseCount: members.length,
    statusCounts: {
      sold: soldCount,
      pending: pendingCount,
      trial: trialCount,
      cancelled: cancelledCount
    },
    charts: {
      daily: chartDataDaily,
      monthly: chartDataMonthly,
      yearly: chartDataYearly
    },
    popularity: Object.keys(packagePopularity).map(name => ({ name, count: packagePopularity[name] })),
    geography: Object.keys(geoDistribution).map(name => ({ name, count: geoDistribution[name] })),
    potentialSummary: {
      trialConversionPotential: trialCount * 3500000, // assuming trial users convert to Pro package
      marketGrowthRate: "15%",
      topRegion: Object.keys(geoDistribution).sort((a,b) => geoDistribution[b] - geoDistribution[a])[0] || 'Chưa có'
    }
  });
});

// Member Referral Link stats
app.get('/api/referrals/my-stats', verifyToken, (req, res) => {
  const referrals = db.getCollection('referrals');
  const myRefs = referrals.filter(r => r.referrerId === req.user.id || r.referrerId === req.user.referralCode);
  
  const completedRefs = myRefs.filter(r => r.status === 'completed');
  const totalCommission = completedRefs.reduce((sum, r) => sum + (r.commission || 0), 0);

  res.json({
    referrals: myRefs,
    totalCommission,
    count: myRefs.length,
    completedCount: completedRefs.length
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Có lỗi xảy ra trên hệ thống.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  T3Gold Backend Server running on port ${PORT}`);
  console.log(`  API Base URL: http://localhost:${PORT}/api`);
  console.log(`====================================================`);
});
