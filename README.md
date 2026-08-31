# Serdar’ın Bütçe Planı — Supabase sürümü

Bu proje, son hazırlanan bütçe uygulamasının görünümünü ve hesaplama kurallarını korur. Tek farkı, verileri yalnızca tarayıcıda değil Supabase veritabanında saklamasıdır. Böylece aynı hesapla telefon ve bilgisayarda aynı bütçe açılır.

## Özellikler

- Garanti ve DenizBank ekstrelerini kesim/ödeme tarihlerine göre hesaplama
- Dönem içi, devreden, faiz ve toplam kart borcunu ayrı gösterme
- Nakit, Garanti KK ve DenizBank KK ile harcama girişi
- Aylık tekrarlanan taksit mantığı
- Kategori grafikleri ve harcama ayrıntıları
- Gelir, sabit gider, nakit avans ve gerçekleşen ödeme takibi
- Supabase üzerinde kullanıcıya özel ve RLS ile korunan veri
- Değişikliklerden sonra otomatik bulut kaydı
- Bulutta kayıt yoksa aynı alan adındaki eski `localStorage` verisini ilk açılışta devralma

## 1. Supabase veritabanını hazırlama

1. Supabase projenizi açın.
2. **SQL Editor → New query** bölümüne girin.
3. [`supabase/schema.sql`](supabase/schema.sql) dosyasının tamamını yapıştırıp **Run** düğmesine basın.
4. **Authentication → Providers → Email** bölümünde e-posta ile girişin açık olduğunu kontrol edin.
5. Onay e-postası kullanmak istemiyorsanız **Confirm email** seçeneğini kapatın.

SQL dosyası her kullanıcıya yalnızca kendi bütçe kaydını okuma ve değiştirme izni verir. Uygulamada `service_role` anahtarı kullanılmaz.

## 2. Ortam değişkenleri

`.env.example` dosyasını `.env.local` adıyla kopyalayın ve Supabase değerlerinizi ekleyin:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJE_KODUNUZ.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxx
```

Publishable key’i `sb_publishable_` kısmıyla birlikte eksiksiz yapıştırın.

## 3. Bilgisayarda çalıştırma

```bash
npm install
npm run dev
```

Ardından `http://localhost:3000` adresini açın.

## 4. Vercel’e yayınlama

1. Bu klasörü GitHub’daki boş projenize yükleyin.
2. Vercel’de **Add New → Project** ile GitHub projesini seçin.
3. **Environment Variables** bölümüne şu iki değeri ekleyin:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy** düğmesine basın.
5. Supabase’de **Authentication → URL Configuration** bölümünde Vercel adresinizi **Site URL** olarak yazın.

## Veri saklama mantığı

Uygulamanın bütün bütçe durumu `public.budget_profiles` tablosundaki tek bir JSONB kaydında tutulur. Kayıt anahtarı giriş yapan kullanıcının Supabase kullanıcı kimliğidir. Değişiklikler 650 ms bekleme sonrasında tek seferde kaydedilir; art arda hızlı girişler gereksiz veritabanı isteği oluşturmaz.

## Önemli

- `.env.local` dosyasını GitHub’a yüklemeyin.
- Supabase `service_role` secret key’ini kesinlikle tarayıcı uygulamasına veya Vercel’de `NEXT_PUBLIC_` isimli bir değişkene koymayın.
- Yeni bir alan adında açılan uygulama, eski sitenin tarayıcı verisine tarayıcı güvenliği nedeniyle doğrudan erişemez. Eski verilerin aktarılması gerekiyorsa mevcut siteden dışa aktarma ve bu projede içe aktarma adımı eklenebilir.
