# Hazırlıq Ödəniş Sistemi

Bu versiyada local-first + Supabase timestamp merge fix əlavə edildi.

## Əsas fix

- Data əvvəl cihazda saxlanır.
- Supabase arxada sync edir.
- Refresh zamanı köhnə cloud data yeni local datanı silmir.
- Hər dəyişiklik `__updatedAt` timestamp ilə saxlanılır.
- App açılarkən local və cloud timestamp müqayisə olunur.
- Daha yeni olan data qalır.
- Local daha yenidirsə, cloud avtomatik yenilənir.

## Fayllar

- `index.html`
- `style.css`
- `app.js`
- `supabase-config.js`
- `README.md`

## Deploy

Bu faylları GitHub repo-da köhnə faylların üstünə upload edin. Vercel avtomatik redeploy edəcək.
