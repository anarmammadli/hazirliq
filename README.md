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


## v13 Single Admin Supabase Setup

Bu versiyada Supabase Auth istifadə olunmur. Data tək row-da saxlanır: `public.app_states`, `id = main`.

1. Supabase → SQL Editor açın.
2. `supabase_single_admin_setup.sql` faylındakı kodu run edin.
3. GitHub/Vercel-ə bu faylları yükləyin: `index.html`, `style.css`, `app.js`, `supabase-config.js`, `supabase_single_admin_setup.sql`, `README.md`.
4. Login üçün standart admin şifrəsi: `123456`. Dəyişmək üçün `supabase-config.js` içində `adminPassword` dəyərini dəyişin.

Qeyd: Bu static app üçün `app_states` table public read/write olacaq. Bu, session problemlərini tam aradan qaldırır, amma bank-səviyyəli təhlükəsizlik deyil.
