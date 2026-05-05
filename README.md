# Hazırlıq sistemi

Bu versiya local-first məntiqlə işləyir.

## Əsas dəyişiklik

Əlavə/edit/sil əməliyyatları əvvəlcə cihaz yaddaşına yazılır və UI dərhal işləyir. Supabase yalnız arxa planda cloud sync üçün istifadə olunur.

Bu o deməkdir:

- Alt+Tab və ya başqa tabdan qayıdanda əməliyyatlar bloklanmır.
- Supabase session geciksə belə, qrup/şagird/ödəniş əlavə etmək dayanmayacaq.
- Cloud sync fail olsa, məlumat cihazda qalır və sonra yenidən sync etməyə çalışır.

## Fayllar

- index.html
- style.css
- app.js
- supabase-config.js
- README.md

GitHub-a bu 5 faylı upload edin və Vercel redeploy olacaq.
