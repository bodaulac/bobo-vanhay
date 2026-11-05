import axios from 'axios';
import config from '../../../config.js';

class GeminiService {
    constructor() {
        // AI Proxy configuration
        this.AI_PROXY_URL = config.aiProxy.url;
        this.AI_PROXY_AUTH = config.aiProxy.auth;
        this.DEFAULT_MODEL = "deepseek-chat"; // Using DeepSeek which is working
        
        console.log('✅ Gemini Service (via AI Proxy) initialized');
        console.log(`   Proxy URL: ${this.AI_PROXY_URL}`);
        console.log(`   Default Model: ${this.DEFAULT_MODEL}`);
        
        // Cost tracking (estimated)
        this.costTracker = {
            totalCalls: 0,
            estimatedCost: 0
        };
        
        // Estimated cost per call (conservative)
        this.ESTIMATED_COST_PER_CALL = 0.0005; // $0.0005 per call
        
        // Quota Management
        this.quotaState = {
            lastQuotaCheck: null,
            quotaExhausted: false,
            quotaRetryAfter: 60 * 60 * 1000, // 1 hour in milliseconds
            failedAttempts: 0,
            maxFailedAttempts: 3
        };
        
        // Error patterns for quota detection
        this.QUOTA_ERROR_PATTERNS = [
            'quota',
            'limit exceeded',
            'rate limit',
            '429',
            'insufficient quota',
            'billing',
            'payment required',
            'credit',
            'exceeded',
            'too many requests'
        ];
    }

    /**
     * Rewrite content in Vietnamese classic literary style
     * @param {string} originalText - Original content to rewrite
     * @param {Object} options - Additional options
     * @returns {Promise<string>} - Rewritten content
     */
    async rewriteContent(originalText, options = {}) {
        const {
            style = 'vietnamese_classic',
            addMoral = true,
            length = 'medium' // short, medium, long
        } = options;

        // Check quota before processing
        if (this.quotaState.quotaExhausted) {
            const timeSinceLastCheck = Date.now() - this.quotaState.lastQuotaCheck;
            if (timeSinceLastCheck < this.quotaState.quotaRetryAfter) {
                const waitMinutes = Math.ceil(
                    (this.quotaState.quotaRetryAfter - timeSinceLastCheck) / (60 * 1000)
                );
                console.log(`⏳ Quota exhausted. Waiting ${waitMinutes} minutes before retry...`);
                return this.fallbackEnhancement(originalText);
            } else {
                // Reset quota state after waiting period
                this.quotaState.quotaExhausted = false;
                this.quotaState.failedAttempts = 0;
                console.log('🔄 Quota check period passed. Resuming normal operation.');
            }
        }

        const lengthMap = {
            short: '150-250 từ',
            medium: '300-500 từ',
            long: '600-800 từ'
        };

        const prompt = `
HÃY VIẾT LẠI NỘI DUNG SAU THEO PHONG CÁCH VĂN HỌC VIỆT NAM CỔ ĐIỂN:

${originalText}

YÊU CẦU CHẤT LƯỢNG CAO:
1. MỞ ĐẦU: Sử dụng cụm từ cổ điển như "Ngày xửa ngày xưa...", "Thuở ấy...", "Chuyện kể rằng..."
2. NGÔN NGỮ: Văn học, giàu hình ảnh, sử dụng từ Hán-Việt phù hợp
3. CẤU TRÚC: Có mở bài, thân bài, kết bài rõ ràng
4. BÀI HỌC: ${addMoral ? 'Thêm bài học đạo đức cuối truyện' : 'Không cần bài học'}
5. ĐỘ DÀI: ${lengthMap[length] || lengthMap.medium}
6. VĂN PHONG: Trang trọng nhưng tự nhiên, phù hợp với truyện cổ tích Việt Nam

LƯU Ý QUAN TRỌNG:
- KHÔNG đề cập đến nguồn gốc hoặc tác giả gốc
- KHÔNG sao chép nguyên văn
- Tạo nội dung ĐỘC ĐÁO, có giá trị văn học
- Giữ nguyên cốt truyện chính nhưng làm phong phú thêm chi tiết

CHỈ TRẢ VỀ NỘI DUNG ĐÃ VIẾT LẠI, KHÔNG THÊM BẤT KỲ GIẢI THÍCH NÀO.
`;

        // Try models in priority order
        for (let i = this.currentModelIndex; i < this.MODEL_PRIORITY.length; i++) {
            const model = this.MODEL_PRIORITY[i];
            
            try {
                console.log(`🤖 Trying model: ${model}...`);
                
                // Track cost
                this.costTracker.totalCalls++;
                this.costTracker.estimatedCost += this.ESTIMATED_COST_PER_CALL;
                
                const response = await axios.post(this.AI_PROXY_URL, {
                    model: model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 1000
                }, {
                    headers: { 'Authorization': this.AI_PROXY_AUTH },
                    timeout: 30000
                });

                const text = response.data.choices[0].message.content;
                
                // Success! Set this as current model
                this.currentModelIndex = i;
                
                console.log(`✅ ${model} rewrite thành công!`);
                console.log(`   Input: ${prompt.length} chars`);
                console.log(`   Output: ${text.length} chars`);
                console.log(`   Estimated cost: $${this.ESTIMATED_COST_PER_CALL.toFixed(6)}`);
                console.log(`   Total cost: $${this.costTracker.estimatedCost.toFixed(6)}`);
                console.log(`   Current model: ${model}`);
                
                return text;

            } catch (error) {
                console.log(`❌ Model ${model} failed: ${error.message}`);
                
                // Check if quota error for Gemini
                if (model.includes('gemini') && this.isQuotaError(error)) {
                    console.log(`🚫 Gemini quota exhausted. Trying next model...`);
                    this.handleQuotaExhaustion();
                    continue;
                }
                
                // For other errors, try next model
                if (i < this.MODEL_PRIORITY.length - 1) {
                    console.log(`🔄 Switching to next model...`);
                    continue;
                }
                
                // All models failed
                console.error('❌ All AI models failed:', error.message);
                
                if (error.message.includes('ECONNREFUSED')) {
                    console.error('💡 AI Proxy not running at http://127.0.0.1:9090');
                    console.error('💡 Start the proxy or check the URL');
                } else if (error.message.includes('401')) {
                    console.error('💡 Authentication failed. Check AI_PROXY_KEY');
                } else if (error.message.includes('timeout')) {
                    console.error('💡 Proxy timeout. Check proxy health');
                }
            }
        }
        
        // All models failed, use fallback
        console.log(`⚠️ All AI models failed. Using fallback enhancement.`);
        return this.fallbackEnhancement(originalText);
    }

