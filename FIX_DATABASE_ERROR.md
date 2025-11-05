# 🔧 Fix Deploy Error - Database Issue

## ❌ Vấn Đề

Render báo: **"cannot have more than one active free tier database"**

Nghĩa là: Bạn đã có 1 free database trên Render rồi, không thể tạo thêm.

---

## ✅ Giải Pháp

### **Cách 1: Dùng External Database (Khuyến nghị) ⭐**

Xóa database khỏi `render.yaml` và sử dụng database service khác (miễn phí):

**Lựa chọn Database Miễn Phí:**

#### **A. Railway (Dễ Nhất)**
1. Truy cập: https://railway.app
2. Signup bằng GitHub
3. New Project → Database → PostgreSQL
4. Copy connection string
5. Update `render.yaml` hoặc env var

#### **B. Supabase (Phổ Biến)**
1. Truy cập: https://supabase.com
2. Signup bằng GitHub
3. Create project
4. Supabase sẽ cấp PostgreSQL miễn phí
5. Copy connection string

#### **C. Neon (Tốt nhất cho Prisma)**
1. Truy cập: https://neon.tech
2. Signup bằng GitHub
3. Create project
4. Chọn PostgreSQL
5. Copy connection string

---

### **Cách 2: Xóa render.yaml Database Section**

Edit `render.yaml` - **xóa toàn bộ databases section:**

```yaml
# ❌ Xóa phần này:
# databases:
#    - name: otakomi-postgres
#      plan: free
#      databaseName: otakomi_db
```

Rồi update env var `DATABASE_URL` thủ công:
- Vào Render dashboard → Backend service → Environment
- Add env var: `DATABASE_URL=postgresql://...` (từ Railway/Supabase/Neon)

---

## 🚀 Hướng Dẫn Chi Tiết (Dùng Railway)

### **Bước 1: Tạo Database trên Railway**

1. Mở: https://railway.app
2. Signup bằng GitHub
3. New Project
4. Add Database → PostgreSQL
5. Chờ tạo xong
6. Vào Database → Connect
7. Copy connection string (dạng: `postgresql://username:password@host:port/database`)

### **Bước 2: Update render.yaml**

```bash
cd /Users/tunakite/Learning/UIT/DOANTN/OnWay_BE
```

Edit file `render.yaml` - xóa databases section:

Trước:
```yaml
databases:
   - name: otakomi-postgres
     plan: free
     databaseName: otakomi_db
```

Sau (xóa toàn bộ phần databases)

### **Bước 3: Thêm DATABASE_URL vào render.yaml**

Update backend service environment variables:

```yaml
envVars:
   - key: NODE_ENV
     value: production
   - key: DATABASE_URL
     value: postgresql://user:password@host:port/database
   # ... other vars
```

Hoặc để Render tự động thay:
```yaml
   - key: DATABASE_URL
     generateValue: false  # Set static value manually
```

### **Bước 4: Push & Redeploy**

```bash
git add render.yaml
git commit -m "Use external Railway database instead of Render free tier"
git push origin main
```

Render sẽ tự động redeploy.

---

## 📝 Nhanh Gọn - Các Bước Tôi Sẽ Làm

Bạn muốn tôi:

**A. Update render.yaml để xóa database?**
```bash
# Sẽ xóa databases section khỏi render.yaml
# Bạn sẽ tự thêm DATABASE_URL sau từ Railway/Supabase
```

**B. Tạo file guide để setup Railway?**
```bash
# Tôi sẽ tạo file hướng dẫn từng bước
```

**C. Cả 2?**
```bash
# Xóa database section + tạo guide
```

---

## 💡 Lý Do Nên Dùng External Database

| Lý Do | Chi Tiết |
|------|---------|
| ✅ Miễn phí | Railway/Supabase/Neon cung cấp database free |
| ✅ Persistent | Data không mất khi redeploy |
| ✅ Independent | Database riêng biệt từ app |
| ✅ Dễ scale | Sau này upgrade mà không ảnh hưởng app |
| ❌ Setup hơi phức | Phải tạo 2 service thay vì 1 |

---

**Bạn chọn lựa nào? A, B, hay C?** 🤔

Tôi sẵn sàng fix ngay!
