import asyncio
import logging
from typing import Dict, Any
import re
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import torch

logger = logging.getLogger(__name__)

class SentimentAnalyzer:
    """
    Sentiment Analysis service using Hugging Face transformers
    """
    
    def __init__(self, model_name: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"):
        self.model_name = model_name
        self.pipeline = None
        self.tokenizer = None
        self.model = None
        self._ready = False
        
    async def initialize(self):
        """Initialize the sentiment analysis model"""
        try:
            logger.info(f"Loading sentiment analysis model: {self.model_name}")
            
            # Load model and tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            
            # Create pipeline
            self.pipeline = pipeline(
                "sentiment-analysis",
                model=self.model,
                tokenizer=self.tokenizer,
                device=0 if torch.cuda.is_available() else -1,
                return_all_scores=True
            )
            
            self._ready = True
            logger.info("Sentiment analysis model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize sentiment analyzer: {e}")
            raise
    
    def is_ready(self) -> bool:
        """Check if the analyzer is ready to use"""
        return self._ready and self.pipeline is not None
    
    def _preprocess_text(self, text: str) -> str:
        """Preprocess text for sentiment analysis"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Remove URLs
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        
        # Remove mentions and hashtags (but keep the content)
        text = re.sub(r'[@#](\w+)', r'\1', text)
        
        # Limit length
        if len(text) > 512:
            text = text[:512]
        
        return text
    
    def _map_sentiment(self, label: str) -> str:
        """Map model-specific labels to standard sentiment labels"""
        label_mapping = {
            'LABEL_0': 'NEGATIVE',
            'LABEL_1': 'NEUTRAL', 
            'LABEL_2': 'POSITIVE',
            'negative': 'NEGATIVE',
            'neutral': 'NEUTRAL',
            'positive': 'POSITIVE'
        }
        
        return label_mapping.get(label.upper(), label.upper())
    
    async def analyze(self, text: str) -> Dict[str, Any]:
        """
        Analyze sentiment of text
        
        Args:
            text: Text to analyze
            
        Returns:
            Dict containing sentiment, confidence, and detailed scores
        """
        if not self.is_ready():
            raise RuntimeError("Sentiment analyzer not initialized")
        
        if not text or not text.strip():
            return {
                "sentiment": "NEUTRAL",
                "confidence": 0.0,
                "scores": {"POSITIVE": 0.0, "NEUTRAL": 1.0, "NEGATIVE": 0.0}
            }
        
        try:
            # Preprocess text
            processed_text = self._preprocess_text(text)
            
            # Run sentiment analysis
            results = self.pipeline(processed_text)
            
            # Process results
            scores = {}
            max_score = 0.0
            predicted_sentiment = "NEUTRAL"
            
            for result in results[0]:  # results is a list with one element
                label = self._map_sentiment(result['label'])
                score = result['score']
                scores[label] = score
                
                if score > max_score:
                    max_score = score
                    predicted_sentiment = label
            
            # Ensure all three sentiment types are present
            for sentiment in ['POSITIVE', 'NEUTRAL', 'NEGATIVE']:
                if sentiment not in scores:
                    scores[sentiment] = 0.0
            
            return {
                "sentiment": predicted_sentiment,
                "confidence": max_score,
                "scores": scores
            }
            
        except Exception as e:
            logger.error(f"Error during sentiment analysis: {e}")
            # Return neutral sentiment as fallback
            return {
                "sentiment": "NEUTRAL",
                "confidence": 0.0,
                "scores": {"POSITIVE": 0.0, "NEUTRAL": 1.0, "NEGATIVE": 0.0}
            }
    
    async def analyze_batch(self, texts: list) -> list:
        """
        Analyze sentiment of multiple texts
        
        Args:
            texts: List of texts to analyze
            
        Returns:
            List of sentiment analysis results
        """
        if not self.is_ready():
            raise RuntimeError("Sentiment analyzer not initialized")
        
        tasks = [self.analyze(text) for text in texts]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle any exceptions in results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error analyzing text {i}: {result}")
                processed_results.append({
                    "sentiment": "NEUTRAL",
                    "confidence": 0.0,
                    "scores": {"POSITIVE": 0.0, "NEUTRAL": 1.0, "NEGATIVE": 0.0}
                })
            else:
                processed_results.append(result)
        
        return processed_results