    /**
     * Generate image prompt from story content
     * @param {string} title - Story title
     * @param {string} content - Story content
     * @returns {Promise<string>} - Image generation prompt
     */
    async generateImagePrompt(title, content) {
        const prompt = `
TẠO PROMPT CHO AI IMAGE GENERATION:

TIÊU ĐỀ TRUYỆN: ${title}

NỘI DUNG TÓM TẮT: ${content.substring(0, 300)}...

YÊU CẦU PROMPT:
1. MÔ TẢ: Cảnh chính, nhân vật chính, hành động quan trọng
2. PHONG CÁCH: Tranh dân gian Việt Nam, minh họa sách cổ tích
3. MÀU SẮC: Ấm áp, tự nhiên, màu đất, màu gỗ
4. BỐ CỤC: Cân đối, có điểm nhấn
5. TỶ LỆ: 16:9 (landscape)
6. CHẤT LƯỢNG: High resolution, detailed

VIẾT PROMPT BẰNG TIẾNG ANH (cho DALL-E/Stable Diffusion):
CHỈ TRẢ VỀ PROMPT, KHÔNG THÊM GIẢI THÍCH.
`;

        // Try models in priority order (Gemini better for image prompts)
        for (let i = 0; i < this.MODEL_PRIORITY.length; i++) {
            const model = this.MODEL_PRIORITY[i];
            
            try {
                console.log(`🎨 Generating image prompt with ${model}...`);
                
                // Track cost
                this.costTracker.totalCalls++;
                this.costTracker.estimatedCost += this.ESTIMATED_COST_PER_CALL;
                
                const response = await axios.post(this.AI_PROXY_URL, {
                    model: model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 500
                }, {
                    headers: { 'Authorization': this.AI_PROXY_AUTH },
                    timeout: 30000
                });

                const text = response.data.choices[0].message.content;
                
                console.log(`✅ Image prompt from ${model}: OK`);
                console.log(`   Prompt: ${text.substring(0, 80)}...`);
                
                return text.trim();

            } catch (error) {
                console.log(`❌ Image prompt from ${model} failed: ${error.message}`);
                
                // Try next model
                if (i < this.MODEL_PRIORITY.length - 1) {
                    console.log(`🔄 Trying next model for image prompt...`);
                    continue;
                }
            }
        }
        
        // All models failed, use fallback
        console.log(`⚠️ All models failed for image prompt. Using fallback.`);
        return `Vietnamese folk art illustration of "${title}", traditional painting style, warm colors, detailed, 16:9`;
    }

