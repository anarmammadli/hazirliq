# Hazırlıq sistemi

Bu versiyada session/save problemi düzəldildi.

## v8 düzəlişi

- Alt-tab və tab dəyişəndən sonra app artıq hər klikdə session refresh etməyə çalışmır.
- `Session yoxlanılır...` statusunda ilişib qalma problemi aradan qaldırıldı.
- Save etməzdən əvvəl session yüngül şəkildə yoxlanılır.
- Supabase cavab verməyəndə əməliyyat sonsuz gözləmir, timeout verir.
- Save alınmasa məlumat müvəqqəti backup-da qalır və sonra yenidən cəhd edilir.

## Fayllar

- index.html
- style.css
- app.js
- supabase-config.js
