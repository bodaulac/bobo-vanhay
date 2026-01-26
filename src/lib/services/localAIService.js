const axios = require('axios');

class LocalAIService {
    constructor() {
        this.baseUrl = 'http://localhost:11434';
        this.model = 'phi3:mini'; // Default model
        this.timeout = 30000; // 30 seconds
    }

    /**
     * Set the AI model to use
     * @param {string} model - Model name (phi3:mini, llama3.2:3b, etc.)
     */
    setModel(model) {
        this.model = model;
        return this;
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
`;

        try {
            console.log(`🤖 Local AI đang rewrite content (${this.model})...`);
            
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: this.model,
                prompt: prompt.trim(),
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 40,
                    repeat_penalty: 1.1,
                    num_predict: 800,
                    stop: ['\n\n', '###', '---']
                }
            }, {
                timeout: this.timeout
            });

            const result = response.data.response;
            
            // Clean up response
            let cleaned = result
                .replace(/^Hãy viết lại nội dung sau theo phong cách.*?:/i, '')
                .replace(/^Yêu cầu.*?:/i, '')
                .replace(/^###.*$/gm, '')
                .trim();

            console.log(`✅ AI rewrite thành công! (${response.data.eval_count} tokens)`);
            return cleaned;

        } catch (error) {
            console.error('❌ Local AI Error:', error.message);
            
            // Fallback to simple enhancement if AI fails
            console.log('⚠️ Using fallback enhancement...');
            return this.fallbackEnhancement(originalText);
        }
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
`;

        try {
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.8,
                    num_predict: 200
                }
            });

            return response.data.response.trim();

        } catch (error) {
            console.error('❌ Image prompt generation failed:', error.message);
            return `Vietnamese folk art illustration of "${title}", traditional painting style, warm colors, detailed, 16:9`;
        }
    }

    /**
     * Simple fallback enhancement when AI fails
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
     * Check if AI service is available
     * @returns {Promise<boolean>} - Service status
     */
    async checkHealth() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 5000
            });
            
            const models = response.data.models || [];
            const hasModel = models.some(m => m.name.includes(this.model.split(':')[0]));
            
            return {
                available: true,
                models: models.map(m => m.name),
                hasRequiredModel: hasModel
            };
            
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }

    /**
     * Batch rewrite multiple contents
     * @param {Array<string>} contents - Array of original contents
     * @param {Object} options - Rewrite options
     * @returns {Promise<Array<string>>} - Array of rewritten contents
     */
    async batchRewrite(contents, options = {}) {
        console.log(`🤖 Batch rewriting ${contents.length} contents...`);
        
        const results = [];
        for (let i = 0; i < contents.length; i++) {
            console.log(`   Processing ${i + 1}/${contents.length}...`);
            try {
                const rewritten = await this.rewriteContent(contents[i], options);
                results.push(rewritten);
                
                // Small delay to prevent overwhelming
                if (i < contents.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error(`   ❌ Failed to rewrite content ${i + 1}:`, error.message);
                results.push(this.fallbackEnhancement(contents[i]));
            }
        }
        
        return results;
    }
}

// Export singleton instance
module.exports = new LocalAIService();