# ⚡ Blueprint Deployment - Quick Start (5 Bước)

Hướng dẫn nhanh cho Blueprint deployment trên Render. Dự kiến thời gian: **15 phút**.

---

## 🚀 BƯỚC 1: Chuẩn Bị Repository (2 phút)

```bash
cd /Users/tunakite/Learning/UIT/DOANTN/OnWay_BE

# Kiểm tra status
git status

# Commit tất cả thay đổi
git add .
git commit -m "Prepare for Blueprint deployment"
git push origin main
```

✅ **Kết quả**: Tất cả code đã lên GitHub

---

## 🌐 BƯỚC 2: Mở Render & Authorize GitHub (3 phút)

### 2.1 Mở Render
- Truy cập: https://render.com
- Nhấn **"Sign up"** (hoặc **"Sign in"** nếu có account)
- Chọn **"Continue with GitHub"**

### 2.2 Authorize
- Bạn sẽ được redirect tới GitHub để authorize
- Nhấn **"Authorize render-unc"**
- Chọn repository `OnWay_BE` hoặc để render access all repos

✅ **Kết quả**: Bạn đã login vào Render Dashboard

---

## 📝 BƯỚC 3: Tạo Blueprint (5 phút)

### 3.1 Nhấn "New +"
Trên Render Dashboard, góc trên cùng bên trái, nhấn **"New +"**

### 3.2 Chọn "Blueprint"
```
New +
├── Web Service
├── Background Worker
├── Private Service
├── PostgreSQL
├── MySQL
├── Redis
├── Disk
└── Blueprint  ← CLICK HERE
```

### 3.3 Kết Nối Repository
- Chọn repository: **"OnWay_BE"** (hoặc tên project của bạn)
- Nhấn **"Connect"**

### 3.4 Review Blueprint Preview
Render sẽ hiển thị:
```
✅ Blueprint Found!

Services:
  • otakomi-backend (Node.js Web Service)
  • otakomi-sentiment-service (Python Web Service)

Databases:
  • otakomi-postgres (PostgreSQL 17)
```

✅ **Kết quả**: Blueprint preview hiển thị đúng 3 thành phần

---

## ⚙️ BƯỚC 4: Cấu Hình & Deploy (3 phút)

### 4.1 Review Environment Variables

Trên trang preview, scroll xuống xem các env vars:

```
✓ NODE_ENV = production
✓ PORT = 3000
✓ DATABASE_URL = (from database - tự động)
✓ JWT_SECRET = (generateValue - tự động sinh)
✓ SENTIMENT_SERVICE_URL = https://otakomi-sentiment-service.onrender.com
✓ ALLOWED_ORIGINS = https://otakomi.netlify.app/, ...
```

**Nếu cần edit**, click vào variable để chỉnh sửa.

### 4.2 Chọn Plan & Region

Scroll xuống tìm mục "Plan":

```
Backend Plan: [Standard ▼]        Region: [us-east-1 ▼]
Sentiment Plan: [Standard ▼]      Region: [us-east-1 ▼]
Database Plan: [Standard ▼]       Region: [us-east-1 ▼]
```

**Khuyến nghị cho lần đầu:**
- **Plan**: Giữ `Standard` (ổn định)
- **Region**: Chọn `ap-southeast-1` (Singapore - gần Việt Nam) hoặc `us-east-1`

### 4.3 Nhấn "Create Blueprint" (hoặc "Deploy")

Render sẽ hiển thị progress bar:
```
Creating Blueprint...
[████░░░░░░] 40%

Current step: Creating PostgreSQL database...
```

⏱️ Đợi **5-10 phút** cho quá trình deploy hoàn tất

✅ **Kết quả**: Tất cả 3 services đang build và deploy

---

## ✅ BƯỚC 5: Kiểm Tra Deploy Thành Công (2 phút)

### 5.1 Xem Status

Sau khi deploy xong, bạn sẽ thấy Dashboard:

```
Services
├── otakomi-backend           ✅ Live     https://otakomi-backend.onrender.com
├── otakomi-sentiment         ✅ Live     https://otakomi-sentiment-xxxx.onrender.com
└── otakomi-postgres          ✅ Live     

Status: All services deployed successfully
```

### 5.2 Test Health Endpoint

Mở browser, truy cập:
```
https://otakomi-backend.onrender.com/health
```

**Kết quả mong đợi:**
```json
{
  "status": "OK",
  "timestamp": "2024-11-05T10:30:45.123Z",
  "uptime": 245.67
}
```

