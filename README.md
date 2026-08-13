# Dota Live HUD — نسخه‌ی Cloudflare Workers

این نسخه به‌جای سرور Node/Express محلی، از **Cloudflare Workers + Durable Objects**
استفاده می‌کنه. کل اجرا و بیلد روی سرورهای Cloudflare انجام می‌شه، پس نیازی به
نصب Node.js یا هیچ ابزار CLI روی سیستم خودتون نیست — کل کار از توی مرورگر
انجام می‌شه.

## چی عوض شده نسبت به نسخه‌ی قبلی؟

- `server/server.js` (Express + ws) حذف شد و به‌جاش `src/worker.js` اومد که
  روی Cloudflare Workers اجرا می‌شه.
- به‌جای یک متغیر ساده تو حافظه‌ی پروسس Node، یک **Durable Object** (کلاس
  `GameStateHub`) آخرین وضعیت بازی و لیست کلاینت‌های وصل‌شده رو نگه می‌داره.
- فایل‌های `public/` (داشبورد HTML/CSS/JS) دقیقاً همون‌هایی هستن که بودن — هیچ
  تغییری لازم نداشتن، چون از قبل با `wss://` و مسیر نسبی کار می‌کردن.
- مسیرهای API یکسان موندن: `POST /gsi`، `GET /state`، `GET /ws`.

## مرحله ۱: آپلود پروژه توی یک ریپوی گیت‌هاب (بدون نیاز به Git)

۱. برید به [github.com/new](https://github.com/new) و یک ریپوی جدید بسازید
   (مثلاً `dota-live-hud`).
۲. توی صفحه‌ی ریپو، روی **"uploading an existing file"** کلیک کنید.
۳. کل محتوای این پوشه (`wrangler.jsonc`, `package.json`, `src/`, `public/`,
   `gamestate_integration_dotalivehud.cfg`, همین `README.md`) رو با drag & drop
   آپلود و کامیت کنید.

اینجا هیچ نصبی لازم نیست — همه‌چیز از توی مرورگر گیت‌هاب انجام می‌شه.

## مرحله ۲: وصل کردن ریپو به Cloudflare Workers

۱. وارد [dash.cloudflare.com](https://dash.cloudflare.com) بشید (اکانت رایگان
   کافیه).
۲. از منو: **Workers & Pages → Create → Import an existing Git repository**.
۳. گیت‌هاب رو وصل کنید و ریپوی `dota-live-hud` رو انتخاب کنید.
۴. Cloudflare خودش فایل `wrangler.jsonc` رو تشخیص می‌ده و تنظیمات بیلد رو خودکار
   پر می‌کنه (build command لازم نیست چیزی بزنید بمونه خالی/پیش‌فرض).
۵. روی **Deploy** بزنید. بیلد و دیپلوی کاملاً روی سرورهای Cloudflare انجام
   می‌شه، نه روی سیستم شما.

بعد از دیپلوی، یک آدرس مثل این می‌گیرید:
```
https://dota-live-hud.<your-subdomain>.workers.dev
```

از این به بعد، با هر بار آپلود/کامیت جدید توی گیت‌هاب، Cloudflare خودکار
دوباره دیپلوی می‌کنه (Workers Builds).

## مرحله ۳: وصل کردن به Dota 2

۱. فایل `gamestate_integration_dotalivehud.cfg` رو باز کنید و خط `uri` رو با
   آدرس واقعی خودتون جایگزین کنید:
   ```
   "uri"   "https://dota-live-hud.<your-subdomain>.workers.dev/gsi"
   ```
۲. این فایل رو کپی کنید به:

   **ویندوز:**
   ```
   <مسیر نصب استیم>\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\
   ```
   اگه پوشه‌ی `gamestate_integration` وجود نداشت، خودتون بسازیدش.

۳. توی Steam روی Dota 2 راست‌کلیک → Properties → Launch Options، و این رو
   اضافه کنید:
   ```
   -gamestateintegration
   ```

۴. یک بازی شروع کنید و مرورگر رو باز کنید روی:
   ```
   https://dota-live-hud.<your-subdomain>.workers.dev
   ```
   داده‌ها به‌محض شروع بازی زنده نمایش داده می‌شن — چون سرور رو کلود2 مستقیم
   به آدرس عمومی POST می‌فرسته، نیازی به لوکال یا هم‌شبکه بودن هم نیست؛ از هر
   جایی می‌تونید داشبورد رو باز کنید.

## محدودیت GSI (مثل قبل)

GSI موقعیت روی نقشه (پوزیشن هیرو/وارد/رون) رو نمی‌ده — این محدودیت عمدی
والوئه، نه محدودیت این پروژه. تایمر رون‌ها بر اساس زمان بازی محاسبه می‌شه، نه
موقعیت واقعی.

## توسعه/تست لوکال (اختیاری)

اگه بعداً خواستید روی سیستم خودتون هم تست کنید، تنها اونجا به Node نیاز
دارید (`npx wrangler dev`) — ولی برای استفاده‌ی عادی و دیپلوی نهایی هیچ‌وقت
لازم نیست.

## ساختار پروژه

```
dota-live-hud-cloudflare/
├── src/worker.js                           Worker + Durable Object (جایگزین Express/ws)
├── public/                                  همون داشبورد قبلی، بدون تغییر
├── wrangler.jsonc                           تنظیمات Cloudflare (assets + Durable Object)
├── package.json                             فقط برای بیلد ابری Cloudflare
└── gamestate_integration_dotalivehud.cfg    کانفیگی که باید تو Dota 2 کپی بشه
```
