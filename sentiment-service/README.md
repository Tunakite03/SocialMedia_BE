# Sentiment Analysis API Service

Flask API service cho sentiment analysis model tiếng Việt sử dụng model `tunakite03/sentiment-vi-social-vi`.

## Cài đặt

```bash
pip install -r requirements.txt
```

## Chạy service

### Development (Standalone)

```bash
python api_service.py
```

Service sẽ chạy tại: `http://localhost:8000`

### Docker

```bash
# Build và chạy
docker build -t sentiment-service .
docker run -p 8000:8000 sentiment-service
```

### Docker Compose

```bash
# Chạy toàn bộ stack
docker-compose up -d

# Chỉ chạy sentiment service
docker-compose up -d sentiment-service

# Xem logs
docker-compose logs -f sentiment-service
```

## API Endpoints

### 1. Health Check

```http
GET /health
```

Response:

```json
{
   "status": "healthy",
   "model": "tunakite03/sentiment-vi-social-vi",
   "model_loaded": true
}
```

### 2. Analyze Sentiment (Single) - Endpoint chính

```http
POST /analyze
Content-Type: application/json

{
  "text": "Sản phẩm này rất tốt!",
  "user_id": "optional-user-id",
  "entity_id": "optional-entity-id",
  "entity_type": "optional-type"
}
```

Response:

```json
{
   "sentiment": "positive",
   "confidence": 0.9856,
   "scores": {
      "negative": 0.0034,
      "neutral": 0.011,
      "positive": 0.9856
   },
   "label_id": 2,
   "processing_time": 45.23
}
```

**Sentiment Labels:**

-  `negative` (0): Tiêu cực
-  `neutral` (1): Trung tính
-  `positive` (2): Tích cực

### 3. Batch Analyze

```http
POST /analyze/batch
Content-Type: application/json

{
  "texts": [
    "Sản phẩm tốt!",
    "Dịch vụ tệ!",
    "Bình thường"
  ],
  "user_id": "optional-user-id"
}
```

Response:

```json
{
  "results": [
    {
      "sentiment": "positive",
      "confidence": 0.9845,
      "scores": {
         "negative": 0.0045,
         "neutral": 0.0110,
         "positive": 0.9845
      },
      "label_id": 2,
      "processing_time": 42.15
    },
    ...
  ],
  "count": 3
}
```

### 4. Legacy Endpoints (Backward Compatibility)

Các endpoint cũ vẫn hoạt động:

-  `POST /predict` → redirects to `/analyze`
-  `POST /batch-predict` → redirects to `/analyze/batch`

## Sử dụng từ Node.js

Xem file `nodejs_example.js` để biết cách tích hợp với Node.js backend.

### Cài đặt axios (trong Node.js project)

```bash
npm install axios
```

### Ví dụ đơn giản

```javascript
const axios = require('axios');

async function analyzeSentiment(text) {
   const response = await axios.post('http://localhost:5000/predict', {
      text: text,
   });
   return response.data;
}

// Sử dụng
const result = await analyzeSentiment('Tôi rất thích sản phẩm này!');
console.log(result);
```

## Labels

-  **Negative (0)**: Tiêu cực
-  **Neutral (1)**: Trung tính
-  **Positive (2)**: Tích cực
