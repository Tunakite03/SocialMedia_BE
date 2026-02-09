from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import time
from ai_batch_processor import AIBatchProcessor


app = Flask(__name__)
CORS(app)  # Cho phép CORS để Node.js có thể gọi API

MODEL_ID = "tunakite03/visobert-emotion-vietnamese-v2"

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

# Initialize AI Batch Processor
try:
    ai_processor = AIBatchProcessor(provider="cerebras", max_workers=5)
except Exception as e:
    ai_processor = None

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
    """Endpoint phân tích nhiều texts và trả về 1 sentiment duy nhất cho toàn bộ"""
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
        
        # Filter empty texts
        valid_texts = [t for t in texts if t and t.strip()]
        
        if not valid_texts:
            return jsonify({
                "error": "No valid texts to analyze"
            }), 400
        
        start_time = time.time()
        
        # Try to use AI processor first, fallback to local model
        if ai_processor:
            try:
                # Use optimized AI batch processing
                ai_results = ai_processor.analyze_batch_optimized(valid_texts)
                method = "ai_batch_aggregated"
            except Exception as e:
                print(f"AI processor failed, falling back to local model: {e}")
                # Fallback to local PyTorch model
                ai_results = []
                for text in valid_texts:
                    result = predict_sentiment(text)
                    # Convert to percentages format
                    ai_results.append({
                        "enjoyment": result['scores'][0] * 100,
                        "sadness": result['scores'][1] * 100,
                        "anger": result['scores'][2] * 100,
                        "fear": result['scores'][3] * 100,
                        "disgust": result['scores'][4] * 100,
                        "surprise": result['scores'][5] * 100,
                        "other": result['scores'][6] * 100
                    })
                method = "pytorch_batch_aggregated"
        else:
            # Use local PyTorch model
            ai_results = []
            for text in valid_texts:
                result = predict_sentiment(text)
                # Convert to percentages format
                ai_results.append({
                    "enjoyment": result['scores'][0] * 100,
                    "sadness": result['scores'][1] * 100,
                    "anger": result['scores'][2] * 100,
                    "fear": result['scores'][3] * 100,
                    "disgust": result['scores'][4] * 100,
                    "surprise": result['scores'][5] * 100,
                    "other": result['scores'][6] * 100
                })
            method = "pytorch_batch_aggregated"
        
        # Aggregate all results into one sentiment
        emotion_labels = ["enjoyment", "sadness", "anger", "fear", "disgust", "surprise", "other"]
        
        # Calculate average scores across all texts
        avg_scores = {
            "enjoyment": 0,
            "sadness": 0,
            "anger": 0,
            "fear": 0,
            "disgust": 0,
            "surprise": 0,
            "other": 0
        }
        
        for ai_result in ai_results:
            for emotion in emotion_labels:
                avg_scores[emotion] += ai_result[emotion]
        
        # Average by number of texts
        num_texts = len(ai_results)
        for emotion in emotion_labels:
            avg_scores[emotion] = avg_scores[emotion] / num_texts
        
        # Convert to scores (0-1 range)
        scores = [
            avg_scores["enjoyment"] / 100,
            avg_scores["sadness"] / 100,
            avg_scores["anger"] / 100,
            avg_scores["fear"] / 100,
            avg_scores["disgust"] / 100,
            avg_scores["surprise"] / 100,
            avg_scores["other"] / 100
        ]
        
        # Find dominant emotion
        max_idx = scores.index(max(scores))
        
        processing_time = round(time.time() - start_time, 4)
        
        return jsonify({
            "emotion_class": max_idx,
            "emotion": emotion_labels[max_idx],
            "confidence": round(scores[max_idx], 4),
            "scores": [round(s, 4) for s in scores],
            "percentages": avg_scores,
            "texts_analyzed": num_texts,
            "processing_time": processing_time,
            "method": method
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
