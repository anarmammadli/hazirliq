# Hazırlıq Sistemi

Bu versiyada Alt+Tab / başqa tabdan geri qayıdanda yaranan Supabase save problemi üçün session refresh fix əlavə edildi.

## Dəyişikliklər

- Sayt yenidən aktiv olanda Supabase session avtomatik yoxlanır.
- Session köhnəlibsə refresh edilir.
- Save alınmasa məlumat müvəqqəti local backup-da saxlanır.
- İnternet və ya session düzələndə app yenidən save etməyə çalışır.
- RLS policy fix SQL faylı saxlanılıb: `supabase_rls_fix.sql`.

## Deploy

GitHub-a bu faylları upload edin:

- `index.html`
- `style.css`
- `app.js`
- `supabase-config.js`
- `README.md`

Vercel avtomatik redeploy edəcək.
