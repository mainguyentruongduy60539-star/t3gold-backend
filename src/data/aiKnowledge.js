/**
 * T3GOLD VIP AI KNOWLEDGE BASE (Nguồn Tri Thức AI Kim Hoàn & Nghiệp Vụ T3Gold)
 * 
 * Chứa bộ tri thức nghiệp vụ chuyên sâu đã được huấn luyện từ các tài liệu chuẩn:
 * 1. T3Gold Silver - Phần mềm quản lý Bạc (v1.5.12)
 * 2. Sổ tay sử dụng T3Gold 24K (v0.12.2)
 * 3. T3Gold Desktop & T3Gold Cầm Đồ (v1.1.15)
 * 4. Nghị định Thuế 123, Luật Dân sự & Quy chuẩn Giá vàng / Bù hao
 */

const AI_KNOWLEDGE_BASE = [
  {
    id: "t3gold_silver_guide",
    category: "Phần Mềm Quản Lý Bạc (T3Gold Silver)",
    keywords: [
      "bạc", "t3gold silver", "phần mềm bạc", "nhập bạc", "tuổi bạc", "in tem bạc", 
      "bill 80", "hóa đơn a4", "1.5.12", "phiếu gia công bạc", "tra cứu kho bạc"
    ],
    title: "Hướng Dẫn Sử Dụng Phần Mềm T3Gold Silver (Quản Lý Bạc v1.5.12)",
    content: `
1. Đăng nhập & Kết nối Máy chính:
- Chọn biểu tượng T3Gold Silver trên Desktop. Nhập Tài khoản & Mật khẩu do cửa hàng cấp.
- Khi máy phụ không tải được dữ liệu: Bấm "Đổi kết nối máy chủ", nhập địa chỉ IP máy chính (ví dụ http://192.168.1.x:7101 hoặc dùng file .t3connect).

2. Quy trình Nhập hàng Bạc mới & In tem:
- Vào màn hình "Nhập hàng", chọn loại "Bạc", chọn Nhà cung cấp & Nhân viên nhận.
- Nhập thông tin: Nhóm hàng, Tên hàng, Chi tiết/Kiểu dáng, Tuổi bạc (ví dụ Bạc 925, Bạc 999).
- Nhập Trọng lượng: TL Thực = Tổng Trọng Lượng - Trọng Lượng Hột/Đá.
- Nhập Tiền công, Giá nhập, Giá bán. Gắn ảnh sản phẩm từ Webcam USB/Điện thoại hoặc chọn tệp JPG/PNG.
- Bấm "LƯU & IN TEM" (hỗ trợ mẫu tem 21x10 hoặc 28x12).

3. Tạo Hóa đơn Bán hàng & Thu đổi:
- Quét mã sản phẩm bằng máy quét barcode hoặc nhập mã hàng.
- Tìm/Chọn Khách hàng hoặc quét CCCD để tự động điền thông tin người mua.
- Bán kèm Thu cũ / Thu mua: Bấm "THU ĐỔI", chọn luồng thu, nhập số lượng, trọng lượng & tuổi bạc món thu lại.
- Nhập số tiền thanh toán (Tiền mặt / Chuyển khoản). Bấm "LƯU HÓA ĐƠN BÁN (F9)" và bấm "IN HÓA ĐƠN" (Bill 80 khổ Receipt 72/80mm hoặc Hóa đơn A4).

4. Tiếp nhận & Theo dõi Phiếu Gia Công Bạc:
- Vào màn hình "Gia công", bấm "THÊM/PHIẾU MỚI".
- Nhập SĐT, Tên khách hàng, Ngày hẹn giao, Nội dung yêu cầu và gắn Ảnh mẫu.
- Chọn Thợ gia công, cập nhật từng bước (Nhận món -> Giao thợ -> Thợ trả -> Giao khách). Bấm "LƯU & IN PHIẾU".
    `
  },
  {
    id: "t3gold_24k_handbook",
    category: "Sổ Tay Quản Lý Vàng 24K (T3Gold 24K)",
    keywords: [
      "vàng 24k", "t3gold 24k", "nhẫn trơn", "1c", "2c", "3c", "5c", "1l", "1p", 
      "tiền quầy lấy", "nấu thu cũ sang bóng", "xuất nội bộ", "xuất vàng thu cũ", "gửi zalo", "đổi ngang"
    ],
    title: "Sổ Tay Hướng Dẫn Thao Tác T3Gold 24K (v0.12.2)",
    content: `
1. Quy tắc nhập Số lượng, Trọng lượng & Tiền trên T3Gold 24K:
- Số lượng: tính bằng chiếc (nằm dưới các nút quy cách 1P, 2P, 3P, 5P, 1C, 2C, 3C, 5C, 1L).
- Trọng lượng: tính bằng CHỈ. Quy đổi: 1P = 0.001 chỉ (1 phân), 1C = 0.100 chỉ (1 chỉ), 1L = 1.000 chỉ (1 lượng).
  + Ví dụ: Nhập 2.500 chỉ -> gõ số 2500 (phần mềm tự đặt 3 số lẻ).
- Tiền: gõ đủ số tiền bằng ĐỒNG. Ví dụ: 1 triệu đồng -> gõ 1000000.

2. Bán hàng Nhẫn Trơn & Bán kèm Đổi Ngang:
- Bấm trực tiếp nút quy cách nhẫn trơn (ví dụ bấm nút 1C hai lần hoặc gõ số 2 vào ô dưới 1C).
- Thanh toán: chọn Tiền mặt, Chuyển khoản hoặc gõ trọng lượng vào ô "TL đổi ngang" (ví dụ 0.500 chỉ -> gõ 500).
- Bấm "LƯU PHIẾU" và bấm "IN BILL".

3. Nghiệp vụ Quản lý Kho Vàng 24K đặc thù:
- Ghi nhận Tiền quầy lấy: Vào ô "Tiền quầy lấy", nhập số tiền rút khỏi quầy (ví dụ gõ 1000000), bấm Lưu phiếu.
- Ghi nhận Nấu Thu cũ sang Bóng: Bấm "Nấu Thu cũ -> Bóng" ở cuối màn hình. Nhập "Thu cũ đưa nấu (chỉ)" và "Bóng thu được (chỉ)", hệ thống tự tính và ghi nhận Hao hụt.
- Xuất Nội Bộ & Xuất Vàng Thu Cũ: Nhập trọng lượng xuất (chỉ), chọn nơi nhận (Vào kho nguyên liệu hoặc Xuất ngoài kho cho thợ).
- Gửi Báo cáo qua Zalo: Tại màn hình Báo cáo, bấm "XUẤT BÁO CÁO", tích gửi Excel/PNG, bấm "XUẤT & MỞ ZALO" để gửi tự động cho chủ tiệm.
    `
  },
  {
    id: "t3gold_pawn_desktop_roles",
    category: "Phân Quyền & Bảo Mật Hệ Thống (Desktop & Cầm Đồ)",
    keywords: [
      "owner", "employee", "chủ tiệm", "nhân viên", "phân quyền", "mật khẩu thao tác", 
      "bảo mật", "duyệt ngoại lệ", "máy chính", "máy phụ", "cổng 7101", "mysql 8.4"
    ],
    title: "Cấu Hình Hệ Thống & Phân Quyền Vai Trò OWNER vs EMPLOYEE",
    content: `
1. Chuẩn Phân Quyền 2 Vai Trò (T3Gold v1.1.15):
- Vai trò OWNER (Chủ tiệm): Có toàn quyền kiểm soát hệ thống, cài đặt tài khoản, cấu hình máy in/bảng giá, duyệt ngoại lệ, xóa dữ liệu nhạy cảm, hủy phiếu và xem toàn bộ báo cáo doanh thu.
- Vai trò EMPLOYEE (Nhân viên): Thực hiện các thao tác bán hàng, nhập hàng, gia công, lập hợp đồng cầm đồ hằng ngày. Khi bị chặn quyền hoặc gặp giao dịch nhạy cảm, nhân viên cần dừng thao tác và nhờ OWNER duyệt.

2. Chuẩn 2 Loại Mật Khẩu Bảo Mật:
- Mật khẩu đăng nhập: Dùng để xác thực mở ứng dụng vào hệ thống.
- Mật khẩu bảo mật thao tác: Dùng để xác nhận thay đổi cấu hình hoặc thực hiện các nghiệp vụ nhạy cảm (duyệt ngoại lệ, hủy đơn).

3. Mô hình Cài đặt Máy chính & Máy phụ (LAN):
- Máy chính: Chạy cơ sở dữ liệu MySQL 8.4 và T3Gold Store API (cổng mặc định 7101, kiểm tra qua http://127.0.0.1:7101/health/ready).
- Máy phụ: Kết nối đến IP máy chính qua mạng LAN (ví dụ http://192.168.1.100:7101/). Yêu cầu mạng để ở chế độ Private và mở cổng 7101 trên Windows Firewall.
    `
  },
  {
    id: "t3gold_pawn_advanced",
    category: "Nghiệp Vụ Cầm Đồ & Ca Quỹ Chuyên Sâu",
    keywords: [
      "ca quỹ", "mở ca", "đóng ca", "biên nhận cầm đồ", "vốn hóa lãi", "lấy thêm gốc", 
      "trả bớt gốc", "chuộc", "thanh lý", "active", "redeemed", "liquidated", "lãi suất 20%"
    ],
    title: "Quy Trình Quản Lý Cầm Đồ, Quản Lý Hợp Đồng & Ca Quỹ",
    content: `
1. Quản lý Ca Quỹ Tiền Mặt:
- Mở ca: Vào Cấu hình -> Ca quỹ, kiểm đếm tiền đầu ca thực tế và bấm "Mở ca quỹ". Mỗi nhân viên chỉ có 1 ca mở tại một thời điểm.
- Ghi bổ sung / Chi quỹ: Nhập số tiền chi bổ sung hoặc rút quỹ kèm lý do rõ ràng.
- Đóng ca: Nhập số tiền kiểm đếm thực tế cuối ca và giải trình chênh lệch nếu có.

2. Lập Biên Nhận Cầm Đồ Hợp Pháp:
- Nhập SĐT & Tên khách hàng (hoặc nhập CCCD đủ 12 chữ số).
- Thêm tài sản cầm (tối đa 20 tài sản/hợp đồng): chọn loại tài sản, mô tả, tổng TL, TL hột, định giá và phân bổ tiền cầm.
- Khung lãi suất: Theo Bộ luật Dân sự, lãi suất tối đa 20%/năm (~1.66%/tháng). Bấm "LƯU BIÊN NHẬN" và in hợp đồng.

3. Các Nghiệp vụ Thay đổi trên Hợp đồng Cầm đồ:
- Thu lãi: Nhập số tiền lãi thu thực tế, cập nhật ngày đến hạn kỳ tiếp theo.
- Lấy thêm gốc: Tăng tiền cầm cho khách (phát sinh khoản chi).
- Trả bớt gốc: Khách trả bớt tiền gốc (phát sinh khoản thu). Không dùng Trả bớt gốc để tất toán hợp đồng.
- Vốn hóa lãi: Chuyển số lãi đến hạn nhập vào dư nợ gốc (tăng gốc, không thu/chi tiền mặt).
- Chuộc tài sản: Khách trả hết gốc + lãi, chuyển trạng thái sang REDEEMED và giao lại tài sản.
- Thanh lý tài sản: Hợp đồng quá hạn không chuộc, OWNER thực hiện chuyển trạng thái sang LIQUIDATED để đưa tài sản vào kho thanh lý.
    `
  },
  {
    id: "t3gold_troubleshooting",
    category: "Xử Lý Sự Cố & Sự Cố Thường Gặp",
    keywords: [
      "lỗi kết nối", "không in được", "mất dữ liệu", "hết hạn phiên", "không tải được", 
      "lỗi tem", "sao lưu", "khôi phục", "kết nối máy chính", "quên mật khẩu"
    ],
    title: "Hướng Dẫn Xử Lý Lỗi Kỹ Thuật & Sự Cố Thường Gặp",
    content: `
1. Không kết nối được Máy chính (Báo lỗi API/Kết nối):
- Báo lỗi ngắt kết nối: Bấm "TẢI LẠI". Kiểm tra WiFi/dây mạng LAN.
- Đảm bảo máy chính đang bật và dịch vụ T3GoldStoreApi đang chạy ở cổng 7101.
- Kiểm tra Windows Firewall trên máy chính đã cho phép cổng 7101 và mạng ở chế độ Private.

2. Sự cố In ấn (In Bill 80, Hóa đơn A4, In Tem):
- In Bill 80 bị lệch/mờ: Kiểm tra máy in POS-80C, đặt khổ giấy Receipt 72/80mm, tỷ lệ Scale 100%/Actual size.
- In Tem sai vị trí: Kiểm tra driver máy in tem (Godex/TSC), mẫu BarTender (kích thước 90x12mm hoặc 34x11mm). Không tự ý thay mã sản phẩm để bù lề.

3. Mất mạng hoặc gián đoạn khi bấm LƯU:
- Tuyệt đối KHÔNG nhấn Lưu/Thanh toán lần thứ hai ngay lập tức để tránh tạo giao dịch trùng.
- Bấm TẢI LẠI danh sách, mở Sổ giao dịch / Kho hàng / Hợp đồng để kiểm tra xem phiếu lần một đã ghi nhận chưa.

4. Thông báo phiên hết hạn hoặc dữ liệu đã thay đổi:
- Đăng xuất tài khoản và đăng nhập lại để làm mới token làm việc.
    `
  },
  {
    id: "gold_pricing_raw",
    category: "Bảng Giá & Nguyên Liệu",
    keywords: ["giá vàng", "nguyên liệu", "vàng 9999", "vàng 24k", "18k", "14k", "bù hao", "tiền công", "chế tác"],
    title: "Nghiệp vụ Giá Vàng, Nguyên Liệu & Tỷ lệ Bù Hao",
    content: `
1. Cấu trúc Giá Vàng & Nguyên liệu:
- Vàng 9999 (24K): Hàm lượng vàng đạt 99.99%, thường dùng tích trữ hoặc giao dịch nguyên liệu chính.
- Vàng 18K (750): Hàm lượng 75% vàng nguyên chất, 25% hợp kim (hội), chuyên dùng cho nữ trang cao cấp.
- Vàng 14K (585): Hàm lượng 58.5% vàng nguyên chất, có độ cứng cao, dễ đính đá.

2. Công thức tính Giá Vàng Thành Phẩm:
   Giá bán = (Trọng lượng vàng x Giá vàng thời điểm) + Tiền công chế tác + Tiền đá/vật liệu phụ + Tỷ lệ bù hao.

3. Tỷ lệ Bù hao & Hao hụt khi Chế tác:
- Hao hụt đúc/gọt: Thường dao động 0.5% - 1.5% tùy vào độ tỉ mỉ của mẫu nữ trang.
- Tiền công thợ: Được phân loại theo độ khó (Hàng trơn, hàng đính đá chấu, hàng đúc vi mô).
    `
  },
  {
    id: "tax_legal_docs",
    category: "Thuế & Chứng Từ Thuế Tiệm Vàng",
    keywords: ["thuế", "hóa đơn", "máy tính tiền", "123", "nghị định 123", "gtgt", "kê khai", "chứng từ", "nguồn gốc"],
    title: "Nghị định Thuế & Hóa đơn Điện tử Tiệm Vàng",
    content: `
1. Quy định Hóa đơn Điện tử khởi tạo từ Máy tính tiền (Nghị định 123/NĐ-CP):
- Các tiệm vàng kinh doanh trực tiếp đến người tiêu dùng bắt buộc phải sử dụng Hóa đơn điện tử có mã của cơ quan thuế khởi tạo từ máy tính tiền.
- Hóa đơn phải ghi rõ: Tên hàng hóa (Vàng 9999, nữ trang 18K...), trọng lượng (Chỉ/Phân/Li), đơn giá, tiền công, và thuế suất GTGT.

2. Kê khai Thuế GTGT kinh doanh Vàng bạc:
- Phương pháp trực tiếp trên giá trị gia tăng: Thuế GTGT = (Giá bán - Giá mua tương ứng) x Thuế suất (thường là 10%).
- Yêu cầu Chứng từ nguồn gốc: Vàng mua lại từ người dân phải lập Bảng kê mua vào (Mẫu 01/TNDN) ghi rõ Họ tên, CCCD, SĐT người bán.
    `
  },
  {
    id: "pawn_shop_procedures",
    category: "Thủ Tục Cầm Đồ Hợp Pháp",
    keywords: ["cầm đồ", "cầm vàng", "lãi suất", "hợp đồng", "20%", "quá hạn", "niêm phong", "luật dân sự", "an ninh trật tự"],
    title: "Quy trình & Thủ tục Cầm Vàng/Cầm Đồ Hợp Pháp",
    content: `
1. Khung Lãi Suất Cầm Đồ Hợp Pháp (Theo Bộ luật Dân sự 2015):
- Lãi suất thỏa thuận không được vượt quá 20%/năm (tương đương ~1.66%/tháng).
- Phí dịch vụ bảo quản, niêm phong tài sản phải được niêm yết công khai và ghi rõ trong hợp đồng.

2. Quy trình Lập Hợp đồng Cầm cố Tài sản:
- Kiểm tra giấy tờ tùy thân (CCCD/CMND/Hộ chiếu) của khách hàng.
- Kiểm tra trọng lượng & tuổi vàng bằng máy quang phổ hoặc thử axit/cân tỷ trọng.
- Lập 02 bản Hợp đồng cầm cố (Tiệm giữ 1 bản, Khách giữ 1 bản).
- Niêm phong tài sản vàng/trang sức vào túi zip có chữ ký 2 bên.

3. Xử lý Tài sản Cầm đồ Quá hạn:
- Sau thời hạn gia hạn thỏa thuận (thường 5 - 10 ngày), nếu khách không đóng lãi/chuộc đồ, tiệm có quyền thanh lý tài sản theo điều khoản hợp đồng.
    `
  },
  {
    id: "t3gold_software_guide",
    category: "Hướng Dẫn Phần Mềm T3Gold",
    keywords: ["t3gold", "kết nối cân", "in tem", "mã vạch", "phần mềm", "máy tính tiền", "xuất hóa đơn", "quản lý kho"],
    title: "Hướng dẫn Thao tác Tính năng Phần mềm T3Gold",
    content: `
1. Kết nối Cân Điện Tử Tiệm Vàng:
- T3Gold hỗ trợ kết nối trực tiếp với các dòng cân Ohaus, Shinko, Sartorius qua cổng RS232 / USB Com Port.
- Số liệu trọng lượng (Chỉ, Phân, Li, Mangan) tự động nhảy lên màn hình lập hóa đơn, chống sai lệch thủ công.

2. In Tem Mã Vạch Nữ Trang:
- Chuẩn tem vàng chuyên dụng chịu hóa chất rửa vàng (Kích thước 34x11mm, 40x10mm).
- Trên tem hiển thị: Mã sản phẩm, Trọng lượng tổng, Trọng lượng đá, Hàm lượng vàng (Tuổi vàng), Tiền công.

3. Xuất Hóa Đơn & Quản lý Doanh Thu:
- Tích hợp 1-click xuất hóa đơn điện tử máy tính tiền truyền dữ liệu sang Thuế.
- Báo cáo tồn kho vàng theo từng tuổi vàng thực tế theo thời gian thực.
    `
  }
];

module.exports = {
  AI_KNOWLEDGE_BASE
};
