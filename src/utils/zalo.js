const db = require('../config/db');

/**
 * Cấu hình Zalo Open App từ file môi trường & Cơ sở dữ liệu
 */
const ZALO_APP_ID = process.env.ZALO_APP_ID || '2170612476781447002';
const ZALO_APP_SECRET = process.env.ZALO_APP_SECRET || 'R252E9jCUCYIKYm115SG';
const ZALO_OA_ID = process.env.ZALO_OA_ID || '2226317272607901891';

// Mã 3 Template ID ZNS riêng biệt vừa được tạo trên Zalo Cloud:
const ZALO_ZNS_TEMPLATE_REGISTRATION = process.env.ZALO_ZNS_TEMPLATE_REGISTRATION || '636472';
const ZALO_ZNS_TEMPLATE_ADMIN = process.env.ZALO_ZNS_TEMPLATE_ADMIN || '636722';
const ZALO_ZNS_TEMPLATE_APPROVAL = process.env.ZALO_ZNS_TEMPLATE_APPROVAL || '636724';

/**
 * Lấy Zalo Access Token hợp lệ (Tự động gia hạn khi hết hạn 25h)
 */
async function getValidZaloAccessToken() {
  const zaloTokens = db.getCollection('zaloTokens') || [];
  let tokenData = zaloTokens[0] || null;

  if (tokenData && tokenData.accessToken && tokenData.expiresAt && Date.now() < tokenData.expiresAt) {
    return tokenData.accessToken;
  }

  if (tokenData && tokenData.refreshToken) {
    try {
      console.log('[ZALO OAUTH] 🔄 Đang tự động làm mới Access Token từ Zalo OAuth...');
      const params = new URLSearchParams({
        refresh_token: tokenData.refreshToken,
        app_id: ZALO_APP_ID,
        grant_type: 'refresh_token'
      });

      const response = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'secret_key': ZALO_APP_SECRET
        },
        body: params
      });

      const data = await response.json();
      if (data.access_token) {
        const updatedToken = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || tokenData.refreshToken,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000),
          updatedAt: new Date().toISOString()
        };
        db.setCollection('zaloTokens', [updatedToken]);
        console.log('[ZALO OAUTH] ✅ Làm mới Access Token thành công!');
        return data.access_token;
      } else {
        console.error('[ZALO OAUTH ERROR]:', data);
      }
    } catch (e) {
      console.error('[ZALO OAUTH FETCH ERROR]:', e.message);
    }
  }

  return process.env.ZALO_ACCESS_TOKEN || '';
}

/**
 * 1️⃣ MẪU 1 (Template 636472): Gửi ZNS cho Khách hàng khi ĐĂNG KÝ MỚI
 */
