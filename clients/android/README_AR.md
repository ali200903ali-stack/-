# نسخة Android

عميل Android WebView أصلي يتصل بنظام NineSoft على Hostinger عبر HTTPS. لا يحفظ دفتر أستاذ محلياً ولا يحتاج مفاتيح قاعدة بيانات على الهاتف.

## بناء APK
- استخدم Android Studio مع Java 17، Android SDK 35، وGradle 8.13.
- افتح clients/android كمشروع Gradle، ثم نفذ gradle assembleDebug أو من Android Studio Build APK.
- أو شغّل GitHub Actions: workflow Android APK، ثم نزّل الـArtifact بعد نجاح البناء.
- بعد تثبيت التطبيق: أدخل رابط الخادم https://... مرة واحدة ثم سجّل الدخول.
- assembleDebug ينتج APK تجريبياً موقّعاً بمفتاح Debug. التوزيع الرسمي يتطلب مفتاح إصدار خاص بك وتهيئة signingConfigs.

**نطاق الإصدار:** يحتاج شبكة؛ لا يوجد وضع offline أو مزامنة محلية. يمنع التطبيق الالتفاف على أخطاء شهادات HTTPS.
