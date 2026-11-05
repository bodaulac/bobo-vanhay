# Bố Đậu Lạc - Văn Hay

Hệ thống văn học Việt Nam với AI enhancement và crawler tự động.

## 🚀 Tính năng chính

### 📚 Crawler System (6 crawlers)
1. **gemini_crawler.js** - Crawl + AI enhancement với Gemini Pro 3
2. **enhanced_crawler.js** - Crawl + local AI (Ollama)
3. **simple_crawler.js** - Crawl cơ bản từ truyencotich.net
4. **simple_crawler_with_b2.js** - Crawl + upload ảnh lên Backblaze B2
5. **local_ai_crawler.js** - Crawl + local AI processing
6. **power_crawler.js** - Batch processing crawler

### 🤖 AI Enhancement
- **Gemini Pro 3** - Chất lượng cao nhất
- **DeepSeek** - Fallback option
- **Local AI (Ollama)** - Free, offline processing
- **Image prompt generation** - Cho DALL-E/Stable Diffusion

### 🗄️ Database
- **MongoDB** với replica set
- **16+ stories** đã crawl
- **AI-enhanced content** storage
- **Image URL management**

### 🔎 SEO & trải nghiệm đọc
- Meta description, canonical, Open Graph, JSON-LD (WebSite, Article, BreadcrumbList)
- `/sitemap.xml` (cache 1 giờ) và `/robots.txt` sinh động theo `SITE_URL`
- Tìm kiếm toàn văn `/tim-kiem?q=...` (MongoDB text index, không index trang kết quả)
- Chế độ đọc: chỉnh cỡ chữ, nền tối (lưu trong trình duyệt)
- Nội dung bài viết được lọc HTML (sanitize) trước khi hiển thị

### ✍️ Viết truyện dài (ainovel-cli + novel)

Tích hợp hai dự án mã nguồn mở (đều Apache-2.0):

