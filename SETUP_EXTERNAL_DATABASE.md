# 🚀 Cách 1: Dùng Railway (Nhanh & Dễ)

## Bước 1: Tạo Database trên Railway

```bash
1. Mở: https://railway.app
2. Nhấn "Start New Project"
3. Chọn "Database" → "PostgreSQL"
4. Chờ database tạo xong (2 phút)
```

## Bước 2: Lấy Connection String

Trên Railway dashboard:
```
1. Click vào PostgreSQL database
2. Chọn tab "Connect"
3. Copy connection string (URI)
4. Nó sẽ có dạng:
   postgresql://username:password@host:port/database
```

## Bước 3: Update render.yaml

Edit file `render.yaml`, thêm DATABASE_URL vào backend service:

```yaml
services:
   - type: web
     name: otakomi-backend
     runtime: node
     plan: free
     buildCommand: npm ci && npx prisma generate && npx prisma migrate deploy
     startCommand: npm start
     envVars:
        - key: NODE_ENV
          value: production
        - key: DATABASE_URL
          value: postgresql://user:password@host:5432/database  # ← PASTE YOUR RAILWAY CONNECTION STRING HERE
        - key: JWT_SECRET
          generateValue: true
        # ... rest of env vars
```

## Bước 4: Push & Deploy

```bash
git add render.yaml
git commit -m "Use Railway PostgreSQL database"
git push origin main
```

Render sẽ tự động redeploy!

---

# 🚀 Cách 2: Dùng Supabase (Recommended)

## Bước 1: Tạo Project

```bash
1. Mở: https://supabase.com
2. Nhấn "New Project"
3. Nhập project name: otakomi
4. Set password
5. Chọn region: Singapore
6. Chờ tạo xong (2 phút)
```

## Bước 2: Lấy Connection String

```
1. Dashboard → Settings → Database → Connection String
2. Chọn "Prisma"
3. Copy entire connection string
```

## Bước 3: Update render.yaml

Tương tự như Railway, thêm DATABASE_URL.

---

# 🚀 Cách 3: Dùng Neon (Tốt nhất cho Prisma)

## Bước 1: Signup

```bash
1. Mở: https://neon.tech
2. Signup bằng GitHub
3. Create project
```

## Bước 2: Lấy Connection String

```
1. Dashboard → Connection String
2. Copy URL
```

## Bước 3: Update render.yaml

Thêm DATABASE_URL vào.

---

## 📝 Quick Paste Template

Sau khi copy connection string từ Railway/Supabase, replace phần này trong `render.yaml`:

```yaml
        - key: DATABASE_URL
          value: [PASTE_YOUR_CONNECTION_STRING_HERE]
```

---

## ✅ Verify Deployment

Sau push, mở: `https://otakomi-backend.onrender.com/health`

Nếu thấy:
```json
{"status": "OK", ...}
```

✅ Deploy thành công!

---

## 🆘 Nếu Lỗi Connection

Kiểm tra:
1. Connection string copy đúng không?
2. Database name đúng không?
3. Username/password đúng không?

Nếu vẫn lỗi, xem logs:
- Render dashboard → Backend → Logs
