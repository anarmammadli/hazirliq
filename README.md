# Hazirliq Anar v9 - Session/Alt-Tab Fix

Bu versiyada əsas düzəliş Supabase session/save problemidir.

Dəyişikliklər:
- Alt+Tab və ya başqa browser tabından geri qayıdanda session yenidən yoxlanır.
- Save zamanı köhnə cached user istifadə edilmir; hər save-dən əvvəl Supabase-dən fresh user yoxlanır.
- Token refresh event-i artıq bütün datanı yenidən yükləyib save prosesini qarışdırmır.
- Save əməliyyatları queue ilə ardıcıl işləyir, eyni anda iki save race condition yaratmır.
- Cloud aktiv statusu kiçik read testindən sonra göstərilir.

Deploy:
1. Bu ZIP-i extract edin.
2. GitHub repo-da bu faylları köhnələrin üstünə upload edin:
   - index.html
   - style.css
   - app.js
   - supabase-config.js
   - README.md
3. Vercel redeploy olacaq.
4. Saytda çıxış edin və yenidən login olun.
