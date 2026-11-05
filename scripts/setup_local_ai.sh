#!/bin/bash

echo "🤖 SETUP LOCAL AI (OLLAMA) FOR CONTENT REWRITING"
echo "=================================================="

# Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is already installed"
else
    echo "📦 Installing Ollama..."
    
    # Install Ollama
    curl -fsSL https://ollama.com/install.sh | sh
    
    if [ $? -eq 0 ]; then
        echo "✅ Ollama installed successfully"
    else
        echo "❌ Failed to install Ollama"
        exit 1
    fi
fi

# Start Ollama service in background
echo "🚀 Starting Ollama service..."
ollama serve &
OLLAMA_PID=$!
echo "Ollama PID: $OLLAMA_PID"

# Wait for service to start
echo "⏳ Waiting for Ollama to start (10 seconds)..."
sleep 10

# Check if Ollama is running
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama service is running"
else
    echo "❌ Ollama service failed to start"
    exit 1
fi

# Pull a small model (phi3:mini is only 1.8GB)
echo "📥 Pulling AI model (phi3:mini - 1.8GB)..."
ollama pull phi3:mini

if [ $? -eq 0 ]; then
    echo "✅ Model downloaded successfully"
else
    echo "⚠️ Trying alternative model (llama3.2:3b)..."
    ollama pull llama3.2:3b
fi

# Create test script
echo "📝 Creating test script..."
cat > /tmp/test_ai_rewrite.js << 'EOF'
const axios = require('axios');

async function testAIRewrite() {
    console.log("🧪 Testing Local AI Content Rewriting...");
    
    const originalStory = `
Con gà trống kiêu ngạo
Một con gà trống rất kiêu ngạo, luôn khoe khoang về tiếng gáy của mình.
Một ngày nọ, nó thách thức cả làng về khả năng gáy của mình.
Nhưng khi gặp con chó sói, nó không dám gáy nữa.
`;

    const prompt = `
Hãy viết lại câu chuyện sau theo phong cách văn học Việt Nam cổ điển:

${originalStory}

Yêu cầu:
1. Thêm mở đầu "Ngày xửa ngày xưa..."
2. Sử dụng ngôn ngữ văn học, giàu hình ảnh
3. Thêm bài học đạo đức cuối truyện
4. Độ dài khoảng 300 từ
`;

    try {
        console.log("🤖 Đang gọi Local AI...");
        
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'phi3:mini', // or 'llama3.2:3b'
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.7,
                top_p: 0.9,
                max_tokens: 500
            }
        }, {
            timeout: 30000
        });
        
        console.log("\n✅ AI RESPONSE:");
        console.log("=" .repeat(50));
        console.log(response.data.response);
        console.log("=" .repeat(50));
        
        console.log("\n📊 Stats:");
        console.log(`   Model: ${response.data.model}`);
        console.log(`   Tokens: ${response.data.eval_count}`);
        console.log(`   Duration: ${(response.data.total_duration / 1e9).toFixed(2)}s`);
        
        return {
            success: true,
            content: response.data.response,
            tokens: response.data.eval_count,
            duration: response.data.total_duration
        };
        
    } catch (error) {
        console.error("❌ AI Error:", error.message);
        if (error.response) {
            console.error("Response data:", error.response.data);
        }
        return {
            success: false,
            error: error.message
        };
    }
}

// Run test
testAIRewrite().then(result => {
    console.log("\n" + "=" .repeat(50));
    if (result.success) {
        console.log("🎉 LOCAL AI TEST SUCCESSFUL!");
        console.log(`   Generated ${result.tokens} tokens in ${(result.duration / 1e9).toFixed(2)}s`);
    } else {
        console.log("❌ LOCAL AI TEST FAILED");
        console.log(`   Error: ${result.error}`);
    }
    
    // Cleanup
    console.log("\n🛑 Stopping Ollama service...");
    process.exit(result.success ? 0 : 1);
});
EOF

echo "🚀 Running AI test..."
cd "$(dirname "$0")/.."
node /tmp/test_ai_rewrite.js

# Kill Ollama process
kill $OLLAMA_PID 2>/dev/null

echo ""
echo "📋 SETUP COMPLETE!"
echo "=================="
echo "✅ Ollama installed"
echo "✅ AI model downloaded"
echo "✅ Test completed"
echo ""
echo "🔧 To use in production:"
echo "1. Start Ollama: ollama serve"
echo "2. Use API: http://localhost:11434/api/generate"
echo "3. Integrate with crawler scripts"
echo ""
echo "💾 Model location: ~/.ollama/models/"
echo "📚 Available models: ollama list"