    /**
     * Simple fallback enhancement when API fails
     * @param {string} text - Original text
     * @returns {string} - Enhanced text
     */
    fallbackEnhancement(text) {
        const openings = [
            "Ngày xửa ngày xưa, ",
            "Thuở ấy, ",
            "Từ thuở xa xưa, ",
            "Vào một ngày nọ, ",
            "Chuyện kể rằng, "
        ];
        
        const opening = openings[Math.floor(Math.random() * openings.length)];
        const moral = "\n\nBài học: Câu chuyện dạy chúng ta về những giá trị tốt đẹp trong cuộc sống.";
        
        return opening + text + moral;
    }

    /**
     * Get cost statistics
     * @returns {Object} - Cost tracking data
     */
    getCostStats() {
        return {
            totalCalls: this.costTracker.totalCalls,
            estimatedCost: this.costTracker.estimatedCost,
            avgCostPerCall: this.costTracker.totalCalls > 0 
                ? this.costTracker.estimatedCost / this.costTracker.totalCalls 
                : 0,
            costPerThousandStories: this.costTracker.estimatedCost * 1000
        };
    }

    /**
     * Reset cost tracking
     */
    resetCostTracking() {
        this.costTracker = {
            totalCalls: 0,
            estimatedCost: 0
        };
        console.log('💰 Cost tracking reset');
    }

    /**
     * Test API connection
     * @returns {Promise<boolean>} - Connection status
     */
    async testConnection() {
        console.log('🔍 Testing AI Proxy connection with model priority...');
        
        // Try all models
        for (let i = 0; i < this.MODEL_PRIORITY.length; i++) {
            const model = this.MODEL_PRIORITY[i];
            
            try {
                console.log(`   Testing model: ${model}...`);
                
                const response = await axios.post(this.AI_PROXY_URL, {
                    model: model,
                    messages: [{ role: "user", content: "Viết một câu ngắn về tình bạn." }],
                    temperature: 0.7,
                    max_tokens: 50
                }, {
                    headers: { 'Authorization': this.AI_PROXY_AUTH },
                    timeout: 10000
                });

                const text = response.data.choices[0].message.content;
                
                console.log(`✅ ${model} connection successful!`);
                console.log(`   Test response: ${text.substring(0, 50)}...`);
                
                // Set this as current model if it's working
                this.currentModelIndex = i;
                console.log(`   Current model set to: ${model}`);
                
                return true;
                
            } catch (error) {
                console.log(`❌ ${model} connection failed: ${error.message}`);
                
                // Try next model
                if (i < this.MODEL_PRIORITY.length - 1) {
                    console.log(`   Trying next model...`);
                    continue;
                }
            }
        }
        
        console.error('❌ All AI Proxy connections failed');
        console.error('💡 Check:');
        console.error('   1. AI Proxy at http://127.0.0.1:9090');
        console.error('   2. Authentication: Bearer <AI_PROXY_KEY>');
        console.error('   3. Internet connection');
        
        return false;
    }

