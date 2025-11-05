from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import asyncio
import logging
from datetime import datetime
import os
from dotenv import load_dotenv

from sentiment_analyzer import SentimentAnalyzer

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Otakomi Sentiment Analysis API",
    description="Real-time sentiment analysis service for Otakomi social platform",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize sentiment analyzer
sentiment_analyzer = SentimentAnalyzer()

# Pydantic models
class SentimentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Text to analyze")
    user_id: Optional[str] = Field(None, description="User ID for tracking")
    entity_id: Optional[str] = Field(None, description="Entity ID (post, comment, message)")
    entity_type: Optional[str] = Field(None, description="Entity type")

class BatchSentimentRequest(BaseModel):
    texts: List[str] = Field(..., min_items=1, max_items=100, description="Texts to analyze")
    user_id: Optional[str] = Field(None, description="User ID for tracking")

class SentimentResponse(BaseModel):
    text: str
    sentiment: str
    confidence: float
    scores: dict
    processing_time: float
    timestamp: datetime

class BatchSentimentResponse(BaseModel):
    results: List[SentimentResponse]
    total_count: int
    processing_time: float
    timestamp: datetime

class HealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool
    timestamp: datetime

@app.on_event("startup")
async def startup_event():
    """Initialize the sentiment analyzer on startup"""
    try:
        await sentiment_analyzer.initialize()
        logger.info("Sentiment analysis service started successfully")
    except Exception as e:
        logger.error(f"Failed to initialize sentiment analyzer: {e}")
        raise

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        model_loaded=sentiment_analyzer.is_ready(),
        timestamp=datetime.now()
    )

@app.post("/analyze", response_model=SentimentResponse)
async def analyze_sentiment(request: SentimentRequest):
    """Analyze sentiment of a single text"""
    try:
        start_time = asyncio.get_event_loop().time()
        
        if not sentiment_analyzer.is_ready():
            raise HTTPException(status_code=503, detail="Sentiment analyzer not ready")
        
        result = await sentiment_analyzer.analyze(request.text)
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        logger.info(f"Analyzed sentiment for user {request.user_id}: {result['sentiment']} ({result['confidence']:.3f})")
        
        return SentimentResponse(
            text=request.text,
            sentiment=result["sentiment"],
            confidence=result["confidence"],
            scores=result["scores"],
            processing_time=processing_time,
            timestamp=datetime.now()
        )
    
    except Exception as e:
        logger.error(f"Error analyzing sentiment: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing sentiment: {str(e)}")

@app.post("/analyze/batch", response_model=BatchSentimentResponse)
async def analyze_batch_sentiment(request: BatchSentimentRequest):
    """Analyze sentiment of multiple texts"""
    try:
        start_time = asyncio.get_event_loop().time()
        
        if not sentiment_analyzer.is_ready():
            raise HTTPException(status_code=503, detail="Sentiment analyzer not ready")
        
        # Process texts in parallel
        tasks = [sentiment_analyzer.analyze(text) for text in request.texts]
        results = await asyncio.gather(*tasks)
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        response_results = []
        for i, (text, result) in enumerate(zip(request.texts, results)):
            response_results.append(SentimentResponse(
                text=text,
                sentiment=result["sentiment"],
                confidence=result["confidence"],
                scores=result["scores"],
                processing_time=processing_time / len(request.texts),
                timestamp=datetime.now()
            ))
        
        logger.info(f"Analyzed {len(request.texts)} texts for user {request.user_id}")
        
        return BatchSentimentResponse(
            results=response_results,
            total_count=len(response_results),
            processing_time=processing_time,
            timestamp=datetime.now()
        )
    
    except Exception as e:
        logger.error(f"Error analyzing batch sentiment: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing batch sentiment: {str(e)}")

@app.get("/models/info")
async def get_model_info():
    """Get information about the loaded model"""
    try:
        return {
            "model_name": sentiment_analyzer.model_name,
            "model_ready": sentiment_analyzer.is_ready(),
            "supported_languages": ["en", "multilingual"],
            "max_text_length": 2000,
            "batch_size_limit": 100
        }
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting model info: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )