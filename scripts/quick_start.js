import mongoose from 'mongoose';

const MONGODB_URI = "mongodb://root:examplepassword@localhost:27017/bobo-vanhoc?authSource=admin";

const WorkSchema = new mongoose.Schema({
    title: String,
    author: String,
    content: String,
    excerpt: String,
    thumbnail: String,
    type: String,
    category: String,
    slug: { type: String, unique: true },
    sourceUrl: String,
    views: { type: Number, default: 0 }
}, { timestamps: true });

const Work = mongoose.models.Work || mongoose.model('Work', WorkSchema);

function slugify(text) {
    if (!text) return 'no-title-' + Date.now();
    return text.toString().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

const sampleStories = [
    {
        title: "Cậu Bé Tích Chu và Giếng Nước Thần",
        category: "Truyện cổ tích",
        excerpt: "Câu chuyện về cậu bé hiếu thảo tìm nước thần chữa bệnh cho bà, dạy bài học về lòng hiếu thảo và sự kiên trì.",
        content: `
            <h2>Cậu Bé Tích Chu và Giếng Nước Thần</h2>
            <p>Ngày xửa ngày xưa, ở một làng quê nhỏ có cậu bé tên Tích Chu. Cậu sống với bà nội già yếu, người đã nuôi nấng cậu từ nhỏ.</p>
            <p>Một hôm, bà nội lâm bệnh nặng. Thầy lang trong làng bảo rằng chỉ có nước từ Giếng Thần trên núi cao mới chữa được bệnh cho bà.</p>
            <p>Tích Chu quyết tâm lên núi tìm Giếng Thần. Chặng đường gian nan với nhiều thử thách: rừng sâu, thú dữ, và con dốc cheo leo.</p>
            <p>Cuối cùng, sau ba ngày ba đêm, cậu tìm thấy Giếng Thần. Nước trong giếng long lanh như ngọc, tỏa hương thơm ngát.</p>
            <p>Mang nước thần về, Tích Chu chữa khỏi bệnh cho bà. Từ đó, cậu càng thêm hiểu giá trị của tình thương gia đình.</p>
            <p><strong>Bài học:</strong> Lòng hiếu thảo và sự kiên trì sẽ chiến thắng mọi khó khăn.</p>
        `
    },
    {
        title: "Chú Thỏ Thông Minh và Cáo Gian Ác",
        category: "Truyện ngụ ngôn", 
        excerpt: "Câu chuyện ngụ ngôn về chú thỏ dùng trí thông minh để thoát khỏi nanh vuốt của con cáo xảo quyệt.",
        content: `
            <h2>Chú Thỏ Thông Minh và Cáo Gian Ác</h2>
            <p>Trong khu rừng xanh, có chú Thỏ nhỏ bé nhưng rất thông minh. Một hôm, chú bị Cáo bắt gặp khi đang kiếm ăn.</p>
            <p>"Hôm nay ta sẽ có bữa tối ngon lành!" - Cáo cười gian xảo.</p>
            <p>Thỏ bình tĩnh đáp: "Thưa ngài Cáo, trước khi ăn thịt tôi, hãy để tôi chỉ cho ngài nơi có nhiều thức ăn hơn."</p>
            <p>Cáo tò mò đồng ý. Thỏ dẫn Cáo đến gần hang của Sư Tử, rồi nhanh chóng trốn vào bụi rậm.</p>
            <p>Sư Tử ra khỏi hang, thấy Cáo đang rình mò liền gầm lên. Cáo sợ hãi bỏ chạy, còn Thỏ an toàn trở về nhà.</p>
            <p><strong>Bài học:</strong> Trí thông minh quan trọng hơn sức mạnh. Trong mọi tình huống, hãy giữ bình tĩnh và tìm giải pháp sáng suốt.</p>
        `
    },
    {
        title: "Sự Tích Hoa Cúc Trắng",
        category: "Truyện cổ tích",
        excerpt: "Truyền thuyết về nguồn gốc của hoa cúc trắng - loài hoa tượng trưng cho lòng hiếu thảo và tình mẫu tử.",
        content: `
            <h2>Sự Tích Hoa Cúc Trắng</h2>
            <p>Ngày xưa, có một cô gái tên Cúc sống với mẹ già. Hai mẹ con sống rất hạnh phúc trong ngôi nhà nhỏ bên đồi.</p>
            <p>Một năm, mẹ Cúc lâm bệnh nặng. Cô đi khắp nơi tìm thầy chạy thuốc nhưng bệnh tình không thuyên giảm.</p>
            <p>Đêm nọ, Cúc mơ thấy một bà tiên mách bảo: "Hãy tìm loài hoa màu trắng tinh khiết trên đỉnh núi cao, đó là thuốc quý chữa bệnh cho mẹ."</p>
            <p>Cúc vượt qua bao khó khăn, cuối cùng tìm thấy khóm hoa trắng muốt trên đỉnh núi. Cô mang về nấu thuốc cho mẹ.</p>
            <p>Kỳ diệu thay, mẹ Cúc khỏi bệnh. Từ đó, loài hoa ấy được gọi là hoa Cúc, tượng trưng cho lòng hiếu thảo.</p>
            <p><strong>Ý nghĩa:</strong> Hoa cúc trắng nhắc nhở chúng ta về tình mẫu tử thiêng liêng và lòng hiếu thảo của con cái.</p>
        `
    },
    {
        title: "Rùa và Thỏ - Bài Học Mới",
        category: "Truyện ngụ ngôn",
        excerpt: "Phiên bản mới của câu chuyện ngụ ngôn kinh điển, với những bài học sâu sắc về sự kiên trì và khiêm tốn.",
        content: `
            <h2>Rùa và Thỏ - Bài Học Mới</h2>
            <p>Sau lần thua cuộc nổi tiếng, Thỏ vô cùng xấu hổ. Chú quyết tâm luyện tập chăm chỉ để chuộc lại danh dự.</p>
            <p>Rùa, dù đã thắng cuộc, vẫn không ngừng rèn luyện. Chú hiểu rằng chiến thắng một lần không có nghĩa là mãi mãi.</p>
            <p>Một năm sau, hai bạn tổ chức cuộc đua mới. Lần này, Thỏ chạy nhanh nhưng vẫn nghỉ ngơi đúng lúc.</p>
            <p>Rùa bước từng bước chậm rãi nhưng kiên định. Cả hai cùng về đích gần như cùng lúc.</p>
            <p>Họ nhận ra: Thắng thua không quan trọng bằng tinh thần thể thao và sự cố gắng không ngừng.</p>
            <p><strong>Bài học:</strong> Thành công đến từ sự kiên trì và khiêm tốn. Dù nhanh hay chậm, quan trọng là không bỏ cuộc.</p>
        `
    },
    {
        title: "Chàng Trai và Cây Đàn Thần",
        category: "Truyện cổ tích",
        excerpt: "Câu chuyện cổ tích về chàng trai nghèo tìm thấy cây đàn thần có khả năng mang lại niềm vui và hạnh phúc.",
        content: `
            <h2>Chàng Trai và Cây Đàn Thần</h2>
            <p>Ở ngôi làng nọ, có chàng trai nghèo tên Lộc. Dù cuộc sống khó khăn, chàng luôn lạc quan và yêu âm nhạc.</p>
            <p>Một ngày, trong lúc đốn củi, Lộc tìm thấy cây đàn cổ kỳ lạ dưới gốc cây cổ thụ. Cây đàn phát ra âm thanh du dương lạ thường.</p>
            <p>Khi Lộc gảy đàn, tiếng nhạc khiến chim chóc hót theo, hoa lá rung rinh, và mọi người trong làng cảm thấy vui vẻ.</p>
            <p>Tin đồn về cây đàn thần lan xa. Một phú ông tham lam muốn chiếm đoạt, nhưng cây đàn chỉ phát ra âm thanh đẹp trong tay Lộc.</p>
            <p>Cuối cùng, Lộc dùng tiếng đàn để mang niềm vui đến cho mọi người, chàng hiểu rằng hạnh phúc thật sự đến từ việc sẻ chia.</p>
            <p><strong>Thông điệp:</strong> Nghệ thuật chân chính xuất phát từ trái tim và mang lại hạnh phúc cho cộng đồng.</p>
        `
    }
];

async function main() {
    console.log("🚀 TẠO CONTENT MẪU CHO VĂN HAY...");
    try {
        await mongoose.connect(MONGODB_URI);
        
        let createdCount = 0;
        for (const story of sampleStories) {
            const slug = slugify(story.title);
            
            // Check if exists
            const existing = await Work.findOne({ slug });
            if (existing) {
                console.log(`⚠️ Đã tồn tại: ${story.title}`);
                continue;
            }
            
            // Create new story
            await Work.create({
                title: story.title,
                author: "Biên tập bởi Văn Hay",
                content: story.content,
                excerpt: story.excerpt,
                thumbnail: "https://via.placeholder.com/800x450/431407/ffffff?text=Văn+Hay",
                type: 'story',
                category: story.category,
                slug: slug,
                sourceUrl: "https://vanhay.info"
            });
            
            console.log(`✅ Đã tạo: ${story.title}`);
            createdCount++;
        }
        
        console.log(`\n🎉 HOÀN TẤT! Đã tạo ${createdCount}/${sampleStories.length} stories`);
        console.log(`📊 Tổng stories trong database: ${await Work.countDocuments()}`);
        
    } catch (error) {
        console.error("❌ Lỗi:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

main();