    /**
     * Batch rewrite multiple contents
     * @param {Array<string>} contents - Array of original contents
     * @param {Object} options - Rewrite options
     * @returns {Promise<Array<string>>} - Array of rewritten contents
     */
    async batchRewrite(contents, options = {}) {
        console.log(`🤖 Batch rewriting ${contents.length} contents with Gemini...`);
        
        const results = [];
        for (let i = 0; i < contents.length; i++) {
            console.log(`   Processing ${i + 1}/${contents.length}...`);
            try {
                const rewritten = await this.rewriteContent(contents[i], options);
                results.push(rewritten);
                
                // Rate limiting: Gemini allows 60 RPM
                if (i < contents.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1100)); // ~55 RPM
                }
            } catch (error) {
                console.error(`   ❌ Failed to rewrite content ${i + 1}:`, error.message);
                results.push(this.fallbackEnhancement(contents[i]));
            }
        }
        
        return results;
    }

    /**
     * Check if error is quota-related
     * @param {Error} error - Error object
     * @returns {boolean} - True if quota error
     */
    isQuotaError(error) {
        const errorMessage = error.message.toLowerCase();
        const responseData = error.response?.data;
        const responseString = responseData ? JSON.stringify(responseData).toLowerCase() : '';
        
        // Check error message
        const isQuotaInMessage = this.QUOTA_ERROR_PATTERNS.some(pattern => 
            errorMessage.includes(pattern.toLowerCase())
        );
        
        // Check response data
        const isQuotaInResponse = responseData && this.QUOTA_ERROR_PATTERNS.some(pattern =>
            responseString.includes(pattern.toLowerCase())
        );
        
        // Check HTTP status code
        const isQuotaStatusCode = error.response?.status === 429 || error.response?.status === 402;
        
        return isQuotaInMessage || isQuotaInResponse || isQuotaStatusCode;
    }

    /**
     * Handle quota exhaustion
     */
    handleQuotaExhaustion() {
        this.quotaState.quotaExhausted = true;
        this.quotaState.lastQuotaCheck = Date.now();
        this.quotaState.failedAttempts++;
        
        console.log('📊 QUOTA STATE UPDATED:');
        console.log(`   • Quota exhausted: YES`);
        console.log(`   • Retry after: 1 hour`);
        console.log(`   • Failed attempts: ${this.quotaState.failedAttempts}`);
        console.log(`   • Next check: ${new Date(this.quotaState.lastQuotaCheck + this.quotaState.quotaRetryAfter).toLocaleTimeString()}`);
        
        // If too many failures, increase retry time
        if (this.quotaState.failedAttempts >= this.quotaState.maxFailedAttempts) {
            this.quotaState.quotaRetryAfter = 2 * 60 * 60 * 1000; // 2 hours
            console.log(`   ⚠️ Multiple failures. Increased retry to 2 hours.`);
        }
    }

    /**
     * Get current quota status
     * @returns {Object} - Quota status information
     */
    getQuotaStatus() {
        if (this.quotaState.quotaExhausted) {
            const timeLeft = this.quotaState.quotaRetryAfter - 
                           (Date.now() - this.quotaState.lastQuotaCheck);
            const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
            
            return {
                status: 'exhausted',
                retryAfterMinutes: minutesLeft,
                lastCheck: new Date(this.quotaState.lastQuotaCheck).toLocaleString(),
                failedAttempts: this.quotaState.failedAttempts,
                nextCheckTime: new Date(this.quotaState.lastQuotaCheck + this.quotaState.quotaRetryAfter).toLocaleString()
            };
        }
        
        return {
            status: 'available',
            failedAttempts: this.quotaState.failedAttempts,
            lastCheck: this.quotaState.lastQuotaCheck ? 
                      new Date(this.quotaState.lastQuotaCheck).toLocaleString() : 
                      'Never'
        };
    }

    /**
     * Reset quota tracking
     */
    resetQuota() {
        this.quotaState = {
            lastQuotaCheck: null,
            quotaExhausted: false,
            quotaRetryAfter: 60 * 60 * 1000,
            failedAttempts: 0,
            maxFailedAttempts: 3
        };
        console.log('🔄 Quota tracking reset');
    }

    /**
     * Manually set quota as exhausted (for testing)
     * @param {number} retryAfterHours - Hours to wait before retry
     */
    simulateQuotaExhaustion(retryAfterHours = 1) {
        this.quotaState.quotaExhausted = true;
        this.quotaState.lastQuotaCheck = Date.now();
        this.quotaState.quotaRetryAfter = retryAfterHours * 60 * 60 * 1000;
        console.log(`🧪 Simulated quota exhaustion. Retry after ${retryAfterHours} hour(s).`);
    }
}

// Export singleton instance
export default new GeminiService();