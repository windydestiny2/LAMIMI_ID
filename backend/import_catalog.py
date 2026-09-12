"""Import katalog asli LAMIMI_ID dari daftar user. Menghapus katalog contoh lama."""
import asyncio

from lib.db import db
from server import Book

IMGB = "https://static.prod-images.emergentagent.com/jobs/51f7e078-38c7-42d6-91d5-1c65bce9bd40/images"
COVER = {
    "mandarin": f"{IMGB}/5bf0e2c787c6676408a2109fec35404a2682917defb88a7f7237269a82ec2758.jpeg",
    "korea": f"{IMGB}/583dd15761c201afa7758356e98f0027139eca4cb3edc270ad06229bfd351861.jpeg",
    "jepang": f"{IMGB}/c06a07b9085e3a8ce056bdc2e4ada5080d9a3770991ba7bfdf5c7fc8da5a8efd.jpeg",
    "inggris": f"{IMGB}/811d0e4800721ae27e8925be66999fd49680a2406c3c93cdd968f7dcb9352e2b.jpeg",
}
FISIK_COVERS = [
    "https://images.unsplash.com/photo-1514369118554-e20d93546b30?crop=entropy&cs=srgb&fm=jpg&w=900&q=80",
    "https://images.unsplash.com/photo-1673515334717-da4d85aaf38b?crop=entropy&cs=srgb&fm=jpg&w=900&q=80",
    "https://images.unsplash.com/photo-1688644707880-3d0df0fb2dc5?crop=entropy&cs=srgb&fm=jpg&w=900&q=80",
    "https://images.unsplash.com/photo-1578511161102-485cc0775c6b?crop=entropy&cs=srgb&fm=jpg&w=900&q=80",
]
SHOPEE = "https://s.shopee.co.id/8AV4Tsb6bM"


def b(title, price, lang, badge="", desc="", featured=False, satuan=None):
    if satuan:
        desc = (desc + " " if desc else "") + f"Harga satuan: Rp {satuan:,}.".replace(",", ".")
    return Book(title=title, author="LAMIMI_ID", language=lang, type="digital", price=price,
                description=desc, cover_url=COVER[lang], badge=badge, featured=featured)


def f(title, price, cover_idx=0, badge="", desc="", shopee=SHOPEE):
    return Book(title=title, author="LAMIMI Press", language="mandarin", type="fisik", price=price,
                description=desc, cover_url=FISIK_COVERS[cover_idx % len(FISIK_COVERS)], badge=badge, shopee_url=shopee)


