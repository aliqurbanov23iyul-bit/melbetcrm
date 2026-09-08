# Melbet CRM v4 — Canlı Menejer Operasyon Sistemi

Bu sürüm yalnızca menejer dataları için düzenlenmiştir.

## Ana yenilikler

- Tamamen yeni mor / pembe / turuncu / camgöbeği canlı tema
- Hareketli arka plan ışıkları, kart ve buton efektleri
- Tüm görünür metinler Türkçe
- Menejer ekleme, düzenleme, arşivleme ve kalıcı silme
- Menejer listesini CSV olarak dışa aktarma
- Telegram mesaj butonları
- NDA Takibi sayfası
- NDA filtreleri: Onaylanan / Bekleyen / Onaylanmayan
- NDA durumunu doğrudan NDA ekranından değiştirme
- Takıma menejer ekleme ve takımdan çıkarma
- Takım silme
- Eğitime menejer ekleme ve eğitimden çıkarma
- Eğitim silme
- Katılım / sonuç / eğitmen notu güncelleme
- Menejer profilinde eğitim geçmişi ve not geçmişi
- Süper Yönetici rolü oluşturabilme
- Detaylı ve Türkçe açıklamalı yetki kartları
- Yönetici düzenleme, aktifleştirme, devre dışı bırakma ve silme
- Ana Süper Yönetici `okancoach` korunur
- Eski CRM sürümünde oluşturulmuş yetkiler için geriye dönük uyumluluk

## Vercel Environment Variables

Zorunlu:

- `SUPERADMIN_PASSWORD`
- `SESSION_SECRET`
- `DATABASE_URL`

`DATABASE_URL` Neon bağlantısı üzerinden otomatik gelebilir.

`SESSION_SECRET` en az 32 karakter olmalıdır.

Ana Süper Yönetici kullanıcı adı kodda sabittir:

`okancoach`

## Deploy

Framework Preset: Other

Build Command: boş

Output Directory: boş

Install Command: otomatik

Bu projede `public` klasörü gerekmemektedir.

## Sağlık testi

Deploy sonrası:

`/api/index?action=health`

Yanıtta:

- `"ok": true`
- `"database": true`
- `"superAdmin": "okancoach"`

görülmelidir.
