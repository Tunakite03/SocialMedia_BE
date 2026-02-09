from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import time


app = Flask(__name__)
CORS(app)  # Cho phép CORS để Node.js có thể gọi API

MODEL_ID = "tunakite03/visobert-emotion-vietnamese"

print("Loading model...")

try:
    print("Downloading model files...")
    # Use slow tokenizer to avoid corrupted tokenizer.json
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=False, force_download=True)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID, force_download=True)
    model.eval()
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    raise

def predict_sentiment(text):
    """Phân tích emotion cho văn bản với 7 classes"""
    start_time = time.time()
    
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=256, padding=True)
    
    with torch.no_grad():
        outputs = model(**inputs)
        predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
        predicted_class = torch.argmax(predictions, dim=-1).item()
        confidence = predictions[0][predicted_class].item()
        
        # Get all scores
        all_scores = predictions[0].tolist()
    
    processing_time = round(time.time() - start_time, 4)
    
    # 7-class emotion model
    # 0: Enjoyment, 1: Sadness, 2: Anger, 3: Fear, 4: Disgust, 5: Surprise, 6: Other
    emotion_labels = {
        0: "enjoyment",
        1: "sadness", 
        2: "anger",
        3: "fear",
        4: "disgust",
        5: "surprise",
        6: "other"
    }
    
    return {
        "emotion_class": predicted_class,
        "emotion": emotion_labels.get(predicted_class, "other"),
        "confidence": round(confidence, 4),
        "scores": [round(score, 4) for score in all_scores],  # Array of 7 scores
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
        
        print(f"[DEBUG] Received batch request: {data}")
        
        if not data or 'texts' not in data:
            return jsonify({
                "error": "Missing 'texts' field in request body"
            }), 400
        
        texts = data['texts']
        
        print(f"[DEBUG] Texts to analyze: {texts}")
        
        if not isinstance(texts, list):
            return jsonify({
                "error": "'texts' must be an array"
            }), 400
        
        results = []
        for i, text in enumerate(texts):
            print(f"[DEBUG] Processing text {i}: '{text}' (type: {type(text)}, empty: {not text or not text.strip()})")
            if text and text.strip():
                result = predict_sentiment(text)
                print(f"[DEBUG] Result {i}: {result}")
                results.append(result)
            else:
                # Return 'other' emotion for empty texts
                print(f"[DEBUG] Empty text detected at index {i}, returning default 'other'")
                results.append({
                    "emotion_class": 6,
                    "emotion": "other",
                    "confidence": 0.0,
                    "scores": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0],  # 7 scores, last is 'other'
                    "processing_time": 0

                })
        
        print(f"[DEBUG] Returning {len(results)} results")
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