BOOKS = [
    # ===== BEST SELLER (Mandarin) =====
    b("HSK 3.0 Bundle (All Released Materials)", 99000, "mandarin", "Best Seller",
      "Textbook HSK 1-4A + audio + bonus, Workbook HSK 1-3 + audio, PPT HSK 1-3, Video Xiaoyu's bonus content 1-3, answer key textbook & workbook 1-3.", featured=True, satuan=9990),
    b("HSK 3.0 Mock Test (New Released)", 112000, "mandarin", "Best Seller",
      "Tersedia level 1-4. Sudah termasuk audio + answer key.", featured=True, satuan=30000),
    b("HSK 2.0 Bundle HSK 1-6", 29000, "mandarin", "Best Seller"),
    b("YCT 1-6 Bundle", 25000, "mandarin", "Best Seller"),
    b("CSCA Bank Past Paper + Materials", 20000, "mandarin", "Best Seller"),
    b("HSK Bank Past Paper + Mock Test 1-6 & 1-9 (HSK 2.0 & 3.0)", 28000, "mandarin", "Best Seller"),
    b("HSK 7-9 Complete Mock Test Exam (Merah)", 10000, "mandarin", "Best Seller"),
    b("HSK 7-9 Full Simulated Test Exam (Hijau)", 10000, "mandarin", "Best Seller"),
    b("Han Yu JiaoCheng 1-4 Bundle", 19000, "mandarin", "Best Seller"),
    b("HSK Handwriting Book 1-6 Bundle", 19000, "mandarin", "Best Seller"),
    b("Easy Steps To Chinese Edisi 2", 35000, "mandarin", "Best Seller", satuan=10000),
    # ===== MANDARIN BISNIS =====
    b("BCT 1-3 Bundle", 25000, "mandarin", "Bisnis", satuan=10000),
    b("Startup Business Chinese Bundle", 20000, "mandarin", "Bisnis"),
    b("Business Chinese Conversation Bundle", 20000, "mandarin", "Bisnis"),
    b("Winning in China 1-3 Bundle", 20000, "mandarin", "Bisnis"),
    b("International Business Practice (国际贸易实务双语教程)", 15000, "mandarin", "Bisnis",
      "Publisher: Tsinghua University Press 2016 (4th Edition). Buku teks praktik perdagangan internasional bilingual (Mandarin-Inggris): regulasi, pengiriman, kontrak. Untuk mahasiswa bisnis internasional & profesional."),
    b("Practical Medical Chinese", 30000, "mandarin", "Bisnis",
      "Panduan Mandarin medis: konsultasi pasien, pemeriksaan, terminologi rumah sakit. Untuk mahasiswa & praktisi kesehatan.", satuan=15000),
    # ===== MANDARIN TAIWAN =====
    b("A Course in Contemporary Chinese 1-6 Bundle", 40000, "mandarin", "Taiwan", satuan=10000),
    b("Let's Learn Mandarin 1-4 Bundle", 35000, "mandarin", "Taiwan", satuan=12000),
    b("China & Taiwan (History Bundle)", 35000, "mandarin", "Taiwan",
      "Memahami isu China-Taiwan: semikonduktor, geopolitik AS-China, dan dampaknya ke kehidupan sehari-hari.", satuan=12000),
    # ===== MANDARIN FOR KIDS =====
    b("Chinese Made Easy 1-4 Bundle (v1)", 30000, "mandarin", "Anak-anak", satuan=10000),
    b("Chinese Made Easy 1-4 Bundle (v2)", 30000, "mandarin", "Anak-anak", satuan=10000),
    b("Chinese Made Easy 1-4 Bundle (v3)", 30000, "mandarin", "Anak-anak", satuan=10000),
    b("Easy Steps to Chinese for Kids 1-4 Bundle", 30000, "mandarin", "Anak-anak", satuan=10000),
    b("Mei Hua 1-6 Bundle", 35000, "mandarin", "Anak-anak", satuan=10000),
    b("Han Yu 1-12 Bundle (Textbook & Workbook)", 20000, "mandarin", "Anak-anak"),
    b("Xiao Xiao Chinese 1-6 (天天学华文)", 35000, "mandarin", "Anak-anak",
      "Seri Mandarin anak yang dipakai luas di Singapura. Penjelasan ramah anak, latihan harian terstruktur.", satuan=10000),
    # ===== LAINNYA (Mandarin) =====
    b("HSKK Elementary 1-4 Bundle", 29000, "mandarin", satuan=10000),
    b("Conversational Chinese 301 (Edisi 4)", 25000, "mandarin", satuan=15000),
    b("Learning Chinese Language and Culture 1-2 Bundle", 18000, "mandarin", satuan=10000),
    b("Short Term Spoken Chinese 1-6 Bundle", 39000, "mandarin", satuan=10000),
    b("Basic Spoken Chinese 1 & 2 Bundle", 15000, "mandarin", satuan=10000),
    b("Developing Mandarin: Comprehensive Course", 30000, "mandarin",
      "Elementary 1-2, Intermediate 1-2, Advanced 1-2.", satuan=12000),
    b("Developing Mandarin: Listening", 30000, "mandarin",
      "Elementary 1-2, Intermediate 1-2, Advanced 1-2.", satuan=12000),
    b("An Intensive Guide to Math (for CSCA)", 10000, "mandarin"),
    b("An Intensive Guide to Math (for CSCA) 3rd Edition", 15000, "mandarin"),
    b("Mandarin Chinese Visual Phrase Book", 5000, "mandarin"),
    b("Integrated Chinese Bundle", 20000, "mandarin"),
    b("New Practical Chinese Reader 2nd Edition", 30000, "mandarin", satuan=10000),
    b("HSKK (2013)", 10000, "mandarin"),
    b("HSK Conversational 1-3 (audio via link di PDF)", 30000, "mandarin", satuan=12000),
    b("Graded Chinese Reader 1-6 + Audio", 30000, "mandarin", satuan=12000),
    b("Cambridge Mandarin: Coursebook + Workbook + Past Paper Bundle", 40000, "mandarin",
      "Termasuk past paper First/Second/Foreign Language 2024-2026.", satuan=15000),
    b("New Era Spoken Chinese", 30000, "mandarin",
      "Elementary 1-2, Intermediate 1-2, Pre-advanced 1-2. Semua include audio per level.", satuan=15000),
    b("Boya Chinese", 35000, "mandarin",
      "Elementary 1-2, Quasi-intermediate 1-2, Intermediate 1-2, Advanced 1-3. Audio included.", satuan=15000),
    b("Speed Up Your Chinese (Routledge)", 15000, "mandarin",
      "Strategi praktis meningkatkan akurasi & fluency, menghindari kesalahan umum grammar & kosakata. Level intermediate-advanced."),
    b("A Short History of China and Southeast Asia", 10000, "mandarin",
      "Allen & Unwin 2003. Sejarah hubungan China-Asia Tenggara: migrasi, pedagang, sistem tributari, hingga geopolitik kontemporer."),
    b("China's Economic Engagement in North Korea", 10000, "mandarin",
      "Palgrave Macmillan 2019. Analisis hubungan ekonomi China-Korut: perdagangan, investasi, sanksi internasional."),
    b("English Agreements: International Contract Writing Guide", 10000, "mandarin",
      "BLCUP 2010. Panduan menulis kontrak internasional dalam bahasa Inggris + kamus istilah legal."),
    b("CTCSOL Interview Q&A (国际汉语教师证书面试常见英文问答)", 10000, "mandarin",
      "World Book Publishing 2017. Persiapan wawancara bahasa Inggris ujian sertifikasi guru Mandarin internasional."),
    b("A Bilingual Treasury of Chinese Folktales", 10000, "mandarin",
      "Tuttle 2022. 10 dongeng tradisional China, bilingual Mandarin-Inggris, dengan audio online gratis."),
    b("Fun with Chinese Characters (3 Buku)", 25000, "mandarin",
      "Cheng & Tsui. Pahami Hanzi lewat asal-usul & logika visualnya, bukan hafalan buta.", satuan=10000),
    b("New Target Chinese Spoken Language 1-6", 30000, "mandarin",
      "BLCUP 2012. Beginner-lower intermediate. Latihan speaking natural untuk percakapan nyata.", satuan=10000),
    b("Learning Chinese with Mom & Dad (Pengantar Korea)", 10000, "mandarin", "Absolute beginner."),
    b("Chinese Mandarin Made Easy (Tuttle)", 10000, "mandarin",
      "Level HSK 1-3. Ilustrasi asal-usul tiap Hanzi — cocok untuk visual learner."),
    b("All About History: History of China", 5000, "mandarin", "Serba 5rb",
      "Future Publishing 2024. Dari Tembok Besar, Jalur Sutra, hingga politik modern era Xi Jinping."),
    b("Chinese for Traditional Chinese Medicine (中医汉语)", 5000, "mandarin", "Serba 5rb",
      "BLCUP. Buku teks Mandarin khusus pengobatan tradisional China (TCM): terminologi herbal, akupunktur, diagnostik."),
    # ===== PPT HSK VERSI LAMA =====
    b("PPT HSK 1 (Versi Lama)", 10000, "mandarin", "PPT HSK Lama"),
    b("PPT HSK 2 (Versi Lama)", 10000, "mandarin", "PPT HSK Lama"),
    b("PPT HSK 3 (Versi Lama)", 10000, "mandarin", "PPT HSK Lama"),
    b("PPT HSK 4 A&B (Versi Lama)", 20000, "mandarin", "PPT HSK Lama"),
    b("PPT HSK 5 A&B (Versi Lama)", 20000, "mandarin", "PPT HSK Lama"),
    b("PPT HSK 6 A&B (Versi Lama)", 20000, "mandarin", "PPT HSK Lama"),
    # ===== KOREAN CORNER =====
    b("Talk to Me in Korean: Textbook + Workbook + Audio", 30000, "korea", "Best Seller", featured=True, satuan=10000),
    b("Sejong Korean EBooks", 30000, "korea", satuan=10000),
    b("TOPIK 1 & 2", 15000, "korea", satuan=10000),
    b("EPS TOPIK 2024 (Terjemahan Bhs Inggris)", 15000, "korea", satuan=10000),
    b("My First 500 Korean Words", 15000, "korea", satuan=10000),
    b("Marketing Terminology 480 (마케팅용어 480)", 15000, "korea", "Bisnis",
      "Pahami & pakai istilah marketing Korea dalam situasi bisnis nyata. Untuk mahasiswa, karyawan, dan entrepreneur."),
    b("Dad, What Is Business Administration? (아빠, 경영학이 뭐예요?)", 15000, "korea", "Bisnis",
      "예림당 2012. Dasar-dasar bisnis, manajemen, dan kewirausahaan dengan bahasa ringan."),
    b("I Will Grow Up to be a Happy Person", 10000, "korea",
      "천문장 2019. 6 cerita anak untuk berpikir positif, self-esteem, dan kecerdasan emosional."),
    b("Seoul National University Korean Plus (24 Buku)", 35000, "korea",
      "SNU 2022. 6 level x (A/B) x (Student Book + Workbook) = 24 buku.", featured=True),
    b("Excel Work Strategy Guide (엑셀 업무 공략집)", 10000, "korea", "Bisnis",
      "한빛미디어 2020. 52 formula Excel penting untuk pekerjaan kantoran, dengan contoh nyata."),
    b("Discussion Class (토론 수업)", 10000, "korea",
      "나무생각 2022. Intermediate. Melatih diskusi, berpikir logis, dan kosakata opini."),
    b("올쏘의 입사 영어 (Natural English for Koreans)", 10000, "korea",
      "Booksgo 2022. Ekspresi Inggris natural ala native untuk learner Korea."),
    b("Idol English User Manual (아이돌 영어 사용설명서)", 10000, "korea",
      "더디퍼런스 2024. English percakapan nyata & situasi audition ala idol."),
    b("MBTI의 모든 것 + 우리들의 MBTI Bundle", 29000, "korea",
      "Tipe kepribadian, relasi teman & keluarga, tipe belajar. 4 seri Our MBTI.", satuan=10000),
    b("The Minimum Law You Need to Protect Yourself", 10000, "korea",
      "자음과모음 2022. Pengetahuan hukum dasar sehari-hari untuk remaja, bahasa sederhana."),
    b("Korean for Humanities Students (전공 한국어 인문)", 10000, "korea",
      "다락원 2019. Bahasa Korea akademik untuk mahasiswa rumpun humaniora."),
    b("Korean for Business Administration Students (전공 한국어 경영)", 10000, "korea", "Bisnis",
      "Darakwon 2019. Memahami kuliah bisnis berbahasa Korea: terminologi, reading, presentasi."),
    b("Perfect Fit: Essential Korean Conversations", 10000, "korea",
      "에스디에듀 2022. Percakapan praktis: transportasi, bank, rumah sakit, belanja. Beginner-intermediate."),
    b("365 Daily Positive Readings for Children", 10000, "korea",
      "책이있는풍경 2014. Satu bacaan positif pendek per hari, Korea-Inggris."),
    b("재무제표 모르면 주식투자 절대로 하지마라", 18000, "korea", "Bisnis",
      "VegaBooks 2020. Komik keuangan: cara baca laporan keuangan sebelum investasi saham.", satuan=10000),
    b("Economics Lecture in Comics (만화 경제학 강의)", 10000, "korea",
      "길벗 2021. Konsep ekonomi dasar lewat komik: supply-demand, inflasi, kapitalisme."),
    b("하루 한줄 꿈 명언 365", 10000, "korea",
      "문예춘추사 2020. 365 quotes motivasi Korea-Inggris, satu per hari."),
    b("Yonsei Korean (새 연세 한국어)", 35000, "korea",
      "Yonsei University 2020. Vocab & Grammar, Listening & Reading, Speaking & Writing per level/semester (level 2, 4, 5 unavailable).", satuan=10000),
    b("쓱싹 초등 사자성어 (Korean Idioms)", 10000, "korea",
      "Saikel 2022. Full Korean. Belajar sajaseongeo lewat konteks komik — untuk level intermediate."),
    b("쓱싹 초등 속담 (Korean Proverbs)", 10000, "korea",
      "Saikel 2022. Peribahasa Korea (sokdam) bergaya komik — bacaan suplemen intermediate, membantu TOPIK II."),
    b("Korea: The Impossible Country", 10000, "korea",
      "Tuttle 2012. Bagaimana Korsel bertransformasi jadi kekuatan ekonomi & budaya global — di luar K-pop."),
    b("Advanced Korean (Routledge)", 10000, "korea",
      "2021. Untuk upper-intermediate sampai advanced & kandidat TOPIK II."),
    b("KIIP Korean Language & Culture Textbook", 30000, "korea",
      "NIIED 2020. Level 0, 1AB-2AB. Untuk residen asing, pekerja, dan marriage migrants di Korea.", satuan=10000),
    b("Korean Grammar In Use (KGIU)", 20000, "korea",
      "Darakwon. Beginner-Advanced. Referensi grammar utama yang logis & sistematis.", featured=True, satuan=10000),
    b("Build & Extend Your Korean Sentences (TTMIK)", 10000, "korea",
      "Upper beginner-intermediate. Bangun kalimat Korea lebih panjang & natural."),
    b("TTMIK Speaking Series Bundle", 18000, "korea",
      "Real-Life Conversations (Beginner & Intermediate), 1100 Phrases, Phrasebook for Travelers, Survival Korean, Fan Letter Recipes, dan lainnya. Audio MP3 di web TTMIK.", satuan=10000),
    b("Let's Learn Hangul 0-6", 5000, "korea", "Serba 5rb"),
    b("TOPIK I Master Final 실전 모의고사 (English ver.)", 5000, "korea", "Serba 5rb", "Darakwon 2023, 3rd Edition."),
    b("TOPIK II Master Final 실전 모의고사 (English ver.)", 5000, "korea", "Serba 5rb", "Darakwon 2023, 3rd Edition."),
    b("TOPIK Speaking Master (말하기 표현 Master)", 5000, "korea", "Serba 5rb",
      "에스디에듀 2023. Panduan speaking, sample questions, answer key, strategi."),
    b("TOPIK I & II Reading Strategy Master (읽기 전략)", 5000, "korea", "Serba 5rb",
      "에스디에듀 2023. Sample reading questions + strategi & pembahasan."),
    b("Complete Guide to the TOPIK Speaking", 5000, "korea", "Serba 5rb",
      "Darakwon 2023. Tipe soal, strategi, full mock test, audio CD. TOPIK I & II."),
    # ===== JAPAN CORNER =====
    b("Japanese N5-N1 (The Japan Times)", 30000, "jepang", featured=True, satuan=10000),
    b("JLPT N5-N1 Bundle", 20000, "jepang", "Tidak termasuk seri The Japan Times."),
    b("15 Minutes Japanese (Dorling Kindersley)", 8000, "jepang"),
    b("JLPT N5 - Finish in One Book (Pengantar Korea)", 8000, "jepang",
      "Darakwon 2022. Persiapan JLPT N5 lengkap: vocab, grammar, kanji, listening, mock test."),
    b("Nihongo Raku Raku (Bahasa Jepang untuk SMK)", 8000, "jepang",
      "Japan Foundation 2020. Buku ajar dasar untuk pengajar & murid SMK/LPK."),
    b("Be More Japan (DK Eyewitness)", 8000, "jepang",
      "2019. Panduan budaya Jepang: keseharian, etiket, pop culture, work culture."),
    b("Irodori - Japanese for Life in Japan", 8000, "jepang",
      "Japan Foundation 2020 (A1-A2). Bahasa Jepang untuk survive sehari-hari di Jepang."),
    b("All About History: History of Japan", 8000, "jepang",
      "Future Publishing 2023. Dari mitologi kuno, era samurai, hingga Jepang modern."),
    b("Japanese Reading Comprehension for Beginners (読解120)", 8000, "jepang",
      "Ask Publishing 2020. 120 bacaan pendek (email, memo, esai) + audio, 10 menit per hari."),
    b("Speed Master Vocabulary Intermediate 2500 (JLPT N2)", 5000, "jepang", "Serba 5rb",
      "J Research Publishing. Terjemahan Inggris, Mandarin, Korea."),
    b("Speed Master N4 & N5 Vocabulary (Basic 1800)", 5000, "jepang", "Serba 5rb",
      "50 unit tematik + tabel konjugasi. Terjemahan Inggris, Mandarin, Korea."),
    b("Image de Wakaru! Nihongo no Joshi (Partikel)", 5000, "jepang", "Serba 5rb",
      "Level N5-N4. Perbandingan partikel yang mirip (に vs で) + latihan & kunci."),
    b("Manabou! Nihongo Vol. 1-4 (学ぼう! にほんご)", 5000, "jepang", "Serba 5rb", "Shokyu 1-2, Shochukyu, Chukyu."),
    b("JLPT Official Practice Workbook Vol.2 (N5-N1)", 5000, "jepang", "Serba 5rb"),
    # ===== BAHASA INGGRIS =====
    b("Otodidak Jago Bahasa Inggris dari 0", 10000, "inggris"),
    b("Speakout English BBC", 10000, "inggris"),
    b("Oxford English Grammar Course Basic", 10000, "inggris"),
    b("Collins English for Business", 10000, "inggris", "Bisnis"),
    b("Bahasa Inggris Sistem 52M", 18000, "inggris", satuan=10000),
    b("IELTS Bundle", 18000, "inggris", featured=True),
    b("Practice Makes Perfect: English Conversation", 10000, "inggris"),
    b("Spoken English Conversation Practice", 10000, "inggris"),
    b("English as Second Language: Coursebook + Audio + Workbook + Teacher Book", 30000, "inggris", satuan=12000),
    b("IELTS 21 (2026) + Audio", 15000, "inggris"),
    # ===== BUKU FISIK =====
    f("Buku FISIK New HSK 3.0 — Textbook HSK 1 (A4 Full Color)", 87000, 0, "Full Color", "Edisi cetak A4 full color. Dikirim via JNE atau CO via Shopee."),
    f("Buku FISIK New HSK 3.0 — Textbook HSK 2 (A4 Full Color)", 89000, 1, "Full Color", "Edisi cetak A4 full color. Dikirim via JNE atau CO via Shopee."),
    f("Buku FISIK New HSK 3.0 — Textbook HSK 3 (A4 Full Color)", 89000, 2, "Full Color", "Edisi cetak A4 full color. Dikirim via JNE atau CO via Shopee."),
    f("Buku FISIK New HSK 3.0 — Workbook HSK 1 (A4 Full Color)", 87000, 3, "Full Color", "Edisi cetak A4 full color. Dikirim via JNE atau CO via Shopee."),
    f("Buku FISIK New HSK 3.0 — Workbook HSK 2 (A4 Full Color)", 89000, 0, "Full Color", "Edisi cetak A4 full color. Dikirim via JNE atau CO via Shopee."),
    f("Buku FISIK New HSK 3.0 — Workbook HSK 3 (A4 Full Color)", 89000, 1, "Full Color", "Edisi cetak A4 full color. Dikirim via JNE atau CO via Shopee."),
    f("Buku FISIK A Contemporary Course Chinese (Taiwan) Uk B5", 0, 2, "Tanya Admin",
      "Harga via admin/Shopee. Dikirim via JNE atau CO via Shopee.", shopee="https://s.shopee.co.id/8V7usaJfCD"),
    f("Buku FISIK Cambridge Mandarin as Second Language", 105000, 3, "", "Dikirim via JNE atau CO via Shopee.", shopee="https://id.shp.ee/GDs18AwG"),
]


async def main():
    await db.books.delete_many({})
    await db.books.insert_many([x.model_dump() for x in BOOKS])
    await db.payment_methods.update_one({"name": "QRIS"}, {"$set": {"qr_image": "/qris-lamimi.png", "account_name": "Scan barcode QRIS di bawah"}})
    print("imported:", await db.books.count_documents({}), "books")
    for lang in ["mandarin", "korea", "jepang", "inggris"]:
        print(lang, await db.books.count_documents({"language": lang, "type": "digital"}))
    print("fisik:", await db.books.count_documents({"type": "fisik"}))
    qris = await db.payment_methods.find_one({"name": "QRIS"})
    print("qris image:", qris.get("qr_image"))


if __name__ == "__main__":
    asyncio.run(main())
