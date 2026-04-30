# Hazırlıq Ödəniş Sistemi — Supabase Cloud Version

Bu versiyada məlumatlar browser `localStorage`-da yox, **Supabase cloud database**-də saxlanılır.

## Nə var?

- Email + password login
- Qruplar, şagirdlər, ödənişlər və cədvəl cloud-da saxlanılır
- Eyni hesabla başqa cihazdan girəndə məlumatlar görünür
- `supabase-config.js` əlavə edilib
- `supabase.sql` əlavə edilib

## Supabase qurulumu

### 1. Project yarat

1. Supabase dashboard-a gir.
2. **New project** yarat.
3. Project adı yaz: `hazirliq-system`.
4. Region seç.
5. Project hazır olanda davam et.

### 2. Table və rules yarat

1. Supabase-də **SQL Editor** aç.
2. Bu ZIP içindəki `supabase.sql` faylını aç.
3. İçindəki SQL kodu SQL Editor-a yapışdır.
4. **Run** bas.

Bu bir table yaradır:

```text
user_states
- user_id
- data
- created_at
- updated_at
```

Hər istifadəçi yalnız öz datasını görə və dəyişə bilir.

### 3. Email login aktiv et

1. **Authentication** → **Providers** bölməsinə gir.
2. **Email** provider aktiv olsun.
3. Rahat test üçün **Confirm email** söndürə bilərsən.

Confirm email aktiv qalsa, hesab yaradandan sonra email təsdiqlənməlidir.

### 4. Config-i yaz

Supabase-də:

1. **Project Settings** → **API** bölməsinə gir.
2. `Project URL` götür.
3. `anon public` key götür.
4. `supabase-config.js` faylını aç.
5. Placeholder-ləri dəyiş:

```js
window.HAZIRLIQ_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_ANON_PUBLIC_KEY"
};
```

### 5. Test

1. `index.html` aç.
2. Email və şifrə yaz.
3. **Hesab yarat** bas.
4. Login ol.
5. Qrup, şagird və ödəniş əlavə et.
6. Refresh et — məlumat qalmalıdır.

## Deploy

Vercel-ə bu faylları upload et:

- `index.html`
- `style.css`
- `app.js`
- `supabase-config.js`
- `supabase.sql`
- `README.md`

## Qeyd

Supabase Free project istifadə olunmasa pause ola bilər. Məlumatlar adətən silinmir, sadəcə dashboard-dan project-i resume etmək lazımdır.