### 5.3 Xem Logs (Optional)

Click vào **"otakomi-backend"** → **"Logs"**

Bạn sẽ thấy:
```
> npm start
✓ Server running on port 3000
✓ Database connected successfully
✓ Socket.IO server ready
```

✅ **Kết quả**: Deployment hoàn toàn thành công!

---

## 📋 Checklist Hoàn Tất

- [ ] Repository đã push lên GitHub
- [ ] Account Render created & GitHub authorized
- [ ] Blueprint created & services showing Live
- [ ] Health endpoint trả về 200 OK
- [ ] Logs không có error
- [ ] Environment variables đều có giá trị
- [ ] Sentinel service running
- [ ] Database connected

---

## 🆘 Nếu Có Lỗi?

### ❌ "Blueprint not found"
→ Kiểm tra file `render.yaml` có đúng syntax không

### ❌ "Database connection error"
→ Vào `otakomi-backend` → Shell → chạy: `npx prisma migrate deploy`

### ❌ "Services stuck in 'Building' state"
→ Refresh page, nếu vẫn lâu (>15 phút), click "Redeploy"

### ❌ "Health endpoint returns 500"
→ Vào Logs xem error chi tiết, có thể database chưa migrate

### ❌ "Build command failed"
→ Xem Logs chi tiết, thường là dependency issue hoặc Prisma error

---

## 🔄 Sau Khi Deploy

### Auto-Redeploy Khi Push Code

1. Vào service **"otakomi-backend"** → **"Settings"**
2. Scroll xuống → **"Auto-Deploy"** → Chọn **"Yes"**
3. Chọn branch: **"main"**
4. Nhấn **"Save"**

**Từ nay:** Mỗi khi `git push origin main`, Render sẽ tự động redeploy!

### Update Environment Variable

Nếu cần thay ALLOWED_ORIGINS, JWT_SECRET, v.v.:

**Cách 1 (Khuyến nghị):**
```bash
# Edit render.yaml locally
git add render.yaml
git commit -m "Update env vars"
git push origin main
# Render auto-redeploy

# Hoặc manual redeploy: Dashboard → Redeploy latest commit
```

**Cách 2 (Quick fix):**
```
Dashboard → otakomi-backend → Environment → Edit variable → Save
```

---

## 💡 Tips & Tricks

### Tip 1: Monitor từ Terminal
```bash
# Setup để auto-refresh logs
watch -n 5 'curl -s https://otakomi-backend.onrender.com/health'
```

### Tip 2: SSH vào Server
```
Dashboard → Service → Shell

# Kiểm tra env vars
echo $DATABASE_URL

# Kiểm tra node version
node --version

# Run commands
npm list  # xem packages
```

### Tip 3: Backup Database
```
Dashboard → otakomi-postgres → Backups → Create Backup
```

### Tip 4: View Metrics
```
Dashboard → Service → Metrics
→ Xem CPU, Memory, Disk usage
```

---

## 🎯 Điều Gì Tiếp Theo?

1. **Setup Frontend** để kết nối với backend:
   ```javascript
   // frontend/.env
   REACT_APP_API_URL=https://otakomi-backend.onrender.com
   ```

2. **Update ALLOWED_ORIGINS** để allow frontend domain:
   ```yaml
   # render.yaml
   ALLOWED_ORIGINS: https://yourdomain.com,https://www.yourdomain.com
   ```

3. **Setup Custom Domain** (optional):
   ```
   Dashboard → Service → Settings → Custom Domain
   ```

4. **Enable SSL/TLS** (auto):
   ```
   Render tự động cung cấp HTTPS certificate
   ```

---

## 📊 Performance Baseline

Sau deploy, bạn nên thấy:

| Metric | Expected | Acceptable |
|--------|----------|-----------|
| Response Time | < 200ms | < 500ms |
| CPU Usage | 5-10% | < 50% |
| Memory | 100-150MB | < 512MB |
| Uptime | > 99% | > 95% |

Nếu không đạt, có thể cần upgrade plan.

---

## 🎉 Hoàn Tất!

**Bạn vừa thành công deploy cả backend trên Render bằng Blueprint! 🚀**

Từ giờ, mỗi lần push code:
```bash
git push origin main
```

→ Render sẽ tự động build, test, deploy mà không cần làm gì thêm!

---

## 📞 Hỗ Trợ

- **Render Docs**: https://docs.render.com
- **Status Page**: https://status.render.com
- **Support**: https://render.com/support
- **Discord Community**: https://discord.gg/render

---

**Happy Deploying! 🎊**
