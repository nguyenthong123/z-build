/**
 * ZBUILD - Google Apps Script Đồng Bộ Đơn Hàng & Tồn Kho (Kèm Chatbot Fallback)
 * 
 * HƯỚNG DẪN TÍCH HỢP:
 * 1. Mở dự án Google Apps Script liên kết với Google Sheet của bạn.
 * 2. Thay thế toàn bộ mã nguồn của file code hiện tại bằng nội dung file này.
 * 3. Chỉnh sửa tên các Cột hoặc Tên Tab Sheet nếu cần (Xem phần CẤU HÌNH bên dưới).
 * 4. Nhấn Deploy -> New Deployment -> Chọn Web App -> Deploy lại phiên bản mới.
 * 5. Chọn quyền truy cập: Anyone (Bất kỳ ai).
 */

// ============ CẤU HÌNH TÊN TAB TRÊN GOOGLE SHEET ============
const PRODUCT_SHEET_NAME = 'Sản phẩm'; // Hoặc tên tab chứa danh sách sản phẩm của bạn (ví dụ: Trang_tinh1)
const ORDER_SHEET_NAME = 'Đơn hàng';    // Tên tab ghi nhận đơn hàng (Sẽ tự tạo nếu chưa có)

// Cấu hình các chỉ số cột trong tab sản phẩm (1-indexed: Cột A=1, B=2, C=3,...)
const COL_PRODUCT_NAME = 1;  // Tên sản phẩm nằm ở Cột A
const COL_PRODUCT_STOCK = 2; // Tồn kho nằm ở Cột B (Vui lòng kiểm tra lại cột Tồn kho của bạn)

// ============ XỬ LÝ GET REQUEST ============
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'bulk_import_products') {
    return handleBulkImportProducts(e.parameter.sheet_id, e.parameter.gid);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    message: 'Zbuild Apps Script Service is running.'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============ XỬ LÝ POST REQUEST ============
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    
    // 1. Kiểm tra nếu có tín hiệu tạo đơn hàng từ Web
    if (postData.action === 'create_order') {
      return handleCreateOrder(postData);
    }
    
    // 2. FALLBACK CHATBOT LOGIC (Giữ nguyên tính năng Chatbot AI hiện tại của bạn)
    const userMessage = postData.message || postData.prompt || postData.userMessage;
    if (!userMessage) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Error: Không có tin nhắn người dùng."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Chèn logic Chatbot Gọi Gemini/OpenAI hiện tại của bạn vào đây
    // Ví dụ:
    // const botResponse = callGeminiAPI(userMessage);
    // return ContentService.createTextOutput(JSON.stringify({ status: "success", reply: botResponse }));
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Tính năng chatbot qua POST chưa cấu hình trong kịch bản này."
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============ XỬ LÝ LẤY DANH SÁCH SẢN PHẨM (doGet) ============
function handleBulkImportProducts(sheetId, gid) {
  try {
    const ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(PRODUCT_SHEET_NAME) || ss.getSheets()[0];
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const products = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[COL_PRODUCT_NAME - 1]) continue;
      
      products.push({
        name: row[COL_PRODUCT_NAME - 1],
        stock: Number(row[COL_PRODUCT_STOCK - 1]) || 0,
        specs: row[2] || "",  // Cột C (Quy cách)
        price: Number(row[3]) || 0,  // Cột D (Giá)
        category: row[4] || "", // Cột E (Danh mục)
        sku: row[5] || "",
        weight: row[6] || ""
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      products: products
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============ XỬ LÝ TẠO ĐƠN HÀNG VÀ TRỪ TỒN KHO (doPost) ============
function handleCreateOrder(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Ghi đơn hàng vào tab 'Đơn hàng'
    let orderSheet = ss.getSheetByName(ORDER_SHEET_NAME);
    if (!orderSheet) {
      // Tự động tạo tab mới nếu chưa có
      orderSheet = ss.insertSheet(ORDER_SHEET_NAME);
      orderSheet.appendRow([
        'Mã đơn hàng', 'Khách hàng', 'Email', 'Điện thoại', 
        'Địa chỉ giao hàng', 'Chi tiết sản phẩm', 'Tổng tiền (VND)', 
        'Thanh toán', 'Vận chuyển', 'Ngày tạo'
      ]);
      // Định dạng dòng đầu in đậm
      orderSheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    }
    
    // Gom danh sách sản phẩm thành text để lưu
    const itemsText = data.items.map(item => `${item.name} (x${item.quantity})`).join('\n');
    
    // Append dòng mới
    orderSheet.appendRow([
      data.orderNumber,
      data.customerName,
      data.email,
      data.phone,
      data.address,
      itemsText,
      data.total,
      data.paymentMethod,
      data.shippingMethod,
      data.createdAt || new Date().toISOString()
    ]);
    
    // 2. Tìm sản phẩm và Trừ tồn kho
    let productSheet = ss.getSheetByName(PRODUCT_SHEET_NAME) || ss.getSheets()[0];
    const productData = productSheet.getDataRange().getValues();
    const updatedRows = [];
    
    for (const orderItem of data.items) {
      const orderItemNameClean = orderItem.name.trim().toLowerCase();
      
      // Duyệt qua các dòng sản phẩm để tìm khớp tên
      for (let r = 1; r < productData.length; r++) {
        const productName = String(productData[r][COL_PRODUCT_NAME - 1]).trim().toLowerCase();
        
        if (productName === orderItemNameClean) {
          const currentStock = Number(productData[r][COL_PRODUCT_STOCK - 1]) || 0;
          const buyQty = Number(orderItem.quantity) || 1;
          const newStock = Math.max(0, currentStock - buyQty); // Tránh tồn kho âm
          
          // Ghi đè số lượng tồn kho mới xuống sheet (r + 1 vì header ở dòng 1)
          productSheet.getRange(r + 1, COL_PRODUCT_STOCK).setValue(newStock);
          updatedRows.push({ name: orderItem.name, oldStock: currentStock, newStock: newStock });
          break;
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Đơn hàng đã được lưu và trừ tồn kho thành công!',
      orderNumber: data.orderNumber,
      updatedProducts: updatedRows
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Lỗi xử lý đơn hàng tại Google Sheets: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
