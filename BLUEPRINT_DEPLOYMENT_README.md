# 📚 Deploy Render Blueprint - Tất Cả Tài Liệu

Bạn vừa chuẩn bị xong tất cả cấu hình để deploy trên Render bằng Blueprint. Dưới đây là các file hướng dẫn để bạn reference:

---

## 📖 Các File Hướng Dẫn

### 1. **BLUEPRINT_QUICK_START.md** ⚡ (START HERE!)
- **Dành cho**: Những ai muốn deploy nhanh nhất (15 phút)
- **Nội dung**: 5 bước cơ bản, từng bước rõ ràng
- **Thời gian**: ~15 phút đọc + 10 phút deploy
- **Cách dùng**: Mở và follow từng bước 1 → 2 → 3 → 4 → 5

👉 **Bắt đầu từ đây nếu bạn muốn deploy ngay!**

---

### 2. **DEPLOY_BLUEPRINT_GUIDE.md** 📖 (Chi Tiết)
- **Dành cho**: Những ai muốn hiểu sâu hơn
- **Nội dung**: 
  - Giải thích Blueprint là gì?
  - 8 bước chi tiết (có screenshot)
  - Troubleshooting
  - Best practices
  - Tài liệu tham khảo
- **Thời gian**: Đọc ~30 phút
- **Cách dùng**: Reference khi có thắc mắc

👉 **Dùng khi bạn muốn hiểu kỹ hơn hoặc gặp vấn đề!**

---

### 3. **render.yaml** ⚙️ (Cấu Hình)
- **Dành cho**: File cấu hình chính
- **Nội dung**:
  - Service backend (Node.js)
  - Service sentiment (Python)
  - Database PostgreSQL
  - Environment variables
- **Cách dùng**: Render sẽ tự động tìm file này
- **Lưu ý**: **KHÔNG** cần chỉnh sửa, đã sẵn sàng!

👉 **Render sẽ tự động detect file này, không cần làm gì!**

---

### 4. **validate-blueprint.py** 🔍 (Optional)
- **Dành cho**: Kiểm tra render.yaml trước deploy
- **Cách dùng**:
  ```bash
  python3 validate-blueprint.py
  ```
- **Kết quả**: Báo cáo lỗi nếu có

👉 **Chạy file này trước khi deploy nếu lo lắng!**

---

## 🚀 Cách Deploy (Tóm Tắt)

### Bước 1: Git push
```bash
git push origin main
```

### Bước 2: Mở Render
- Truy cập: https://render.com
- Login bằng GitHub

### Bước 3: Tạo Blueprint
- Click: **"New +"** → **"Blueprint"**
- Chọn repository: **"OnWay_BE"**
- Click: **"Connect"**

### Bước 4: Deploy
- Render sẽ show preview
- Click: **"Create Blueprint"**
- Đợi 5-10 phút

### Bước 5: Kiểm Tra
- Mở: `https://otakomi-backend.onrender.com/health`
- Kết quả: `{"status": "OK", ...}`

✅ **Xong!**

---

## 📋 Checklist Trước Deploy

- [ ] Đã read **BLUEPRINT_QUICK_START.md** (ít nhất scan qua)
- [ ] Git repository clean (all committed)
- [ ] `render.yaml` file tồn tại
- [ ] GitHub repository public hoặc Render có access
- [ ] Đã có Render account (hoặc sẽ tạo khi deploy)
- [ ] Chọn xong region & plan (khuyến nghị: Standard, ap-southeast-1)

---

## ❓ Câu Hỏi Thường Gặp

### Q: Render.yaml là gì?
**A:** File cấu hình YAML định nghĩa toàn bộ infrastructure (database, backend, sentiment service). Render sẽ read file này và deploy tự động.

### Q: Blueprint là gì?
**A:** Cách deploy Infrastructure as Code trên Render. Thay vì setup UI từng service, bạn chỉ cần 1 file YAML.

### Q: Deploy mất bao lâu?
**A:** Lần đầu: 5-10 phút. Sau này (khi push code): 3-5 phút.

### Q: Có thể cancel deployment được không?
**A:** Có, click "Cancel deployment" trên dashboard.

### Q: Nếu deploy fail sao?
**A:** Check logs (Service → Logs), xem error chi tiết. Thường là database connection hoặc Prisma migration lỗi.

### Q: Sau khi deploy, cần làm gì?
**A:** 
1. Test health endpoint
2. Config frontend để kết nối backend
3. Enable auto-redeploy (optional nhưng khuyến nghị)
4. Monitor logs định kỳ

### Q: Có thể redeploy lại không?
**A:** Có, 2 cách:
- Push code mới → auto-redeploy (nếu bật auto-deploy)
- Dashboard → Service → Redeploy → Latest commit

### Q: Nếu Database error?
**A:** Thường là migration chưa chạy. Vào Shell và chạy:
```bash
npx prisma migrate deploy
```

### Q: Giá tiền bao nhiêu?
**A:** ~$36/tháng (Backend + Sentiment + Database, mỗi cái $12)

---

## 📚 Tài Liệu Tham Khảo

- **Render Docs**: https://docs.render.com
- **Render Blueprint**: https://docs.render.com/infrastructure-as-code
- **Prisma Deployment**: https://www.prisma.io/docs/guides/deployment
- **Express Best Practices**: https://expressjs.com/en/advanced/best-practice-security.html

---

## 🎯 Next Steps

### Ngay bây giờ:
1. ✅ Read BLUEPRINT_QUICK_START.md
2. ✅ Follow 5 bước deploy
3. ✅ Test health endpoint
4. ✅ Enable auto-redeploy

### Tiếp theo (1-2 ngày):
1. Setup frontend để kết nối backend
2. Test các API endpoints
3. Setup custom domain (optional)
4. Setup monitoring & alerts

### Sau 1 tuần:
1. Monitor performance & logs
2. Optimize code nếu cần
3. Upgrade plan nếu cần (CPU/Memory cao)

---

## 🎉 Tóm Lại

Bạn đã hoàn toàn sẵn sàng để deploy trên Render!

**Chỉ cần:**
1. 📖 Mở **BLUEPRINT_QUICK_START.md**
2. 👉 Follow 5 bước
3. ⏱️ Đợi 10 phút
4. ✅ Deploy xong!

---

**Good luck! 🚀**

Nếu có vấn đề gì, check **DEPLOY_BLUEPRINT_GUIDE.md** → Troubleshooting section.

Hoặc contact Render support: https://render.com/support