- [voocel/ainovel-cli](https://github.com/voocel/ainovel-cli) (Go): engine AI tự viết cả cuốn truyện nhiều chương. Chạy như tiến trình riêng, **không nhúng vào Node**.
- [steven-tey/novel](https://github.com/steven-tey/novel) (Tiptap): trình soạn thảo kiểu Notion cho trang quản trị, kèm các nút AI.

Luồng làm việc:

```
ainovel-cli (headless) → output/novel/ → scripts/import_ainovel.js → MongoDB (nháp)
                                                                        ↓
                       /admin: sửa chương bằng trình soạn thảo + AI → Đăng → /sach/<truyện>/chuong-<n>
```

**1. Viết bằng ainovel-cli** (cài theo hướng dẫn của dự án, chạy `ainovel-cli` một lần để cấu hình API key):

```bash
scripts/ainovel_write.sh tam-cam-moi "Viết truyện dã sử Việt về cô Tấm sau khi làm hoàng hậu, 20 chương"
```

Script tạo `workspace/<tên>/`, copy quy tắc tiếng Việt từ `ainovel/rules/`, chạy headless (chạy lại cùng tên sẽ tự **tiếp tục** từ checkpoint) rồi import vào MongoDB ở trạng thái **nháp**. Import lại an toàn: chương không đổi thì bỏ qua, chương đã sửa tay chỉ bị ghi đè khi thêm `--force`.

> ⚠️ ainovel-cli được thiết kế cho truyện mạng tiếng Trung (prompt hệ thống bằng tiếng Trung, yêu cầu về ngôn ngữ chỉ được thêm qua `ainovel/rules/`). Chất lượng tiếng Việt cần được kiểm tra bằng một cuốn thử trước khi dùng thật.

**2. Biên tập & đăng ở `/admin`:** đặt `ADMIN_TOKEN` trong `.env`, vào `/admin` (đăng nhập Basic Auth, mật khẩu = token). Tại đây tạo truyện, thêm/sửa chương, dùng nút AI (Viết tiếp, Chau chuốt, Rút gọn, Kéo dài, Sửa lỗi, yêu cầu riêng) rồi đặt "Đã đăng". Truyện và chương chỉ hiện công khai khi **cả hai** đều ở trạng thái đăng.

**3. Build trình soạn thảo:** `npm run build` (CSS + `public/assets/editor.js`); cả hai file đã được commit sẵn. Nên giới hạn `/admin` theo IP hoặc VPN ở nginx.

### 🌐 Web Interface
- **Express.js server** trên port 3004
- **EJS templates** cho frontend
- **REST API** cho crawlers
- **PM2 process management**

## 📁 Cấu trúc thư mục

```
bobo-vanhoc-v2/
├── server.js              # Web server chính
├── config.js              # Cấu hình từ .env
├── .env.example           # Mẫu biến môi trường
├── ecosystem.config.js    # PM2 configuration
├── package.json          # Dependencies
├── README.md             # This file
├── .gitignore           # Git ignore rules
├── models/              # Mongoose models
├── scripts/             # 6 crawler scripts
├── public/              # Static files (CSS, JS, images)
├── views/               # EJS templates
└── node_modules/        # Dependencies
```

## 🛠️ Cài đặt

```bash
# Clone repository
git clone https://github.com/bodaulac/bobo-vanhay.git
cd bobo-vanhay

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env với MongoDB URI và API keys

# Start MongoDB (Docker)
docker run -d --name xs-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=<mật-khẩu-của-bạn> \
  mongo:latest --replSet rs0 --auth

# Initialize replica set
docker exec -it xs-mongo mongosh --eval "rs.initiate()"

# Build CSS (Tailwind) - file public/css/app.css đã commit sẵn, chỉ cần build lại khi sửa giao diện
npm run build:css

# Start the application
npm start
# Hoặc với PM2
pm2 start ecosystem.config.js
```

## 🚀 Deployment với PM2

```bash
# Start với PM2
pm2 start ecosystem.config.js

# Monitor logs
pm2 logs bobo-vanhoc --lines 20

# Check status
pm2 status

# Restart
pm2 restart bobo-vanhoc

# Stop
pm2 stop bobo-vanhoc
```

## 📊 Database Status

```bash
# Check số lượng stories
node scripts/check_db.js
```

## 🎯 Crawler Usage

```bash
# Run Gemini crawler (recommended)
node scripts/gemini_crawler.js

# Run simple crawler
node scripts/simple_crawler.js

# Run crawler với image upload
node scripts/simple_crawler_with_b2.js
```

## 🔧 Environment Variables

Tạo file `.env`:

```env
MONGODB_URI=mongodb://USER:PASSWORD@127.0.0.1:27017/bobo-vanhoc?authSource=admin&directConnection=true&replicaSet=rs0
AI_PROXY_URL=http://127.0.0.1:9090/v1/chat/completions
AI_PROXY_KEY=your_proxy_key
B2_APPLICATION_KEY_ID=your_b2_key_id
B2_APPLICATION_KEY=your_b2_key
B2_BUCKET_NAME=your_bucket_name
PORT=3004
SITE_URL=https://vanhay.info
ADMIN_TOKEN=chuoi_dai_ngau_nhien
AI_MODEL=deepseek-chat
PAGE_SIZE=12
```

Xem đầy đủ trong `.env.example`. Cấu hình đọc qua `config.js`; schema dùng chung ở `models/Work.js`.

## 📈 Monitoring

- **Web interface**: http://localhost:3004
- **PM2 status**: `pm2 status`
- **MongoDB logs**: `docker logs xs-mongo`
- **Application logs**: `pm2 logs bobo-vanhoc`

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 👤 Tác giả

**Bố Đậu Lạc**
- GitHub: [@bodaulac](https://github.com/bodaulac)
- Project: [bobo-vanhay](https://github.com/bodaulac/bobo-vanhay)

---

**⭐ Nếu bạn thấy dự án hữu ích, hãy cho một star trên GitHub!**
