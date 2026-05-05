# Hazırlıq sistemi — Option A multi-teacher

Bu versiyada Supabase Auth istifadə olunmur. Hər müəllim üçün ayrıca `teacher_states` row yaradılır.

## Necə işləyir

- Admin müəllim yaradır.
- Müəllimə `username` və `kod` verilir.
- Müəllim həmin məlumatlarla login olur.
- Hər müəllim yalnız öz row-dakı datası ilə işləyir.
- Session problemi yoxdur, çünki Supabase Auth yoxdur.

## Supabase setup

1. Supabase → SQL Editor aç.
2. `supabase_option_a_setup.sql` faylındakı kodu paste et.
3. `Run without RLS` seç və run et.

Bu table yaradacaq:

```text
teacher_states
- username
- name
- code
- data
- created_at
- updated_at
```

## Admin panel

Sayta girəndə login ekranında `Admin` tabına keç.

Standart admin şifrəsi:

```text
123456
```

Şifrəni dəyişmək üçün `supabase-config.js` içində bunu dəyiş:

```js
adminPassword: "123456"
```

Admin paneldən müəllim yarat:

```text
Müəllim adı: Aytən müəllimə
Username: ayten
Kod: 123456
```

Sonra müəllim `Müəllim` tabından bu məlumatlarla daxil olur.

## GitHub/Vercel üçün upload ediləcək fayllar

```text
index.html
style.css
app.js
supabase-config.js
README.md
```

SQL faylını GitHub-a yükləməyə məcbur deyilsən; yalnız Supabase-də run etmək üçündür.

## Vacib qeyd

Option A çox stabil və sadədir, amma bank səviyyəli security deyil. Bu sistem tanıdığın 10-15 müəllim üçün praktikdir. Daha ciddi security üçün Supabase Auth + server/Edge Function lazımdır.
