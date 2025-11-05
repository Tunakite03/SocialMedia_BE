# Logging Documentation

Dự án này sử dụng Winston để ghi log với cấu hình chi tiết và các tính năng nâng cao.

## Cấu hình Log

### Log Levels

-  `error`: Ghi log lỗi nghiêm trọng
-  `warn`: Ghi log cảnh báo
-  `info`: Ghi log thông tin chung (mặc định)
-  `debug`: Ghi log chi tiết cho development

### Cấu hình Environment

Thêm vào file `.env`:

```env
LOG_LEVEL=info
NODE_ENV=development
```

### Log Files

-  `logs/error.log`: Chỉ chứa log lỗi
-  `logs/combined.log`: Chứa tất cả log
-  Console: Hiển thị log trong development mode

## Cách sử dụng Logger

### Import Logger

```javascript
const Logger = require('../utils/logger');
```

### Basic Logging

```javascript
// Log thông tin
Logger.info('Server started successfully');

// Log lỗi
Logger.error('Database connection failed', error);

// Log cảnh báo
Logger.warn('High memory usage detected');

// Log debug
Logger.debug('Processing user data', { userId: 123 });
```

### Specialized Logging

#### HTTP Requests

```javascript
Logger.logRequest(req, res, 'User Login');
```

#### Database Operations

```javascript
Logger.logDatabase('CREATE', 'user', { userId: newUser.id });
Logger.logDatabase('UPDATE', 'post', { postId: 456, action: 'like' });
```

#### Authentication Events

```javascript
Logger.logAuth('login', user, req.ip);
Logger.logAuth('logout', user, req.ip);
Logger.logAuth('register', user, req.ip);
```

#### Socket Events

```javascript
Logger.logSocket('connection', socket.id, { userId: socket.user?.id });
Logger.logSocket('message_sent', socket.id, { roomId: 'room123' });
```

## Log Format

### Console (Development)

```
[2024-11-03 14:30:45] INFO: User login attempt {"email":"user@example.com"}
[2024-11-03 14:30:46] ERROR: Database connection failed
Error: Connection timeout
    at Database.connect (/path/to/file.js:10:5)
```

### File (JSON)

```json
{
   "level": "info",
   "message": "User login attempt",
   "timestamp": "2024-11-03T14:30:45.123Z",
   "service": "otakomi-backend",
   "email": "user@example.com"
}
```

## Log Rotation

Log files tự động được rotate khi:

-  Kích thước file vượt quá 5MB
-  Giữ tối đa 5 file backup

## Best Practices

### 1. Sử dụng log level phù hợp

```javascript
// ✅ Đúng
Logger.info('User logged in successfully');
Logger.error('Failed to process payment', error);
Logger.debug('Processing step 1', { data });

// ❌ Sai
Logger.error('User logged in successfully'); // Không phải lỗi
Logger.info('Critical system failure'); // Nên dùng error
```

### 2. Thêm context hữu ích

```javascript
// ✅ Đúng
Logger.info('User created', {
   userId: user.id,
   email: user.email,
   registrationMethod: 'email',
});

// ❌ Sai
Logger.info('User created'); // Thiếu thông tin
```

### 3. Không log sensitive data

```javascript
// ✅ Đúng
Logger.info('User authenticated', { userId: user.id, email: user.email });

// ❌ Sai
Logger.info('User authenticated', { password: user.password }); // Không log password
```

### 4. Log errors với stack trace

```javascript
// ✅ Đúng
Logger.error('Failed to process request', error);

// ❌ Sai
Logger.error('Failed to process request', error.message); // Mất stack trace
```

## Monitoring và Debugging

### Development

-  Logs hiển thị màu sắc trong console
-  Debug logs được hiển thị
-  Chi tiết error stack trace

### Production

-  Chỉ log ra file
-  Ẩn sensitive information
-  Tối ưu performance

### Log Analysis

```bash
# Xem log realtime
tail -f logs/combined.log

# Tìm lỗi
grep "ERROR" logs/combined.log

# Xem log của user cụ thể
grep "userId.*123" logs/combined.log

# Count số lượng requests
grep "Request -" logs/combined.log | wc -l
```

## Integration với Controllers

```javascript
const Logger = require('../utils/logger');

const createPost = async (req, res, next) => {
   try {
      Logger.info('Creating new post', { userId: req.user.id });

      const post = await prisma.post.create({ data: postData });

      Logger.logDatabase('CREATE', 'post', { postId: post.id, userId: req.user.id });
      Logger.logRequest(req, res, 'Post Created');

      return successResponse(res, { post });
   } catch (error) {
      Logger.error('Failed to create post', error);
      next(error);
   }
};
```
