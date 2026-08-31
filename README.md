# Serdar Bütçe Planı — GitHub + Vercel + Supabase

Bu sürüm SQLite/Flask yerine tarayıcıdan Supabase'e bağlanır. Böylece telefon, iPad, Mac ve Windows aynı veriyi görür.

## 1. Supabase
1. https://supabase.com adresinde yeni proje oluştur.
2. SQL Editor > New query aç.
3. `supabase/schema.sql` içeriğini yapıştırıp **Run**.
4. Project Settings > API bölümünden:
   - Project URL
   - anon / public key
   bilgilerini al.

## 2. Yerelde çalıştırma
1. `.env.example` dosyasını `.env` olarak kopyala.
2. Değerleri kendi Supabase bilgilerinle doldur:
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
3. Terminal:
   npm install
   npm run dev

## 3. GitHub
1. GitHub'da örn. `serdar-butce-plani` repository oluştur.
2. Bu klasörün tamamını yükle.
3. `.env` dosyasını GitHub'a yükleme. `.gitignore` zaten engelliyor.

## 4. Vercel
1. Vercel > Add New > Project.
2. GitHub repository'yi seç.
3. Framework Preset: Vite.
4. Environment Variables'a:
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   ekle.
5. Deploy.

## 5. İlk giriş
- Site açılınca e-posta ve şifre yaz.
- "İlk kez kullanıyorum · Hesap oluştur" ile hesap oluştur.
- Supabase Auth ayarına göre e-posta doğrulaması gerekebilir.
- İlk girişten sonra "Başlangıç verilerini yükle" düğmesi görünür.

## Güvenlik
- Supabase Row Level Security açık.
- Her kullanıcı yalnızca kendi satırlarını görebilir.
- Anon key'in tarayıcıda bulunması normaldir; güvenlik RLS ile sağlanır.
- Service Role key'i ASLA Vercel frontend değişkenlerine koyma.

## Uygulamadaki son istekler
- Kartlarda Dönem İçi / Devreden / Faiz ayrı.
- Ödeme alanları boş gelir.
- Otomatik ödeme önerisi yok.
- "En az faiz" bölümü yok.
- Sayısal inputlarda +/- buton mantığı yok; normal tutar alanı var.
- Nakit avans ayrı borç türü ve ödeme yapıldıkça kalan tutar düşer.

Not: Garanti nakit avansının kesin tutarı bilinmediği için başlangıç seed verisine eklenmedi.
