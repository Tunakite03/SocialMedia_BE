#!/bin/bash

# Sentiment Service Test Script
# Kiểm tra các API endpoints của sentiment service

SENTIMENT_URL="${SENTIMENT_SERVICE_URL:-http://localhost:8000}"

echo "=========================================="
echo "Testing Sentiment Service"
echo "URL: $SENTIMENT_URL"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
response=$(curl -s -w "\n%{http_code}" "$SENTIMENT_URL/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "Response: $body"
else
    echo -e "${RED}✗ Health check failed (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 2: Analyze Single Text (Positive)
echo -e "${YELLOW}Test 2: Analyze Positive Text${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$SENTIMENT_URL/analyze" \
  -H "Content-Type: application/json" \
  -d '{"text": "Tôi rất vui và hạnh phúc hôm nay!"}')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "200" ]; then
    sentiment=$(echo "$body" | grep -o '"sentiment":"[^"]*"' | cut -d'"' -f4)
    confidence=$(echo "$body" | grep -o '"confidence":[0-9.]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ Analysis passed${NC}"
    echo "Sentiment: $sentiment (confidence: $confidence)"
else
    echo -e "${RED}✗ Analysis failed (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 3: Analyze Single Text (Negative)
echo -e "${YELLOW}Test 3: Analyze Negative Text${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$SENTIMENT_URL/analyze" \
  -H "Content-Type: application/json" \
  -d '{"text": "Tôi rất buồn và thất vọng"}')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "200" ]; then
    sentiment=$(echo "$body" | grep -o '"sentiment":"[^"]*"' | cut -d'"' -f4)
    confidence=$(echo "$body" | grep -o '"confidence":[0-9.]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ Analysis passed${NC}"
    echo "Sentiment: $sentiment (confidence: $confidence)"
else
    echo -e "${RED}✗ Analysis failed (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 4: Analyze Single Text (Neutral)
echo -e "${YELLOW}Test 4: Analyze Neutral Text${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$SENTIMENT_URL/analyze" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hôm nay trời nắng đẹp"}')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "200" ]; then
    sentiment=$(echo "$body" | grep -o '"sentiment":"[^"]*"' | cut -d'"' -f4)
    confidence=$(echo "$body" | grep -o '"confidence":[0-9.]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ Analysis passed${NC}"
    echo "Sentiment: $sentiment (confidence: $confidence)"
else
    echo -e "${RED}✗ Analysis failed (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 5: Batch Analyze
echo -e "${YELLOW}Test 5: Batch Analyze${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$SENTIMENT_URL/analyze/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "Tôi rất yêu thích sản phẩm này!",
      "Dịch vụ tệ quá",
      "Bình thường thôi"
    ]
  }')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "200" ]; then
    count=$(echo "$body" | grep -o '"count":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ Batch analysis passed${NC}"
    echo "Analyzed $count texts"
    echo "Response: $body"
else
    echo -e "${RED}✗ Batch analysis failed (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 6: Error Handling (Empty Text)
echo -e "${YELLOW}Test 6: Error Handling (Empty Text)${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$SENTIMENT_URL/analyze" \
  -H "Content-Type: application/json" \
  -d '{"text": ""}')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "400" ]; then
    echo -e "${GREEN}✓ Error handling correct${NC}"
    echo "Response: $body"
else
    echo -e "${RED}✗ Unexpected response (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 7: Legacy Endpoint (/predict)
echo -e "${YELLOW}Test 7: Legacy Endpoint (/predict)${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$SENTIMENT_URL/predict" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test legacy endpoint"}')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ Legacy endpoint works${NC}"
    echo "Response: $body"
else
    echo -e "${RED}✗ Legacy endpoint failed (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

echo "=========================================="
echo "Testing completed!"
echo "=========================================="
