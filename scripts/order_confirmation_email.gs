/**
 * ZBUILD - Script Gửi Email Xác Nhận Đơn Hàng
 * 
 * HƯỚNG DẪN SỬ DỤNG:
 * 1. Vào https://script.google.com → Tạo dự án mới
 * 2. Copy toàn bộ nội dung file này vào
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me (email của bạn)
 *    - Who has access: Anyone
 * 4. Copy URL của deployment → đưa lại cho developer để gắn vào Checkout
 * 
 * TEST: Chạy function testSendEmail() để kiểm tra
 */

// ============ CẤU HÌNH ============
const STORE_NAME = 'Zbuild - Giải pháp Xây dựng';
const STORE_EMAIL = 'noreply@zbuild.click'; // Email hiển thị (dùng email của bạn khi gửi)
const STORE_PHONE = '0xxx.xxx.xxx'; // Số hotline
const STORE_WEBSITE = 'https://zbuild.click'; // URL website

// ============ XỬ LÝ REQUEST TỪ WEBSITE ============

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Validate dữ liệu bắt buộc
    if (!data.email || !data.orderNumber || !data.items) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Thiếu thông tin bắt buộc (email, orderNumber, items)'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Gửi email
    const result = sendOrderConfirmationEmail(data);
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Hỗ trợ GET request để test
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'OK',
    message: 'ZBUILD Email Service is running. Use POST to send emails.',
    version: '1.0'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============ GỬI EMAIL XÁC NHẬN ĐƠN HÀNG ============

