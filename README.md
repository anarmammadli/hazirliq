# Hazırlıq Anar v10

Bu versiyada Alt+Tab / tab dəyişəndən sonra yaranan save problemi üçün daha sadə və stabil fix tətbiq edildi.

## Dəyişikliklər

- Tab-a qayıdanda artıq avtomatik save edilmir.
- Tab-a qayıdanda yalnız session yüngül yoxlanılır.
- `Cloud gözləyir` ilişməsi aradan qaldırıldı.
- Save queue çıxarıldı və sadə `saveInProgress` qoruması əlavə edildi.
- Save əməliyyatı timeout ilə işləyir, sonsuz gözləmir.
- Save alınmasa data lokal backup-da saxlanır.
- Növbəti save zamanı yenidən Supabase-ə yazmağa çalışır.

## Deploy

GitHub repo-da bu faylları upload edin:

- index.html
- style.css
- app.js
- supabase-config.js
- README.md

Sonra Vercel redeploy olacaq.