async function sendZaloCustomerRegistrationZNS({ phone, name, storeName, softwarePackage }) {
  let formattedPhone = phone ? phone.trim().replace(/^0/, '84') : '';
  const pkgName = softwarePackage || 'Phần Mềm Quản Lý Tiệm Vàng T3Gold';
  const accessToken = await getValidZaloAccessToken();

  console.log(`====================================================`);
  console.log(`[ZALO ZNS MẪU 1 - 636472] 📱 GỬI KHÁCH HÀNG: ${name} (${formattedPhone})`);
  console.log(`[TIỆM VÀNG]: ${storeName} | [GÓI]: ${pkgName}`);
  console.log(`====================================================`);

  // Dữ liệu tham số cho Mẫu 1 (636472)
  const templateData = {
    customer_name: name || 'Khách hàng',
    product_name: pkgName,
    company_name: 'T3Gold',
    order_code: `T3G-${Math.floor(1000 + Math.random() * 9000)}`,
    payment_status: 'Chờ quản trị viên duyệt'
  };

  const zaloPayload = {
    phone: formattedPhone,
    template_id: ZALO_ZNS_TEMPLATE_REGISTRATION,
    template_data: templateData,
    tracking_id: `t3g_reg_${Date.now()}`
  };

  let zaloApiResponse = null;
  let status = 'sent';

  try {
    if (typeof fetch !== 'undefined') {
      const response = await fetch('https://business.openapi.zalo.me/message/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': accessToken
        },
        body: JSON.stringify(zaloPayload)
      });
      zaloApiResponse = await response.json();
      console.log(`[ZALO ZNS MẪU 1 RESULT]:`, zaloApiResponse);
    }
  } catch (apiError) {
    console.error(`[ZALO ZNS MẪU 1 ERROR]:`, apiError.message);
    status = 'error';
  }

  const zaloLog = {
    type: 'customer_registration_zns',
    phone: formattedPhone,
    name,
    storeName,
    softwarePackage: pkgName,
    templateId: ZALO_ZNS_TEMPLATE_REGISTRATION,
    templateData,
    apiResponse: zaloApiResponse,
    status,
    sentAt: new Date().toISOString()
  };

  try {
    db.insert('zaloLogs', zaloLog);
  } catch (e) {
    console.error('Error saving Zalo log to database:', e);
  }

  return {
    success: true,
    message: `Đã gửi ZNS xác nhận đăng ký cho ${name}`,
    apiResponse: zaloApiResponse,
    sentAt: zaloLog.sentAt
  };
}

/**
 * 2️⃣ MẪU 2 (Template 636722): Gửi ZNS CẢNH BÁO CHO QUẢN TRỊ VIÊN (ADMIN) KHI CÓ ĐƠN MỚI
 */
async function sendZaloAdminNotification({ adminPhone, customerName, customerPhone, storeName, softwarePackage }) {
  let formattedAdminPhone = adminPhone ? adminPhone.trim().replace(/^0/, '84') : '';
  const pkgName = softwarePackage || 'Gói phần mềm T3Gold';
  const accessToken = await getValidZaloAccessToken();

  console.log(`====================================================`);
  console.log(`[ZALO ZNS MẪU 2 - 636722] 🔔 BẮN CẢNH BÁO TỚI ADMIN (${formattedAdminPhone})`);
  console.log(`[ĐƠN MỚI]: Khách: ${customerName} (${customerPhone}) - Tiệm: ${storeName}`);
  console.log(`====================================================`);

  // Dữ liệu tham số cho Mẫu 2 (636722)
  const templateData = {
    order_code: `T3G-ADMIN-${Math.floor(1000 + Math.random() * 9000)}`,
    payment_status: 'Chờ Admin duyệt',
    customer_name: customerName || 'Khách hàng',
    phone_number: customerPhone || 'Chưa cập nhật',
    product_name: `${pkgName} (${storeName})`
  };

  const zaloPayload = {
    phone: formattedAdminPhone,
    template_id: ZALO_ZNS_TEMPLATE_ADMIN,
    template_data: templateData,
    tracking_id: `t3g_adm_${Date.now()}`
  };

  let zaloApiResponse = null;
  let status = 'sent';

  try {
    if (typeof fetch !== 'undefined' && formattedAdminPhone) {
      const response = await fetch('https://business.openapi.zalo.me/message/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': accessToken
        },
        body: JSON.stringify(zaloPayload)
      });
      zaloApiResponse = await response.json();
      console.log(`[ZALO ZNS MẪU 2 RESULT]:`, zaloApiResponse);
    }
  } catch (apiError) {
    console.error(`[ZALO ZNS MẪU 2 ERROR]:`, apiError.message);
    status = 'error';
  }

  const zaloLog = {
    type: 'admin_registration_alert',
    adminPhone: formattedAdminPhone,
    customerName,
    customerPhone,
    storeName,
    softwarePackage: pkgName,
    templateId: ZALO_ZNS_TEMPLATE_ADMIN,
    templateData,
    apiResponse: zaloApiResponse,
    status,
    sentAt: new Date().toISOString()
  };

  try {
    db.insert('zaloLogs', zaloLog);
  } catch (e) {
    console.error('Error saving Zalo Admin log to database:', e);
  }

  return {
    success: true,
    message: `Đã cảnh báo ZNS đơn mới tới Admin (${formattedAdminPhone})`,
    apiResponse: zaloApiResponse,
    sentAt: zaloLog.sentAt
  };
}

