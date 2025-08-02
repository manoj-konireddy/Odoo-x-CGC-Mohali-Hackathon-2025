#!/usr/bin/env python3
"""
Test script for OpenRouter API with DeepSeek
Replace YOUR_API_KEY with your actual OpenRouter API key
"""

from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get API key from environment or set it directly
api_key = os.getenv('OPENROUTER_API_KEY') or "YOUR_API_KEY_HERE"

if api_key == "YOUR_API_KEY_HERE":
    print("❌ Please set your OpenRouter API key!")
    print("Either:")
    print("1. Set OPENROUTER_API_KEY in .env file")
    print("2. Replace YOUR_API_KEY_HERE in this script")
    exit(1)

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

def test_openrouter():
    try:
        print("🧪 Testing OpenRouter connection with DeepSeek...")
        
        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "QuickDesk Development",
            },
            model="deepseek/deepseek-r1-0528:free",
            messages=[
                {
                    "role": "user",
                    "content": "Write a simple Python function to validate an email address. Keep it short."
                }
            ]
        )
        
        print("✅ OpenRouter connection successful!")
        print("📝 Response:")
        print(completion.choices[0].message.content)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Check your API key and internet connection")

if __name__ == "__main__":
    test_openrouter()
