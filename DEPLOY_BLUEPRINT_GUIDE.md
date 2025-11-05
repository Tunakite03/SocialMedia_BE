# 🚀 Hướng Dẫn Deploy Bằng Render Blueprint (Cách 2)

## ❓ Blueprint là gì?

**Blueprint** là cách deploy Infrastructure as Code (IaC) trên Render. Thay vì setup từng service riêng lẻ trên UI, bạn chỉ cần 1 file `render.yaml` để deploy **tất cả mọi thứ cùng lúc**: Database, Backend, Sentiment Service.

**Ưu điểm:**
- ✅ Deploy tất cả trong 1 lần
- ✅ Tái sử dụng được (share config dễ)
- ✅ Version control được (track thay đổi infrastructure)
- ✅ Không phải setup UI nhiều lần

**Nhược điểm:**
- ⚠️ Phức tạp hơn lần đầu
- ⚠️ Nếu có lỗi, phải fix YAML và redeploy

---

## 📋 Bước Chuẩn Bị

### 1️⃣ Đảm bảo repository clean

```bash
cd /Users/tunakite/Learning/UIT/DOANTN/OnWay_BE
git status
```

✅ Tất cả thay đổi phải được commit:
```bash
git add .
git commit -m "Ready for Blueprint deployment"
git push origin main
```

### 2️⃣ Kiểm tra file render.yaml

File `render.yaml` hiện tại đã được setup tốt:
- ✅ Có service backend (Node.js)
- ✅ Có service sentiment (Python)
- ✅ Có PostgreSQL database

---

## 🎯 Từng Bước Deploy Blueprint

### **BƯỚC 1: Truy cập Render Dashboard**

1. Mở https://render.com
2. Login bằng GitHub (nếu chưa có account)
3. Authorize Render để truy cập repository của bạn

**Kết quả mong đợi:** Bạn sẽ thấy dashboard trống (chưa có service nào)

---

### **BƯỚC 2: Tạo Blueprint từ Repository**

#### Cách 1: Từ Dashboard (Khuyến nghị)

1. Trên Render dashboard, nhấn **"New +"** (góc trên cùng bên trái)
2. Chọn **"Blueprint"** (không phải "Web Service")

   ![Chọn Blueprint](https://docs.render.com/images/new-blueprint.png)

3. Bạn sẽ được chuyển tới trang **"Connect a repository"**
4. Chọn repository **"OnWay_BE"** (hoặc tên project của bạn)

   > Nếu không thấy repository, kiểm tra:
   > - Bạn đã authorize Render truy cập GitHub chưa?
   > - Repository có public không?
   > - Nếu private, phải config SSH key

5. Nhấn **"Connect"**

#### Kết quả:
Render sẽ tự động tìm file `render.yaml` trong repository

---

### **BƯỚC 3: Review Cấu Hình Blueprint**

Sau khi connect repository, Render sẽ hiển thị preview cấu hình:

```
📦 Blueprint Preview
├── Services (2)
│   ├── otakomi-backend (Web Service - Node.js)
│   └── otakomi-sentiment-service (Web Service - Python)
└── Databases (1)
    └── otakomi-postgres (PostgreSQL)
```

✅ **Kiểm tra các điểm:**
- [ ] Service backend có `buildCommand` và `startCommand`
- [ ] Service sentiment có đúng path Python
- [ ] Database PostgreSQL được config đúng
- [ ] Environment variables được định nghĩa

---

### **BƯỚC 4: Cấu Hình Environment Variables Có Giá Trị**

Trong file `render.yaml`, có 2 loại env var:

#### A. Giá Trị Cụ Thể (đã set)
```yaml
NODE_ENV: production
PORT: 3000
```
→ Giữ nguyên, Render sẽ dùng giá trị này

#### B. Giá Trị Auto-generate (`generateValue: true`)
```yaml
JWT_SECRET:
  generateValue: true
```
→ Render sẽ tự động sinh một secret ngẫu nhiên bảo mật

#### C. Từ Database (`fromDatabase`)
```yaml
DATABASE_URL:
  fromDatabase:
    name: otakomi-postgres
    property: connectionString
```
→ Render sẽ tự động kết nối từ database

**Trên UI, bạn sẽ thấy:**
- Xanh ✅ = Đã config
- Vàng ⚠️ = Cần xác nhận
- Đỏ ❌ = Lỗi

**Nếu cần thay đổi**, click vào từng variable để edit:

```yaml
# IMPORTANT: Cần update trước deploy
ALLOWED_ORIGINS: https://yourdomain.com,https://www.yourdomain.com
SENTIMENT_SERVICE_URL: https://otakomi-sentiment-service.onrender.com
```

---

### **BƯỚC 5: Review Build & Start Commands**

#### Backend (Node.js)
```yaml
buildCommand: npm ci && npx prisma generate && npx prisma migrate deploy
startCommand: npm start
```

**Giải thích:**
- `npm ci` = Cài đặt dependencies (tương tự npm install nhưng safer)
- `npx prisma generate` = Sinh Prisma client
- `npx prisma migrate deploy` = Chạy migrations trên production database
- `npm start` = Khởi động server

#### Sentiment Service (Python)
```yaml
buildCommand: pip install -r sentiment-service/requirements.txt
startCommand: python -m uvicorn main:app --host 0.0.0.0 --port 10000
```

**Giải thích:**
- `pip install -r ...` = Cài dependencies Python
- `python -m uvicorn` = Khởi động FastAPI server

---

### **BƯỚC 6: Chọn Plan & Region**

Trên trang Blueprint preview, bạn sẽ thấy:

```
Services Configuration
├── Backend Plan: [Standard ▼] Region: [us-east-1 ▼]
├── Sentiment Plan: [Standard ▼] Region: [us-east-1 ▼]
└── Database Plan: [Standard ▼] Region: [us-east-1 ▼]
```

**Khuyến nghị:**
- **Plan**: `Standard` (có chi phí, nhưng ổn định)
  - Nếu muốn tiết kiệm lần đầu: Dùng `Starter` (~$7/tháng/service)
  - Không nên dùng `Free` (dễ crash, có downtime)

- **Region**: Chọn gần user của bạn
  - Singapore (ap-southeast-1) - Tốt cho Southeast Asia
  - Tokyo (ap-northeast-1) - Tốt cho East Asia
  - Frankfurt (eu-central-1) - Tốt cho Europe

**⚠️ Lưu ý:** Tất cả services phải cùng region để có latency thấp

---

### **BƯỚC 7: Deploy Blueprint**

1. Kiểm tra lại tất cả cấu hình
2. Nhấn nút **"Create Blueprint"** (hoặc "Deploy Blueprint")
3. Render sẽ bắt đầu deploy theo thứ tự:
   ```
   1. Tạo PostgreSQL Database
   2. Tạo Backend Web Service
   3. Tạo Sentiment Web Service
   ```

**Khoảng thời gian:**
- PostgreSQL: 1-2 phút
- Backend build & start: 2-5 phút
- Sentiment build & start: 1-3 phút
- **Total: 5-10 phút**

---

## 📊 Giám Sát Quá Trình Deploy

Trong khi deploy, bạn sẽ thấy một dashboard:

```
🔄 Deployment in Progress

[████░░░░░░] 40%

Current Step: Building otakomi-backend...
```

### Trạng Thái các Service:

```
✅ otakomi-postgres        Live
🔄 otakomi-backend        Building...
⏳ otakomi-sentiment       Pending
```

### Logs của từng service:

Bạn có thể click vào từng service để xem logs real-time:

```
otakomi-backend > Logs

> npm ci
> npm start
[1] Starting server on port 3000...
[1] Database connected successfully
✅ Server ready!
```

---

## ✅ Kiểm Tra Deployment Thành Công

### 1️⃣ Kiểm Tra Status

Tất cả services phải show **"Live"** (xanh):

```
otakomi-backend           ✅ Live    https://otakomi-backend.onrender.com
otakomi-sentiment         ✅ Live    https://otakomi-sentiment.onrender.com
otakomi-postgres          ✅ Live    postgresql://...
```

### 2️⃣ Test Health Endpoint

Mở browser truy cập:
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

✅ = Deploy thành công!

### 3️⃣ Kiểm Tra Logs

Vào service **otakomi-backend** → **"Logs"**:

```
[✓] Database connected successfully
[✓] Server running on port 3000
[✓] Socket.IO server ready
```

Không thấy error đỏ ❌ = Tốt!

### 4️⃣ Test API Endpoint

```bash
curl https://otakomi-backend.onrender.com/health
```

Hoặc test API thực tế:
```bash
curl https://otakomi-backend.onrender.com/api/v1/users
```

---

## 🔄 Cập Nhật Environment Variables Sau Deploy

Nếu bạn cần thay đổi env var (ví dụ: ALLOWED_ORIGINS):

### Cách 1: Sửa file render.yaml + Push (Khuyến nghị)

1. Edit file `render.yaml`:
```yaml
envVars:
  - key: ALLOWED_ORIGINS
    value: https://mynewdomain.com
```

2. Commit & Push:
```bash
git add render.yaml
git commit -m "Update ALLOWED_ORIGINS"
git push origin main
```

3. Trên Render dashboard, nhấn **"Redeploy"** → Chọn **"Deploy latest commit"**

### Cách 2: Sửa trực tiếp trên Render UI

1. Vào service → **"Environment"**
2. Edit variable → **"Save"**
3. Render sẽ tự động redeploy service đó

---

## 🐛 Troubleshooting Blueprint Deployment

### ❌ Build Failed - Errors trong logs

**Lỗi phổ biến:**

#### 1. `npm ERR! ERESOLVE unable to resolve dependency tree`
```
Fix: Update package.json, xóa node_modules, chạy npm install local
```

#### 2. `FATAL ERROR: cannot connect to database`
```
Fix: 
1. Kiểm tra DATABASE_URL có đúng không
2. Chạy: npx prisma migrate deploy (manual trong Shell)
```

#### 3. `Prisma error: MIGRATION CONFLICT`
```
Fix: Repository local và production không sync
- Chạy local: npm run db:migrate
- Push lên GitHub
- Redeploy
```

#### 4. Python: `ModuleNotFoundError: No module named 'fastapi'`
```
Fix: 
1. Kiểm tra sentiment-service/requirements.txt có fastapi không
2. Đảm bảo buildCommand: pip install -r sentiment-service/requirements.txt
```

### ⏳ Deploy quá lâu (> 10 phút)

```
Có thể là:
- npm install chậm (dependencies lớn)
- Prisma migrate lâu (migrations nhiều)
- Server yếu

Fix: Upgrade lên plan cao hơn (Pro, Premium)
```

### 🔌 Backend không kết nối được Database

1. Vào service backend → **"Shell"**
2. Chạy lệnh kiểm tra:
```bash
npx prisma db execute --stdin < /dev/null
```

3. Nếu lỗi: Kiểm tra DATABASE_URL:
```bash
echo $DATABASE_URL
```

---

## 🔄 Auto-Redeploy Khi Push Code

Render hỗ trợ auto-redeploy mỗi khi bạn push lên GitHub:

1. Vào service → **"Settings"**
2. Scroll xuống → **"Auto-deploy"**
3. Chọn **"Yes"** → **"Save"**

**Từ giờ, mỗi khi bạn:**
```bash
git push origin main
```

Render sẽ **tự động:**
1. Build code mới
2. Deploy services
3. Update mọi thứ

⏱️ Khoảng **3-5 phút** mới thành công. Server không down.

---

## 💾 Backup & Rollback

### Backup Database

Trên Render dashboard:
1. Vào database **"otakomi-postgres"**
2. Nhấn **"Backups"**
3. Nhấn **"Create Backup"**

### Rollback Code

Nếu cần quay lại phiên bản cũ:

1. Vào service → **"Deploys"**
2. Xem danh sách deploy lịch sử
3. Nhấn vào deploy cũ → **"Redeploy"**

---

## 💰 Chi Phí Ước Tính

**Blueprint sử dụng:**
- PostgreSQL Standard: **$12/tháng**
- Backend Web Service Standard: **$12/tháng**
- Sentiment Web Service Standard: **$12/tháng**
- **Total: ~$36/tháng**

**Cách tiết kiệm:**
```yaml
# Dùng Starter thay vì Standard
plan: starter  # ~$7/tháng/service
# Total: ~$21/tháng (tiết kiệm 42%)
```

---

## 📝 Cheat Sheet - Các Lệnh Hữu Ích

### Deploy lần đầu:
```bash
git push origin main
# Truy cập Render → New Blueprint → Select repository
```

### Redeploy mới nhất:
```bash
git push origin main
# Render auto-redeploy (nếu có enable auto-deploy)
```

### Manual redeploy:
```
Render Dashboard → Service → Deploys → Latest → Redeploy
```

### Xem logs:
```
Render Dashboard → Service → Logs
```

### SSH vào server:
```
Render Dashboard → Service → Shell
```

### Kiểm tra env var:
```bash
# Vào Shell
echo $DATABASE_URL
echo $JWT_SECRET
```

---

## ✨ Best Practices

### 1. Luôn test local trước
```bash
npm run dev
# Kiểm tra không có error trước khi push
```

### 2. Commit message rõ ràng
```bash
git commit -m "Fix: Update database schema"
```

### 3. Dùng .gitignore
```
node_modules/
.env.local
uploads/
logs/
```

### 4. Environment variables bảo mật
```yaml
# ❌ Sai
JWT_SECRET: my-secret-123

# ✅ Đúng
JWT_SECRET:
  generateValue: true  # Render auto-generate
```

### 5. Monitor logs định kỳ
```
Mỗi ngày check: Render Dashboard → Logs → Errors
```

---

## 🎉 Checklist Trước Deployment

- [ ] Git repository clean (all committed)
- [ ] `.env.example` có tất cả variables cần thiết
- [ ] `render.yaml` syntax đúng (dùng YAML validator)
- [ ] `package.json` có `"engines": { "node": ">=18.0.0" }`
- [ ] Prisma schema valid
- [ ] Build command chạy OK locally
- [ ] Start command chạy OK locally
- [ ] Health endpoint `/health` hoạt động
- [ ] Database migrations viết đúng
- [ ] Sentiment service có requirements.txt
- [ ] ALLOWED_ORIGINS update cho production
- [ ] JWT_SECRET không hardcode

---

## 📞 Cần Giúp?

| Vấn Đề | Giải Pháp |
|--------|----------|
| Deploy thất bại | Check logs: Service → Logs |
| Database không connect | Check DATABASE_URL, chạy Prisma migrate |
| API 500 error | Kiểm tra env vars, check logs |
| Socket.IO không work | Verify ALLOWED_ORIGINS |
| Slow performance | Upgrade plan hoặc optimize code |
| Cần support | https://render.com/support |

---

**Happy Deploying! 🚀✨**

---

## 📚 Tài Liệu Tham Khảo

- Render Blueprint Docs: https://docs.render.com/infrastructure-as-code
- Prisma Deployment: https://www.prisma.io/docs/guides/deployment
- Express.js Best Practices: https://expressjs.com/en/advanced/best-practice-security.html