/**
 * 3️⃣ MẪU 3 (Template 636724): Gửi ZNS THÔNG BÁO KÍCH HOẠT BẢN QUYỀN THÀNH CÔNG CHO KHÁCH HÀNG
 */
async function sendZaloApprovalZNS({ phone, name, storeName, softwarePackage, licenseKey }) {
  let formattedPhone = phone ? phone.trim().replace(/^0/, '84') : '';
  const pkgName = softwarePackage || 'Phần Mềm Quản Lý Tiệm Vàng T3Gold';
  const key = licenseKey || `T3G-ACT-${Math.floor(1000 + Math.random() * 9000)}`;
  const accessToken = await getValidZaloAccessToken();

  console.log(`====================================================`);
  console.log(`[ZALO ZNS MẪU 3 - 636724] 🎉 THÔNG BÁO DUYỆT THÀNH CÔNG TỚI KHÁCH: ${name} (${formattedPhone})`);
  console.log(`[TIỆM VÀNG]: ${storeName} | [MÃ BẢN QUYỀN]: ${key}`);
  console.log(`====================================================`);

  // Dữ liệu tham số cho Mẫu 3 (636724)
  const templateData = {
    customer_name: name || 'Khách hàng',
    store_name: storeName || 'Tiệm Vàng Thành Viên',
    product_name: pkgName,
    license_key: key,
    payment_status: 'Đã kích hoạt thành công'
  };

  const zaloPayload = {
    phone: formattedPhone,
    template_id: ZALO_ZNS_TEMPLATE_APPROVAL,
    template_data: templateData,
    tracking_id: `t3g_appr_${Date.now()}`
  };

  let zaloApiResponse = null;
  let status = 'sent';

  try {
    if (typeof fetch !== 'undefined') {
      const response = await fetch('https://business.openapi.zalo.me/message/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': accessToken
        },
        body: JSON.stringify(zaloPayload)
      });
      zaloApiResponse = await response.json();
      console.log(`[ZALO ZNS MẪU 3 RESULT]:`, zaloApiResponse);
    }
  } catch (apiError) {
    console.error(`[ZALO ZNS MẪU 3 ERROR]:`, apiError.message);
    status = 'error';
  }

  const zaloLog = {
    type: 'customer_approval_zns',
    phone: formattedPhone,
    name,
    storeName,
    softwarePackage: pkgName,
    licenseKey: key,
    templateId: ZALO_ZNS_TEMPLATE_APPROVAL,
    templateData,
    apiResponse: zaloApiResponse,
    status,
    sentAt: new Date().toISOString()
  };

  try {
    db.insert('zaloLogs', zaloLog);
  } catch (e) {
    console.error('Error saving approval Zalo log to database:', e);
  }

  return {
    success: true,
    message: `Đã phát lệnh gửi ZNS duyệt tài khoản thành công cho ${name}`,
    apiResponse: zaloApiResponse,
    sentAt: zaloLog.sentAt
  };
}

module.exports = {
  ZALO_APP_ID,
  ZALO_APP_SECRET,
  ZALO_OA_ID,
  ZALO_ZNS_TEMPLATE_REGISTRATION,
  ZALO_ZNS_TEMPLATE_ADMIN,
  ZALO_ZNS_TEMPLATE_APPROVAL,
  getValidZaloAccessToken,
  sendZaloCustomerRegistrationZNS,
  sendZaloAdminNotification,
  sendZaloApprovalZNS
};
