from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import time

app = Flask(__name__)
CORS(app)  # Cho phép CORS để Node.js có thể gọi API

MODEL_ID = "tunakite03/sentiment-vi-social-vi"

print("Loading model...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
model.eval()
print("Model loaded successfully!")

def predict_sentiment(text):
    """Phân tích sentiment cho văn bản"""
    start_time = time.time()
    
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=256, padding=True)
    
    with torch.no_grad():
        outputs = model(**inputs)
        predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
        predicted_class = torch.argmax(predictions, dim=-1).item()
        confidence = predictions[0][predicted_class].item()
        
        # Get all scores
        all_scores = predictions[0].tolist()
    
    labels = {0: "negative", 1: "neutral", 2: "positive"}
    processing_time = round((time.time() - start_time) * 1000, 2)  # in milliseconds
    
    return {
        "sentiment": labels.get(predicted_class, "neutral"),
        "confidence": round(confidence, 4),
        "scores": {
            "negative": round(all_scores[0], 4),
            "neutral": round(all_scores[1], 4),
            "positive": round(all_scores[2], 4)
        },
        "label_id": predicted_class,
        "processing_time": processing_time
    }

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint kiểm tra health"""
    return jsonify({
        "status": "healthy",
        "model": MODEL_ID,
        "model_loaded": True
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    """Endpoint phân tích sentiment cho một văn bản"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                "error": "Missing 'text' field in request body"
            }), 400
        
        text = data['text']
        
        if not text or not text.strip():
            return jsonify({
                "error": "Text cannot be empty"
            }), 400
        
        result = predict_sentiment(text)
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

@app.route('/analyze/batch', methods=['POST'])
def batch_analyze():
    """Endpoint phân tích sentiment cho nhiều văn bản cùng lúc"""
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({
                "error": "Missing 'texts' field in request body"
            }), 400
        
        texts = data['texts']
        
        if not isinstance(texts, list):
            return jsonify({
                "error": "'texts' must be an array"
            }), 400
        
        results = []
        for text in texts:
            if text and text.strip():
                result = predict_sentiment(text)
                results.append(result)
            else:
                # Return neutral for empty texts
                results.append({
                    "sentiment": "neutral",
                    "confidence": 0.0,
                    "scores": {
                        "negative": 0.33,
                        "neutral": 0.34,
                        "positive": 0.33
                    },
                    "label_id": 1,
                    "processing_time": 0
                })
        
        return jsonify({
            "results": results,
            "count": len(results)
        }), 200
    
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

# Legacy endpoints for backward compatibility
@app.route('/predict', methods=['POST'])
def predict():
    """Legacy endpoint - redirects to /analyze"""
    return analyze()

@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    """Legacy endpoint - redirects to /analyze/batch"""
    return batch_analyze()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=False)
