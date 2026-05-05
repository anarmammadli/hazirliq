# Hazirliq Anar v6 Save Fix

Bu versiyada Supabase save problemi üçün fix əlavə olunub.

## Nə dəyişdi
- Save etməzdən əvvəl active Supabase session yenidən yoxlanılır.
- Session bitibsə istifadəçi login ekranına qaytarılır.
- Save alınmasa məlumatlar müvəqqəti local backup-a yazılır.
- Console error daha aydın görünür.
- `supabase_rls_fix.sql` əlavə edildi.

## Əgər yenə "Yaddaşa yazılmadı" çıxsa
1. Supabase → SQL Editor açın.
2. `supabase_rls_fix.sql` faylındakı kodu run edin.
3. Vercel-i redeploy edin.
4. Saytdan çıxış edib yenidən login olun.
