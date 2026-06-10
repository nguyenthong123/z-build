import React from 'react';
import './LegalPage.css';

const PrivacyPolicy = () => {
  return (
    <div className="legal-container">
      <div className="legal-header">
        <h1>Privacy Policy</h1>
        <p>Cập nhật lần cuối: 10/06/2026</p>
      </div>

      <div className="legal-content">
        <h2>1. Giới thiệu</h2>
        <p>
          Chào mừng bạn đến với ZBUILD. Việc bảo vệ dữ liệu cá nhân của bạn là ưu tiên hàng đầu của chúng tôi. Chính sách bảo mật này giải thích cách chúng tôi thu thập, sử dụng, chia sẻ và bảo vệ thông tin cá nhân của bạn khi bạn sử dụng trang web và dịch vụ của chúng tôi.
        </p>
        <p>
          Chính sách này áp dụng cho mọi khách truy cập, người dùng và những người khác truy cập hoặc sử dụng Dịch vụ (bao gồm ứng dụng web, dịch vụ liên kết qua Facebook, TikTok, YouTube).
        </p>

        <h2>2. Dữ liệu chúng tôi thu thập</h2>
        <p>Chúng tôi có thể thu thập các loại thông tin sau:</p>
        <ul>
          <li><strong>Thông tin cá nhân:</strong> Tên, địa chỉ email, số điện thoại, địa chỉ giao hàng, và thông tin thanh toán khi bạn đăng ký tài khoản hoặc mua hàng.</li>
          <li><strong>Dữ liệu tự động:</strong> Địa chỉ IP, loại trình duyệt, hệ điều hành, thời gian truy cập, các trang đã xem thông qua cookie và các công nghệ theo dõi tương tự.</li>
          <li><strong>Dữ liệu từ bên thứ ba:</strong> Thông tin từ các nền tảng quảng cáo (như Facebook Pixel, TikTok Pixel, Google Analytics) để tối ưu hóa trải nghiệm và quảng cáo.</li>
        </ul>

        <h2>3. Cách chúng tôi sử dụng dữ liệu</h2>
        <p>Chúng tôi sử dụng thông tin thu thập được để:</p>
        <ul>
          <li>Cung cấp, duy trì và cải thiện Dịch vụ của chúng tôi.</li>
          <li>Xử lý giao dịch và gửi thông báo liên quan đến đơn hàng.</li>
          <li>Phân tích hành vi người dùng để tối ưu hóa UI/UX và nội dung.</li>
          <li>Phục vụ cho các chiến dịch quảng cáo trên Facebook, TikTok, Google.</li>
          <li>Ngăn chặn các hoạt động gian lận và đảm bảo tính bảo mật của hệ thống.</li>
        </ul>

        <h2>4. Chia sẻ dữ liệu</h2>
        <p>
          Chúng tôi không bán thông tin cá nhân của bạn cho bên thứ ba. Tuy nhiên, chúng tôi có thể chia sẻ thông tin với:
        </p>
        <ul>
          <li><strong>Nhà cung cấp dịch vụ:</strong> Các đối tác thanh toán, đơn vị vận chuyển, và dịch vụ lưu trữ (như Firebase, Cloudinary).</li>
          <li><strong>Đối tác quảng cáo:</strong> Facebook, TikTok, Google để phục vụ cho mục đích tiếp thị lại (remarketing) và đo lường hiệu quả quảng cáo.</li>
          <li><strong>Yêu cầu pháp lý:</strong> Khi được yêu cầu bởi cơ quan chức năng hoặc để tuân thủ pháp luật.</li>
        </ul>

        <h2>5. Quyền của bạn</h2>
        <p>Bạn có quyền:</p>
        <ul>
          <li>Truy cập, cập nhật hoặc xóa thông tin cá nhân của mình thông qua trang Quản lý Hồ sơ (Profile).</li>
          <li>Từ chối nhận email tiếp thị (opt-out).</li>
          <li>Yêu cầu vô hiệu hóa Cookie thông qua cài đặt trình duyệt của bạn.</li>
        </ul>
        
        <h2>6. Xóa dữ liệu (Data Deletion)</h2>
        <p>
          Theo yêu cầu của Facebook và TikTok, nếu bạn muốn xóa hoàn toàn dữ liệu cá nhân của mình khỏi hệ thống của ZBUILD, vui lòng gửi yêu cầu đến email <strong>thachcao.taman@gmail.com</strong>. Chúng tôi sẽ xử lý và xóa dữ liệu của bạn trong vòng 7 ngày làm việc.
        </p>

        <h2>7. Liên hệ</h2>
        <p>
          Nếu bạn có bất kỳ câu hỏi nào về Chính sách bảo mật này, vui lòng liên hệ với chúng tôi:
        </p>
        <ul>
          <li>Email: thachcao.taman@gmail.com</li>
          <li>Hotline: 098825914</li>
        </ul>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