function sendOrderConfirmationEmail(data) {
  const {
    email,           // Email khách hàng
    orderNumber,     // Mã đơn hàng
    customerName,    // Tên khách hàng
    items,           // Danh sách sản phẩm [{name, quantity, price, image}]
    total,           // Tổng tiền
    shippingAddress, // Địa chỉ giao hàng {firstName, lastName, address, city, state, phone}
    paymentMethod,   // Phương thức thanh toán
    shippingMethod   // Phương thức vận chuyển
  } = data;
  
  // Tạo bảng sản phẩm
  let itemsHtml = '';
  let subtotal = 0;
  
  (items || []).forEach(item => {
    const itemTotal = (item.price || 0) * (item.quantity || 1);
    subtotal += itemTotal;
    itemsHtml += `
      <tr>
        <td style="padding:12px 8px; border-bottom:1px solid #f0f0f0;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width:48px; height:48px; border-radius:8px; object-fit:cover;" />` : ''}
            <div>
              <div style="font-weight:600; color:#333;">${item.name || 'Sản phẩm'}</div>
              <div style="font-size:12px; color:#888;">x${item.quantity || 1}</div>
            </div>
          </div>
        </td>
        <td style="padding:12px 8px; border-bottom:1px solid #f0f0f0; text-align:right; font-weight:600;">
          ${formatCurrency(itemTotal)}
        </td>
      </tr>
    `;
  });
  
  const tax = subtotal * 0.08;
  const totalAmount = total || (subtotal + tax);
  
  // Phương thức thanh toán
  const paymentLabel = paymentMethod === 'bank-transfer' ? 'Chuyển khoản ngân hàng' 
    : paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng (COD)' 
    : 'Thẻ tín dụng / Ghi nợ';
  
  // Phương thức vận chuyển  
  const shippingLabel = shippingMethod === 'express' ? 'Giao nhanh (1-2 ngày)' : 'Giao tiêu chuẩn (3-5 ngày)';
  
  // Ngày giao dự kiến
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + (shippingMethod === 'express' ? 2 : 5));
  const deliveryStr = Utilities.formatDate(deliveryDate, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
  
  // Tạo nội dung email HTML
  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body style="margin:0; padding:0; background-color:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width:600px; margin:0 auto; background:white;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding:32px; text-align:center;">
        <div style="display:inline-block; background:#FFB800; color:#000; font-weight:900; font-size:24px; padding:8px 16px; border-radius:8px; letter-spacing:2px;">
          Z
        </div>
        <h1 style="color:white; margin:16px 0 0; font-size:20px; font-weight:600;">
          ${STORE_NAME}
        </h1>
      </div>
      
      <!-- Success Banner -->
      <div style="background:#f0fdf4; padding:24px; text-align:center; border-bottom:3px solid #4CAF50;">
        <div style="width:48px; height:48px; background:#4CAF50; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; margin-bottom:12px;">
          <span style="color:white; font-size:24px;">✓</span>
        </div>
        <h2 style="margin:0 0 8px; color:#333; font-size:22px;">Đặt hàng thành công!</h2>
        <p style="margin:0; color:#666; font-size:14px;">
          Cảm ơn <strong>${customerName || 'bạn'}</strong>, đơn hàng của bạn đã được tiếp nhận.
        </p>
      </div>
      
      <!-- Order Info -->
      <div style="padding:24px;">
        <div style="background:#fafafa; border-radius:12px; padding:16px; margin-bottom:20px;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="padding:4px 0; color:#888; font-size:13px;">Mã đơn hàng</td>
              <td style="padding:4px 0; text-align:right; font-weight:700; color:#FFB800; font-size:15px;">#${orderNumber}</td>
            </tr>
            <tr>
              <td style="padding:4px 0; color:#888; font-size:13px;">Ngày đặt</td>
              <td style="padding:4px 0; text-align:right; font-size:13px;">${Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm')}</td>
            </tr>
            <tr>
              <td style="padding:4px 0; color:#888; font-size:13px;">Dự kiến giao</td>
              <td style="padding:4px 0; text-align:right; font-size:13px; font-weight:600;">${deliveryStr}</td>
            </tr>
          </table>
        </div>
        
        <!-- Products -->
        <h3 style="font-size:16px; margin:0 0 12px; color:#333;">📦 Sản phẩm đã đặt</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
          ${itemsHtml}
        </table>
        
        <!-- Pricing -->
        <div style="background:#fafafa; border-radius:12px; padding:16px;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0; color:#666; font-size:14px;">Tạm tính</td>
              <td style="padding:6px 0; text-align:right; font-size:14px;">${formatCurrency(subtotal)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0; color:#666; font-size:14px;">Phí vận chuyển</td>
              <td style="padding:6px 0; text-align:right; font-size:14px; color:#4CAF50; font-weight:600;">Miễn phí</td>
            </tr>
            <tr>
              <td style="padding:6px 0; color:#666; font-size:14px;">Thuế (8%)</td>
              <td style="padding:6px 0; text-align:right; font-size:14px;">${formatCurrency(tax)}</td>
            </tr>
            <tr>
              <td colspan="2" style="border-top:2px solid #eee; padding-top:12px;"></td>
            </tr>
            <tr>
              <td style="padding:6px 0; font-weight:700; font-size:18px;">Tổng cộng</td>
              <td style="padding:6px 0; text-align:right; font-weight:700; font-size:18px; color:#FFB800;">${formatCurrency(totalAmount)}</td>
            </tr>
          </table>
        </div>
      </div>
      
      <!-- Shipping & Payment Info -->
      <div style="padding:0 24px 24px;">
        <div style="display:flex; gap:16px;">
          <div style="flex:1; background:#fafafa; border-radius:12px; padding:16px;">
            <h4 style="margin:0 0 8px; font-size:14px; color:#333;">🚚 Giao hàng</h4>
            <p style="margin:0; font-size:13px; color:#666; line-height:1.6;">
              ${shippingAddress ? `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}<br>
              ${shippingAddress.address || ''}<br>
              ${shippingAddress.city || ''}, ${shippingAddress.state || ''}<br>
              ${shippingAddress.phone || ''}` : 'Chưa cung cấp'}
            </p>
            <p style="margin:8px 0 0; font-size:12px; color:#888;">${shippingLabel}</p>
          </div>
          <div style="flex:1; background:#fafafa; border-radius:12px; padding:16px;">
            <h4 style="margin:0 0 8px; font-size:14px; color:#333;">💳 Thanh toán</h4>
            <p style="margin:0; font-size:13px; color:#666;">${paymentLabel}</p>
          </div>
        </div>
      </div>
      
      <!-- CTA -->
      <div style="padding:0 24px 32px; text-align:center;">
        <a href="${STORE_WEBSITE}" style="display:inline-block; background:#FFB800; color:#000; text-decoration:none; padding:14px 32px; border-radius:12px; font-weight:700; font-size:14px;">
          Theo dõi đơn hàng
        </a>
      </div>
      
      <!-- Footer -->
      <div style="background:#1a1a1a; padding:24px; text-align:center;">
        <p style="margin:0 0 8px; color:#999; font-size:12px;">
          ${STORE_NAME} - Giải pháp vật liệu xây dựng & công nghệ quản lý bán hàng
        </p>
        <p style="margin:0; color:#666; font-size:11px;">
          Hotline: ${STORE_PHONE} | ${STORE_WEBSITE}
        </p>
        <p style="margin:12px 0 0; color:#555; font-size:10px;">
          Email này được gửi tự động. Vui lòng không trả lời email này.
        </p>
      </div>
      
    </div>
  </body>
  </html>
  `;
  
  // Gửi email
  try {
    GmailApp.sendEmail(email, `[${STORE_NAME}] Xác nhận đơn hàng #${orderNumber}`, 
      `Đơn hàng #${orderNumber} đã được tiếp nhận. Tổng: ${formatCurrency(totalAmount)}. Dự kiến giao: ${deliveryStr}.`,
      {
        htmlBody: htmlBody,
        name: STORE_NAME
      }
    );
    
    return { success: true, message: `Email xác nhận đã gửi đến ${email}` };
  } catch (error) {
    return { success: false, error: 'Không thể gửi email: ' + error.toString() };
  }
}

// ============ TIỆN ÍCH ============

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + '₫';
}

// ============ TEST ============

function testSendEmail() {
  const testData = {
    email: 'your-test-email@gmail.com', // ← ĐỔI THÀNH EMAIL CỦA BẠN ĐỂ TEST
    orderNumber: 'TEST-001',
    customerName: 'Nguyễn Văn Test',
    items: [
      { name: 'Tấm Duraflex 6mm', quantity: 10, price: 85000, image: '' },
      { name: 'App bán hàng Dunvex', quantity: 1, price: 1500000, image: '' }
    ],
    total: 3438000,
    shippingAddress: {
      firstName: 'Nguyễn',
      lastName: 'Văn Test',
      address: '123 Nguyễn Huệ',
      city: 'TP. Hồ Chí Minh',
      state: 'Quận 1',
      phone: '0901234567'
    },
    paymentMethod: 'cod',
    shippingMethod: 'standard'
  };
  
  const result = sendOrderConfirmationEmail(testData);
  Logger.log(result);
}
