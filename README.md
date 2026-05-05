# Hazırlıq Ödəniş Sistemi

Multi-teacher Option A versiyası.

## Məntiq
- Supabase Auth istifadə olunmur.
- Hər müəllim `username + kod` ilə daxil olur.
- Hər müəllimin datası `teacher_states` table-da öz `username` row-unda saxlanılır.
- Admin paneldən müəllim yaradıla, yenilənə və silinə bilər.

## Admin kodu
Admin kodu `supabase-config.js` içindədir:

```js
adminPassword: "a0516600094"
```

## Supabase setup
Supabase SQL Editor-də `supabase_option_a_setup.sql` faylındakı kodu run edin.
Bu versiya demo müəllim yaratmır və əvvəlki `demo` müəllimi varsa silir.

## GitHub/Vercel üçün yüklənəcək əsas fayllar
- index.html
- style.css
- app.js
- supabase-config.js
- README.md

## Tarix formatı
Bütün tarixlər Gün/Ay/İl kimi göstərilir və daxil edilir.
Məsələn: `05/05/2025`.
