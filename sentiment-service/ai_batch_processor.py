# -*- coding: utf-8 -*-
"""
AI Batch Processor for Sentiment Analysis
Sử dụng LLM (Cerebras/Groq) để phân tích nhiều văn bản cùng lúc
"""
import json
import re
from typing import List, Dict, Optional
from openai import OpenAI
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

class AIBatchProcessor:
    """Xử lý batch sentiment analysis với AI"""
    
    # Danh sách các API providers
    PROVIDERS = {
        "cerebras": {
            "api_key": "csk-xf42rmnndvhddtt6etpxhjwtp2nj4tywefnf2emk5rwm89eh",
            "base_url": "https://api.cerebras.ai/v1",
            "model": "gpt-oss-120b"
        },
    }
    
    def __init__(self, provider: str = "cerebras", max_workers: int = 5):
        """
        Initialize AI Batch Processor
        
        Args:
            provider: Tên provider (cerebras)
            max_workers: Số lượng threads xử lý song song
        """
        self.provider_name = provider
        self.max_workers = max_workers
        
        if provider not in self.PROVIDERS:
            raise ValueError(f"Provider {provider} không được hỗ trợ. Chọn: {list(self.PROVIDERS.keys())}")
        
        config = self.PROVIDERS[provider]
        self.client = OpenAI(
            api_key=config["api_key"],
            base_url=config["base_url"]
        )
        self.model = config["model"]
        
    
    def extract_json_from_text(self, text: str) -> Optional[Dict]:
        """Trích xuất JSON từ text response"""
        try:
            return json.loads(text)
        except:
            pass
        
        # Xóa markdown code blocks
        text = re.sub(r'```(?:json)?\s*', '', text)
        text = re.sub(r'```\s*', '', text)
        
        # Tìm JSON object
        match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text)
        if match:
            try:
                return json.loads(match.group())
            except:
                pass
        
        return None
    
    def analyze_single_text(self, text: str, retry: int = 2) -> Dict:
        """
        Phân tích một văn bản với AI
        
        Args:
            text: Văn bản cần phân tích
            retry: Số lần retry nếu lỗi
            
        Returns:
            Dict với emotion scores
        """
        prompt = f"""
Phân tích cảm xúc của câu sau và trả về tỉ lệ phần trăm (0-100) cho mỗi cảm xúc.
Tổng các tỉ lệ PHẢI bằng 100.

Câu: "{text}"

Trả về JSON với format:
{{
    "enjoyment": <số>,
    "sadness": <số>,
    "anger": <số>,
    "fear": <số>,
    "disgust": <số>,
    "surprise": <số>,
    "other": <số>
}}
"""
        
        for attempt in range(retry + 1):
            try:
                completion = self.client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": "Bạn là chuyên gia phân tích cảm xúc. Chỉ trả về JSON thuần với 7 emotions. Tổng = 100. KHÔNG giải thích."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    model=self.model,
                    temperature=0.3,
                    max_tokens=300,
                )
                
                response_text = completion.choices[0].message.content
                data = self.extract_json_from_text(response_text)
                
                if data and self._validate_emotion_data(data):
                    return self._normalize_scores(data)
                
            except Exception as e:
                if attempt == retry:
                    print(f"❌ Error analyzing text after {retry+1} attempts: {e}")
                    return self._get_default_scores()
                time.sleep(1)  # Wait before retry
        
        return self._get_default_scores()
    
    def analyze_batch_optimized(self, texts: List[str]) -> List[Dict]:
        """
        Phân tích batch với một prompt duy nhất (tối ưu nhất)
        
        Args:
            texts: List các văn bản cần phân tích
            
        Returns:
            List các kết quả emotion scores
        """
        if not texts:
            return []
        
        # Tạo prompt cho tất cả texts
        texts_formatted = "\n".join([f"{i+1}. {text}" for i, text in enumerate(texts)])
        
        prompt = f"""
Phân tích cảm xúc cho {len(texts)} câu sau. Với mỗi câu, trả về tỉ lệ % cho 7 cảm xúc (tổng = 100).

{texts_formatted}

Trả về JSON array với format:
[
    {{"enjoyment": <số>, "sadness": <số>, "anger": <số>, "fear": <số>, "disgust": <số>, "surprise": <số>, "other": <số>}},
    ...
]
"""
        
        try:
            completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "Bạn là chuyên gia phân tích cảm xúc. Trả về JSON array với emotion scores. Mỗi object có 7 keys. Tổng mỗi object = 100."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model=self.model,
                temperature=0.3,
                max_tokens=2000,
            )
            
            response_text = completion.choices[0].message.content
            
            # Extract JSON array
            data = self.extract_json_from_text(response_text)
            
            if isinstance(data, list) and len(data) == len(texts):
                results = []
                for item in data:
                    if self._validate_emotion_data(item):
                        results.append(self._normalize_scores(item))
                    else:
                        results.append(self._get_default_scores())
                return results
            
        except Exception as e:
            print(f"❌ Batch analysis error: {e}")
        
        # Fallback: analyze individually
        print("⚠️ Falling back to individual analysis...")
        return self.analyze_batch_parallel(texts)
    
    def analyze_batch_parallel(self, texts: List[str]) -> List[Dict]:
        """
        Phân tích batch với threading (song song)
        
        Args:
            texts: List các văn bản cần phân tích
            
        Returns:
            List các kết quả emotion scores
        """
        results = [None] * len(texts)
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_index = {
                executor.submit(self.analyze_single_text, text): i 
                for i, text in enumerate(texts)
            }
            
            for future in as_completed(future_to_index):
                index = future_to_index[future]
                try:
                    results[index] = future.result()
                except Exception as e:
                    print(f"❌ Error processing text {index}: {e}")
                    results[index] = self._get_default_scores()
        
        return results
    
    def _validate_emotion_data(self, data: Dict) -> bool:
        """Kiểm tra data có đủ 7 emotions không"""
        required_keys = {"enjoyment", "sadness", "anger", "fear", "disgust", "surprise", "other"}
        return all(key in data for key in required_keys)
    
    def _normalize_scores(self, data: Dict) -> Dict:
        """Normalize scores để tổng = 100"""
        total = sum(data.values())
        if total == 0:
            return self._get_default_scores()
        
        normalized = {key: round((value / total) * 100, 2) for key, value in data.items()}
        
        # Đảm bảo tổng = 100 (fix rounding errors)
        diff = 100 - sum(normalized.values())
        if diff != 0:
            max_key = max(normalized, key=normalized.get)
            normalized[max_key] = round(normalized[max_key] + diff, 2)
        
        return normalized
    
    def _get_default_scores(self) -> Dict:
        """Trả về scores mặc định khi lỗi"""
        return {
            "enjoyment": 0,
            "sadness": 0,
            "anger": 0,
            "fear": 0,
            "disgust": 0,
            "surprise": 0,
            "other": 100
        }


# Test function
if __name__ == "__main__":
    processor = AIBatchProcessor(provider="cerebras", max_workers=3)
    
    test_texts = [
        "Món này ngon quá! Tôi rất thích",
        "Buồn quá, tôi thất vọng lắm",
        "Tôi rất tức giận về việc này",
        "Sợ quá, không dám làm",
        "Ghê tởm, kinh khủng"
    ]
    
    print("\n🔄 Testing batch analysis (optimized)...")
    start = time.time()
    results = processor.analyze_batch_optimized(test_texts)
    elapsed = time.time() - start
    
    print(f"\n✅ Processed {len(test_texts)} texts in {elapsed:.2f}s")
    for i, (text, result) in enumerate(zip(test_texts, results)):
        print(f"\n{i+1}. {text}")
        print(f"   {result}")
